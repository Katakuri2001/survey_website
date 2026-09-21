import { createMiddleware } from 'hono/factory';
import type { MiddlewareHandler } from 'hono';
import type { AppContext, Bindings } from '../types';
import { ErrorCode, failure, logEvent } from './http';

// ============================================================
// JWT (HS256, WebCrypto) with issuer/audience and expiry checks
// ============================================================

const JWT_ISSUER = 'myanmarbeer-api';
const JWT_AUDIENCE = 'myanmarbeer-web';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export type TokenClaims = { sub: string; role: string; iat: number; exp: number; iss?: string; aud?: string };

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8ToBase64Url(text: string): string {
  return toBase64Url(new TextEncoder().encode(text));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

/**
 * The JWT secret must be provided in production. Falling back to a known
 * development value in production would let anyone forge admin tokens.
 */
export function resolveJwtSecret(env: Bindings): string | null {
  const secret = env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  const environment = env.ENVIRONMENT || 'production';
  if (environment === 'production') return null;
  return secret || 'dev-jwt-secret-change-in-production';
}

export async function createToken(
  userId: string,
  role: string,
  secret: string,
  ttlSeconds = TOKEN_TTL_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = utf8ToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = utf8ToBase64Url(
    JSON.stringify({
      sub: userId,
      role,
      iat: now,
      exp: now + ttlSeconds,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = toBase64Url(await hmacSha256(secret, signingInput));
  return `${signingInput}.${signature}`;
}

/**
 * Verify signature, expiry and (for new tokens) issuer/audience. Old tokens
 * minted before issuer/audience were added remain valid until they expire so
 * an in-flight event is not interrupted.
 */
export async function decodeToken(token: string, secret: string): Promise<TokenClaims | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = await hmacSha256(secret, signingInput);
    const actual = fromBase64Url(parts[2]);
    if (!timingSafeEqual(expected, actual)) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]))) as TokenClaims;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (payload.iat && payload.iat > now + 60) return null;
    if (payload.iss && payload.iss !== JWT_ISSUER) return null;
    if (payload.aud && payload.aud !== JWT_AUDIENCE) return null;
    return { ...payload, role: payload.role || 'user' };
  } catch {
    return null;
  }
}

// ============================================================
// Password hashing (PBKDF2-SHA256) with legacy SHA-256 upgrade
// ============================================================

const PBKDF2_PREFIX = 'pbkdf2';
const PBKDF2_ITERATIONS = 100_000;
const LEGACY_SHA256_RE = /^[a-f0-9]{64}$/;

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function legacySha256Hex(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return bytesToHex(new Uint8Array(digest));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

/** Guest users never log in with a password; store an unguessable marker. */
export function unusablePasswordMarker(): string {
  return `guest$${toBase64Url(crypto.getRandomValues(new Uint8Array(24)))}`;
}

export type PasswordCheck = { ok: boolean; needsRehash: boolean };

/** True when the stored value is a legacy unsalted SHA-256 hex digest. */
export function isLegacyHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && LEGACY_SHA256_RE.test(stored);
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<PasswordCheck> {
  if (!stored) return { ok: false, needsRehash: false };
  if (stored.startsWith(`${PBKDF2_PREFIX}$`)) {
    const [, iterationsRaw, saltRaw, hashRaw] = stored.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !saltRaw || !hashRaw) return { ok: false, needsRehash: false };
    try {
      const derived = await pbkdf2(password, fromBase64Url(saltRaw), iterations);
      return { ok: timingSafeEqual(derived, fromBase64Url(hashRaw)), needsRehash: false };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }
  if (LEGACY_SHA256_RE.test(stored)) {
    const candidate = await legacySha256Hex(password);
    const ok = timingSafeEqual(hexToBytes(candidate), hexToBytes(stored));
    return { ok, needsRehash: ok };
  }
  return { ok: false, needsRehash: false };
}

// ============================================================
// Middleware
// ============================================================

export const authMiddleware: MiddlewareHandler<AppContext> = createMiddleware<AppContext>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return failure(c, ErrorCode.UNAUTHORIZED, 'Authentication required');
  }
  const secret = resolveJwtSecret(c.env);
  if (!secret) {
    logEvent('error', 'jwt_secret_missing');
    return failure(c, ErrorCode.INTERNAL, 'Server authentication is not configured');
  }
  const claims = await decodeToken(header.slice(7), secret);
  if (!claims) {
    return failure(c, ErrorCode.UNAUTHORIZED, 'Invalid or expired token');
  }
  c.set('userId', claims.sub);
  c.set('role', claims.role);
  c.set('isAdmin', claims.role === 'admin');
  await next();
});

/**
 * Admin access is re-checked against the database. A forged role claim in the
 * JWT alone is never sufficient.
 */
export const adminMiddleware: MiddlewareHandler<AppContext> = createMiddleware<AppContext>(async (c, next) => {
  const userId = c.get('userId');
  const row = await c.env.survey_db
    .prepare('SELECT is_admin, is_active FROM users WHERE id = ?')
    .bind(userId)
    .first<{ is_admin: number; is_active: number }>();

  if (!row || !row.is_admin || !row.is_active) {
    return failure(c, ErrorCode.FORBIDDEN, 'Administrator access required');
  }
  c.set('isAdmin', true);
  await next();
});
