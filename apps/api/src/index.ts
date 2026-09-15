import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  survey_db: D1Database;
  JWT_SECRET: string;
};

type Variables = {
  userId: string;
  isAdmin: boolean;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateId(): string {
  return crypto.randomUUID();
}

function orNull<T>(value: T | undefined | null): T | null {
  return value === undefined ? null : value;
}

function getAgeGroup(age: number): string {
  if (age < 18) return 'under_18';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  return '55+';
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getJwtSecret(env: Bindings): string {
  return env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8ToBase64Url(text: string): string {
  return toBase64Url(new TextEncoder().encode(text));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

async function createToken(userId: string, role: string, secret: string): Promise<string> {
  const header = utf8ToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = utf8ToBase64Url(JSON.stringify({
    sub: userId,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  }));
  const signingInput = `${header}.${payload}`;
  const signature = toBase64Url(await hmacSha256(secret, signingInput));
  return `${signingInput}.${signature}`;
}

async function decodeToken(token: string, secret: string): Promise<{ sub: string; role: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expected = await hmacSha256(secret, signingInput);
    const actual = fromBase64Url(parts[2]);
    if (!timingSafeEqual(expected, actual)) return null;
    const payloadJson = new TextDecoder().decode(fromBase64Url(parts[1]));
    const payload = JSON.parse(payloadJson);
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: payload.sub, role: payload.role || 'user' };
  } catch {
    return null;
  }
}

function isAnswerPresent(type: string, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (type === 'multiple_choice') return Array.isArray(value) && value.length > 0;
  if (type === 'text' || type === 'long_text') return String(value).trim().length > 0;
  if (type === 'rating' || type === 'number') return value !== '' && !Number.isNaN(Number(value));
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

function jsonError(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ success: false, error: { code: 'ERROR', message } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function jsonSuccess(data: any) {
  return new Response(
    JSON.stringify({ success: true, data }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('Unauthorized', 401);
  }
  const token = authHeader.slice(7);
  const decoded = await decodeToken(token, getJwtSecret(c.env));
  if (!decoded) {
    return jsonError('Invalid token', 401);
  }
  c.set('userId', decoded.sub);
  c.set('isAdmin', decoded.role === 'admin');
  return await next();
}

async function adminMiddleware(c: any, next: any) {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const user = await db.prepare('SELECT is_admin, is_active FROM users WHERE id = ?').bind(userId).first() as any;
  if (!user || !user.is_admin || !user.is_active) {
    return jsonError('Forbidden', 403);
  }
  c.set('isAdmin', true);
  return await next();
}

// ============================================================
// PUBLIC ROUTES - AUTH
// ============================================================

// Register
app.post('/auth/register', async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { fullName, email, phone, password, age, gender, city, township, nrcState, nrcType, nrcNumber, occupation } = body;

  if (!fullName || !email || !password) {
    return jsonError('Full name, email, and password are required');
  }

  // Check age requirement
  if (age && age < 18) {
    return jsonError('Must be at least 18 years old');
  }

  // Check existing user
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return jsonError('Email already registered');
  }

  if (phone) {
    const phoneExists = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
    if (phoneExists) {
      return jsonError('Phone number already registered');
    }
  }

  const id = generateId();
  const passwordHash = await hashPassword(password);
  const ageGroup = age ? getAgeGroup(age) : null;

  await db.prepare(`
    INSERT INTO users (id, full_name, email, phone, password_hash, age, age_group, gender, city, township, nrc_state, nrc_type, nrc_number, occupation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, fullName, email, phone || null, passwordHash, age || null, ageGroup, gender || null, city || null, township || null, nrcState || null, nrcType || null, nrcNumber || null, occupation || null).run();

  const token = await createToken(id, 'user', getJwtSecret(c.env));

  return jsonSuccess({ userId: id, token, user: { id, fullName, email } });
});

// Login
app.post('/auth/login', async (c) => {
  const db = c.env.survey_db;
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return jsonError('Email and password are required');
  }

  const passwordHash = await hashPassword(password);
  const user = await db.prepare('SELECT id, full_name, email, is_active FROM users WHERE email = ? AND password_hash = ?').bind(email, passwordHash).first();

  if (!user) {
    return jsonError('Invalid credentials', 401);
  }

  if (!(user as any).is_active) {
    return jsonError('Account is disabled', 403);
  }

  const token = await createToken((user as any).id, 'user', getJwtSecret(c.env));

  return jsonSuccess({ userId: (user as any).id, token, user: { id: (user as any).id, fullName: (user as any).full_name, email: (user as any).email } });
});

// Admin login
app.post('/auth/admin/login', async (c) => {
  const db = c.env.survey_db;
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return jsonError('Email and password are required');
  }

  const passwordHash = await hashPassword(password);
  const user = await db.prepare('SELECT id, full_name, email, is_active, is_admin FROM users WHERE email = ? AND password_hash = ?').bind(email, passwordHash).first();

  if (!user) {
    return jsonError('Invalid credentials', 401);
  }

  if (!(user as any).is_active || !(user as any).is_admin) {
    return jsonError('Not authorized as admin', 403);
  }

  const token = await createToken((user as any).id, 'admin', getJwtSecret(c.env));

  return jsonSuccess({ userId: (user as any).id, token, user: { id: (user as any).id, fullName: (user as any).full_name, email: (user as any).email } });
});

// ============================================================
// USER PROFILE ROUTES
// ============================================================

// Create a guest user from the personal information form (no email/password needed)
app.post('/users/guest', async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { fullName, phone, dob, nrcState, nrcType, nrcNumber } = body || {};

  if (!fullName || !phone || !dob) {
    return jsonError('Full name, phone number, and date of birth are required');
  }

  const dobDate = new Date(`${dob}T00:00:00Z`);
  if (isNaN(dobDate.getTime())) {
    return jsonError('Invalid date of birth');
  }

  const age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) {
    return jsonError('Must be at least 18 years old');
  }
  const ageGroup = getAgeGroup(age);

  // Reuse an existing user by phone so repeat surveys stay linked
  const existing = await db.prepare('SELECT id, email, password_hash FROM users WHERE phone = ?').bind(phone).first() as any;

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db.prepare(`
      UPDATE users SET full_name = ?, age = ?, age_group = ?, dob = ?, nrc_state = ?, nrc_type = ?, nrc_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(fullName, age, ageGroup, dob || null, nrcState || null, nrcType || null, nrcNumber || null, userId).run();
  } else {
    userId = generateId();
    const passwordHash = await hashPassword(crypto.randomUUID());
    await db.prepare(`
      INSERT INTO users (id, full_name, phone, password_hash, age, age_group, dob, nrc_state, nrc_type, nrc_number, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(userId, fullName, phone, passwordHash, age, ageGroup, dob || null, nrcState || null, nrcType || null, nrcNumber || null).run();
  }

  const token = await createToken(userId, 'user', getJwtSecret(c.env));

  return jsonSuccess({ userId, token, user: { id: userId, fullName, phone } });
});

// Get current user profile
app.get('/user/profile', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');

  const user = await db.prepare(`
    SELECT id, full_name, email, phone, age, age_group, gender, city, township, nrc_state, nrc_type, nrc_number, occupation, created_at
    FROM users WHERE id = ?
  `).bind(userId).first();

  if (!user) return jsonError('User not found', 404);

  return jsonSuccess(user);
});

// Update user profile
app.patch('/user/profile', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const body = await c.req.json();

  const { fullName, phone, age, gender, city, township, nrcState, nrcType, nrcNumber, occupation } = body;

  let ageGroup = null;
  if (age) {
    ageGroup = getAgeGroup(age);
  }

  await db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      phone = COALESCE(?, phone),
      age = COALESCE(?, age),
      age_group = COALESCE(?, age_group),
      gender = COALESCE(?, gender),
      city = COALESCE(?, city),
      township = COALESCE(?, township),
      nrc_state = COALESCE(?, nrc_state),
      nrc_type = COALESCE(?, nrc_type),
      nrc_number = COALESCE(?, nrc_number),
      occupation = COALESCE(?, occupation),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(fullName || null, phone || null, age || null, ageGroup, gender || null, city || null, township || null, nrcState || null, nrcType || null, nrcNumber || null, occupation || null, userId).run();

  return jsonSuccess({ message: 'Profile updated' });
});

// ============================================================
// PUBLIC ROUTES - PRODUCTS
// ============================================================

app.get('/products', async (c) => {
  const db = c.env.survey_db;
  const lang = c.req.query('lang') || 'en';

  const products = await db.prepare(`
    SELECT p.id, p.name, p.description, p.brand, p.image_url, p.display_order,
           COALESCE(pt.name, p.name) as name,
           COALESCE(pt.description, p.description) as description
    FROM products p
    LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.language = ?
    WHERE p.is_active = 1
    ORDER BY p.display_order
  `).bind(lang).all();

  return jsonSuccess(products.results);
});

// ============================================================
// PUBLIC ROUTES - CAMPAIGNS
// ============================================================

app.get('/campaigns', async (c) => {
  const db = c.env.survey_db;
  const lang = c.req.query('lang') || 'en';

  const campaigns = await db.prepare(`
    SELECT c.id, c.name, c.description, c.slug, c.start_date, c.end_date,
           COALESCE(ct.name, c.name) as name,
           COALESCE(ct.description, c.description) as description
    FROM campaigns c
    LEFT JOIN campaign_translations ct ON c.id = ct.campaign_id AND ct.language = ?
    WHERE c.is_active = 1
    ORDER BY c.start_date DESC
  `).bind(lang).all();

  return jsonSuccess(campaigns.results);
});

// ============================================================
// SURVEY ROUTES
// ============================================================

// Get survey questions for a product
app.get('/survey/questions/:productId', async (c) => {
  const db = c.env.survey_db;
  const productId = c.req.param('productId');
  const lang = c.req.query('lang') || 'en';

  // Get active survey version for product
  const version = await db.prepare(`
    SELECT id, title, description FROM survey_versions
    WHERE product_id = ? AND is_active = 1
    ORDER BY version DESC LIMIT 1
  `).bind(productId).first() as any;

  if (!version) {
    return jsonError('No active survey found', 404);
  }

  // Get questions with translations
  const questions = await db.prepare(`
    SELECT q.id, q.question_type, q.is_required, q.display_order, q.validation_rules,
           COALESCE(qt.question_text, q.question_text) as question_text
    FROM survey_questions q
    LEFT JOIN survey_question_translations qt ON q.id = qt.question_id AND qt.language = ?
    WHERE q.survey_version_id = ? AND q.is_active = 1
    ORDER BY q.display_order
  `).bind(lang, version.id).all();

  // Get options for each question
  const questionsWithOptions = await Promise.all(
    (questions.results as any[]).map(async (q) => {
      const options = await db.prepare(`
        SELECT o.id, o.option_value, o.display_order,
               COALESCE(ot.option_text, o.option_text) as option_text
        FROM survey_options o
        LEFT JOIN survey_option_translations ot ON o.id = ot.option_id AND ot.language = ?
        WHERE o.question_id = ? AND o.is_active = 1
        ORDER BY o.display_order
      `).bind(lang, q.id).all();

      // Get conditions
      const conditions = await db.prepare(`
        SELECT * FROM survey_question_conditions
        WHERE question_id = ? AND is_active = 1
      `).bind(q.id).all();

      return { ...q, options: options.results, conditions: conditions.results };
    })
  );

  return jsonSuccess({ version, questions: questionsWithOptions });
});

// Submit survey response
app.post('/survey/submit', async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { userId, productId, campaignId, language, answers, profile } = body;

  if (!productId || !answers || !Array.isArray(answers)) {
    return jsonError('Product ID and answers are required');
  }

  const answersByQuestion = new Map(answers.map((a: any) => [a.questionId, a]));

  // Get or create user
  let actualUserId = userId;
  if (!actualUserId && profile) {
    // Create user from profile
    actualUserId = generateId();
    const ageGroup = profile.age ? getAgeGroup(profile.age) : null;
    await db.prepare(`
      INSERT INTO users (id, full_name, email, phone, age, age_group, gender, city, township, occupation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(actualUserId, profile.fullName || 'Anonymous', profile.email || null, profile.phone || null, profile.age || null, ageGroup, profile.gender || null, profile.city || null, profile.township || null, profile.occupation || null).run();
  }

  if (!actualUserId) {
    return jsonError('User ID or profile required');
  }

  // Get active survey version
  const version = await db.prepare(`
    SELECT id FROM survey_versions WHERE product_id = ? AND is_active = 1
    ORDER BY version DESC LIMIT 1
  `).bind(productId).first() as any;

  if (!version) {
    return jsonError('No active survey found');
  }

  const requiredQuestions = await db.prepare(`
    SELECT id, question_type, is_required, question_text
    FROM survey_questions
    WHERE survey_version_id = ? AND is_active = 1
  `).bind(version.id).all();

  for (const question of (requiredQuestions.results as any[])) {
    if (!question.is_required) continue;
    const answer = answersByQuestion.get(question.id);
    if (!isAnswerPresent(question.question_type, answer?.value)) {
      return jsonError(`Missing required answer for: ${question.question_text}`);
    }
  }

  // Create response
  const responseId = generateId();
  await db.prepare(`
    INSERT INTO survey_responses (id, user_id, campaign_id, product_id, survey_version_id, language, status, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', datetime('now'))
  `).bind(responseId, actualUserId, campaignId || null, productId, version.id, language || 'en').run();

  // Insert answers
  for (const answer of answers) {
    const answerId = generateId();
    let answerText = null;
    let answerNumber = null;
    let answerChoice = null;
    let answerRating = null;

    if (answer.type === 'text' || answer.type === 'long_text') {
      answerText = answer.value;
    } else if (answer.type === 'number' || answer.type === 'rating') {
      answerNumber = answer.value;
      answerRating = answer.type === 'rating' ? answer.value : null;
    } else if (answer.type === 'single_choice' || answer.type === 'multiple_choice' || answer.type === 'yes_no' || answer.type === 'dropdown') {
      answerChoice = Array.isArray(answer.value) ? answer.value.join(',') : answer.value;
    }

    await db.prepare(`
      INSERT INTO survey_answers (id, response_id, question_id, answer_text, answer_number, answer_choice, answer_rating)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(answerId, responseId, answer.questionId, answerText, answerNumber, answerChoice, answerRating).run();
  }

  return jsonSuccess({ responseId, message: 'Survey submitted successfully' });
});

// ============================================================
// REWARD ROUTES
// ============================================================

// Get available rewards for spin
app.get('/rewards', async (c) => {
  const db = c.env.survey_db;
  const lang = c.req.query('lang') || 'en';

  const rewards = await db.prepare(`
    SELECT r.id, r.name, r.description, r.image_url, r.weight, r.status,
           COALESCE(rt.name, r.name) as name,
           COALESCE(rt.description, r.description) as description
    FROM rewards r
    LEFT JOIN reward_translations rt ON r.id = rt.reward_id AND rt.language = ?
    WHERE r.is_active = 1 AND r.remaining_quantity > 0 AND r.status != 'EXHAUSTED' AND r.status != 'PAUSED'
    ORDER BY r.weight DESC
  `).bind(lang).all();

  return jsonSuccess(rewards.results);
});

// Spin the wheel (server-determined result)
app.post('/rewards/spin', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const { campaignId, productId } = body;
  const campaignKey = campaignId || 'default';

  const existingSpin = await db.prepare(`
    SELECT id FROM reward_spins
    WHERE user_id = ? AND campaign_id = ? AND status != 'CANCELLED'
  `).bind(userId, campaignKey).first();

  if (existingSpin) {
    return jsonError('You have already spun the wheel for this campaign');
  }

  const spinId = generateId();
  try {
    await db.prepare(`
      INSERT INTO reward_spins (id, user_id, campaign_id, product_id, reward_id, status)
      VALUES (?, ?, ?, ?, NULL, 'WON')
    `).bind(spinId, userId, campaignKey, productId || null).run();
  } catch {
    return jsonError('You have already spun the wheel for this campaign');
  }

  const rewards = await db.prepare(`
    SELECT id, name, weight, remaining_quantity FROM rewards
    WHERE is_active = 1 AND remaining_quantity > 0 AND status != 'EXHAUSTED' AND status != 'PAUSED'
    AND (campaign_id = ? OR campaign_id IS NULL OR ? = 'default')
    ORDER BY weight DESC
  `).bind(campaignKey, campaignKey).all();

  if (!rewards.results || (rewards.results as any[]).length === 0) {
    await db.prepare("UPDATE reward_spins SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").bind(spinId).run();
    return jsonError('No rewards available');
  }

  const totalWeight = (rewards.results as any[]).reduce((sum, r) => sum + r.weight, 0);

  let random = Math.random() * totalWeight;
  let selectedReward = (rewards.results as any[])[0];

  for (const reward of rewards.results as any[]) {
    random -= reward.weight;
    if (random <= 0) {
      selectedReward = reward;
      break;
    }
  }

  const result = await db.prepare(`
    UPDATE rewards SET remaining_quantity = remaining_quantity - 1, updated_at = datetime('now')
    WHERE id = ? AND remaining_quantity > 0
  `).bind(selectedReward.id).run();

  if (result.meta?.changes === 0) {
    await db.prepare("UPDATE reward_spins SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").bind(spinId).run();
    return jsonError('Reward out of stock. Please try again.', 409);
  }

  const reward = await db.prepare('SELECT remaining_quantity, low_stock_threshold FROM rewards WHERE id = ?').bind(selectedReward.id).first() as any;
  let newStatus = 'AVAILABLE';
  if (reward.remaining_quantity <= 0) newStatus = 'EXHAUSTED';
  else if (reward.remaining_quantity <= (reward.low_stock_threshold || 10)) newStatus = 'LOW_STOCK';

  await db.prepare('UPDATE rewards SET status = ? WHERE id = ?').bind(newStatus, selectedReward.id).run();
  await db.prepare('UPDATE reward_spins SET reward_id = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(selectedReward.id, spinId).run();

  const userRewardId = generateId();
  await db.prepare(`
    INSERT INTO user_rewards (id, user_id, reward_spin_id, reward_id, delivery_status, won_at)
    VALUES (?, ?, ?, ?, 'DELIVERY_PENDING', datetime('now'))
  `).bind(userRewardId, userId, spinId, selectedReward.id).run();

  await db.prepare(`
    INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, reference_id, created_by)
    VALUES (?, ?, 'REWARD_AWARDED', -1, 'reward_spin', ?, ?)
  `).bind(generateId(), selectedReward.id, spinId, userId).run();

  return jsonSuccess({
    spinId,
    rewardId: selectedReward.id,
    rewardName: selectedReward.name,
    userRewardId
  });
});

// Submit delivery information
app.post('/rewards/delivery', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');
  const body = await c.req.json();
  const { userRewardId, fullName, phone, address, city, township, postalCode, notes } = body;

  if (!userRewardId || !fullName || !phone || !address || !city) {
    return jsonError('All delivery fields are required');
  }

  // Verify ownership
  const userReward = await db.prepare(`
    SELECT id FROM user_rewards WHERE id = ? AND user_id = ?
  `).bind(userRewardId, userId).first();

  if (!userReward) {
    return jsonError('Reward not found', 404);
  }

  // Idempotent: if delivery info already submitted, return existing without duplicating
  const existing = await db.prepare(`
    SELECT id FROM delivery_information WHERE user_reward_id = ?
  `).bind(userRewardId).first();
  if (existing) {
    return jsonSuccess({ message: 'Delivery information already submitted', deliveryId: existing.id });
  }

  // Create delivery info
  const deliveryId = generateId();
  await db.prepare(`
    INSERT INTO delivery_information (id, user_reward_id, full_name, phone, address, city, township, postal_code, additional_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(deliveryId, userRewardId, fullName, phone, address, city, township || null, postalCode || null, notes || null).run();

  // Update delivery status
  await db.prepare(`
    UPDATE user_rewards SET delivery_status = 'DELIVERY_SUBMITTED', updated_at = datetime('now')
    WHERE id = ?
  `).bind(userRewardId).run();

  await db.prepare(`
    UPDATE reward_spins SET status = 'DELIVERY_SUBMITTED', updated_at = datetime('now')
    WHERE id = (SELECT reward_spin_id FROM user_rewards WHERE id = ?)
  `).bind(userRewardId).run();

  return jsonSuccess({ message: 'Delivery information submitted', deliveryId });
});

// Get user's rewards
app.get('/rewards/my', authMiddleware, async (c) => {
  const db = c.env.survey_db;
  const userId = c.get('userId');

  const rewards = await db.prepare(`
    SELECT ur.id, ur.delivery_status, ur.won_at, ur.delivered_at,
           r.name as reward_name, r.description as reward_description, r.image_url
    FROM user_rewards ur
    JOIN rewards r ON ur.reward_id = r.id
    WHERE ur.user_id = ?
    ORDER BY ur.won_at DESC
  `).bind(userId).all();

  return jsonSuccess(rewards.results);
});

// ============================================================
// ADMIN ROUTES - DASHBOARD
// ============================================================

app.get('/admin/dashboard', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const [totalUsers, completedSurveys, totalRewards, pendingDeliveries, deliveredRewards, activeProducts] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').first(),
    db.prepare("SELECT COUNT(*) as count FROM survey_responses WHERE status = 'COMPLETED'").first(),
    db.prepare('SELECT COUNT(*) as count FROM user_rewards').first(),
    db.prepare("SELECT COUNT(*) as count FROM user_rewards WHERE delivery_status = 'DELIVERY_SUBMITTED'").first(),
    db.prepare("SELECT COUNT(*) as count FROM user_rewards WHERE delivery_status = 'DELIVERED'").first(),
    db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').first(),
  ]);

  const completionRate = (totalUsers as any)?.count > 0
    ? Math.round(((completedSurveys as any)?.count / (totalUsers as any)?.count) * 100)
    : 0;

  return jsonSuccess({
    totalParticipants: (totalUsers as any)?.count || 0,
    completedSurveys: (completedSurveys as any)?.count || 0,
    completionRate,
    totalRewardsAwarded: (totalRewards as any)?.count || 0,
    pendingDeliveries: (pendingDeliveries as any)?.count || 0,
    deliveredRewards: (deliveredRewards as any)?.count || 0,
    activeProducts: (activeProducts as any)?.count || 0,
  });
});

// ============================================================
// ADMIN ROUTES - ANALYTICS
// ============================================================

// Product popularity
app.get('/admin/analytics/popularity', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const popularity = await db.prepare(`
    SELECT p.id, p.name,
           COUNT(sr.id) as response_count,
           ROUND(COUNT(sr.id) * 100.0 / (SELECT COUNT(*) FROM survey_responses WHERE status = 'COMPLETED'), 1) as percentage
    FROM products p
    LEFT JOIN survey_responses sr ON p.id = sr.product_id AND sr.status = 'COMPLETED'
    WHERE p.is_active = 1
    GROUP BY p.id, p.name
    ORDER BY response_count DESC
  `).all();

  return jsonSuccess(popularity.results);
});

// Average ratings by product
app.get('/admin/analytics/ratings', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const productId = c.req.query('productId');

  let query = `
    SELECT p.id, p.name,
           ROUND(AVG(sa.answer_rating), 2) as avg_rating,
           COUNT(DISTINCT sr.id) as response_count
    FROM products p
    JOIN survey_responses sr ON p.id = sr.product_id AND sr.status = 'COMPLETED'
    JOIN survey_answers sa ON sr.id = sa.response_id
    WHERE sa.answer_rating IS NOT NULL
  `;
  const params: any[] = [];

  if (productId) {
    query += ' AND p.id = ?';
    params.push(productId);
  }

  query += ' GROUP BY p.id, p.name ORDER BY avg_rating DESC';

  const ratings = await db.prepare(query).bind(...params).all();

  return jsonSuccess(ratings.results);
});

// Rating by age group
app.get('/admin/analytics/age-groups', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const productId = c.req.query('productId');

  let query = `
    SELECT u.age_group,
           p.name as product_name,
           ROUND(AVG(sa.answer_rating), 2) as avg_rating,
           COUNT(DISTINCT sr.id) as response_count
    FROM survey_responses sr
    JOIN users u ON sr.user_id = u.id
    JOIN products p ON sr.product_id = p.id
    JOIN survey_answers sa ON sr.id = sa.response_id
    WHERE sr.status = 'COMPLETED'
    AND sa.answer_rating IS NOT NULL
    AND u.age_group IS NOT NULL
  `;
  const params: any[] = [];

  if (productId) {
    query += ' AND p.id = ?';
    params.push(productId);
  }

  query += ' GROUP BY u.age_group, p.name ORDER BY u.age_group, p.name';

  const ageGroups = await db.prepare(query).bind(...params).all();

  return jsonSuccess(ageGroups.results);
});

// Product comparison
app.get('/admin/analytics/comparison', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const comparison = await db.prepare(`
    SELECT p.id, p.name,
           COUNT(DISTINCT sr.id) as total_responses,
           ROUND(AVG(CASE WHEN sa.answer_rating IS NOT NULL THEN sa.answer_rating END), 2) as avg_rating,
           ROUND(AVG(CASE WHEN sq.question_text LIKE '%Taste%' THEN sa.answer_rating END), 2) as taste_rating,
           ROUND(AVG(CASE WHEN sq.question_text LIKE '%Packaging%' THEN sa.answer_rating END), 2) as packaging_rating,
           ROUND(AVG(CASE WHEN sq.question_text LIKE '%Value%' THEN sa.answer_rating END), 2) as value_rating,
           ROUND(SUM(CASE WHEN sa.answer_choice LIKE '%Definitely yes%' OR sa.answer_choice LIKE '%Probably yes%' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT sr.id), 1) as recommendation_rate
    FROM products p
    LEFT JOIN survey_responses sr ON p.id = sr.product_id AND sr.status = 'COMPLETED'
    LEFT JOIN survey_answers sa ON sr.id = sa.response_id
    LEFT JOIN survey_questions sq ON sa.question_id = sq.id
    WHERE p.is_active = 1
    GROUP BY p.id, p.name
    ORDER BY total_responses DESC
  `).all();

  return jsonSuccess(comparison.results);
});

