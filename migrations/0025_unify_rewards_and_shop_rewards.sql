-- Migration number: 0025 2026-11-10T00:00:00.000Z
-- Unify legacy campaign rewards and shop-level rewards into a single master catalog.
--
-- Changes:
-- 1. Add `reward_id` FK to `shop_rewards` linking to `rewards.id` (master catalog).
--    `shop_rewards` becomes the shop-level assignment table.
--    `reward_name` is kept for display/legacy compatibility but `reward_id` is the
--    source of truth for new assignments.
-- 2. Add indexes for the new FK.

-- ============================================================
-- 1. Add reward_id FK to shop_rewards
-- ============================================================

ALTER TABLE shop_rewards ADD COLUMN reward_id TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_rewards_reward_id ON shop_rewards(reward_id);
CREATE INDEX IF NOT EXISTS idx_shop_rewards_shop_reward ON shop_rewards(shop_id, reward_id);

-- Note: Data migration (backfilling reward_id by matching reward_name to rewards.name)
-- is handled lazily by the backend API on first read, and by the shop-create/edit
-- flow which now accepts rewardId directly.
