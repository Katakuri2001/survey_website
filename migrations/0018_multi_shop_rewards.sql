-- Migration number: 0018 2026-11-02T00:00:00.000Z
-- Multi-shop reward allocation system.
--
-- Adds shop-isolated reward inventory and winning configuration.
-- Non-destructive: existing tables and data are preserved.
-- Legacy `rewards` rows remain campaign-level (unassigned to any shop)
-- for historical reporting. New shop-specific rewards live in `shop_rewards`.

-- ============================================================
-- 1. shops — participating retail locations
-- ============================================================

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  contact_information TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  UNIQUE (campaign_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_shops_campaign ON shops(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_campaign_status ON shops(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_shops_display_order ON shops(display_order);

-- ============================================================
-- 2. shop_rewards — shop-specific reward inventory
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_rewards (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  reward_name TEXT NOT NULL,
  reward_description TEXT,
  reward_image_url TEXT,
  stock_total INTEGER NOT NULL DEFAULT 0 CHECK (stock_total >= 0),
  stock_remaining INTEGER NOT NULL DEFAULT 0 CHECK (stock_remaining >= 0),
  probability_weight INTEGER NOT NULL DEFAULT 10 CHECK (probability_weight >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CHECK (stock_remaining <= stock_total)
);

CREATE INDEX IF NOT EXISTS idx_shop_rewards_shop ON shop_rewards(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_rewards_campaign ON shop_rewards(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shop_rewards_shop_active_stock
  ON shop_rewards(shop_id, active, stock_remaining);
CREATE INDEX IF NOT EXISTS idx_shop_rewards_campaign_shop
  ON shop_rewards(campaign_id, shop_id);

-- ============================================================
-- 3. shop_winning_config — per-shop winning probability
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_winning_config (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL UNIQUE,
  win_probability REAL NOT NULL DEFAULT 0
    CHECK (win_probability >= 0 AND win_probability <= 100),
  probability_mode TEXT NOT NULL DEFAULT 'percentage'
    CHECK (probability_mode IN ('percentage', 'ratio')),
  no_reward_enabled INTEGER NOT NULL DEFAULT 1 CHECK (no_reward_enabled IN (0, 1)),
  configuration_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shop_winning_config_shop ON shop_winning_config(shop_id);

-- ============================================================
-- 4. survey_sessions extensions — selected shop + session lifecycle
-- ============================================================

ALTER TABLE survey_sessions ADD COLUMN user_id TEXT;
ALTER TABLE survey_sessions ADD COLUMN selected_shop_id TEXT;
ALTER TABLE survey_sessions ADD COLUMN shop_selected_at TEXT;
ALTER TABLE survey_sessions ADD COLUMN completed_at TEXT;
-- Normalized personal information for searchability (keeps personal_info_json as source)
ALTER TABLE survey_sessions ADD COLUMN full_name TEXT;
ALTER TABLE survey_sessions ADD COLUMN phone TEXT;

CREATE INDEX IF NOT EXISTS idx_survey_sessions_user ON survey_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_selected_shop ON survey_sessions(selected_shop_id);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_status_shop
  ON survey_sessions(status, selected_shop_id);

-- ============================================================
-- 5. survey_answers — tie answers to session
-- ============================================================

ALTER TABLE survey_answers ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_survey_answers_session ON survey_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_session_question
  ON survey_answers(session_id, question_id);

-- ============================================================
-- 6. reward_wins extensions — shop isolation + idempotency
-- ============================================================

ALTER TABLE reward_wins ADD COLUMN shop_id TEXT;
ALTER TABLE reward_wins ADD COLUMN shop_reward_id TEXT;
ALTER TABLE reward_wins ADD COLUMN idempotency_key TEXT;
ALTER TABLE reward_wins ADD COLUMN spin_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_wins_idempotency
  ON reward_wins(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reward_wins_session ON reward_wins(session_id);
CREATE INDEX IF NOT EXISTS idx_reward_wins_shop ON reward_wins(shop_id);
CREATE INDEX IF NOT EXISTS idx_reward_wins_shop_reward ON reward_wins(shop_reward_id);

-- ============================================================
-- 7. reward_events extensions — shop context
-- ============================================================
-- reward_id already exists in reward_events (migration 0017).

ALTER TABLE reward_events ADD COLUMN shop_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reward_events_shop ON reward_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_reward_events_shop_type
  ON reward_events(shop_id, event_type);

-- ============================================================
-- 8. reward_delivery_records — delivery tracking per reward win
-- ============================================================

CREATE TABLE IF NOT EXISTS reward_delivery_records (
  id TEXT PRIMARY KEY,
  reward_win_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_status IN ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  recipient_name TEXT,
  recipient_phone TEXT,
  collection_reference TEXT,
  notes TEXT,
  delivered_by TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (reward_win_id) REFERENCES reward_wins(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_delivery_records_win ON reward_delivery_records(reward_win_id);
CREATE INDEX IF NOT EXISTS idx_reward_delivery_records_shop ON reward_delivery_records(shop_id);
CREATE INDEX IF NOT EXISTS idx_reward_delivery_records_status
  ON reward_delivery_records(delivery_status);

-- ============================================================
-- Legacy rewards preservation note
-- ============================================================
-- Existing `rewards` rows (tumbler, t-shirt, cap, cooler, tote bag,
-- umbrella, thank-you) are campaign-level with campaign_id = 'campaign-2026'
-- or NULL. They are intentionally NOT migrated into shop_rewards because
-- historical shop ownership cannot be determined reliably. They remain
-- in `rewards` for legacy reporting only and are invisible to the new
-- shop-isolated allocation engine.