// Participation trend
app.get('/admin/analytics/trend', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const period = c.req.query('period') || '30';

  const trend = await db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM survey_responses
    WHERE status = 'COMPLETED'
    AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date
  `).bind(period).all();

  return jsonSuccess(trend.results);
});

// ============================================================
// ADMIN ROUTES - SURVEY MANAGEMENT
// ============================================================

// Get all questions
app.get('/admin/survey/questions', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const questions = await db.prepare(`
    SELECT q.*, sv.title as version_title, p.name as product_name,
           (SELECT COUNT(*) FROM survey_options WHERE question_id = q.id AND is_active = 1) as option_count
    FROM survey_questions q
    JOIN survey_versions sv ON q.survey_version_id = sv.id
    JOIN products p ON sv.product_id = p.id
    ORDER BY q.display_order
  `).all();

  return jsonSuccess(questions.results);
});

// Create question
app.post('/admin/survey/questions', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { surveyVersionId, questionText, questionType, isRequired, displayOrder, validationRules, translations, options } = body;

  if (!surveyVersionId || !questionText) {
    return jsonError('Survey version ID and question text are required');
  }

  const id = generateId();
  await db.prepare(`
    INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, is_required, display_order, validation_rules)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, surveyVersionId, questionText, questionType || 'single_choice', isRequired !== false, displayOrder || 0, validationRules || null).run();

  // Add translations
  if (translations) {
    for (const [lang, text] of Object.entries(translations)) {
      if (text) {
        await db.prepare(`
          INSERT INTO survey_question_translations (id, question_id, language, question_text)
          VALUES (?, ?, ?, ?)
        `).bind(generateId(), id, lang, text).run();
      }
    }
  }

  // Add options
  if (options && Array.isArray(options)) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const optionId = generateId();
      await db.prepare(`
        INSERT INTO survey_options (id, question_id, option_text, option_value, display_order)
        VALUES (?, ?, ?, ?, ?)
      `).bind(optionId, id, opt.text, opt.value || opt.text, opt.displayOrder || i).run();

      if (opt.translations) {
        for (const [lang, text] of Object.entries(opt.translations)) {
          if (text) {
            await db.prepare(`
              INSERT INTO survey_option_translations (id, option_id, language, option_text)
              VALUES (?, ?, ?, ?)
            `).bind(generateId(), optionId, lang, text).run();
          }
        }
      }
    }
  }

  return jsonSuccess({ id, message: 'Question created' });
});

