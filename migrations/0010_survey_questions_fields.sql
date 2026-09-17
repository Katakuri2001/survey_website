-- Migration number: 0010 2026-09-17T00:00:00.000Z
-- Add product_type and image_url to survey_questions
-- Add winning_ratio to rewards

-- survey_questions: add image_url and product_type
ALTER TABLE survey_questions ADD COLUMN image_url TEXT;
ALTER TABLE survey_questions ADD COLUMN product_type TEXT DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_survey_questions_product_type ON survey_questions(product_type);

-- rewards: add winning_ratio (percentage 0-100, NULL means auto-calculate)
ALTER TABLE rewards ADD COLUMN winning_ratio REAL;

CREATE INDEX IF NOT EXISTS idx_rewards_winning_ratio ON rewards(winning_ratio);
