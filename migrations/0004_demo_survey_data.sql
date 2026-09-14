-- Migration number: 0004 2026-09-14T00:00:00.000Z
-- Extend the beer survey to 12 questions and seed demo users/responses/rewards
-- so the admin dashboard and analytics show meaningful, non-empty data.

-- ============================================================
-- SURVEY QUESTIONS (q7 - q12)
-- ============================================================
INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, is_active, validation_rules)
VALUES
  ('q7',  'sv-beer-v1', 'Where do you usually buy beer?', 'single_choice',    1, 7,  1, '{"required":true}'),
  ('q8',  'sv-beer-v1', 'How would you rate the packaging of Myanmar Beer?', 'rating', 1, 8, 1, '{"required":true,"min":1,"max":5}'),
  ('q9',  'sv-beer-v1', 'Would you choose Myanmar Beer over other brands at the same price?', 'yes_no', 1, 9, 1, '{"required":true}'),
  ('q10', 'sv-beer-v1', 'On which occasion do you most often drink beer?', 'single_choice', 1, 10, 1, '{"required":true}'),
  ('q11', 'sv-beer-v1', 'How satisfied are you with the value for money of Myanmar Beer?', 'rating', 1, 11, 1, '{"required":true,"min":1,"max":5}'),
  ('q12', 'sv-beer-v1', 'Through which channels have you seen Myanmar Beer advertised?', 'multiple_choice', 1, 12, 1, '{"required":true,"min":1}')
ON CONFLICT (id) DO NOTHING;