// Update question
app.patch('/admin/survey/questions/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');
  const body = await c.req.json();

  const { questionText, questionType, isRequired, displayOrder, isActive, validationRules, translations } = body;

  await db.prepare(`
    UPDATE survey_questions SET
      question_text = COALESCE(?, question_text),
      question_type = COALESCE(?, question_type),
      is_required = COALESCE(?, is_required),
      display_order = COALESCE(?, display_order),
      is_active = COALESCE(?, is_active),
      validation_rules = COALESCE(?, validation_rules),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(questionText || null, questionType || null, orNull(isRequired), orNull(displayOrder), orNull(isActive), validationRules || null, id).run();

  // Update translations
  if (translations) {
    for (const [lang, text] of Object.entries(translations)) {
      if (text) {
        await db.prepare(`
          INSERT OR REPLACE INTO survey_question_translations (id, question_id, language, question_text)
          VALUES (?, ?, ?, ?)
        `).bind(generateId(), id, lang, text).run();
      }
    }
  }

  return jsonSuccess({ message: 'Question updated' });
});

// Delete question
app.delete('/admin/survey/questions/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');

  await db.prepare('DELETE FROM survey_questions WHERE id = ?').bind(id).run();

  return jsonSuccess({ message: 'Question deleted' });
});

// Get all survey versions
app.get('/admin/survey/versions', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const versions = await db.prepare(`
    SELECT sv.*, p.name as product_name,
           (SELECT COUNT(*) FROM survey_questions WHERE survey_version_id = sv.id AND is_active = 1) as question_count,
           (SELECT COUNT(*) FROM survey_responses WHERE survey_version_id = sv.id) as response_count
    FROM survey_versions sv
    JOIN products p ON sv.product_id = p.id
    ORDER BY sv.created_at DESC
  `).all();

  return jsonSuccess(versions.results);
});

// Create survey version
app.post('/admin/survey/versions', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { productId, title, description, translations } = body;

  if (!productId || !title) {
    return jsonError('Product ID and title are required');
  }

  // Get next version number
  const lastVersion = await db.prepare(`
    SELECT MAX(version) as max_version FROM survey_versions WHERE product_id = ?
  `).bind(productId).first() as any;

  const versionNumber = (lastVersion?.max_version || 0) + 1;
  const id = generateId();

  await db.prepare(`
    INSERT INTO survey_versions (id, product_id, version, title, description, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).bind(id, productId, versionNumber, title, description || null).run();

  // Add translations
  if (translations) {
    for (const [lang, data] of Object.entries(translations) as any) {
      if (data.title) {
        await db.prepare(`
          INSERT INTO survey_version_translations (id, version_id, language, title, description)
          VALUES (?, ?, ?, ?, ?)
        `).bind(generateId(), id, lang, data.title, data.description || null).run();
      }
    }
  }

  return jsonSuccess({ id, version: versionNumber, message: 'Survey version created' });
});

