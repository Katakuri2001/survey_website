-- Migration number: 0022 2026-11-02T00:00:00.000Z
-- Add is_default_remainder flag to shop_rewards.
-- The default remainder reward (typically "Thank You") receives the
-- remaining probability after all explicit winning_ratio values are summed.
-- Only one reward per shop should have is_default_remainder = 1.

ALTER TABLE shop_rewards ADD COLUMN is_default_remainder INTEGER NOT NULL DEFAULT 0
  CHECK (is_default_remainder IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_shop_rewards_default_remainder
  ON shop_rewards(shop_id, is_default_remainder);