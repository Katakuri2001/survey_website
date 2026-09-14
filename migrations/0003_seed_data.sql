-- Apply users.is_active so the user inserts below succeed on fresh databases
-- (0001_initial.sql created users without this column; it was applied ad-hoc to
-- the original local DB and is persisted here for reproducibility).
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Migration number: 0003 2026-09-11T00:00:00.000Z
-- Seed initial data: admin user, product, survey version, questions, options, rewards

-- ============================================================
-- ADMIN USER (admin@myanmarbeer.com / admin)
-- ============================================================
INSERT INTO users (id, full_name, email, password_hash, age_verified, eligibility_confirmed, consent_marketing, consent_age_gate, is_admin, is_active, age, age_group, gender, city, township, occupation)
VALUES ('00000000-0000-0000-0000-000000000001', 'Platform Admin', 'admin@myanmarbeer.com',
        '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
        1, 1, 1, 1, 1, 1, 35, '25-34', 'other', 'Yangon', 'Bahan', 'Administrator')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- SAMPLE USER (user@example.com / user123)
-- ============================================================
INSERT INTO users (id, full_name, email, phone, password_hash, age_verified, eligibility_confirmed, consent_marketing, consent_age_gate, is_active, age, age_group, gender, city, township, occupation)
VALUES ('00000000-0000-0000-0000-000000000002', 'Mg Min Thu', 'user@example.com', '09123456789',
        'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446',
        1, 1, 1, 1, 1, 28, '25-34', 'male', 'Yangon', 'Kamayut', 'Software Engineer')
ON CONFLICT (email) DO NOTHING;