// ============================================================
// ADMIN ROUTES - PRODUCTS
// ============================================================

app.get('/admin/products', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const products = await db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM survey_responses WHERE product_id = p.id AND status = 'COMPLETED') as response_count
    FROM products p
    ORDER BY p.display_order
  `).all();

  return jsonSuccess(products.results);
});

app.post('/admin/products', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { name, description, brand, imageUrl, displayOrder, translations } = body;

  if (!name) return jsonError('Product name is required');

  const id = generateId();
  await db.prepare(`
    INSERT INTO products (id, name, description, brand, image_url, display_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, name, description || null, brand || null, imageUrl || null, displayOrder || 0).run();

  if (translations) {
    for (const [lang, data] of Object.entries(translations) as any) {
      if (data.name) {
        await db.prepare(`
          INSERT INTO product_translations (id, product_id, language, name, description)
          VALUES (?, ?, ?, ?, ?)
        `).bind(generateId(), id, lang, data.name, data.description || null).run();
      }
    }
  }

  return jsonSuccess({ id, message: 'Product created' });
});

app.patch('/admin/products/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');
  const body = await c.req.json();

  const { name, description, brand, imageUrl, displayOrder, isActive, translations } = body;

  await db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      brand = COALESCE(?, brand),
      image_url = COALESCE(?, image_url),
      display_order = COALESCE(?, display_order),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(name || null, description || null, brand || null, imageUrl || null, orNull(displayOrder), orNull(isActive), id).run();

  if (translations) {
    for (const [lang, data] of Object.entries(translations) as any) {
      if (data.name) {
        await db.prepare(`
          INSERT OR REPLACE INTO product_translations (id, product_id, language, name, description)
          VALUES (?, ?, ?, ?, ?)
        `).bind(generateId(), id, lang, data.name, data.description || null).run();
      }
    }
  }

  return jsonSuccess({ message: 'Product updated' });
});

