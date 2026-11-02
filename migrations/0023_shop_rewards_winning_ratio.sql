-- Migration number: 0023 2026-11-02T00:00:00.000Z
-- Add winning_ratio to shop_rewards (per-reward win probability percentage).
-- NULL means this reward does not have an explicit ratio (remainder reward).

ALTER TABLE shop_rewards ADD COLUMN winning_ratio REAL;