-- Role for admin
INSERT INTO roles (id, name, description) VALUES ('role-admin', 'Admin', 'Full platform administration')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PRODUCT: Myanmar Beer
-- ============================================================
INSERT INTO products (id, name, description, brand, image_url, display_order, is_active)
VALUES ('beer', 'Myanmar Beer', 'The premium lager beer of Myanmar', 'Myanmar Brewery', '/assets/beer.png', 1, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_translations (id, product_id, language, name, description)
VALUES ('pt-beer-my', 'beer', 'my', 'မြန်မာဘီယာ', 'မြန်မာနိုင်ငံ၏ ထိပ်တန်း အရက်')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CAMPAIGN
-- ============================================================
INSERT INTO campaigns (id, name, description, slug, is_active, start_date, end_date)
VALUES ('campaign-2026', 'Myanmar Beer Summer Campaign 2026', 'Scan, survey, and win rewards', 'summer-2026', 1, '2026-01-01', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_translations (id, campaign_id, language, name, description)
VALUES ('ct-my', 'campaign-2026', 'my', 'မြန်မာဘီယာ နွေရာသီ ကမ်ပိန်း ၂၀၂၆', 'Scan လုပ်ပါ၊ စစ်တမ်းဖြည့်ပါ၊ ဆုရပါ')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SURVEY VERSION
-- ============================================================
INSERT INTO survey_versions (id, product_id, version, title, description, is_active)
VALUES ('sv-beer-v1', 'beer', 1, 'Myanmar Beer Consumer Survey', 'Help us understand your beer preferences', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SURVEY QUESTIONS
-- ============================================================
INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, is_active, validation_rules)
VALUES
  ('q1', 'sv-beer-v1', 'How often do you drink beer?', 'single_choice', 1, 1, 1, '{"required":true}'),
  ('q2', 'sv-beer-v1', 'Which Myanmar Beer products have you tried?', 'multiple_choice', 1, 2, 1, '{"required":true,"min":1}'),
  ('q3', 'sv-beer-v1', 'How would you rate the taste of Myanmar Beer?', 'rating', 1, 3, 1, '{"required":true,"min":1,"max":5}'),
  ('q4', 'sv-beer-v1', 'How likely are you to recommend Myanmar Beer to a friend?', 'rating', 1, 4, 1, '{"required":true,"min":1,"max":10}'),
  ('q5', 'sv-beer-v1', 'What is your favorite Myanmar Beer flavor?', 'single_choice', 1, 5, 1, '{"required":true}'),
  ('q6', 'sv-beer-v1', 'Any other feedback about Myanmar Beer?', 'text', 0, 6, 1, '{"required":false,"maxLength":500}')
ON CONFLICT (id) DO NOTHING;

-- Question translations (Myanmar)
INSERT INTO survey_question_translations (id, question_id, language, question_text)
VALUES
  ('q1-my', 'q1', 'my', 'သင်ဘီယာကို ဘယ်နှစ်ကြိမ် သောက်လေ့ရှိပါသလဲ?'),
  ('q2-my', 'q2', 'my', 'မြန်မာဘီယာလုပ်ငန်း၏ ဘယ်ထုတ်ကုန်တွေ စမ်းသုံးဖူးပါသလဲ?'),
  ('q3-my', 'q3', 'my', 'မြန်မာဘီယာ၏ အရသာကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('q4-my', 'q4', 'my', 'သူငယ်ချင်းများကို မြန်မာဘီယာ ထောက်ခံပေးနိုင်ခြေက ဘယ်လောက်ရှိပါသလဲ?'),
  ('q5-my', 'q5', 'my', 'သင်အကြိုက်ဆုံး မြန်မာဘီယာ အရသာက ဘာပါလဲ?'),
  ('q6-my', 'q6', 'my', 'မြန်မာဘီယာအကြောင်း အခြားအကြံပြုချက်များ ရှိပါသလဲ?')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SURVEY OPTIONS
-- ============================================================
-- q1 options (frequency)
INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('q1-o1', 'q1', 'Daily', 'daily', 1, 1),
  ('q1-o2', 'q1', 'Weekly', 'weekly', 2, 1),
  ('q1-o3', 'q1', 'Monthly', 'monthly', 3, 1),
  ('q1-o4', 'q1', 'Rarely', 'rarely', 4, 1),
  ('q1-o5', 'q1', 'Never', 'never', 5, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('q1-o1-my', 'q1-o1', 'my', 'နေ့တိုင်း'),
  ('q1-o2-my', 'q1-o2', 'my', 'အပတ်စဉ်'),
  ('q1-o3-my', 'q1-o3', 'my', 'လစဉ်'),
  ('q1-o4-my', 'q1-o4', 'my', 'ရံဖန်ရံခါ'),
  ('q1-o5-my', 'q1-o5', 'my', 'ဘယ်တော့မှ မသောက်')
ON CONFLICT (id) DO NOTHING;

-- q2 options (products tried)
INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('q2-o1', 'q2', 'Myanmar Beer Classic', 'classic', 1, 1),
  ('q2-o2', 'q2', 'Myanmar Beer Gold', 'gold', 2, 1),
  ('q2-o3', 'q2', 'Myanmar Beer Strong', 'strong', 3, 1),
  ('q2-o4', 'q2', 'Myanmar Beer Light', 'light', 4, 1),
  ('q2-o5', 'q2', 'Myanmar Beer Export', 'export', 5, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('q2-o1-my', 'q2-o1', 'my', 'မြန်မာဘီယာ ကလက်ဆစ်'),
  ('q2-o2-my', 'q2-o2', 'my', 'မြန်မာဘီယာ ရွှေ'),
  ('q2-o3-my', 'q2-o3', 'my', 'မြန်မာဘီယာ စထရွန်း'),
  ('q2-o4-my', 'q2-o4', 'my', 'မြန်မာဘီယာ လိုက်'),
  ('q2-o5-my', 'q2-o5', 'my', 'မြန်မာဘီယာ အက္ဇ်ပို့')
ON CONFLICT (id) DO NOTHING;

-- q5 options (favorite flavor)
INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('q5-o1', 'q5', 'Original Lager', 'original', 1, 1),
  ('q5-o2', 'q5', 'Strong', 'strong', 2, 1),
  ('q5-o3', 'q5', 'Light', 'light', 3, 1),
  ('q5-o4', 'q5', 'Black', 'black', 4, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('q5-o1-my', 'q5-o1', 'my', 'ရွှေရောင် လေဂါ'),
  ('q5-o2-my', 'q5-o2', 'my', 'စထရွန်း'),
  ('q5-o3-my', 'q5-o3', 'my', 'လိုက်'),
  ('q5-o4-my', 'q5-o4', 'my', 'အနက်')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- REWARDS
-- ============================================================
INSERT INTO rewards (id, name, description, image_url, total_quantity, remaining_quantity, weight, low_stock_threshold, is_active, status, campaign_id)
VALUES
  ('reward-tumbler', 'Myanmar Beer Tumbler Glass', 'Premium branded tumbler glass', '/assets/tumbler.png', 200, 200, 30, 20, 1, 'AVAILABLE', 'campaign-2026'),
  ('reward-t-shirt', 'Myanmar Beer T-Shirt', 'Premium cotton branded t-shirt', '/assets/tshirt.png', 100, 100, 20, 10, 1, 'AVAILABLE', 'campaign-2026'),
  ('reward-cap', 'Myanmar Beer Cap', 'Branded baseball cap', '/assets/cap.png', 150, 150, 25, 15, 1, 'AVAILABLE', 'campaign-2026'),
  ('reward-cooler', 'Myanmar Beer Cooler Bag', 'Insulated cooler bag', '/assets/cooler.png', 50, 50, 15, 5, 1, 'AVAILABLE', 'campaign-2026'),
  ('reward-no-prize', 'Try Again Next Time', 'Better luck next time!', NULL, 99999, 99999, 10, 0, 1, 'AVAILABLE', 'campaign-2026')
ON CONFLICT (id) DO NOTHING;

INSERT INTO reward_translations (id, reward_id, language, name, description)
VALUES
  ('reward-tumbler-my', 'reward-tumbler', 'my', 'မြန်မာဘီယာ ဘီယာခွက်', 'အမှတ်တံဆိပ် ဖန်ခွက်'),
  ('reward-t-shirt-my', 'reward-t-shirt', 'my', 'မြန်မာဘီယာ အင်္ကျီ', 'အရည်အသွေးမြင့် ချည်အင်္ကျီ'),
  ('reward-cap-my', 'reward-cap', 'my', 'မြန်မာဘီယာ ဦးထုပ်', 'အမှတ်တံဆိပ် ဘော်လီဦးထုပ်'),
  ('reward-cooler-my', 'reward-cooler', 'my', 'မြန်မာဘီယာ အေးအောင်ထားသောအိတ်', 'အပူခံ ဘီယာအိတ်'),
  ('reward-no-prize-my', 'reward-no-prize', 'my', 'နောက်တစ်ကြိမ် ကြိုးစားပါ', 'အခွင့်အရေး နောက်တစ်ကျော့ ရှိပါသည်')
ON CONFLICT (id) DO NOTHING;

-- Inventory transactions for rewards
INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, notes, created_by)
VALUES
  ('inv-tumbler', 'reward-tumbler', 'INITIAL_STOCK', 200, NULL, 'Initial stock upload', '00000000-0000-0000-0000-000000000001'),
  ('inv-tshirt', 'reward-t-shirt', 'INITIAL_STOCK', 100, NULL, 'Initial stock upload', '00000000-0000-0000-0000-000000000001'),
  ('inv-cap', 'reward-cap', 'INITIAL_STOCK', 150, NULL, 'Initial stock upload', '00000000-0000-0000-0000-000000000001'),
  ('inv-cooler', 'reward-cooler', 'INITIAL_STOCK', 50, NULL, 'Initial stock upload', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