// ============================================================
// ADMIN ROUTES - REWARDS
// ============================================================

app.get('/admin/rewards', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const rewards = await db.prepare(`
    SELECT r.*,
           (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id) as rewarded_count,
           (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id AND delivery_status = 'DELIVERED') as delivered_count
    FROM rewards r
    ORDER BY r.created_at DESC
  `).all();

  return jsonSuccess(rewards.results);
});

app.post('/admin/rewards', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const body = await c.req.json();
  const { name, description, imageUrl, totalQuantity, weight, lowStockThreshold, campaignId, translations } = body;

  if (!name || !totalQuantity) return jsonError('Name and total quantity are required');

  const id = generateId();
  await db.prepare(`
    INSERT INTO rewards (id, name, description, image_url, total_quantity, remaining_quantity, weight, low_stock_threshold, campaign_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, name, description || null, imageUrl || null, totalQuantity, totalQuantity, weight || 10, lowStockThreshold || 10, campaignId || null).run();

  // Record initial stock
  await db.prepare(`
    INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, notes, created_by)
    VALUES (?, ?, 'INITIAL_STOCK', ?, 'Initial stock', ?)
  `).bind(generateId(), id, totalQuantity, c.get('userId')).run();

  if (translations) {
    for (const [lang, data] of Object.entries(translations) as any) {
      if (data.name) {
        await db.prepare(`
          INSERT INTO reward_translations (id, reward_id, language, name, description)
          VALUES (?, ?, ?, ?, ?)
        `).bind(generateId(), id, lang, data.name, data.description || null).run();
      }
    }
  }

  return jsonSuccess({ id, message: 'Reward created' });
});

app.patch('/admin/rewards/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');
  const body = await c.req.json();

  const { name, description, imageUrl, weight, lowStockThreshold, isActive, status, campaignId, translations } = body;

  await db.prepare(`
    UPDATE rewards SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      image_url = COALESCE(?, image_url),
      weight = COALESCE(?, weight),
      low_stock_threshold = COALESCE(?, low_stock_threshold),
      is_active = COALESCE(?, is_active),
      status = COALESCE(?, status),
      campaign_id = COALESCE(?, campaign_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(name || null, description || null, imageUrl || null, orNull(weight), orNull(lowStockThreshold), orNull(isActive), orNull(status), orNull(campaignId), id).run();

  if (translations) {
    for (const [lang, data] of Object.entries(translations) as any) {
      if (data.name) {
        await db.prepare(`
          INSERT OR REPLACE INTO reward_translations (id, reward_id, language, name, description)
          VALUES (?, ?, ?, ?, ?)
        `).bind(generateId(), id, lang, data.name, data.description || null).run();
      }
    }
  }

  return jsonSuccess({ message: 'Reward updated' });
});

