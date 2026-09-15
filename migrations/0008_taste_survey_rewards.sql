-- Migration number: 0008 2026-09-15T00:00:00.000Z
-- Taste-test survey (3 tastes: rating + description each), guest-user DOB,
-- and the simplified 4-reward spin wheel (T-Shirt, Tote Bag, Umbrella, Thank You).

-- ============================================================
-- USERS: date of birth for the personal information form
-- ============================================================
ALTER TABLE users ADD COLUMN dob TEXT;

-- ============================================================
-- SURVEY: replace the generic one-screen questions with the
-- 3-taste test (rating + description box per taste).
-- ============================================================
UPDATE survey_questions SET is_active = 0, updated_at = datetime('now')
WHERE survey_version_id = 'sv-beer-v1';

INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, is_active, validation_rules)
VALUES
  ('taste-1-r', 'sv-beer-v1', 'How would you rate Taste 1 of Myanmar Beer?', 'rating', 1, 1, 1, '{"required":true,"min":1,"max":5}'),
  ('taste-1-d', 'sv-beer-v1', 'Describe the taste of Taste 1', 'text', 1, 2, 1, '{"required":true,"maxLength":500}'),
  ('taste-2-r', 'sv-beer-v1', 'How would you rate Taste 2 of Myanmar Beer?', 'rating', 1, 3, 1, '{"required":true,"min":1,"max":5}'),
  ('taste-2-d', 'sv-beer-v1', 'Describe the taste of Taste 2', 'text', 1, 4, 1, '{"required":true,"maxLength":500}'),
  ('taste-3-r', 'sv-beer-v1', 'How would you rate Taste 3 of Myanmar Beer?', 'rating', 1, 5, 1, '{"required":true,"min":1,"max":5}'),
  ('taste-3-d', 'sv-beer-v1', 'Describe the taste of Taste 3', 'text', 1, 6, 1, '{"required":true,"maxLength":500}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_question_translations (id, question_id, language, question_text)
VALUES
  ('taste-1-r-my', 'taste-1-r', 'my', 'မြန်မာဘီယာ အရသာ (၁) ကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('taste-1-d-my', 'taste-1-d', 'my', 'အရသာ (၁) ၏ ခံစားချက်ကို ဖော်ပြပါ'),
  ('taste-2-r-my', 'taste-2-r', 'my', 'မြန်မာဘီယာ အရသာ (၂) ကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('taste-2-d-my', 'taste-2-d', 'my', 'အရသာ (၂) ၏ ခံစားချက်ကို ဖော်ပြပါ'),
  ('taste-3-r-my', 'taste-3-r', 'my', 'မြန်မာဘီယာ အရသာ (၃) ကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('taste-3-d-my', 'taste-3-d', 'my', 'အရသာ (၃) ၏ ခံစားချက်ကို ဖော်ပြပါ')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- REWARDS: exactly four options on the spin wheel.
-- Deactivate the old five and introduce the three new ones;
-- the existing T-Shirt reward is kept and simplified.
-- ============================================================
UPDATE rewards SET is_active = 0, status = 'PAUSED', updated_at = datetime('now')
WHERE id IN ('reward-tumbler', 'reward-cap', 'reward-cooler', 'reward-no-prize');

UPDATE rewards SET name = 'T-Shirt', description = 'Myanmar Beer branded T-Shirt', campaign_id = NULL, updated_at = datetime('now')
WHERE id = 'reward-t-shirt';

INSERT INTO rewards (id, name, description, image_url, total_quantity, remaining_quantity, weight, low_stock_threshold, is_active, status, campaign_id)
VALUES
  ('reward-tote-bag',  'Tote Bag',  'Myanmar Beer branded tote bag',  '/assets/tote.png',    500, 500, 25, 30, 1, 'AVAILABLE', NULL),
  ('reward-umbrella',  'Umbrella', 'Myanmar Beer branded umbrella',  '/assets/umbrella.png', 500, 500, 20, 30, 1, 'AVAILABLE', NULL),
  ('reward-thank-you', 'Thank You', 'Thank you for participating!',  NULL,                   99999, 99999, 40, 0, 1, 'AVAILABLE', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO reward_translations (id, reward_id, language, name, description)
VALUES
  ('reward-tote-bag-my',  'reward-tote-bag',  'my', 'အိတ်',   'မြန်မာဘီယာ အမှတ်တံဆိပ် လက်ကိုင်အိတ်'),
  ('reward-umbrella-my',  'reward-umbrella',  'my', 'ထီး',   'မြန်မာဘီယာ အမှတ်တံဆိပ် ထီး'),
  ('reward-thank-you-my', 'reward-thank-you', 'my', 'ကျေးဇူးတင်ပါသည်', 'ပါဝင်ဆောင်ရွက်မှုအတွက် ကျေးဇူးတင်ပါသည်!')
ON CONFLICT (id) DO NOTHING;