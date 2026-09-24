import { Hono } from 'hono';
import type { AppContext } from '../types';
import { ErrorCode, failure, isUniqueViolation, logEvent, success } from '../lib/http';
import { authMiddleware } from '../lib/auth';
import { enforceRateLimit, maintenanceResponse, RATE_POLICIES } from '../lib/security';
import { buildWeightedPool, pickWeightedIndex, type WeightedPoolEntry } from '../lib/survey';
import { generateId, isoTimestamp } from '../lib/ids';
import { deliverySchema, readJson, spinSchema } from '../lib/validation';

export const rewardRoutes = new Hono<AppContext>();

const NO_REWARDS = 'NO_REWARDS_AVAILABLE';

type EligibleReward = {
  id: string;
  name: string;
  weight: number | null;
  winning_ratio: number | null;
  remaining_quantity: number;
  low_stock_threshold: number | null;
  requires_delivery: number;
};

type SpinRow = {
  id: string;
  reward_id: string | null;
  status: string;
  user_reward_id: string | null;
  reward_name: string | null;
  requires_delivery: number | null;
  reward_snapshot: string | null;
};

async function findSpinByKey(
  db: D1Database,
  userId: string,
  campaign: string,
  idempotencyKey: string
): Promise<SpinRow | null> {
  return db
    .prepare(
      `SELECT rs.id, rs.reward_id, rs.status, rs.reward_snapshot,
              ur.id AS user_reward_id, r.name AS reward_name, r.requires_delivery
       FROM reward_spins rs
       LEFT JOIN user_rewards ur ON ur.reward_spin_id = rs.id
       LEFT JOIN rewards r ON r.id = rs.reward_id
       WHERE rs.user_id = ? AND COALESCE(rs.campaign_id, 'default') = ? AND rs.idempotency_key = ?
         AND rs.status != 'CANCELLED'
       LIMIT 1`
    )
    .bind(userId, campaign, idempotencyKey)
    .first<SpinRow>();
}

async function findActiveSpin(
  db: D1Database,
  userId: string,
  campaign: string
): Promise<SpinRow | null> {
  return db
    .prepare(
      `SELECT rs.id, rs.reward_id, rs.status, rs.reward_snapshot,
              ur.id AS user_reward_id, r.name AS reward_name, r.requires_delivery
       FROM reward_spins rs
       LEFT JOIN user_rewards ur ON ur.reward_spin_id = rs.id
       LEFT JOIN rewards r ON r.id = rs.reward_id
       WHERE rs.user_id = ? AND COALESCE(rs.campaign_id, 'default') = ? AND rs.status != 'CANCELLED'
       LIMIT 1`
    )
    .bind(userId, campaign)
    .first<SpinRow>();
}

function spinResponse(row: SpinRow, idempotent = true) {
  let snapshot: Record<string, unknown> = {};
  try {
    snapshot = row.reward_snapshot ? JSON.parse(row.reward_snapshot) : {};
  } catch {
    snapshot = {};
  }
  const rewardId = row.reward_id || (typeof snapshot.rewardId === 'string' ? snapshot.rewardId : null);
  const rewardName = row.reward_name || (typeof snapshot.rewardName === 'string' ? snapshot.rewardName : '');
  const requiresDelivery = row.requires_delivery !== null
    ? row.requires_delivery !== 0
    : snapshot.requiresDelivery === true;
  return {
    spinId: row.id,
    rewardId,
    rewardName,
    userRewardId: row.user_reward_id,
    requiresDelivery,
    idempotent,
  };
}

// ============================================================
// Spin the wheel (server-authoritative, serialised per user+campaign)
// ============================================================