// Reward inventory
app.get('/admin/rewards/inventory', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;

  const inventory = await db.prepare(`
    SELECT r.id, r.name, r.total_quantity, r.remaining_quantity, r.status, r.low_stock_threshold,
           (r.total_quantity - r.remaining_quantity) as rewarded_count,
           (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id AND delivery_status = 'DELIVERED') as delivered_count,
           (SELECT COUNT(*) FROM user_rewards WHERE reward_id = r.id AND delivery_status IN ('DELIVERY_PENDING', 'DELIVERY_SUBMITTED')) as pending_count,
           ROUND((r.total_quantity - r.remaining_quantity) * 100.0 / r.total_quantity, 1) as utilization_rate
    FROM rewards r
    ORDER BY r.name
  `).all();

  // Summary
  const summary = await db.prepare(`
    SELECT
      SUM(total_quantity) as total_stock,
      SUM(total_quantity - remaining_quantity) as total_rewarded,
      SUM(remaining_quantity) as total_remaining,
      (SELECT COUNT(*) FROM user_rewards WHERE delivery_status = 'DELIVERED') as total_delivered,
      (SELECT COUNT(*) FROM user_rewards WHERE delivery_status IN ('DELIVERY_PENDING', 'DELIVERY_SUBMITTED')) as total_pending
    FROM rewards
  `).first();

  return jsonSuccess({ rewards: inventory.results, summary });
});

