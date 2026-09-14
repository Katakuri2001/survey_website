-- One active (non-cancelled) spin per user per campaign.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_spins_one_per_campaign
  ON reward_spins(user_id, campaign_id)
  WHERE status != 'CANCELLED';

-- Allow the same reward type to be won again on a later campaign.
CREATE TABLE IF NOT EXISTS user_rewards_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reward_spin_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
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

INSERT INTO user_rewards_new
  SELECT id, user_id, reward_spin_id, reward_id, delivery_status, delivery_name, delivery_phone, delivery_address, delivery_city, delivery_postal_code, delivery_notes, won_at, delivered_at, created_at, updated_at
  FROM user_rewards;

DROP TABLE user_rewards;
ALTER TABLE user_rewards_new RENAME TO user_rewards;

CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_spin ON user_rewards(reward_spin_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_status ON user_rewards(delivery_status);