rewardRoutes.post('/rewards/spin', authMiddleware, async (c) => {
  const settings = c.get('settings');
  if (settings.maintenanceMode) return maintenanceResponse(c);
  if (!settings.spinEnabled) {
    return failure(c, ErrorCode.FEATURE_DISABLED, 'The lucky spin is currently closed.', 409);
  }

  const db = c.env.survey_db;
  const userId = c.get('userId');

  const limited = await enforceRateLimit(c, 'spin', userId, RATE_POLICIES.spin);
  if (limited) return limited;

  const parsed = await readJson(c, spinSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const requestedCampaign = body.campaignId?.trim();
  const requestedProduct = body.productId?.trim();
  const eligibilityParams: unknown[] = [userId];
  let eligibilitySql = `SELECT product_id, campaign_id
     FROM survey_responses
     WHERE user_id = ? AND status = 'COMPLETED'`;
  if (requestedCampaign === 'default') {
    eligibilitySql += ' AND campaign_id IS NULL';
  } else if (requestedCampaign) {
    eligibilitySql += ' AND (campaign_id = ? OR campaign_id IS NULL)';
    eligibilityParams.push(requestedCampaign);
  }
  if (requestedProduct) {
    eligibilitySql += ' AND product_id = ?';
    eligibilityParams.push(requestedProduct);
  }
  eligibilitySql += ' ORDER BY completed_at DESC LIMIT 1';
  const completedResponse = await db
    .prepare(eligibilitySql)
    .bind(...eligibilityParams)
    .first<{ product_id: string; campaign_id: string | null }>();
  if (!completedResponse) {
    return failure(c, ErrorCode.SURVEY_REQUIRED, 'Complete the survey before spinning.', 409);
  }

  const campaignKey = requestedCampaign || completedResponse.campaign_id || 'default';
  // 'default' has no `campaigns` row, so it is persisted as NULL to satisfy the
  // foreign key; the uniqueness/idempotency queries fold NULL back to 'default'.
  const storedCampaignId = campaignKey === 'default' ? null : campaignKey;
  const productId = completedResponse.product_id;
  const now = isoTimestamp();

  // 1. Exact retry of this request: return the stored result.
  const replay = await findSpinByKey(db, userId, campaignKey, body.idempotencyKey);
  if (replay) {
    if (replay.status === 'PENDING') {
      return failure(c, ErrorCode.SPIN_IN_PROGRESS, 'Your spin is still being processed. Please wait a moment.', 409);
    }
    return success(c, spinResponse(replay));
  }

  // 2. A different in-flight or completed spin for this campaign.
  const active = await findActiveSpin(db, userId, campaignKey);
  if (active) {
    if (active.status === 'PENDING') {
      return failure(c, ErrorCode.SPIN_IN_PROGRESS, 'Your spin is still being processed. Please wait a moment.', 409);
    }
    return failure(c, ErrorCode.ALREADY_SPUN, 'You have already spun the wheel for this campaign', 409);
  }

  // 3. Insert the PENDING row. The partial unique index on
  //    (user_id, COALESCE(campaign_id,'default')) WHERE status != 'CANCELLED'
  //    serialises concurrent double-taps: exactly one insert wins, the rest hit
  //    a UNIQUE violation. A successful insert is itself the ownership claim, so
  //    no second 'PROCESSING' transition is needed (and 'PROCESSING' is reserved
  //    for the admin delivery lifecycle).
  const spinId = generateId();
  try {
    await db
      .prepare(
        `INSERT INTO reward_spins (id, user_id, campaign_id, product_id, status, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`
      )
      .bind(spinId, userId, storedCampaignId, productId, body.idempotencyKey, now, now)
      .run();
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findActiveSpin(db, userId, campaignKey);
      if (existing?.status === 'PENDING') {
        return failure(c, ErrorCode.SPIN_IN_PROGRESS, 'Your spin is still being processed. Please wait a moment.', 409);
      }
      if (existing) return failure(c, ErrorCode.ALREADY_SPUN, 'You have already spun the wheel for this campaign', 409);
    }
    logEvent('error', 'spin_insert_failed', { userId, error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Spin processing failed. Please try again.');
  }

  const cancelSpin = async (note: string) => {
    try {
      await db
        .prepare(`UPDATE reward_spins SET status = 'CANCELLED', updated_at = ? WHERE id = ?`)
        .bind(isoTimestamp(), spinId)
        .run();
    } catch (error) {
      logEvent('warn', 'spin_cancel_failed', { spinId, note, error: String(error) });
    }
  };

  // 4. Eligible rewards for this campaign.
  const rewardsResult = await db
    .prepare(
      `SELECT id, name, weight, remaining_quantity, winning_ratio, low_stock_threshold, requires_delivery
       FROM rewards
       WHERE is_active = 1 AND remaining_quantity > 0
         AND status != 'EXHAUSTED' AND status != 'PAUSED'
         AND (campaign_id = ? OR campaign_id IS NULL)`
    )
    .bind(campaignKey)
    .all<EligibleReward>();

  const allRewards = rewardsResult.results || [];
  if (allRewards.length === 0) {
    await cancelSpin('no_rewards');
    return failure(c, NO_REWARDS, 'No rewards available', 409);
  }

  // 5. Weighted selection with retry on a lost reservation race.
  let pool: WeightedPoolEntry<EligibleReward>[] = buildWeightedPool(allRewards);
  let selected: EligibleReward | null = null;
  let attempts = 0;

  while (attempts < 3 && pool.length > 0) {
    attempts += 1;
    const index = pickWeightedIndex(pool);
    if (index < 0) break;
    const candidate = pool[index].reward;

    const reserve = await db
      .prepare(
        `UPDATE rewards
         SET remaining_quantity = remaining_quantity - 1,
             reservation_spin_id = ?,
             updated_at = ?
         WHERE id = ? AND remaining_quantity > 0
           AND reservation_spin_id IS NULL
           AND is_active = 1 AND status != 'PAUSED' AND status != 'EXHAUSTED'`
      )
      .bind(spinId, isoTimestamp(), candidate.id)
      .run();

    if (reserve.meta.changes === 1) {
      selected = candidate;
      break;
    }
    pool = pool.filter((entry) => entry.reward.id !== candidate.id);
  }

  if (!selected) {
    await cancelSpin('reserve_exhausted');
    return failure(c, NO_REWARDS, 'All rewards are currently unavailable. Please try again later.', 409);
  }

  // 6. Status derived from the post-reservation quantity.
  const post = await db
    .prepare('SELECT remaining_quantity, low_stock_threshold FROM rewards WHERE id = ?')
    .bind(selected.id)
    .first<{ remaining_quantity: number; low_stock_threshold: number | null }>();
  const remaining = post?.remaining_quantity ?? 0;
  const threshold = post?.low_stock_threshold ?? 10;
  const newStatus = remaining <= 0 ? 'EXHAUSTED' : remaining <= threshold ? 'LOW_STOCK' : 'AVAILABLE';

  const userRewardId = generateId();
  const snapshot = JSON.stringify({
    rewardId: selected.id,
    rewardName: selected.name,
    weight: selected.weight,
    winningRatio: selected.winning_ratio,
    requiresDelivery: selected.requires_delivery === 1,
    campaignId: campaignKey,
    productId,
    selectedAt: now,
  });

  // 7. Finalise only if the durable reservation is still owned by this spin.
  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO user_rewards (id, user_id, reward_spin_id, reward_id, delivery_status, won_at, created_at, updated_at)
           SELECT ?, ?, ?, ?, 'DELIVERY_PENDING', ?, ?, ?
           WHERE EXISTS (
             SELECT 1
             FROM reward_spins rs
             JOIN rewards r ON r.reservation_spin_id = rs.id
             WHERE rs.id = ? AND rs.status = 'PENDING' AND r.reservation_spin_id = ?
           )`
        )
        .bind(userRewardId, userId, spinId, selected.id, now, now, now, spinId, spinId),
      db
        .prepare(
          `UPDATE reward_spins SET reward_id = ?, status = 'WON', reward_snapshot = ?, updated_at = ?
           WHERE id = ? AND status = 'PENDING'
             AND EXISTS (SELECT 1 FROM rewards WHERE id = ? AND reservation_spin_id = ?)`
        )
        .bind(selected.id, snapshot, isoTimestamp(), spinId, selected.id, spinId),
      db
        .prepare(
          `UPDATE rewards
           SET status = CASE WHEN status = 'PAUSED' THEN 'PAUSED' ELSE ? END,
               reservation_spin_id = NULL,
               updated_at = ?
           WHERE id = ? AND reservation_spin_id = ?`
        )
        .bind(newStatus, isoTimestamp(), selected.id, spinId),
      db
        .prepare(
          `INSERT INTO reward_inventory_transactions (id, reward_id, type, quantity, reference_type, reference_id, created_by, created_at)
           SELECT ?, ?, 'REWARD_AWARDED', -1, 'reward_spin', ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM user_rewards WHERE id = ?)`
        )
        .bind(generateId(), selected.id, spinId, userId, now, userRewardId),
    ]);
    if (results[0]?.meta.changes !== 1) {
      return failure(c, ErrorCode.SPIN_IN_PROGRESS, 'Spin reservation expired; please try again.', 409);
    }
  } catch (error) {
    // Compensation is conditional on this spin still owning the reservation.
    try {
      await db
        .prepare(
          `UPDATE rewards
           SET remaining_quantity = remaining_quantity + 1,
               status = CASE
                 WHEN status = 'PAUSED' THEN 'PAUSED'
                 WHEN remaining_quantity + 1 <= 0 THEN 'EXHAUSTED'
                 WHEN remaining_quantity + 1 <= low_stock_threshold THEN 'LOW_STOCK'
                 ELSE 'AVAILABLE'
               END,
               reservation_spin_id = NULL,
               updated_at = ?
           WHERE id = ? AND reservation_spin_id = ?`
        )
        .bind(isoTimestamp(), selected.id, spinId)
        .run();
    } catch (compensationError) {
      logEvent('error', 'spin_compensation_failed', { spinId, rewardId: selected.id, error: String(compensationError) });
    }
    await cancelSpin('finalize_failed');

    if (isUniqueViolation(error)) {
      const existing = await findActiveSpin(db, userId, campaignKey);
      if (existing) return success(c, spinResponse(existing));
    }
    logEvent('error', 'spin_finalize_failed', { userId, spinId, error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Spin processing failed. Please contact support.');
  }

  return success(c, {
    spinId,
    rewardId: selected.id,
    rewardName: selected.name,
    userRewardId,
    requiresDelivery: selected.requires_delivery === 1,
    idempotent: false,
  });
});

// ============================================================
// Submit delivery information
// ============================================================

rewardRoutes.post('/rewards/delivery', authMiddleware, async (c) => {
  const settings = c.get('settings');
  if (settings.maintenanceMode) return maintenanceResponse(c);
  if (!settings.deliveryEnabled) {
    return failure(c, ErrorCode.FEATURE_DISABLED, 'Delivery submission is currently closed.', 409);
  }

  const db = c.env.survey_db;
  const userId = c.get('userId');

  const limited = await enforceRateLimit(c, 'delivery', userId, RATE_POLICIES.delivery);
  if (limited) return limited;

  const parsed = await readJson(c, deliverySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const userReward = await db
    .prepare(
      `SELECT ur.id, ur.delivery_status, r.requires_delivery
       FROM user_rewards ur
       JOIN rewards r ON r.id = ur.reward_id
       WHERE ur.id = ? AND ur.user_id = ?`
    )
    .bind(body.userRewardId, userId)
    .first<{ id: string; delivery_status: string; requires_delivery: number }>();

  if (!userReward) return failure(c, ErrorCode.NOT_FOUND, 'Reward not found');
  if (userReward.requires_delivery !== 1) {
    return failure(c, ErrorCode.INVALID_REQUEST, 'This reward does not require delivery', 409);
  }

  const existing = await db
    .prepare('SELECT id FROM delivery_information WHERE user_reward_id = ?')
    .bind(body.userRewardId)
    .first<{ id: string }>();
  if (existing && userReward.delivery_status !== 'CANCELLED') {
    return success(c, { message: 'Delivery information already submitted', deliveryId: existing.id, idempotent: true });
  }
  if (userReward.delivery_status !== 'DELIVERY_PENDING') {
    return failure(c, ErrorCode.INVALID_STATE_TRANSITION, `Delivery cannot be submitted from ${userReward.delivery_status}`, 409);
  }

  const deliveryId = generateId();
  const now = isoTimestamp();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO delivery_information (id, user_reward_id, full_name, phone, address, city, township, postal_code, additional_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          deliveryId,
          body.userRewardId,
          body.fullName,
          body.phone,
          body.address,
          body.city,
          body.township || null,
          body.postalCode || null,
          body.notes || null
        ),
      db
        .prepare(`UPDATE user_rewards SET delivery_status = 'DELIVERY_SUBMITTED', updated_at = ? WHERE id = ?`)
        .bind(now, body.userRewardId),
      db
        .prepare(
          `UPDATE reward_spins SET status = 'DELIVERY_SUBMITTED', updated_at = ?
           WHERE id = (SELECT reward_spin_id FROM user_rewards WHERE id = ?)`
        )
        .bind(now, body.userRewardId),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await db
        .prepare('SELECT id FROM delivery_information WHERE user_reward_id = ?')
        .bind(body.userRewardId)
        .first<{ id: string }>();
      if (replay) return success(c, { message: 'Delivery information already submitted', deliveryId: replay.id, idempotent: true });
    }
    logEvent('error', 'delivery_submit_failed', { userId, error: String(error) });
    return failure(c, ErrorCode.INTERNAL, 'Delivery submission failed');
  }

  return success(c, { message: 'Delivery information submitted', deliveryId, requiresDelivery: userReward.requires_delivery === 1 });
});

// ============================================================
// User's rewards
// ============================================================

rewardRoutes.get('/rewards/my', authMiddleware, async (c) => {
  const rewards = await c.env.survey_db
    .prepare(
      `SELECT ur.id, ur.reward_id, ur.reward_spin_id, ur.delivery_status, ur.won_at, ur.delivered_at,
              rs.campaign_id, rs.product_id,
              r.name as reward_name, r.description as reward_description, r.image_url, r.requires_delivery
       FROM user_rewards ur
       JOIN rewards r ON ur.reward_id = r.id
       JOIN reward_spins rs ON rs.id = ur.reward_spin_id
       WHERE ur.user_id = ?
       ORDER BY ur.won_at DESC`
    )
    .bind(c.get('userId'))
    .all();
  return success(c, rewards.results || []);
});
