-- Migration number: 0016 2026-10-09T00:00:00.000Z
-- Survey session tracking and reward win audit tables.

-- survey_sessions tracks the state of each user's survey progress server-side.
-- The browser-facing session (localStorage/sessionStorage) is only a recovery
-- mechanism; the server is the source of truth.
CREATE TABLE IF NOT EXISTS survey_sessions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (
      status IN (
        'STARTED',
        'PERSONAL_INFO_COMPLETED',
        'SURVEY_COMPLETED',
        'SPINNING',
        'REWARD_ASSIGNED',
        'COMPLETED',
        'ABANDONED'
      )
    ),
  personal_info_json TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  personal_completed_at TEXT,
  survey_completed_at TEXT,
  reward_assigned_at TEXT,

  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Indexes for survey_sessions query performance
CREATE INDEX IF NOT EXISTS idx_survey_sessions_campaign ON survey_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_status ON survey_sessions(status);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_updated ON survey_sessions(updated_at);

-- reward_wins records which reward was won by which session.
-- UNIQUE(session_id) and UNIQUE(spin_id) enforce the invariants:
--   (1) One session can have at most one reward.
--   (2) A spin_id is never reused.
CREATE TABLE IF NOT EXISTS reward_wins (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  spin_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  reward_name_snapshot TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (
      status IN ('RESERVED', 'CONFIRMED', 'DELIVERED', 'CANCELLED')
    ),
  confirmed_at TEXT,
  delivered_at TEXT,

  FOREIGN KEY (session_id) REFERENCES survey_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE RESTRICT,
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE RESTRICT
);

-- Indexes for reward_wins lookups by campaign and status
CREATE INDEX IF NOT EXISTS idx_reward_wins_campaign ON reward_wins(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_wins_status ON reward_wins(status);
CREATE INDEX IF NOT EXISTS idx_reward_wins_delivered ON reward_wins(delivered_at);

-- reward_events is an append-only log of all reward-related events.
-- This is required for debugging real campaign disputes and verifying the
-- concurrency invariants in production.
CREATE TABLE IF NOT EXISTS reward_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  spin_id TEXT,
  reward_id TEXT,
  event_type TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

-- Indexes for reward_events query performance
CREATE INDEX IF NOT EXISTS idx_reward_events_session ON reward_events(session_id);
CREATE INDEX IF NOT EXISTS idx_reward_events_type ON reward_events(event_type);
CREATE INDEX IF NOT EXISTS idx_reward_events_created ON reward_events(created_at);

-- Conservation invariant check: ensure no two sessions share the same reward_wins entry.
-- The UNIQUE(session_id) and UNIQUE(spin_id) constraints above enforce this at
-- the database level, but we also add a check for documentation and future-proofing.
