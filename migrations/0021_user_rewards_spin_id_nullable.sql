-- Migration number: 0021 2026-11-02T00:00:00.000Z
-- Make reward_spin_id nullable in user_rewards (new flow doesn't create reward_spins).

CREATE TABLE IF NOT EXISTS user_rewards_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reward_spin_id TEXT,
  reward_id TEXT,
  delivery_status TEXT DEFAULT 'DELIVERY_PENDING' CHECK (delivery_status IN ('DELIVERY_PENDING', 'DELIVERY_SUBMITTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  delivery_name TEXT,
  delivery_phone TEXT,
  delivery_address TEXT,
  delivery_city TEXT,
  delivery_postal_code TEXT,
  delivery_notes TEXT,
  won_at TEXT DEFAULT (datetime('now')),
  delivered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_spin_id) REFERENCES reward_spins(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
);

INSERT INTO user_rewards_new (id, user_id, reward_spin_id, reward_id, delivery_status, delivery_name, delivery_phone, delivery_address, delivery_city, delivery_postal_code, delivery_notes, won_at, delivered_at, created_at, updated_at)
SELECT id, user_id, reward_spin_id, reward_id, delivery_status, delivery_name, delivery_phone, delivery_address, delivery_city, delivery_postal_code, delivery_notes, won_at, delivered_at, created_at, updated_at
FROM user_rewards;

DROP TABLE user_rewards;
ALTER TABLE user_rewards_new RENAME TO user_rewards;

CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_spin ON user_rewards(reward_spin_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_status ON user_rewards(delivery_status);