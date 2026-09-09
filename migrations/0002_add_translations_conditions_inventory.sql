-- Migration number: 0002 2026-09-09T14:00:00.000Z
-- Add missing tables for translations, conditions, inventory tracking

-- ============================================================
-- User Profile Extensions
-- ============================================================

-- Add profile fields to users table
ALTER TABLE users ADD COLUMN age INTEGER;
ALTER TABLE users ADD COLUMN age_group TEXT;
ALTER TABLE users ADD COLUMN gender TEXT;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN township TEXT;
ALTER TABLE users ADD COLUMN nrc_state TEXT;
ALTER TABLE users ADD COLUMN nrc_type TEXT;
ALTER TABLE users ADD COLUMN nrc_number TEXT;
ALTER TABLE users ADD COLUMN occupation TEXT;
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN role_id TEXT;
-- is_active already exists in users table

-- Index for age group analytics
CREATE INDEX IF NOT EXISTS idx_users_age_group ON users(age_group);
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- ============================================================
-- Bilingual Translations
-- ============================================================

-- Survey question translations (bilingual support)
CREATE TABLE IF NOT EXISTS survey_question_translations (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'my')),
  question_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
  UNIQUE(question_id, language)
);

-- Index for question translations
CREATE INDEX IF NOT EXISTS idx_question_translations_question ON survey_question_translations(question_id);
CREATE INDEX IF NOT EXISTS idx_question_translations_language ON survey_question_translations(language);

-- Survey option translations (bilingual support)
CREATE TABLE IF NOT EXISTS survey_option_translations (
  id TEXT PRIMARY KEY,
  option_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'my')),
  option_text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (option_id) REFERENCES survey_options(id) ON DELETE CASCADE,
  UNIQUE(option_id, language)
);

-- Index for option translations
CREATE INDEX IF NOT EXISTS idx_option_translations_option ON survey_option_translations(option_id);
CREATE INDEX IF NOT EXISTS idx_option_translations_language ON survey_option_translations(language);

-- ============================================================
-- Survey Question Conditions
-- ============================================================

-- Conditional logic for questions
CREATE TABLE IF NOT EXISTS survey_question_conditions (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  depends_on_question_id TEXT NOT NULL,
  condition_type TEXT NOT NULL DEFAULT 'equals' CHECK (condition_type IN ('equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'answered', 'not_answered')),
  condition_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES survey_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_question_id) REFERENCES survey_questions(id) ON DELETE CASCADE
);

-- Index for conditions
CREATE INDEX IF NOT EXISTS idx_question_conditions_question ON survey_question_conditions(question_id);
CREATE INDEX IF NOT EXISTS idx_question_conditions_depends ON survey_question_conditions(depends_on_question_id);

-- ============================================================
-- Product Translations
-- ============================================================

CREATE TABLE IF NOT EXISTS product_translations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'my')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(product_id, language)
);

-- Index for product translations
CREATE INDEX IF NOT EXISTS idx_product_translations_product ON product_translations(product_id);

-- ============================================================
-- Campaign Translations
-- ============================================================

CREATE TABLE IF NOT EXISTS campaign_translations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'my')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  UNIQUE(campaign_id, language)
);

-- Index for campaign translations
CREATE INDEX IF NOT EXISTS idx_campaign_translations_campaign ON campaign_translations(campaign_id);

-- ============================================================
-- Reward Translations
-- ============================================================

CREATE TABLE IF NOT EXISTS reward_translations (
  id TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'my')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  UNIQUE(reward_id, language)
);

-- Index for reward translations
CREATE INDEX IF NOT EXISTS idx_reward_translations_reward ON reward_translations(reward_id);

-- ============================================================
-- Reward Inventory Transactions (Audit Ledger)
-- ============================================================

CREATE TABLE IF NOT EXISTS reward_inventory_transactions (
  id TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INITIAL_STOCK', 'REWARD_AWARDED', 'MANUAL_ADJUSTMENT', 'CANCELLATION_RETURN')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for inventory transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reward ON reward_inventory_transactions(reward_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON reward_inventory_transactions(type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON reward_inventory_transactions(created_at);

-- ============================================================
-- Survey Version Translations
-- ============================================================

CREATE TABLE IF NOT EXISTS survey_version_translations (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'my')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (version_id) REFERENCES survey_versions(id) ON DELETE CASCADE,
  UNIQUE(version_id, language)
);

-- Index for version translations
CREATE INDEX IF NOT EXISTS idx_version_translations_version ON survey_version_translations(version_id);

-- ============================================================
-- Add language column to survey_responses
-- ============================================================

ALTER TABLE survey_responses ADD COLUMN language TEXT DEFAULT 'my' CHECK (language IN ('en', 'my'));

-- Index for language filtering
CREATE INDEX IF NOT EXISTS idx_survey_responses_language ON survey_responses(language);

-- ============================================================
-- Add low_stock_threshold to rewards
-- ============================================================

ALTER TABLE rewards ADD COLUMN low_stock_threshold INTEGER DEFAULT 10;

-- ============================================================
-- Add campaign_id to rewards for spin-wheel campaign config
-- ============================================================

ALTER TABLE rewards ADD COLUMN campaign_id TEXT;

-- Index for reward campaign filtering
CREATE INDEX IF NOT EXISTS idx_rewards_campaign ON rewards(campaign_id);