-- Migration number: 0006 2026-09-14T00:00:00.000Z
-- Second batch of demo data: additional products, more survey-taken users with
-- varied ratings/answers, and extra reward deliveries so the admin dashboard,
-- analytics graphs and deliveries page show meaningful, non-empty data.
--
-- IMPORTANT: 'beer' keeps display_order = 1 so the consumer app, which auto
-- selects the first active product, continues to serve the beer survey.

-- ============================================================
-- EXTRA PRODUCTS
-- ============================================================
INSERT INTO products (id, name, description, brand, image_url, display_order, is_active)
VALUES
  ('beer-gold',   'Myanmar Beer Gold',   'Premium golden lager for special occasions', 'Myanmar Brewery', '/assets/beer-gold.png',   2, 1),
  ('beer-strong', 'Myanmar Beer Strong', 'Full-bodied strong beer with higher ABV',    'Myanmar Brewery', '/assets/beer-strong.png', 3, 1),
  ('beer-light',  'Myanmar Beer Light',  'Light and refreshing low-carb lager',        'Myanmar Brewery', '/assets/beer-light.png',  4, 1),
  ('beer-export', 'Myanmar Beer Export', 'Export-grade premium lager',                 'Myanmar Brewery', '/assets/beer-export.png', 5, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_translations (id, product_id, language, name, description)
VALUES
  ('pt-beer-gold-my',   'beer-gold',   'my', 'မြန်မာဘီယာ ရွှေ',   'အထူးအခါသမယအတွက် အဆင့်မြင့် ရွှေရောင် လေဂါ'),
  ('pt-beer-strong-my', 'beer-strong', 'my', 'မြန်မာဘီယာ စထရွန်း', 'အရက်ပြင်းအား မြင့်မားသော ဘီယာ'),
  ('pt-beer-light-my',  'beer-light',  'my', 'မြန်မာဘီယာ လိုက်',   'အပေါ့စား ကာဗွန်နိတ်နည်းသော လေဂါ'),
  ('pt-beer-export-my', 'beer-export', 'my', 'မြန်မာဘီယာ အက္ဇ်ပို့', 'ပို့ကုန်အဆင့် အဆင့်မြင့် လေဂါ')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADDITIONAL SURVEY-TAKEN USERS (10 more => 17 participants total)
-- ============================================================
INSERT INTO users (id, full_name, email, phone, password_hash, age_verified, eligibility_confirmed, consent_marketing, consent_age_gate, is_active, age, age_group, gender, city, township, occupation)
VALUES
  ('demo-user-7',  'Hnin Wai Zin',  'demo7@example.com',  '0911000077', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 29, '25-34', 'female', 'Yangon',       'Kamayut',    'Nurse'),
  ('demo-user-8',  'Zaw Min Oo',    'demo8@example.com',  '0911000088', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 36, '35-44', 'male',   'Mandalay',     'Chanmyathazi','Engineer'),
  ('demo-user-9',  'U Ba Htay',     'demo9@example.com',  '0911000099', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 46, '45-54', 'male',   'Pathein',      'Pathein',     'Fisherman'),
  ('demo-user-10', 'May Thu Aung',  'demo10@example.com', '0911001010', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 21, '18-24', 'female', 'Yangon',       'Sanchaung',   'Student'),
  ('demo-user-11', 'U Aung Myint',  'demo11@example.com', '0911001111', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 55, '55+',   'male',   'Taunggyi',     'Taunggyi',    'Shopkeeper'),
  ('demo-user-12', 'Khin Myo Thant','demo12@example.com', '0911001212', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 26, '25-34', 'female', 'Bago',         'Bago',        'Teacher'),
  ('demo-user-13', 'Kyaw Swar Win', 'demo13@example.com', '0911001313', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 33, '25-34', 'male',   'Yangon',       'Dagon',       'Driver'),
  ('demo-user-14', 'Daw Nilar Kyaw','demo14@example.com', '0911001414', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 41, '35-44', 'female', 'Mawlamyine',   'Mawlamyine',  'Housewife'),
  ('demo-user-15', 'Hein Htet Aung','demo15@example.com', '0911001515', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 19, '18-24', 'male',   'Nay Pyi Taw',  'Pyinmana',    'Student'),
  ('demo-user-16', 'Daw Yin Yin Nwe','demo16@example.com','0911001616', 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', 1, 1, 1, 1, 1, 49, '45-54', 'female', 'Myitkyina',    'Myitkyina',   'Civil Servant')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- ADDITIONAL COMPLETED SURVEY RESPONSES
-- Spread across the last 10 days (relative to now) so the participation
-- trend graph always shows fresh data. Responses cover all 5 products so the
-- popularity / ratings / comparison / age-group graphs all populate.
-- ============================================================
INSERT INTO survey_responses (id, user_id, campaign_id, product_id, survey_version_id, language, status, completed_at, created_at)
VALUES
  ('demo-response-7',  'demo-user-7',  'campaign-2026', 'beer-gold',   'sv-beer-v1', 'en', 'COMPLETED', datetime('now', '-5 days'),  datetime('now', '-5 days')),
  ('demo-response-8',  'demo-user-8',  'campaign-2026', 'beer-gold',   'sv-beer-v1', 'en', 'COMPLETED', datetime('now', '-7 days'),  datetime('now', '-7 days')),
  ('demo-response-9',  'demo-user-9',  'campaign-2026', 'beer-gold',   'sv-beer-v1', 'my', 'COMPLETED', datetime('now', '-9 days'),  datetime('now', '-9 days')),
  ('demo-response-10', 'demo-user-10', 'campaign-2026', 'beer-strong', 'sv-beer-v1', 'en', 'COMPLETED', datetime('now', '-3 days'),  datetime('now', '-3 days')),
  ('demo-response-11', 'demo-user-11', 'campaign-2026', 'beer-strong', 'sv-beer-v1', 'my', 'COMPLETED', datetime('now', '-2 days'),  datetime('now', '-2 days')),
  ('demo-response-12', 'demo-user-12', 'campaign-2026', 'beer-light',  'sv-beer-v1', 'en', 'COMPLETED', datetime('now', '-1 days'),  datetime('now', '-1 days')),
  ('demo-response-13', 'demo-user-13', 'campaign-2026', 'beer-light',  'sv-beer-v1', 'en', 'COMPLETED', datetime('now', '-6 days'),  datetime('now', '-6 days')),
  ('demo-response-14', 'demo-user-14', 'campaign-2026', 'beer-export', 'sv-beer-v1', 'my', 'COMPLETED', datetime('now', '-4 days'),  datetime('now', '-4 days')),
  ('demo-response-15', 'demo-user-15', 'campaign-2026', 'beer-export', 'sv-beer-v1', 'en', 'COMPLETED', datetime('now', '-8 days'),  datetime('now', '-8 days')),
  ('demo-response-16', 'demo-user-16', 'campaign-2026', 'beer',        'sv-beer-v1', 'my', 'COMPLETED', datetime('now', '-10 days'), datetime('now', '-10 days'))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADDITIONAL SURVEY ANSWERS (varied ratings & answers per user)
-- ============================================================
INSERT INTO survey_answers (id, response_id, question_id, answer_text, answer_number, answer_choice, answer_rating)
VALUES
  -- Response 7 (beer-gold)
  ('demo-ans-7-1',  'demo-response-7', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-7-2',  'demo-response-7', 'q2',  NULL, NULL, 'gold,strong', NULL),
  ('demo-ans-7-3',  'demo-response-7', 'q3',  NULL, 5, NULL, 5),
  ('demo-ans-7-4',  'demo-response-7', 'q4',  NULL, 9, NULL, 9),
  ('demo-ans-7-5',  'demo-response-7', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-7-6',  'demo-response-7', 'q6',  'Great taste and a smooth finish.', NULL, NULL, NULL),
  ('demo-ans-7-7',  'demo-response-7', 'q7',  NULL, NULL, 'convenience_store', NULL),
  ('demo-ans-7-8',  'demo-response-7', 'q8',  NULL, 5, NULL, 5),
  ('demo-ans-7-9',  'demo-response-7', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-7-10', 'demo-response-7', 'q10', NULL, NULL, 'friends', NULL),
  ('demo-ans-7-11', 'demo-response-7', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-7-12', 'demo-response-7', 'q12', NULL, NULL, 'social_media,tv', NULL),

  -- Response 8 (beer-gold)
  ('demo-ans-8-1',  'demo-response-8', 'q1',  NULL, NULL, 'daily', NULL),
  ('demo-ans-8-2',  'demo-response-8', 'q2',  NULL, NULL, 'gold', NULL),
  ('demo-ans-8-3',  'demo-response-8', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-8-4',  'demo-response-8', 'q4',  NULL, 8, NULL, 8),
  ('demo-ans-8-5',  'demo-response-8', 'q5',  NULL, NULL, 'strong', NULL),
  ('demo-ans-8-6',  'demo-response-8', 'q6',  'Always my go-to choice at gatherings.', NULL, NULL, NULL),
  ('demo-ans-8-7',  'demo-response-8', 'q7',  NULL, NULL, 'restaurant_pub', NULL),
  ('demo-ans-8-8',  'demo-response-8', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-8-9',  'demo-response-8', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-8-10', 'demo-response-8', 'q10', NULL, NULL, 'party', NULL),
  ('demo-ans-8-11', 'demo-response-8', 'q11', NULL, 5, NULL, 5),
  ('demo-ans-8-12', 'demo-response-8', 'q12', NULL, NULL, 'billboard,sponsor', NULL),

  -- Response 9 (beer-gold)
  ('demo-ans-9-1',  'demo-response-9', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-9-2',  'demo-response-9', 'q2',  NULL, NULL, 'classic,gold', NULL),
  ('demo-ans-9-3',  'demo-response-9', 'q3',  NULL, 3, NULL, 3),
  ('demo-ans-9-4',  'demo-response-9', 'q4',  NULL, 7, NULL, 7),
  ('demo-ans-9-5',  'demo-response-9', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-9-6',  'demo-response-9', 'q6',  NULL, NULL, NULL, NULL),
  ('demo-ans-9-7',  'demo-response-9', 'q7',  NULL, NULL, 'supermarket', NULL),
  ('demo-ans-9-8',  'demo-response-9', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-9-9',  'demo-response-9', 'q9',  NULL, NULL, 'no', NULL),
  ('demo-ans-9-10', 'demo-response-9', 'q10', NULL, NULL, 'family_dinner', NULL),
  ('demo-ans-9-11', 'demo-response-9', 'q11', NULL, 3, NULL, 3),
  ('demo-ans-9-12', 'demo-response-9', 'q12', NULL, NULL, 'tv,in_store', NULL),

  -- Response 10 (beer-strong)
  ('demo-ans-10-1',  'demo-response-10', 'q1',  NULL, NULL, 'rarely', NULL),
  ('demo-ans-10-2',  'demo-response-10', 'q2',  NULL, NULL, 'gold,strong', NULL),
  ('demo-ans-10-3',  'demo-response-10', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-10-4',  'demo-response-10', 'q4',  NULL, 8, NULL, 8),
  ('demo-ans-10-5',  'demo-response-10', 'q5',  NULL, NULL, 'strong', NULL),
  ('demo-ans-10-6',  'demo-response-10', 'q6',  'Strong but a bit too heavy for casual nights.', NULL, NULL, NULL),
  ('demo-ans-10-7',  'demo-response-10', 'q7',  NULL, NULL, 'online', NULL),
  ('demo-ans-10-8',  'demo-response-10', 'q8',  NULL, 3, NULL, 3),
  ('demo-ans-10-9',  'demo-response-10', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-10-10', 'demo-response-10', 'q10', NULL, NULL, 'relax', NULL),
  ('demo-ans-10-11', 'demo-response-10', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-10-12', 'demo-response-10', 'q12', NULL, NULL, 'social_media', NULL),

  -- Response 11 (beer-strong)
  ('demo-ans-11-1',  'demo-response-11', 'q1',  NULL, NULL, 'monthly', NULL),
  ('demo-ans-11-2',  'demo-response-11', 'q2',  NULL, NULL, 'strong', NULL),
  ('demo-ans-11-3',  'demo-response-11', 'q3',  NULL, 2, NULL, 2),
  ('demo-ans-11-4',  'demo-response-11', 'q4',  NULL, 5, NULL, 5),
  ('demo-ans-11-5',  'demo-response-11', 'q5',  NULL, NULL, 'strong', NULL),
  ('demo-ans-11-6',  'demo-response-11', 'q6',  NULL, NULL, NULL, NULL),
  ('demo-ans-11-7',  'demo-response-11', 'q7',  NULL, NULL, 'restaurant_pub', NULL),
  ('demo-ans-11-8',  'demo-response-11', 'q8',  NULL, 3, NULL, 3),
  ('demo-ans-11-9',  'demo-response-11', 'q9',  NULL, NULL, 'no', NULL),
  ('demo-ans-11-10', 'demo-response-11', 'q10', NULL, NULL, 'friends', NULL),
  ('demo-ans-11-11', 'demo-response-11', 'q11', NULL, 2, NULL, 2),
  ('demo-ans-11-12', 'demo-response-11', 'q12', NULL, NULL, 'print,tv', NULL),

  -- Response 12 (beer-light)
  ('demo-ans-12-1',  'demo-response-12', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-12-2',  'demo-response-12', 'q2',  NULL, NULL, 'light,classic', NULL),
  ('demo-ans-12-3',  'demo-response-12', 'q3',  NULL, 5, NULL, 5),
  ('demo-ans-12-4',  'demo-response-12', 'q4',  NULL, 9, NULL, 9),
  ('demo-ans-12-5',  'demo-response-12', 'q5',  NULL, NULL, 'light', NULL),
  ('demo-ans-12-6',  'demo-response-12', 'q6',  'Light and refreshing, perfect for hot days.', NULL, NULL, NULL),
  ('demo-ans-12-7',  'demo-response-12', 'q7',  NULL, NULL, 'supermarket', NULL),
  ('demo-ans-12-8',  'demo-response-12', 'q8',  NULL, 5, NULL, 5),
  ('demo-ans-12-9',  'demo-response-12', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-12-10', 'demo-response-12', 'q10', NULL, NULL, 'relax', NULL),
  ('demo-ans-12-11', 'demo-response-12', 'q11', NULL, 5, NULL, 5),
  ('demo-ans-12-12', 'demo-response-12', 'q12', NULL, NULL, 'social_media,in_store', NULL),

  -- Response 13 (beer-light)
  ('demo-ans-13-1',  'demo-response-13', 'q1',  NULL, NULL, 'daily', NULL),
  ('demo-ans-13-2',  'demo-response-13', 'q2',  NULL, NULL, 'light,gold', NULL),
  ('demo-ans-13-3',  'demo-response-13', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-13-4',  'demo-response-13', 'q4',  NULL, 7, NULL, 7),
  ('demo-ans-13-5',  'demo-response-13', 'q5',  NULL, NULL, 'light', NULL),
  ('demo-ans-13-6',  'demo-response-13', 'q6',  NULL, NULL, NULL, NULL),
  ('demo-ans-13-7',  'demo-response-13', 'q7',  NULL, NULL, 'convenience_store', NULL),
  ('demo-ans-13-8',  'demo-response-13', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-13-9',  'demo-response-13', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-13-10', 'demo-response-13', 'q10', NULL, NULL, 'friends', NULL),
  ('demo-ans-13-11', 'demo-response-13', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-13-12', 'demo-response-13', 'q12', NULL, NULL, 'tv,billboard', NULL),

  -- Response 14 (beer-export)
  ('demo-ans-14-1',  'demo-response-14', 'q1',  NULL, NULL, 'weekly', NULL),
  ('demo-ans-14-2',  'demo-response-14', 'q2',  NULL, NULL, 'export,classic', NULL),
  ('demo-ans-14-3',  'demo-response-14', 'q3',  NULL, 3, NULL, 3),
  ('demo-ans-14-4',  'demo-response-14', 'q4',  NULL, 6, NULL, 6),
  ('demo-ans-14-5',  'demo-response-14', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-14-6',  'demo-response-14', 'q6',  'Good quality overall.', NULL, NULL, NULL),
  ('demo-ans-14-7',  'demo-response-14', 'q7',  NULL, NULL, 'duty_free', NULL),
  ('demo-ans-14-8',  'demo-response-14', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-14-9',  'demo-response-14', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-14-10', 'demo-response-14', 'q10', NULL, NULL, 'family_dinner', NULL),
  ('demo-ans-14-11', 'demo-response-14', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-14-12', 'demo-response-14', 'q12', NULL, NULL, 'print', NULL),

  -- Response 15 (beer-export)
  ('demo-ans-15-1',  'demo-response-15', 'q1',  NULL, NULL, 'rarely', NULL),
  ('demo-ans-15-2',  'demo-response-15', 'q2',  NULL, NULL, 'export,gold', NULL),
  ('demo-ans-15-3',  'demo-response-15', 'q3',  NULL, 5, NULL, 5),
  ('demo-ans-15-4',  'demo-response-15', 'q4',  NULL, 9, NULL, 9),
  ('demo-ans-15-5',  'demo-response-15', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-15-6',  'demo-response-15', 'q6',  NULL, NULL, NULL, NULL),
  ('demo-ans-15-7',  'demo-response-15', 'q7',  NULL, NULL, 'online', NULL),
  ('demo-ans-15-8',  'demo-response-15', 'q8',  NULL, 5, NULL, 5),
  ('demo-ans-15-9',  'demo-response-15', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-15-10', 'demo-response-15', 'q10', NULL, NULL, 'sports', NULL),
  ('demo-ans-15-11', 'demo-response-15', 'q11', NULL, 5, NULL, 5),
  ('demo-ans-15-12', 'demo-response-15', 'q12', NULL, NULL, 'social_media,sponsor', NULL),

  -- Response 16 (beer)
  ('demo-ans-16-1',  'demo-response-16', 'q1',  NULL, NULL, 'monthly', NULL),
  ('demo-ans-16-2',  'demo-response-16', 'q2',  NULL, NULL, 'classic', NULL),
  ('demo-ans-16-3',  'demo-response-16', 'q3',  NULL, 4, NULL, 4),
  ('demo-ans-16-4',  'demo-response-16', 'q4',  NULL, 8, NULL, 8),
  ('demo-ans-16-5',  'demo-response-16', 'q5',  NULL, NULL, 'original', NULL),
  ('demo-ans-16-6',  'demo-response-16', 'q6',  'The classic is still my favorite.', NULL, NULL, NULL),
  ('demo-ans-16-7',  'demo-response-16', 'q7',  NULL, NULL, 'supermarket', NULL),
  ('demo-ans-16-8',  'demo-response-16', 'q8',  NULL, 4, NULL, 4),
  ('demo-ans-16-9',  'demo-response-16', 'q9',  NULL, NULL, 'yes', NULL),
  ('demo-ans-16-10', 'demo-response-16', 'q10', NULL, NULL, 'family_dinner', NULL),
  ('demo-ans-16-11', 'demo-response-16', 'q11', NULL, 4, NULL, 4),
  ('demo-ans-16-12', 'demo-response-16', 'q12', NULL, NULL, 'print,tv', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADDITIONAL REWARD SPINS & DELIVERIES
-- Varied statuses: DELIVERED x3, SHIPPED x2, PROCESSING x1,
-- DELIVERY_SUBMITTED x1, CANCELLED x1, no-prize x1.
-- ============================================================
INSERT INTO reward_spins (id, user_id, campaign_id, product_id, reward_id, status, selected_at, created_at)
VALUES
  ('demo-spin-7',  'demo-user-7',  'campaign-2026', 'beer-gold',   'reward-tumbler', 'DELIVERED',          datetime('now', '-5 days'), datetime('now', '-5 days')),
  ('demo-spin-8',  'demo-user-8',  'campaign-2026', 'beer-gold',   'reward-t-shirt', 'SHIPPED',            datetime('now', '-7 days'), datetime('now', '-7 days')),
  ('demo-spin-9',  'demo-user-9',  'campaign-2026', 'beer-gold',   'reward-cap',     'PROCESSING',         datetime('now', '-9 days'), datetime('now', '-9 days')),
  ('demo-spin-10', 'demo-user-10', 'campaign-2026', 'beer-strong', 'reward-t-shirt', 'DELIVERY_SUBMITTED', datetime('now', '-3 days'), datetime('now', '-3 days')),
  ('demo-spin-11', 'demo-user-11', 'campaign-2026', 'beer-strong', 'reward-cooler',  'SHIPPED',            datetime('now', '-2 days'), datetime('now', '-2 days')),
  ('demo-spin-12', 'demo-user-12', 'campaign-2026', 'beer-light',  'reward-tumbler', 'DELIVERED',          datetime('now', '-1 days'), datetime('now', '-1 days')),
  ('demo-spin-13', 'demo-user-13', 'campaign-2026', 'beer-light',  'reward-cap',     'CANCELLED',          datetime('now', '-6 days'), datetime('now', '-6 days')),
  ('demo-spin-14', 'demo-user-14', 'campaign-2026', 'beer-export', 'reward-no-prize','WON',                datetime('now', '-4 days'), datetime('now', '-4 days'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_rewards (id, user_id, reward_spin_id, reward_id, delivery_status, won_at, delivered_at, created_at)
VALUES
  ('demo-ur-7',  'demo-user-7',  'demo-spin-7',  'reward-tumbler', 'DELIVERED',          datetime('now', '-5 days'), datetime('now', '-4 days'), datetime('now', '-5 days')),
  ('demo-ur-8',  'demo-user-8',  'demo-spin-8',  'reward-t-shirt', 'SHIPPED',            datetime('now', '-7 days'), NULL,                       datetime('now', '-7 days')),
  ('demo-ur-9',  'demo-user-9',  'demo-spin-9',  'reward-cap',     'PROCESSING',         datetime('now', '-9 days'), NULL,                       datetime('now', '-9 days')),
  ('demo-ur-10', 'demo-user-10', 'demo-spin-10', 'reward-t-shirt', 'DELIVERY_SUBMITTED', datetime('now', '-3 days'), NULL,                       datetime('now', '-3 days')),
  ('demo-ur-11', 'demo-user-11', 'demo-spin-11', 'reward-cooler',  'SHIPPED',            datetime('now', '-2 days'), NULL,                       datetime('now', '-2 days')),
  ('demo-ur-12', 'demo-user-12', 'demo-spin-12', 'reward-tumbler', 'DELIVERED',          datetime('now', '-1 days'), datetime('now', '-1 days'), datetime('now', '-1 days')),
  ('demo-ur-13', 'demo-user-13', 'demo-spin-13', 'reward-cap',     'CANCELLED',          datetime('now', '-6 days'), NULL,                       datetime('now', '-6 days')),
  ('demo-ur-14', 'demo-user-14', 'demo-spin-14', 'reward-no-prize','DELIVERY_PENDING',   datetime('now', '-4 days'), NULL,                       datetime('now', '-4 days'))
ON CONFLICT (id) DO NOTHING;

-- Delivery information for rewards that progressed past pending
INSERT INTO delivery_information (id, user_reward_id, full_name, phone, address, city, township, postal_code, additional_notes, created_at)
VALUES
  ('demo-di-7',  'demo-ur-7',  'Hnin Wai Zin',  '0911000077', 'No. 21, Inya Road',        'Yangon',     'Kamayut',     '11041', 'Leave at the front desk',     datetime('now', '-5 days')),
  ('demo-di-8',  'demo-ur-8',  'Zaw Min Oo',    '0911000088', 'No. 9, 26th Street',       'Mandalay',   'Chanmyathazi', '10021', NULL,                          datetime('now', '-7 days')),
  ('demo-di-9',  'demo-ur-9',  'U Ba Htay',     '0911000099', 'No. 3, Main Road',         'Pathein',    'Pathein',     '13011', 'Call before delivery',        datetime('now', '-9 days')),
  ('demo-di-10', 'demo-ur-10', 'May Thu Aung',  '0911001010', 'No. 45, Bogalay Street',      'Yangon',     'Sanchaung',   '11111', NULL,                          datetime('now', '-3 days')),
  ('demo-di-11', 'demo-ur-11', 'U Aung Myint',  '0911001111', 'No. 12, Kanda Street',        'Taunggyi',   'Taunggyi',    '14071', 'Deliver after 5pm',           datetime('now', '-2 days')),
  ('demo-di-12', 'demo-ur-12', 'Khin Myo Thant','0911001212', 'No. 88, Kyaikpaw Road',       'Bago',       'Bago',        '08011', NULL,                          datetime('now', '-1 days')),
  ('demo-di-13', 'demo-ur-13', 'Kyaw Swar Win', '0911001313', 'No. 5, Myoma Kyaung Street',  'Yangon',     'Dagon',       '11191', 'Delivery cancelled by customer', datetime('now', '-6 days'))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADJUST REWARD STOCK & INVENTORY LEDGER
-- Awards: tumbler x2, t-shirt x3, cap x1 (+1 returned), cooler x1, no-prize x1
-- ============================================================
UPDATE rewards SET remaining_quantity = remaining_quantity - 2 WHERE id = 'reward-tumbler';
UPDATE rewards SET remaining_quantity = remaining_quantity - 3 WHERE id = 'reward-t-shirt';
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-cap';
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-cooler';
UPDATE rewards SET remaining_quantity = remaining_quantity - 1 WHERE id = 'reward-no-prize';

INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, reference_id, created_by, created_at)
VALUES
  ('demo-inv-7',   'reward-tumbler',  'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-7',  'demo-user-7',  datetime('now', '-5 days')),
  ('demo-inv-8',   'reward-t-shirt',  'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-8',  'demo-user-8',  datetime('now', '-7 days')),
  ('demo-inv-9',   'reward-cap',      'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-9',  'demo-user-9',  datetime('now', '-9 days')),
  ('demo-inv-10',  'reward-t-shirt',  'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-10', 'demo-user-10', datetime('now', '-3 days')),
  ('demo-inv-11',  'reward-cooler',   'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-11', 'demo-user-11', datetime('now', '-2 days')),
  ('demo-inv-12',  'reward-tumbler',  'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-12', 'demo-user-12', datetime('now', '-1 days')),
  ('demo-inv-13a', 'reward-cap',      'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-13', 'demo-user-13', datetime('now', '-6 days')),
  ('demo-inv-13b', 'reward-cap',      'CANCELLATION_RETURN',  1, 'reward_spin', 'demo-spin-13', 'demo-user-13', datetime('now', '-6 days')),
  ('demo-inv-14',  'reward-no-prize', 'REWARD_AWARDED',      -1, 'reward_spin', 'demo-spin-14', 'demo-user-14', datetime('now', '-4 days'))
ON CONFLICT (id) DO NOTHING;