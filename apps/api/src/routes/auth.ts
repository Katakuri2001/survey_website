import { Hono } from 'hono';
import type { AppContext, Ctx } from '../types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import {
  authMiddleware,
  createToken,
  hashPassword,
  isLegacyHash,
  resolveJwtSecret,
  unusablePasswordMarker,
  verifyPassword,
} from '../lib/auth';
import { enforceRateLimit, RATE_POLICIES, verifyTurnstile } from '../lib/security';
import { getAgeGroup } from '../lib/survey';
import { generateId } from '../lib/ids';
import { readJson, guestSchema, loginSchema, registerSchema, profileUpdateSchema } from '../lib/validation';
import { logAudit } from '../lib/audit';

export const authRoutes = new Hono<AppContext>();

// ============================================================
// Register
// ============================================================

authRoutes.post('/auth/register', async (c) => {
  const limited = await enforceRateLimit(c, 'register', c.get('clientIp') || 'unknown', {
    limit: 10,
    windowSeconds: 60,
  });
  if (limited) return limited;

  const parsed = await readJson(c, registerSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const secret = resolveJwtSecret(c.env);
  if (!secret) return failure(c, ErrorCode.INTERNAL, 'Server authentication is not configured');

  if (body.age !== undefined && body.age < 18) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'Must be at least 18 years old');
  }

  const db = c.env.survey_db;
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(body.email).first();
  if (existing) return failure(c, 'EMAIL_EXISTS', 'Email already registered', 409);

  if (body.phone) {
    const phoneExists = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(body.phone).first();
    if (phoneExists) return failure(c, 'PHONE_EXISTS', 'Phone number already registered', 409);
  }

  const id = generateId();
  const passwordHash = await hashPassword(body.password);
  const ageGroup = body.age ? getAgeGroup(body.age) : null;

  try {
    await db
      .prepare(
        `INSERT INTO users (id, full_name, email, phone, password_hash, age, age_group, gender, city, township, nrc_state, nrc_type, nrc_number, occupation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        body.fullName,
        body.email,
        body.phone || null,
        passwordHash,
        body.age ?? null,
        ageGroup,
        body.gender || null,
        body.city || null,
        body.township || null,
        body.nrcState || null,
        body.nrcType || null,
        body.nrcNumber || null,
        body.occupation || null
      )
      .run();
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) {
      return failure(c, 'EMAIL_EXISTS', 'Email or phone already registered', 409);
    }
    logEvent('error', 'register_failed', { error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Registration failed');
  }

  const token = await createToken(id, 'user', secret);
  return success(c, { userId: id, token, user: { id, fullName: body.fullName, email: body.email } });
});

// ============================================================
// Login (user + admin)
// ============================================================

async function handleLogin(c: Ctx, requireAdmin: boolean) {
  const limited = await enforceRateLimit(
    c,
    requireAdmin ? 'admin-login' : 'login',
    c.get('clientIp') || 'unknown',
    RATE_POLICIES.login
  );
  if (limited) return limited;

  const parsed = await readJson(c, loginSchema);
  if (!parsed.ok) return parsed.response;

  const secret = resolveJwtSecret(c.env);
  if (!secret) return failure(c, ErrorCode.INTERNAL, 'Server authentication is not configured');

  const db = c.env.survey_db;
  const user = await db
    .prepare(
      'SELECT id, full_name, email, phone, password_hash, is_active, is_admin FROM users WHERE email = ? AND is_admin = ?'
    )
    .bind(parsed.data.email, requireAdmin ? 1 : 0)
    .first<{
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      password_hash: string | null;
      is_active: number;
      is_admin: number;
    }>();

  // Always perform a hash comparison to keep the failure timing uniform.
  const check = await verifyPassword(parsed.data.password, user?.password_hash ?? null);
  if (!user || !check.ok) {
    return failure(c, ErrorCode.UNAUTHORIZED, 'Invalid credentials', 401);
  }

  if (!user.is_active) {
    return failure(c, ErrorCode.FORBIDDEN, requireAdmin ? 'Not authorized as admin' : 'Account is disabled', 403);
  }
  if (requireAdmin && !user.is_admin) {
    return failure(c, ErrorCode.FORBIDDEN, 'Not authorized as admin', 403);
  }

  // Transparent upgrade of legacy unsalted SHA-256 hashes on successful login.
  if (check.needsRehash || isLegacyHash(user.password_hash)) {
    try {
      const upgraded = await hashPassword(parsed.data.password);
      await db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(upgraded, user.id).run();
    } catch (error) {
      logEvent('warn', 'password_rehash_failed', { userId: user.id, error: String(error) });
    }
  }

  const token = await createToken(user.id, requireAdmin ? 'admin' : 'user', secret);

  if (requireAdmin) {
    await logAudit(c, 'LOGIN', 'auth', user.id, { email: user.email });
  }

  return success(c, {
    userId: user.id,
    token,
    user: { id: user.id, fullName: user.full_name, email: user.email },
  });
}

authRoutes.post('/auth/login', (c) => handleLogin(c, false));
authRoutes.post('/auth/admin/login', (c) => handleLogin(c, true));

// ============================================================
// Guest user (personal-information form)
// ============================================================

authRoutes.post('/users/guest', async (c) => {
  const limited = await enforceRateLimit(c, 'guest', c.get('clientIp') || 'unknown', RATE_POLICIES.guest);
  if (limited) return limited;

  const raw = await c.req.json().catch(() => null);
  const turnstile = await verifyTurnstile(c, (raw as { turnstileToken?: string } | null)?.turnstileToken, 'guest');
  if (turnstile) return turnstile;

  const parsed = await readJson(c, guestSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const secret = resolveJwtSecret(c.env);
  if (!secret) return failure(c, ErrorCode.INTERNAL, 'Server authentication is not configured');

  const dobDate = new Date(`${body.dob}T00:00:00Z`);
  if (Number.isNaN(dobDate.getTime())) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'Invalid date of birth');
  }
  const age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) return failure(c, ErrorCode.INVALID_REQUEST, 'Must be at least 18 years old');
  const ageGroup = getAgeGroup(age);

  const db = c.env.survey_db;
  const existing = await db
    .prepare('SELECT id FROM users WHERE phone = ?')
    .bind(body.phone)
    .first<{ id: string }>();

  let userId: string;
  if (existing) {
    userId = existing.id;
    const result = await db
      .prepare(
        `UPDATE users SET full_name = ?, age = ?, age_group = ?, dob = ?, nrc_state = ?, nrc_type = ?, nrc_number = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(body.fullName, age, ageGroup, body.dob, body.stateCode || null, body.nrcType || null, body.nrcNumber || null, userId)
      .run();
    if (result.error) {
      logEvent('error', 'guest_update_failed', { error: String(result.error) });
      return failure(c, ErrorCode.INTERNAL, 'Failed to update user');
    }
  } else {
    userId = generateId();
    try {
      await db
        .prepare(
          `INSERT INTO users (id, full_name, phone, password_hash, age, age_group, dob, nrc_state, nrc_type, nrc_number, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .bind(
          userId,
          body.fullName,
          body.phone,
          unusablePasswordMarker(),
          age,
          ageGroup,
          body.dob,
          body.stateCode || null,
          body.nrcType || null,
          body.nrcNumber || null
        )
        .run();
    } catch (error) {
      if (!isUniqueViolation(error)) {
        logEvent('error', 'guest_insert_failed', { error: String(error) });
        return failure(c, ErrorCode.INTERNAL, 'Failed to create user');
      }
      // A concurrent request with the same phone won the insert race. Adopt the
      // row it created (and refresh the profile) so the response is idempotent
      // instead of surfacing a UNIQUE violation as a 500.
      const raced = await db
        .prepare('SELECT id FROM users WHERE phone = ?')
        .bind(body.phone)
        .first<{ id: string }>();
      if (!raced) {
        logEvent('error', 'guest_insert_race_unresolved', { error: String(error) });
        return failure(c, ErrorCode.INTERNAL, 'Failed to create user');
      }
      userId = raced.id;
      await db
        .prepare(
          `UPDATE users SET full_name = ?, age = ?, age_group = ?, dob = ?, nrc_state = ?, nrc_type = ?, nrc_number = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(body.fullName, age, ageGroup, body.dob, body.stateCode || null, body.nrcType || null, body.nrcNumber || null, userId)
        .run();
    }
  }

  const token = await createToken(userId, 'user', secret);
  return success(c, { userId, token, user: { id: userId, fullName: body.fullName, phone: body.phone } });
});

// ============================================================
// Current user profile
// ============================================================

const PROFILE_COLUMNS =
  'id, full_name, email, phone, age, age_group, gender, city, township, nrc_state, nrc_township, nrc_type, nrc_number, occupation, created_at';

authRoutes.get('/user/profile', authMiddleware, async (c) => {
  const user = await c.env.survey_db
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`)
    .bind(c.get('userId'))
    .first();
  if (!user) return failure(c, ErrorCode.NOT_FOUND, 'User not found');
  return success(c, user);
});

authRoutes.patch('/user/profile', authMiddleware, async (c) => {
  const parsed = await readJson(c, profileUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const limited = await enforceRateLimit(c, 'profile', c.get('userId'), { limit: 30, windowSeconds: 60 });
  if (limited) return limited;

  const ageGroup = body.age ? getAgeGroup(body.age) : null;

  // Note: is_admin / is_active are deliberately not writable here.
  await c.env.survey_db
    .prepare(
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        phone = COALESCE(?, phone),
        age = COALESCE(?, age),
        age_group = COALESCE(?, age_group),
        gender = COALESCE(?, gender),
        city = COALESCE(?, city),
        township = COALESCE(?, township),
        nrc_state = COALESCE(?, nrc_state),
        nrc_township = COALESCE(?, nrc_township),
        nrc_type = COALESCE(?, nrc_type),
        nrc_number = COALESCE(?, nrc_number),
        occupation = COALESCE(?, occupation),
        updated_at = datetime('now')
      WHERE id = ?`
    )
    .bind(
      body.fullName || null,
      body.phone || null,
      body.age ?? null,
      ageGroup,
      body.gender || null,
      body.city || null,
      body.township || null,
      body.nrcState || null,
      body.nrcTownship || null,
      body.nrcType || null,
      body.nrcNumber || null,
      body.occupation || null,
      c.get('userId')
    )
    .run();

  return success(c, { message: 'Profile updated' });
});
