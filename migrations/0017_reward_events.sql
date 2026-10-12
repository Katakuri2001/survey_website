-- Migration number: 0017 2026-10-09T00:01:00.000Z
-- Reward events audit log.

-- reward_events is an append-only log of all reward-related events.
-- This is required for debugging real campaign disputes and verifying the
-- concurrency invariants in production. Every spin, reservation, and delivery
-- should produce an event entry.
CREATE TABLE IF NOT EXISTS reward_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  spin_id TEXT,
  reward_id TEXT,
  event_type TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

-- Indexes for reward_events query performance.
-- Queries by session to reconstruct the timeline for a single user.
-- Queries by event type to count occurrences (e.g., how many DUPLICATE_SPIN).
-- Queries by created_at for timeline analysis.
CREATE INDEX IF NOT EXISTS idx_reward_events_session ON reward_events(session_id);
CREATE INDEX IF NOT EXISTS idx_reward_events_type ON reward_events(event_type);
CREATE INDEX IF NOT EXISTS idx_reward_events_created ON reward_events(created_at);

-- Example event types ( documented for consistency ):
--   SPIN_REQUESTED, REWARD_SELECTED, STOCK_RESERVED, REWARD_ASSIGNED,
--   DUPLICATE_SPIN, NO_STOCK, SPIN_FAILED, REWARD_CONFIRMED,
--   DELIVERY_PENDING, DELIVERY_COMPLETED, CANCELLATION_REQUESTED
