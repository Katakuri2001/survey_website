-- Migration number: 0015 2026-09-25T00:00:00.000Z
-- Security/session hardening, recoverable spin reservations, and production demo cleanup.

-- Guest identities can be resumed only with a high-entropy secret. Only its
-- SHA-256 digest is stored. Tokens are rotated after every successful resume.
ALTER TABLE users ADD COLUMN guest_resume_token_hash TEXT;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- A reservation is recorded on the reward row in the same UPDATE that
-- decrements inventory. The stale-spin cron can therefore restore any crash.
ALTER TABLE rewards ADD COLUMN reservation_spin_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rewards_reservation_spin
  ON rewards(reservation_spin_id)
  WHERE reservation_spin_id IS NOT NULL;

-- Remove demo inventory effects before deleting demo identities. The reference
-- IDs are migration-owned demo-spin-* values, so real awards are not touched.
UPDATE rewards
SET remaining_quantity = remaining_quantity + COALESCE((
      SELECT SUM(-rit.quantity)
      FROM reward_inventory_transactions rit
      WHERE rit.reward_id = rewards.id
        AND rit.type = 'REWARD_AWARDED'
        AND rit.quantity < 0
        AND rit.reference_id LIKE 'demo-spin-%'
    ), 0),
    status = CASE
      WHEN status = 'PAUSED' THEN 'PAUSED'
      WHEN remaining_quantity + COALESCE((
        SELECT SUM(-rit.quantity)
        FROM reward_inventory_transactions rit
        WHERE rit.reward_id = rewards.id
          AND rit.type = 'REWARD_AWARDED'
          AND rit.quantity < 0
          AND rit.reference_id LIKE 'demo-spin-%'
      ), 0) <= 0 THEN 'EXHAUSTED'
      WHEN remaining_quantity + COALESCE((
        SELECT SUM(-rit.quantity)
        FROM reward_inventory_transactions rit
        WHERE rit.reward_id = rewards.id
          AND rit.type = 'REWARD_AWARDED'
          AND rit.quantity < 0
          AND rit.reference_id LIKE 'demo-spin-%'
      ), 0) <= low_stock_threshold THEN 'LOW_STOCK'
      ELSE 'AVAILABLE'
    END,
    updated_at = datetime('now')
WHERE EXISTS (
  SELECT 1
  FROM reward_inventory_transactions rit
  WHERE rit.reward_id = rewards.id
    AND rit.type = 'REWARD_AWARDED'
    AND rit.quantity < 0
    AND rit.reference_id LIKE 'demo-spin-%'
);

DELETE FROM reward_inventory_transactions
WHERE type = 'REWARD_AWARDED'
  AND quantity < 0
  AND reference_id LIKE 'demo-spin-%';

-- Demo and sample identities are never valid production participants. Their
-- responses, answers, spins, awards, and deliveries cascade from these rows.
DELETE FROM users
WHERE id LIKE 'demo-user-%'
   OR id = '00000000-0000-0000-0000-000000000002'
   OR email LIKE 'demo%@example.com'
   OR email = 'user@example.com';

-- Disable the migration-seeded administrator only when it still has the known
-- legacy password hash. The API also rejects the literal bootstrap password.
UPDATE users
SET password_hash = 'disabled$bootstrap-required',
    is_active = 0,
    updated_at = datetime('now')
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND email = 'admin@myanmarbeer.com'
  AND password_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

-- Ensure every known consolation reward is non-physical, including the legacy
-- seed whose display name differs from the values handled by 0014.
UPDATE rewards
SET requires_delivery = 0,
    updated_at = datetime('now')
WHERE id IN ('reward-no-prize', 'reward-thank-you')
   OR lower(name) IN ('thank you', 'no prize', 'try again next time');