// Adjust reward stock
app.patch('/admin/rewards/:id/stock', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { adjustment, reason } = body;

  if (adjustment === undefined) return jsonError('Adjustment value required');

  const reward = await db.prepare('SELECT remaining_quantity FROM rewards WHERE id = ?').bind(id).first() as any;
  if (!reward) return jsonError('Reward not found', 404);

  const newQuantity = reward.remaining_quantity + adjustment;
  if (newQuantity < 0) return jsonError('Cannot reduce below zero');

  await db.prepare('UPDATE rewards SET remaining_quantity = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(newQuantity, id).run();

  // Record transaction
  await db.prepare(`
    INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, notes, created_by)
    VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, ?, ?)
  `).bind(generateId(), id, adjustment, reason || 'Manual adjustment', c.get('userId')).run();

  return jsonSuccess({ message: 'Stock adjusted', newQuantity });
});

// Reward history
app.get('/admin/rewards/history', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const history = await db.prepare(`
    SELECT ur.id, ur.delivery_status, ur.won_at, ur.delivered_at,
           u.full_name as user_name, u.email as user_email,
           r.name as reward_name,
           p.name as product_name
    FROM user_rewards ur
    JOIN users u ON ur.user_id = u.id
    JOIN rewards r ON ur.reward_id = r.id
    LEFT JOIN reward_spins rs ON ur.reward_spin_id = rs.id
    LEFT JOIN products p ON rs.product_id = p.id
    ORDER BY ur.won_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await db.prepare('SELECT COUNT(*) as count FROM user_rewards').first();

  return jsonSuccess({ history: history.results, total: (total as any)?.count || 0 });
});

// ============================================================
// ADMIN ROUTES - DELIVERIES
// ============================================================

app.get('/admin/deliveries', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  let query = `
    SELECT ur.id, ur.delivery_status, ur.won_at, ur.delivered_at,
           u.full_name as user_name, u.email as user_email, u.phone as user_phone,
           r.name as reward_name,
           di.full_name as delivery_name, di.phone as delivery_phone,
           di.address, di.city, di.township, di.postal_code
    FROM user_rewards ur
    JOIN users u ON ur.user_id = u.id
    JOIN rewards r ON ur.reward_id = r.id
    LEFT JOIN delivery_information di ON ur.id = di.user_reward_id
    WHERE ur.delivery_status != 'DELIVERY_PENDING'
  `;
  const params: any[] = [];

  if (status) {
    query += ' AND ur.delivery_status = ?';
    params.push(status);
  }

  query += ' ORDER BY ur.won_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const deliveries = await db.prepare(query).bind(...params).all();

  const total = await db.prepare(`
    SELECT COUNT(*) as count FROM user_rewards
    WHERE delivery_status != 'DELIVERY_PENDING'
    ${status ? 'AND delivery_status = ?' : ''}
  `).bind(...(status ? [status] : [])).first();

  return jsonSuccess({ deliveries: deliveries.results, total: (total as any)?.count || 0 });
});

// Update delivery status
app.patch('/admin/deliveries/:id/status', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;

  const validStatuses = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return jsonError('Invalid status');
  }

  const updates: any = { delivery_status: status, updated_at: new Date().toISOString() };
  if (status === 'DELIVERED') {
    updates.delivered_at = new Date().toISOString();
  }

  await db.prepare(`
    UPDATE user_rewards SET
      delivery_status = ?,
      delivered_at = COALESCE(?, delivered_at),
      updated_at = datetime('now')
    WHERE id = ?
  `).bind(status, status === 'DELIVERED' ? new Date().toISOString() : null, id).run();

  // Update reward_spins status
  await db.prepare(`
    UPDATE reward_spins SET status = ?, updated_at = datetime('now')
    WHERE id = (SELECT reward_spin_id FROM user_rewards WHERE id = ?)
  `).bind(status, id).run();

  // If cancelled, return inventory
  if (status === 'CANCELLED') {
    const userReward = await db.prepare('SELECT reward_id FROM user_rewards WHERE id = ?').bind(id).first() as any;
    if (userReward) {
      await db.prepare('UPDATE rewards SET remaining_quantity = remaining_quantity + 1, updated_at = datetime(\'now\') WHERE id = ?').bind(userReward.reward_id).run();
      await db.prepare(`
        INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, reference_id, notes, created_by)
        VALUES (?, ?, 'CANCELLATION_RETURN', 1, 'user_reward', ?, 'Delivery cancelled', ?)
      `).bind(generateId(), userReward.reward_id, id, c.get('userId')).run();
    }
  }

  // Audit log
  await db.prepare(`
    INSERT INTO audit_logs (id, admin_id, action, resource_type, resource_id, metadata)
    VALUES (?, ?, 'DELIVERY_STATUS_CHANGED', 'user_reward', ?, ?)
  `).bind(generateId(), c.get('userId'), id, JSON.stringify({ newStatus: status })).run();

  return jsonSuccess({ message: 'Delivery status updated' });
});

// ============================================================
// ADMIN ROUTES - USERS
// ============================================================

app.get('/admin/users', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const search = c.req.query('search');

  let query = `
    SELECT id, full_name, email, phone, age, age_group, gender, city, township, occupation, created_at, is_active,
           (SELECT COUNT(*) FROM survey_responses WHERE user_id = users.id AND status = 'COMPLETED') as survey_count,
           (SELECT COUNT(*) FROM user_rewards WHERE user_id = users.id) as reward_count
    FROM users WHERE is_admin = 0
  `;
  const params: any[] = [];

  if (search) {
    query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const users = await db.prepare(query).bind(...params).all();

  const total = await db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').first();

  return jsonSuccess({ users: users.results, total: (total as any)?.count || 0 });
});

app.get('/admin/users/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');

  const user = await db.prepare(`
    SELECT id, full_name, email, phone, age, age_group, gender, city, township, nrc_state, nrc_type, nrc_number, occupation, created_at, is_active
    FROM users WHERE id = ?
  `).bind(id).first();

  if (!user) return jsonError('User not found', 404);

  // Survey history
  const surveys = await db.prepare(`
    SELECT sr.*, p.name as product_name, sv.title as version_title,
           (SELECT AVG(answer_rating) FROM survey_answers WHERE response_id = sr.id AND answer_rating IS NOT NULL) as avg_rating
    FROM survey_responses sr
    JOIN products p ON sr.product_id = p.id
    JOIN survey_versions sv ON sr.survey_version_id = sv.id
    WHERE sr.user_id = ?
    ORDER BY sr.created_at DESC
  `).bind(id).all();

  // Reward history
  const rewards = await db.prepare(`
    SELECT ur.*, r.name as reward_name
    FROM user_rewards ur
    JOIN rewards r ON ur.reward_id = r.id
    WHERE ur.user_id = ?
    ORDER BY ur.won_at DESC
  `).bind(id).all();

  return jsonSuccess({ user, surveys: surveys.results, rewards: rewards.results });
});

// ============================================================
// ADMIN ROUTES - RESPONSES
// ============================================================

app.get('/admin/responses', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const productId = c.req.query('productId');
  const status = c.req.query('status');

  let query = `
    SELECT sr.*, u.full_name as user_name, u.age_group, u.gender,
           p.name as product_name, sv.title as version_title
    FROM survey_responses sr
    JOIN users u ON sr.user_id = u.id
    JOIN products p ON sr.product_id = p.id
    JOIN survey_versions sv ON sr.survey_version_id = sv.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (productId) {
    query += ' AND sr.product_id = ?';
    params.push(productId);
  }
  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }

  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const responses = await db.prepare(query).bind(...params).all();

  const total = await db.prepare('SELECT COUNT(*) as count FROM survey_responses').first();

  return jsonSuccess({ responses: responses.results, total: (total as any)?.count || 0 });
});

