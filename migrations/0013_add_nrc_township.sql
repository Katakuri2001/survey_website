-- Migration number: 0013 2026-09-18T00:00:00.000Z
-- Add nrc_township column to users table for structured NRC

ALTER TABLE users ADD COLUMN nrc_township TEXT;

CREATE INDEX IF NOT EXISTS idx_users_nrc_township ON users(nrc_township);