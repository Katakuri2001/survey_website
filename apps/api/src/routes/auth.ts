import { Hono } from 'hono';
import type { AppContext, Ctx } from '../types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import {
  authMiddleware,
  createGuestResumeToken,
  createToken,
  hashGuestResumeToken,
  hashPassword,
  isLegacyHash,
  resolveJwtSecret,
  unusablePasswordMarker,
  verifyGuestResumeToken,
  verifyPassword,
} from '../lib/auth';
import { enforceRateLimit, RATE_POLICIES } from '../lib/security';
import { getAgeGroup } from '../lib/survey';
import { generateId } from '../lib/ids';
import { readJson, guestSchema, loginSchema, registerSchema, profileUpdateSchema } from '../lib/validation';
import { logAudit } from '../lib/audit';

export const authRoutes = new Hono<AppContext>();

function calculateAge(dob: string, now = new Date()): number {
  const [year, month, day] = dob.split('-').map(Number);
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() < month - 1 ||
    (now.getUTCMonth() === month - 1 && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

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
        `INSERT INTO users (id, full_name, email, phone, password_hash, age, age_group, gender, city, township, nrc_state, nrc_township, nrc_type, nrc_number, occupation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        body.nrcTownship || null,
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
      'SELECT id, full_name, email, phone, password_hash, is_active, is_admin, token_version FROM users WHERE email = ? AND is_admin = ?'
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
      token_version: number;
    }>();

  // Always perform a hash comparison to keep the failure timing uniform.
  const check = await verifyPassword(parsed.data.password, user?.password_hash ?? null);
  if (!user || !check.ok || (requireAdmin && parsed.data.password.toLowerCase() === 'admin')) {
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

  const token = await createToken(user.id, requireAdmin ? 'admin' : 'user', secret, user.token_version);

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

  const parsed = await readJson(c, guestSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const secret = resolveJwtSecret(c.env);
  if (!secret) return failure(c, ErrorCode.INTERNAL, 'Server authentication is not configured');

  const age = calculateAge(body.dob);
  if (age < 18) return failure(c, ErrorCode.INVALID_REQUEST, 'Must be at least 18 years old');
  const ageGroup = getAgeGroup(age);
  const db = c.env.survey_db;

  type GuestAccount = {
    id: string;
    guest_resume_token_hash: string | null;
    is_active: number;
    is_admin: number;
    token_version: number;
  };
  const findByPhone = async () =>
    db
      .prepare(
        `SELECT id, guest_resume_token_hash, is_active, is_admin, token_version
         FROM users WHERE phone = ?`
      )
      .bind(body.phone)
      .first<GuestAccount>();

  const createResume = async () => {
    const resumeToken = createGuestResumeToken();
    return { resumeToken, resumeHash: await hashGuestResumeToken(resumeToken) };
  };
  const resumeOrReject = async (account: GuestAccount | null): Promise<Response | null> => {
    if (!account) return null;
    if (!account.is_active) return failure(c, ErrorCode.FORBIDDEN, 'Account is disabled', 403);
    if (account.is_admin) return failure(c, ErrorCode.FORBIDDEN, 'Administrator identities cannot use guest access', 403);
    if (!body.resumeToken || !(await verifyGuestResumeToken(body.resumeToken, account.guest_resume_token_hash))) {
      return failure(
        c,
        ErrorCode.RESUME_TOKEN_REQUIRED,
        'This phone already has a profile. Resume with the original device or resume token.',
        409
      );
    }
    return null;
  };

  let account = await findByPhone();
  let userId: string;
  let tokenVersion: number;
  let resumeToken: string;
  let resumeHash: string;

  if (account) {
    const rejected = await resumeOrReject(account);
    if (rejected) return rejected;
    ({ resumeToken, resumeHash } = await createResume());
    const result = await db
      .prepare(
        `UPDATE users SET
           full_name = ?, age = ?, age_group = ?, dob = ?,
           nrc_state = ?, nrc_township = ?, nrc_type = ?, nrc_number = ?,
           guest_resume_token_hash = ?, updated_at = datetime('now')
         WHERE id = ? AND is_active = 1`
      )
      .bind(
        body.fullName,
        age,
        ageGroup,
        body.dob,
        body.stateCode || null,
        body.nrcTownship || null,
        body.nrcType || null,
        body.nrcNumber || null,
        resumeHash,
        account.id
      )
      .run();
    if (result.meta.changes !== 1) return failure(c, ErrorCode.INTERNAL, 'Failed to resume profile');
    userId = account.id;
    tokenVersion = account.token_version;
  } else {
    userId = generateId();
    ({ resumeToken, resumeHash } = await createResume());
    try {
      await db
        .prepare(
          `INSERT INTO users (
             id, full_name, phone, password_hash, age, age_group, dob,
             nrc_state, nrc_township, nrc_type, nrc_number,
             guest_resume_token_hash, token_version, is_active
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`
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
          body.nrcTownship || null,
          body.nrcType || null,
          body.nrcNumber || null,
          resumeHash
        )
        .run();
      tokenVersion = 0;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        logEvent('error', 'guest_insert_failed', { error: String(error) });
        return failure(c, ErrorCode.INTERNAL, 'Failed to create user');
      }
      account = await findByPhone();
      const rejected = await resumeOrReject(account);
      if (rejected) return rejected;
      return failure(
        c,
        ErrorCode.RESUME_TOKEN_REQUIRED,
        'A concurrent request created this phone. Resume with the original response token.',
        409
      );
    }
  }

  const token = await createToken(userId, 'user', secret, tokenVersion);
  return success(c, {
    userId,
    token,
    resumeToken,
    user: { id: userId, fullName: body.fullName, phone: body.phone },
  });
});

// ============================================================
// Current user profile
// ============================================================

const PROFILE_COLUMNS =
  'id, full_name, email, phone, age, age_group, dob, gender, city, township, nrc_state, nrc_township, nrc_type, nrc_number, occupation, created_at';

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
  try {
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
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure(c, 'PHONE_EXISTS', 'Phone number already registered', 409);
    }
    throw error;
  }

  return success(c, { message: 'Profile updated' });
});
