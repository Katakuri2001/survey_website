-- Migration number: 0019 2026-11-02T00:00:00.000Z
-- Add created_at and updated_at columns to reward_wins.

ALTER TABLE reward_wins ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE reward_wins ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

CREATE INDEX IF NOT EXISTS idx_reward_wins_created ON reward_wins(created_at);