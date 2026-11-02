-- Migration number: 0020 2026-11-02T00:00:00.000Z
-- Make spin_id nullable in reward_wins (new flow uses spin_reference).

-- SQLite doesn't support ALTER TABLE ... ALTER COLUMN, so we rebuild.
-- But since this is a dev database, we can just use a simpler approach:
-- Create a new table, copy data, drop old, rename.

CREATE TABLE IF NOT EXISTS reward_wins_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  spin_id TEXT,
  campaign_id TEXT,
  reward_id TEXT,
  reward_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'CONFIRMED', 'DELIVERED', 'CANCELLED', 'REWARD_ASSIGNED', 'NO_REWARD')),
  confirmed_at TEXT,
  delivered_at TEXT,
  shop_id TEXT,
  shop_reward_id TEXT,
  idempotency_key TEXT,
  spin_reference TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (session_id) REFERENCES survey_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE RESTRICT,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE RESTRICT
);

INSERT INTO reward_wins_new (id, session_id, spin_id, campaign_id, reward_id, reward_name_snapshot, status, confirmed_at, delivered_at, shop_id, shop_reward_id, idempotency_key, spin_reference, created_at, updated_at)
SELECT id, session_id, spin_id, campaign_id, reward_id, reward_name_snapshot, status, confirmed_at, delivered_at, shop_id, shop_reward_id, idempotency_key, spin_reference, created_at, updated_at
FROM reward_wins;

DROP TABLE reward_wins;
ALTER TABLE reward_wins_new RENAME TO reward_wins;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_wins_session ON reward_wins(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_wins_idempotency ON reward_wins(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reward_wins_shop ON reward_wins(shop_id);
CREATE INDEX IF NOT EXISTS idx_reward_wins_shop_reward ON reward_wins(shop_reward_id);