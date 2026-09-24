#!/usr/bin/env node
/**
 * Create or rotate the platform administrator without using a migration seed
 * credential. Run explicitly against local or remote D1.
 */
import { randomBytes, pbkdf2Sync } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || ''
const fullName = (process.env.ADMIN_NAME || 'Platform Administrator').trim()
const remote = process.argv.includes('--remote')

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('ADMIN_EMAIL must be a valid email address')
  process.exit(2)
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters')
  process.exit(2)
}

const iterations = 100_000
const salt = randomBytes(16)
const derived = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
const base64url = (value) => value.toString('base64url')
const passwordHash = `pbkdf2$${iterations}$${base64url(salt)}$${base64url(derived)}`
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`

const sql = `
INSERT INTO users (
  id, full_name, email, password_hash, is_admin, is_active, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001', ${quote(fullName)}, ${quote(email)}, ${quote(passwordHash)}, 1, 1, datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  full_name = excluded.full_name,
  email = excluded.email,
  password_hash = excluded.password_hash,
  is_admin = 1,
  is_active = 1,
  updated_at = datetime('now');
`

const args = [
  'wrangler',
  'd1',
  'execute',
  'survey-db',
  '--config',
  'wrangler.toml',
  '--env',
  'development',
  remote ? '--remote' : '--local',
  '--command',
  sql,
]
const result = spawnSync('npx', args, { stdio: 'inherit' })
process.exit(result.status ?? 1)
