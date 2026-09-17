-- Migration number: 0011 2026-09-17T00:00:00.000Z
-- Seed demo product-photo questions. `product_type` stores the product id
-- (see products table); the survey renders that product's photo + name as a card.

INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, is_active, validation_rules, image_url, product_type)
VALUES
  ('photo-rate-gold',   'sv-beer-v1', 'How would you rate the look of this Myanmar Beer Gold bottle?',   'rating',        1, 100, 1, '{"required":true,"min":1,"max":5}', '/assets/beer-gold.png',   'beer-gold'),
  ('photo-rate-light',  'sv-beer-v1', 'How would you rate the look of this Myanmar Beer Light bottle?',  'rating',        1, 101, 1, '{"required":true,"min":1,"max":5}', '/assets/beer-light.png',  'beer-light'),
  ('photo-rate-strong', 'sv-beer-v1', 'How would you rate the look of this Myanmar Beer Strong bottle?', 'rating',        1, 102, 1, '{"required":true,"min":1,"max":5}', '/assets/beer-strong.png', 'beer-strong'),
  ('photo-choose-next', 'sv-beer-v1', 'Which Myanmar Beer product would you like to try next?',           'single_choice', 1, 103, 1, '{"required":true}',                 '/assets/beer.png',        'beer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_question_translations (id, question_id, language, question_text)
VALUES
  ('photo-rate-gold-my',   'photo-rate-gold',   'my', 'ဤ မြန်မာဘီယာ Gold ပုလင်းအသွင်အပြင်ကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('photo-rate-light-my',  'photo-rate-light',  'my', 'ဤ မြန်မာဘီယာ Light ပုလင်းအသွင်အပြင်ကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('photo-rate-strong-my', 'photo-rate-strong', 'my', 'ဤ မြန်မာဘီယာ Strong ပုလင်းအသွင်အပြင်ကို ဘယ်လောက် အဆင့်သတ်မှတ်ပါသလဲ?'),
  ('photo-choose-next-my', 'photo-choose-next', 'my', 'နောက်တစ်ခု စမ်းကြည့်လိုသော မြန်မာဘီယာ ထုတ်ကုန်က ဘယ်ဟာလဲ?')
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_options (id, question_id, option_text, option_value, display_order, is_active)
VALUES
  ('photo-choose-next-o1', 'photo-choose-next', 'Myanmar Beer',      'beer',        1, 1),
  ('photo-choose-next-o2', 'photo-choose-next', 'Myanmar Beer Gold', 'beer-gold',   2, 1),
  ('photo-choose-next-o3', 'photo-choose-next', 'Myanmar Beer Light','beer-light',  3, 1),
  ('photo-choose-next-o4', 'photo-choose-next', 'Myanmar Beer Strong','beer-strong',4, 1),
  ('photo-choose-next-o5', 'photo-choose-next', 'Myanmar Beer Export','beer-export',5, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_option_translations (id, option_id, language, option_text)
VALUES
  ('photo-choose-next-o1-my', 'photo-choose-next-o1', 'my', 'မြန်မာဘီယာ'),
  ('photo-choose-next-o2-my', 'photo-choose-next-o2', 'my', 'မြန်မာဘီယာ Gold'),
  ('photo-choose-next-o3-my', 'photo-choose-next-o3', 'my', 'မြန်မာဘီယာ Light'),
  ('photo-choose-next-o4-my', 'photo-choose-next-o4', 'my', 'မြန်မာဘီယာ Strong'),
  ('photo-choose-next-o5-my', 'photo-choose-next-o5', 'my', 'မြန်မာဘီယာ Export')
ON CONFLICT (id) DO NOTHING;