-- Question translations (Myanmar)
INSERT INTO survey_question_translations (id, question_id, language, question_text)
VALUES
  ('q7-my',  'q7',  'my', 'သင်ဘီယာကို များသောအားဖြင့် ဘယ်မှာဝယ်ပါသလဲ?'),
  ('q8-my',  'q8',  'my', 'မြန်မာဘီယာ၏ အထုပ်အပိုးကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('q9-my',  'q9',  'my', 'တူညီတဲ့စျေးနှုန်းမှာ မြန်မာဘီယာကို အခြားအမှတ်တံဆိပ်များထက် ရွေးချယ်မလား?'),
  ('q10-my', 'q10', 'my', 'ဘယ်အခါသင့်မျိုးမှာ ဘီယာသောက်လေ့ရှိပါသလဲ?'),
  ('q11-my', 'q11', 'my', 'မြန်မာဘီယာ၏ ငွေတန်ဖိုးကို ကျေနပ်ပါသလဲ?'),
  ('q12-my', 'q12', 'my', 'မြန်မာဘီယာ၏ ကြော်ငြာများကို ဘယ်နေရာတွေမှာ တွေ့ဖူးပါသလဲ?')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SURVEY OPTIONS
-- ============================================================
-- q7 options (purchase location)
INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('q7-o1', 'q7', 'Supermarket / Liquor store', 'supermarket',        1, 1),
  ('q7-o2', 'q7', 'Convenience store',         'convenience_store',  2, 1),
  ('q7-o3', 'q7', 'Restaurant / Pub',          'restaurant_pub',     3, 1),
  ('q7-o4', 'q7', 'Online',                    'online',             4, 1),
  ('q7-o5', 'q7', 'Duty free',                 'duty_free',          5, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('q7-o1-my', 'q7-o1', 'my', 'စူပါမားကက် / အရက်ဆိုင်'),
  ('q7-o2-my', 'q7-o2', 'my', 'ကုန်မျိုးစုံဆိုင်'),
  ('q7-o3-my', 'q7-o3', 'my', 'စားသောက်ဆိုင် / ပက်ဘ်'),
  ('q7-o4-my', 'q7-o4', 'my', 'အွန်လိုင်း'),
  ('q7-o5-my', 'q7-o5', 'my', 'Duty Free')
ON CONFLICT (id) DO NOTHING;

-- q10 options (occasion)
INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('q10-o1', 'q10', 'With friends',            'friends',          1, 1),
  ('q10-o2', 'q10', 'Family dinner',          'family_dinner',    2, 1),
  ('q10-o3', 'q10', 'Party or celebration',   'party',            3, 1),
  ('q10-o4', 'q10', 'Relaxing at home',       'relax',            4, 1),
  ('q10-o5', 'q10', 'Watching sports',        'sports',           5, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('q10-o1-my', 'q10-o1', 'my', 'သူငယ်ချင်းများနှင့်'),
  ('q10-o2-my', 'q10-o2', 'my', 'မိသားစု ညစာစားပွဲ'),
  ('q10-o3-my', 'q10-o3', 'my', 'ပါတီ / အခမ်းအနား'),
  ('q10-o4-my', 'q10-o4', 'my', 'အိမ်မှာ အပန်းဖြေ'),
  ('q10-o5-my', 'q10-o5', 'my', 'အားကစားကြည့်ချိန်')
ON CONFLICT (id) DO NOTHING;

-- q12 options (advertising channels)
INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('q12-o1', 'q12', 'Television',        'tv',           1, 1),
  ('q12-o2', 'q12', 'Social media',      'social_media', 2, 1),
  ('q12-o3', 'q12', 'Billboards',        'billboard',    3, 1),
  ('q12-o4', 'q12', 'In-store',          'in_store',     4, 1),
  ('q12-o5', 'q12', 'Sponsored events',  'sponsor',      5, 1),
  ('q12-o6', 'q12', 'Print / Radio',     'print',        6, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('q12-o1-my', 'q12-o1', 'my', 'ရုပ်မြင်သံကြား'),
  ('q12-o2-my', 'q12-o2', 'my', 'ဆိုရှယ်မီဒီယာ'),
  ('q12-o3-my', 'q12-o3', 'my', 'ဘီလ်ဘုတ်'),
  ('q12-o4-my', 'q12-o4', 'my', 'ဆိုင်အတွင်း'),
  ('q12-o5-my', 'q12-o5', 'my', 'စပွန်ဆာ အခမ်းအနား'),
  ('q12-o6-my', 'q12-o6', 'my', 'ပုံနှိပ် / ရေဒီယို')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO USERS
-- ============================================================
INSERT INTO users (id, full_name, email, phone, password_hash, age_verified, eligibility_confirmed, consent_marketing, consent_age_gate, is_active, age, age_group, gender, city, township, occupation)
VALUES
  ('demo-user-1', 'Thiri Aung',      'demo1@example.com', '0911000011', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 24, '18-24',  'female', 'Yangon',       'Kamayut',    'Student'),
  ('demo-user-2', 'Kyaw Zin Htet',   'demo2@example.com', '0911000022', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 31, '25-34',  'male',   'Mandalay',     'Chanayethazan', 'Sales Manager'),
  ('demo-user-3', 'U Myo Thein',     'demo3@example.com', '0911000033', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 42, '35-44',  'male',   'Yangon',       'Latha',       'Business Owner'),
  ('demo-user-4', 'Su Su Nwe',       'demo4@example.com', '0911000044', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 28, '25-34',  'female', 'Nay Pyi Taw',  'Dekkhinathiri','Accountant'),
  ('demo-user-5', 'U Than Zaw',      'demo5@example.com', '0911000055', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 50, '45-54',  'male',   'Yangon',       'Bahan',       'Retiree'),
  ('demo-user-6', 'Aung Kaung Myat', 'demo6@example.com', '0911000066', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 22, '18-24',  'male',   'Mawlamyine',   'Mawlamyine',  'University Student')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- DEMO SURVEY RESPONSES
-- ============================================================
INSERT INTO survey_responses (id, user_id, campaign_id, product_id, survey_version_id, language, status, completed_at, created_at)
VALUES
  ('demo-response-1', 'demo-user-1', 'campaign-2026', 'beer', 'sv-beer-v1', 'en', 'COMPLETED', '2026-08-28 10:00:00', '2026-08-28 10:00:00'),
  ('demo-response-2', 'demo-user-2', 'campaign-2026', 'beer', 'sv-beer-v1', 'en', 'COMPLETED', '2026-09-01 11:30:00', '2026-09-01 11:30:00'),
  ('demo-response-3', 'demo-user-3', 'campaign-2026', 'beer', 'sv-beer-v1', 'en', 'COMPLETED', '2026-09-05 09:15:00', '2026-09-05 09:15:00'),
  ('demo-response-4', 'demo-user-4', 'campaign-2026', 'beer', 'sv-beer-v1', 'my', 'COMPLETED', '2026-09-09 18:45:00', '2026-09-09 18:45:00'),
  ('demo-response-5', 'demo-user-5', 'campaign-2026', 'beer', 'sv-beer-v1', 'en', 'COMPLETED', '2026-09-12 14:20:00', '2026-09-12 14:20:00'),
  ('demo-response-6', 'demo-user-6', 'campaign-2026', 'beer', 'sv-beer-v1', 'my', 'COMPLETED', '2026-09-13 20:10:00', '2026-09-13 20:10:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO SURVEY ANSWERS
-- q1 single_choice | q2 multiple_choice | q3/q4 rating | q5 single_choice | q6 text
-- q7 single_choice | q8 rating | q9 yes_no | q10 single_choice | q11 rating | q12 multiple_choice
-- ============================================================
INSERT INTO survey_answers (id, response_id, question_id, answer_text, answer_number, answer_choice, answer_rating)
VALUES
  -- Response 1
  ('demo-ans-1-1',  'demo-response-1', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-1-2',  'demo-response-1', 'q2',  NULL, NULL, 'classic,gold', NULL),
  ('demo-ans-1-3',  'demo-response-1', 'q3',  NULL, 5, NULL, 5),
  ('demo-ans-1-4',  'demo-response-1', 'q4',  NULL, 9, NULL, 9),
  ('demo-ans-1-5',  'demo-response-1', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-1-6',  'demo-response-1', 'q6',  'Great product, I love the taste!', NULL, NULL, NULL),
  ('demo-ans-1-7',  'demo-response-1', 'q7',  NULL, NULL, 'supermarket', NULL),
  ('demo-ans-1-8',  'demo-response-1', 'q8',  NULL, 5, NULL, 5),
  ('demo-ans-1-9',  'demo-response-1', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-1-10', 'demo-response-1', 'q10', NULL, NULL, 'friends', NULL),
  ('demo-ans-1-11', 'demo-response-1', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-1-12', 'demo-response-1', 'q12', NULL, NULL, 'social_media,tv', NULL),

  -- Response 2
  ('demo-ans-2-1',  'demo-response-2', 'q1',  NULL, NULL, 'monthly', NULL),
  ('demo-ans-2-2',  'demo-response-2', 'q2',  NULL, NULL, 'classic', NULL),
  ('demo-ans-2-3',  'demo-response-2', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-2-4',  'demo-response-2', 'q4',  NULL, 8, NULL, 8),
  ('demo-ans-2-5',  'demo-response-2', 'q5',  NULL, NULL, 'strong', NULL),
  ('demo-ans-2-6',  'demo-response-2', 'q6',  'Very refreshing on a hot day.', NULL, NULL, NULL),
  ('demo-ans-2-7',  'demo-response-2', 'q7',  NULL, NULL, 'convenience_store', NULL),
  ('demo-ans-2-8',  'demo-response-2', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-2-9',  'demo-response-2', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-2-10', 'demo-response-2', 'q10', NULL, NULL, 'relax', NULL),
  ('demo-ans-2-11', 'demo-response-2', 'q11', NULL, 5, NULL, 5),
  ('demo-ans-2-12', 'demo-response-2', 'q12', NULL, NULL, 'billboard,in_store', NULL),

  -- Response 3
  ('demo-ans-3-1',  'demo-response-3', 'q1',  NULL, NULL, 'daily', NULL),
  ('demo-ans-3-2',  'demo-response-3', 'q2',  NULL, NULL, 'classic,gold,strong', NULL),
  ('demo-ans-3-3',  'demo-response-3', 'q3',  NULL, 3, NULL, 3),
  ('demo-ans-3-4',  'demo-response-3', 'q4',  NULL, 6, NULL, 6),
  ('demo-ans-3-5',  'demo-response-3', 'q5',  NULL, NULL, 'strong', NULL),
  ('demo-ans-3-6',  'demo-response-3', 'q6',  'I would like to see more variety in packaging size.', NULL, NULL, NULL),
  ('demo-ans-3-7',  'demo-response-3', 'q7',  NULL, NULL, 'convenience_store', NULL),
  ('demo-ans-3-8',  'demo-response-3', 'q8',  NULL, 3, NULL, 3),
  ('demo-ans-3-9',  'demo-response-3', 'q9',  NULL, NULL, 'no', NULL),
  ('demo-ans-3-10', 'demo-response-3', 'q10', NULL, NULL, 'party', NULL),
  ('demo-ans-3-11', 'demo-response-3', 'q11', NULL, 3, NULL, 3),
  ('demo-ans-3-12', 'demo-response-3', 'q12', NULL, NULL, 'tv,in_store', NULL),

  -- Response 4
  ('demo-ans-4-1',  'demo-response-4', 'q1',  NULL, NULL, 'rarely', NULL),
  ('demo-ans-4-2',  'demo-response-4', 'q2',  NULL, NULL, 'light', NULL),
  ('demo-ans-4-3',  'demo-response-4', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-4-4',  'demo-response-4', 'q4',  NULL, 7, NULL, 7),
  ('demo-ans-4-5',  'demo-response-4', 'q5',  NULL, NULL, 'light', NULL),
  ('demo-ans-4-6',  'demo-response-4', 'q6',  'Nice and light, easy to drink.', NULL, NULL, NULL),
  ('demo-ans-4-7',  'demo-response-4', 'q7',  NULL, NULL, 'online', NULL),
  ('demo-ans-4-8',  'demo-response-4', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-4-9',  'demo-response-4', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-4-10', 'demo-response-4', 'q10', NULL, NULL, 'family_dinner', NULL),
  ('demo-ans-4-11', 'demo-response-4', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-4-12', 'demo-response-4', 'q12', NULL, NULL, 'social_media,sponsor', NULL),

  -- Response 5
  ('demo-ans-5-1',  'demo-response-5', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-5-2',  'demo-response-5', 'q2',  NULL, NULL, 'classic,export', NULL),
  ('demo-ans-5-3',  'demo-response-5', 'q3',  NULL, 5, NULL, 5),
  ('demo-ans-5-4',  'demo-response-5', 'q4',  NULL, 10, NULL, 10),
  ('demo-ans-5-5',  'demo-response-5', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-5-6',  'demo-response-5', 'q6',  'The original remains the best.', NULL, NULL, NULL),
  ('demo-ans-5-7',  'demo-response-5', 'q7',  NULL, NULL, 'restaurant_pub', NULL),
  ('demo-ans-5-8',  'demo-response-5', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-5-9',  'demo-response-5', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-5-10', 'demo-response-5', 'q10', NULL, NULL, 'friends', NULL),
  ('demo-ans-5-11', 'demo-response-5', 'q11', NULL, 5, NULL, 5),
  ('demo-ans-5-12', 'demo-response-5', 'q12', NULL, NULL, 'print,tv', NULL),

  -- Response 6
  ('demo-ans-6-1',  'demo-response-6', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-6-2',  'demo-response-6', 'q2',  NULL, NULL, 'gold,light', NULL),
  ('demo-ans-6-3',  'demo-response-6', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-6-4',  'demo-response-6', 'q4',  NULL, 8, NULL, 8),
  ('demo-ans-6-5',  'demo-response-6', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-6-6',  'demo-response-6', 'q6',  NULL, NULL, NULL, NULL),
  ('demo-ans-6-7',  'demo-response-6', 'q7',  NULL, NULL, 'supermarket', NULL),
  ('demo-ans-6-8',  'demo-response-6', 'q8',  NULL, 5, NULL, 5),
  ('demo-ans-6-9',  'demo-response-6', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-6-10', 'demo-response-6', 'q10', NULL, NULL, 'sports', NULL),
  ('demo-ans-6-11', 'demo-response-6', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-6-12', 'demo-response-6', 'q12', NULL, NULL, 'social_media,sponsor', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEMO REWARD SPINS & DELIVERIES
-- ============================================================
INSERT INTO reward_spins (id, user_id, campaign_id, product_id, reward_id, status, selected_at, created_at)
VALUES
  ('demo-spin-1', 'demo-user-1', 'campaign-2026', 'beer', 'reward-tumbler',   'DELIVERY_SUBMITTED', '2026-08-28 10:05:00', '2026-08-28 10:05:00'),
  ('demo-spin-2', 'demo-user-2', 'campaign-2026', 'beer', 'reward-t-shirt',   'DELIVERY_PENDING',   '2026-09-01 11:35:00', '2026-09-01 11:35:00'),
  ('demo-spin-3', 'demo-user-3', 'campaign-2026', 'beer', 'reward-cap',       'DELIVERED',          '2026-09-05 09:20:00', '2026-09-05 09:20:00'),
  ('demo-spin-4', 'demo-user-4', 'campaign-2026', 'beer', 'reward-cooler',    'PROCESSING',         '2026-09-09 18:50:00', '2026-09-09 18:50:00'),
  ('demo-spin-5', 'demo-user-5', 'campaign-2026', 'beer', 'reward-no-prize',  'WON',                '2026-09-12 14:25:00', '2026-09-12 14:25:00'),
  ('demo-spin-6', 'demo-user-6', 'campaign-2026', 'beer', 'reward-t-shirt',   'SHIPPED',            '2026-09-13 20:15:00', '2026-09-13 20:15:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_rewards (id, user_id, reward_spin_id, reward_id, delivery_status, won_at, delivered_at, created_at)
VALUES
  ('demo-ur-1', 'demo-user-1', 'demo-spin-1', 'reward-tumbler',  'DELIVERY_SUBMITTED', '2026-08-28 10:05:00', NULL,                '2026-08-28 10:05:00'),
  ('demo-ur-2', 'demo-user-2', 'demo-spin-2', 'reward-t-shirt',  'DELIVERY_PENDING',   '2026-09-01 11:35:00', NULL,                '2026-09-01 11:35:00'),
  ('demo-ur-3', 'demo-user-3', 'demo-spin-3', 'reward-cap',      'DELIVERED',          '2026-09-05 09:20:00', '2026-09-09 12:00:00', '2026-09-05 09:20:00'),
  ('demo-ur-4', 'demo-user-4', 'demo-spin-4', 'reward-cooler',   'PROCESSING',         '2026-09-09 18:50:00', NULL,                '2026-09-09 18:50:00'),
  ('demo-ur-5', 'demo-user-5', 'demo-spin-5', 'reward-no-prize', 'DELIVERY_PENDING',   '2026-09-12 14:25:00', NULL,                '2026-09-12 14:25:00'),
  ('demo-ur-6', 'demo-user-6', 'demo-spin-6', 'reward-t-shirt',  'SHIPPED',            '2026-09-13 20:15:00', NULL,                '2026-09-13 20:15:00')
ON CONFLICT (id) DO NOTHING;

-- Delivery information for demo rewards that progressed past pending
INSERT INTO delivery_information (id, user_reward_id, full_name, phone, address, city, township, postal_code, additional_notes, created_at)
VALUES
  ('demo-di-1', 'demo-ur-1', 'Thiri Aung',    '0911000011', 'No. 12, Pyay Road',          'Yangon',     'Kamayut', '11041', 'Leave at the gate',         '2026-08-28 10:10:00'),
  ('demo-di-3', 'demo-ur-3', 'U Myo Thein',   '0911000033', 'No. 55, Latha Street',       'Yangon',     'Latha',   '11131', NULL,                          '2026-09-05 09:25:00'),
  ('demo-di-4', 'demo-ur-4', 'Su Su Nwe',     '0911000044', 'No. 7, Yaza Thingaha Road',  'Nay Pyi Taw','Dekkhinathiri','15021', 'Call before delivery',      '2026-09-09 18:55:00'),
  ('demo-di-6', 'demo-ur-6', 'Aung Kaung Myat','0911000066','No. 88, Strand Road',        'Mawlamyine', 'Mawlamyine', '12011', NULL,                        '2026-09-13 20:20:00')
ON CONFLICT (id) DO NOTHING;

-- Adjust reward remaining stock to match demo awards
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-tumbler';
UPDATE rewards SET remaining_quantity = remaining_quantity - 2 WHERE id = 'reward-t-shirt';
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-cap';
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-cooler';
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-no-prize';

-- Inventory ledger for demo awards
INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, reference_id, created_by, created_at)
VALUES
  ('demo-inv-1', 'reward-tumbler',  'REWARD_AWARDED', -1, 'reward_spin', 'demo-spin-1', 'demo-user-1', '2026-08-28 10:05:00'),
  ('demo-inv-2', 'reward-t-shirt',  'REWARD_AWARDED', -1, 'reward_spin', 'demo-spin-2', 'demo-user-2', '2026-09-01 11:35:00'),
  ('demo-inv-3', 'reward-cap',      'REWARD_AWARDED', -1, 'reward_spin', 'demo-spin-3', 'demo-user-3', '2026-09-05 09:20:00'),
  ('demo-inv-4', 'reward-cooler',   'REWARD_AWARDED', -1, 'reward_spin', 'demo-spin-4', 'demo-user-4', '2026-09-09 18:50:00'),
  ('demo-inv-5', 'reward-no-prize', 'REWARD_AWARDED', -1, 'reward_spin', 'demo-spin-5', 'demo-user-5', '2026-09-12 14:25:00'),
  ('demo-inv-6', 'reward-t-shirt',  'REWARD_AWARDED', -1, 'reward_spin', 'demo-spin-6', 'demo-user-6', '2026-09-13 20:15:00')
ON CONFLICT (id) DO NOTHING;