-- Migration number: 0012 2026-09-18T00:00:00.000Z
-- Add idempotency_key to reward_spins for safe retry handling

ALTER TABLE reward_spins ADD COLUMN idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_reward_spins_idempotency
  ON reward_spins(user_id, campaign_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;