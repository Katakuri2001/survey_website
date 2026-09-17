-- Migration number: 0009 2026-09-17T00:00:00.000Z
-- Prevent duplicate survey submissions: one completed response per user per product.
-- Matches the pattern in migrations/0005_spin_uniqueness.sql.

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_one_per_product
  ON survey_responses(user_id, product_id)
  WHERE status = 'COMPLETED';
