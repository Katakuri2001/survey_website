-- Migration number: 0014 2026-09-21T00:00:00.000Z
-- Production hardening for the 3,000-user event.
--   * runtime settings / feature flags / maintenance mode
--   * idempotency + versioning columns required by the hardened endpoints
--   * indexes that match the actual queries executed by the Worker
--   * pre-aggregated analytics table for the admin dashboard
-- Mostly additive. The one exception is reward_spins, whose original CHECK
-- constraint omitted the 'PENDING' status the spin endpoint relies on; that
-- table is rebuilt in a child-data-preserving way (see the note below).

-- ============================================================
-- Runtime settings (feature flags, maintenance mode, config)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO settings (key, value) VALUES
  ('maintenance_mode', '0'),
  ('survey_enabled',   '1'),
  ('spin_enabled',     '1'),
  ('delivery_enabled', '1'),
  ('config_version',   '2026-v1')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Survey responses: idempotency + historical version label
-- ============================================================
ALTER TABLE survey_responses ADD COLUMN submission_request_id TEXT;
ALTER TABLE survey_responses ADD COLUMN survey_version_label TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_request_id
  ON survey_responses(submission_request_id)
  WHERE submission_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_responses_status_created
  ON survey_responses(status, created_at);

CREATE INDEX IF NOT EXISTS idx_survey_responses_user_status
  ON survey_responses(user_id, status);

-- ============================================================
-- Reward spins:
--   * snapshot the configuration used for the award, and
--   * allow the in-flight 'PENDING' status written by the spin endpoint.
-- The original table CHECK (migration 0001) omitted 'PENDING', so every spin
-- failed with a CHECK constraint error. SQLite cannot alter a CHECK constraint,
-- so the table must be rebuilt. D1 enforces foreign keys and ignores
-- `PRAGMA foreign_keys = OFF`, so dropping the parent table would
-- cascade-delete user_rewards and, through it, delivery_information. Those two
-- child tables are therefore snapshotted into _bak_* first and restored
-- immediately after the rename. The _bak_* names are reused on retry
-- (IF NOT EXISTS) so a partially-applied migration is self-healing.
-- ============================================================
CREATE TABLE IF NOT EXISTS _bak_user_rewards AS SELECT * FROM user_rewards;
CREATE TABLE IF NOT EXISTS _bak_delivery_information AS SELECT * FROM delivery_information;

CREATE TABLE IF NOT EXISTS reward_spins_new (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  campaign_id      TEXT,
  product_id       TEXT,
  reward_id        TEXT,
  status           TEXT DEFAULT 'WON'
                     CHECK (status IN ('PENDING', 'WON', 'DELIVERY_PENDING', 'DELIVERY_SUBMITTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  selected_at      TEXT DEFAULT (datetime('now')),
  resolved_at      TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now')),
  idempotency_key  TEXT,
  reward_snapshot  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE SET NULL
);

-- Preserve every recorded spin. reward_snapshot does not exist yet;
-- idempotency_key was added by migration 0012, so it is included here.
INSERT INTO reward_spins_new
  (id, user_id, campaign_id, product_id, reward_id, status, selected_at, resolved_at, created_at, updated_at, idempotency_key)
  SELECT id, user_id, campaign_id, product_id, reward_id, status, selected_at, resolved_at, created_at, updated_at, idempotency_key
  FROM reward_spins;

DROP TABLE reward_spins;
ALTER TABLE reward_spins_new RENAME TO reward_spins;

-- Restore the child rows removed by the cascade above, children first.
INSERT INTO user_rewards SELECT * FROM _bak_user_rewards;
INSERT INTO delivery_information SELECT * FROM _bak_delivery_information;
DROP TABLE _bak_user_rewards;
DROP TABLE _bak_delivery_information;

CREATE INDEX IF NOT EXISTS idx_reward_spins_user ON reward_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_spins_reward ON reward_spins(reward_id);
CREATE INDEX IF NOT EXISTS idx_reward_spins_status ON reward_spins(status);
CREATE INDEX IF NOT EXISTS idx_reward_spins_selected ON reward_spins(selected_at);
-- One non-cancelled spin per user per campaign. The default campaign is stored
-- as NULL (there is no `campaigns` row for it), and SQLite treats NULLs as
-- distinct in a plain UNIQUE index, so COALESCE folds them into one bucket.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_spins_one_per_campaign
  ON reward_spins(user_id, COALESCE(campaign_id, 'default')) WHERE status != 'CANCELLED';
CREATE INDEX IF NOT EXISTS idx_reward_spins_idempotency
  ON reward_spins(user_id, COALESCE(campaign_id, 'default'), idempotency_key);
CREATE INDEX IF NOT EXISTS idx_reward_spins_campaign_status
  ON reward_spins(campaign_id, status);

-- ============================================================
-- Rewards: does the reward require a delivery address?
-- ============================================================
ALTER TABLE rewards ADD COLUMN requires_delivery INTEGER NOT NULL DEFAULT 1;

-- The seeded "Thank You" consolation is not a physical delivery.
UPDATE rewards SET requires_delivery = 0
WHERE id = 'reward-thank-you' OR name IN ('Thank You', 'No Prize');

-- Eligibility query used by the spin endpoint.
CREATE INDEX IF NOT EXISTS idx_rewards_eligible
  ON rewards(is_active, status, remaining_quantity);

-- ============================================================
-- Survey read path (config endpoint scans a whole version)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_survey_questions_version_active_order
  ON survey_questions(survey_version_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_survey_options_question_active_order
  ON survey_options(question_id, is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_survey_answers_response_question
  ON survey_answers(response_id, question_id);

-- ============================================================
-- Admin query support
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_admin_active
  ON users(is_admin, is_active);

CREATE INDEX IF NOT EXISTS idx_user_rewards_delivery_won
  ON user_rewards(delivery_status, won_at);

-- ============================================================
-- Pre-aggregated analytics (rebuilt on a schedule, never on the
-- critical path). Keyed so a single upsert refreshes a metric.
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_aggregates (
  metric      TEXT NOT NULL,
  dimension   TEXT NOT NULL DEFAULT '',
  value       REAL NOT NULL DEFAULT 0,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (metric, dimension)
);

CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_metric
  ON analytics_aggregates(metric);