app.get('/admin/responses/:id', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const id = c.req.param('id');

  const response = await db.prepare(`
    SELECT sr.*, u.full_name as user_name, u.age, u.age_group, u.gender, u.city,
           p.name as product_name
    FROM survey_responses sr
    JOIN users u ON sr.user_id = u.id
    JOIN products p ON sr.product_id = p.id
    WHERE sr.id = ?
  `).bind(id).first();

  if (!response) return jsonError('Response not found', 404);

  const answers = await db.prepare(`
    SELECT sa.*, sq.question_text, sq.question_type,
           COALESCE(qt.question_text, sq.question_text) as translated_question
    FROM survey_answers sa
    JOIN survey_questions sq ON sa.question_id = sq.id
    LEFT JOIN survey_question_translations qt ON sq.id = qt.question_id AND qt.language = ?
    WHERE sa.response_id = ?
    ORDER BY sq.display_order
  `).bind((response as any).language || 'en', id).all();

  return jsonSuccess({ response, answers: answers.results });
});

// ============================================================
// ADMIN ROUTES - AUDIT LOGS
// ============================================================

app.get('/admin/audit-logs', authMiddleware, adminMiddleware, async (c) => {
  const db = c.env.survey_db;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const logs = await db.prepare(`
    SELECT al.*, u.full_name as admin_name
    FROM audit_logs al
    LEFT JOIN users u ON al.admin_id = u.id
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await db.prepare('SELECT COUNT(*) as count FROM audit_logs').first();

  return jsonSuccess({ logs: logs.results, total: (total as any)?.count || 0 });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/', (c) => {
  return jsonSuccess({
    name: 'Myanmar Beer Survey API',
    version: '2.0.0',
    endpoints: {
      auth: ['/auth/register', '/auth/login', '/auth/admin/login'],
      user: ['/user/profile'],
      public: ['/products', '/campaigns', '/rewards'],
      survey: ['/survey/questions/:productId', '/survey/submit'],
      rewards: ['/rewards/spin', '/rewards/delivery', '/rewards/my'],
      admin: ['/admin/dashboard', '/admin/analytics/*', '/admin/survey/*', '/admin/products', '/admin/rewards/*', '/admin/deliveries', '/admin/users', '/admin/responses', '/admin/audit-logs']
    }
  });
});

export default app;