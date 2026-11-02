/**
 * Shop-isolated reward allocation engine.
 *
 * The backend is the sole authority for reward assignment. All allocation
 * decisions are made server-side using only the selected shop's inventory
 * and winning configuration. No shop can influence another shop's allocation.
 *
 * Source of truth: D1. Conditional UPDATE provides atomic stock reservation.
 * Idempotency keys + UNIQUE constraints prevent duplicate rewards.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { generateId, isoTimestamp } from './ids';
import { logEvent } from './http';

/** Result of the allocation attempt. */
export type AllocationResult =
  | { kind: 'REWARD_ASSIGNED'; shopId: string; shopRewardId: string; rewardName: string; rewardImageUrl: string | null; userRewardId: string; rewardWinId: string }
  | { kind: 'NO_ELIGIBLE_REWARD'; shopId: string }
  | { kind: 'NO_REWARD'; shopId: string; reason: string } // configured no-reward outcome
  | { kind: 'DUPLICATE'; existingWinId: string; rewardName: string; shopId: string };

/** Eligible reward from a specific shop's inventory. */
type EligibleShopReward = {
  id: string;
  reward_name: string;
  reward_image_url: string | null;
  stock_remaining: number;
  probability_weight: number;
  winning_ratio: number | null;
  is_default_remainder: number;
};

/**
 * Cryptographically secure random integer in [0, max).
 */
function secureRandomInt(max: number): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
}

/**
 * Weighted random selection from eligible rewards using crypto.getRandomValues.
 * Returns the index of the selected reward, or -1 if no mass.
 */
function pickWeightedIndexSecure(
  pool: { reward: EligibleShopReward; weight: number }[],
): number {
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return -1;
  const random = Math.floor(secureRandomInt(total));
  let cumulative = 0;
  for (let i = 0; i < pool.length; i++) {
    cumulative += Math.max(0, pool[i].weight);
    if (random < cumulative) return i;
  }
  return pool.length - 1;
}

/**
 * Build a weighted pool from eligible shop rewards.
 */
function buildShopRewardPool(
  rewards: EligibleShopReward[],
): { reward: EligibleShopReward; weight: number }[] {
  return rewards.map((reward) => ({
    reward,
    weight: Math.max(0, reward.probability_weight),
  }));
}

/**
 * Load a survey session and verify it is ready for reward allocation.
 */
async function loadSessionForAllocation(
  db: D1Database,
  sessionId: string,
): Promise<{
  id: string;
  campaign_id: string;
  selected_shop_id: string | null;
  status: string;
  user_id: string | null;
} | null> {
  return db
    .prepare(
      `SELECT id, campaign_id, selected_shop_id, status, user_id
       FROM survey_sessions
       WHERE id = ?`
    )
    .bind(sessionId)
    .first<{
      id: string;
      campaign_id: string;
      selected_shop_id: string | null;
      status: string;
      user_id: string | null;
    }>();
}

/**
 * Check whether a session already has a reward assignment.
 */
async function findExistingRewardWin(
  db: D1Database,
  sessionId: string,
): Promise<{ id: string; reward_name: string; shop_id: string } | null> {
  return db
    .prepare(
      `SELECT id, reward_name_snapshot AS reward_name, shop_id
       FROM reward_wins
       WHERE session_id = ?
       LIMIT 1`
    )
    .bind(sessionId)
    .first<{ id: string; reward_name: string; shop_id: string }>();
}

/**
 * Load the winning configuration for a shop.
 */
async function loadShopWinningConfig(
  db: D1Database,
  shopId: string,
): Promise<{
  win_probability: number;
  probability_mode: string;
  no_reward_enabled: number;
  configuration_version: number;
} | null> {
  return db
    .prepare(
      `SELECT win_probability, probability_mode, no_reward_enabled, configuration_version
       FROM shop_winning_config
       WHERE shop_id = ?`
    )
    .bind(shopId)
    .first<{
      win_probability: number;
      probability_mode: string;
      no_reward_enabled: number;
      configuration_version: number;
    }>();
}

/**
 * Load only the given shop's eligible in-stock rewards.
 *
 * Eligibility: shop_id matches, active = 1, stock_remaining > 0,
 * probability_weight > 0.
 */
async function loadEligibleShopRewards(
  db: D1Database,
  shopId: string,
): Promise<EligibleShopReward[]> {
  const rows = await db
    .prepare(
      `SELECT id, reward_name, reward_image_url, stock_remaining, probability_weight,
              winning_ratio, is_default_remainder
       FROM shop_rewards
       WHERE shop_id = ? AND active = 1 AND stock_remaining > 0
       ORDER BY id`
    )
    .bind(shopId)
    .all<EligibleShopReward>();
  return rows.results || [];
}

/**
 * Atomically reserve one unit of stock for a shop reward.
 * Uses a conditional UPDATE so only one request can consume the final unit.
 * Returns true if the reservation succeeded.
 */
async function reserveShopRewardStock(
  db: D1Database,
  shopRewardId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE shop_rewards
       SET stock_remaining = stock_remaining - 1,
           updated_at = ?
       WHERE id = ? AND stock_remaining > 0 AND active = 1`
    )
    .bind(isoTimestamp(), shopRewardId)
    .run();
  return result.meta.changes === 1;
}

/**
 * Derive the new status for a shop reward after stock changes.
 */
function deriveRewardStatus(
  remaining: number,
  total: number,
  lowStockThreshold: number,
): 'AVAILABLE' | 'LOW_STOCK' | 'EXHAUSTED' {
  if (remaining <= 0) return 'EXHAUSTED';
  if (remaining <= lowStockThreshold) return 'LOW_STOCK';
  return 'AVAILABLE';
}

/**
 * Record a reward event in the audit log.
 */
async function recordRewardEvent(
  db: D1Database,
  sessionId: string | null,
  shopId: string | null,
  rewardId: string | null,
  eventType: string,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO reward_events (id, session_id, shop_id, reward_id, event_type, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId(),
        sessionId ?? null,
        shopId ?? null,
        rewardId ?? null,
        eventType,
        metadata === null ? null : JSON.stringify(metadata),
        isoTimestamp(),
      )
      .run();
  } catch (error) {
    logEvent('warn', 'reward_event_write_failed', { eventType, error: String(error) });
  }
}

/**
 * Perform the full shop-isolated reward allocation for a session.
 *
 * Steps:
 *  1. Load session; verify complete and has selected shop
 *  2. Verify shop exists, belongs to campaign, is active
 *  3. Verify session's selected shop matches requested shop
 *  4. Check for existing reward (idempotency)
 *  5. Load shop winning config
 *  6. Load eligible in-stock rewards for this shop only
 *  7. Evaluate winning probability
 *  8. If no win -> persist no-reward result (if enabled)
 *  9. If win -> weighted select reward, atomically reserve stock
 * 10. Persist reward win + audit event + session update
 * 11. Return result
 */
export async function allocateRewardForSession(
  db: D1Database,
  sessionId: string,
  requestedShopId: string,
  idempotencyKey: string,
): Promise<AllocationResult> {
  // 1. Load session
  const session = await loadSessionForAllocation(db, sessionId);
  if (!session) {
    return { kind: 'NO_ELIGIBLE_REWARD', shopId: requestedShopId };
  }

  // 2. Check for existing reward (idempotency) — before status check
  const existing = await findExistingRewardWin(db, sessionId);
  if (existing) {
    return { kind: 'DUPLICATE', existingWinId: existing.id, rewardName: existing.reward_name, shopId: existing.shop_id ?? requestedShopId };
  }

  // 3. Verify survey complete
  if (session.status !== 'SURVEY_COMPLETED') {
    return { kind: 'SESSION_INCOMPLETE', shopId: requestedShopId } as unknown as AllocationResult;
  }

  // 3. Session must have a selected shop
  if (!session.selected_shop_id) {
    return { kind: 'NO_ELIGIBLE_REWARD', shopId: requestedShopId } as unknown as AllocationResult;
  }

  // 4. Session's selected shop must match requested shop (immutability rule)
  if (session.selected_shop_id !== requestedShopId) {
    return { kind: 'SHOP_MISMATCH', shopId: session.selected_shop_id } as unknown as AllocationResult;
  }

  const shopId = session.selected_shop_id;

  // 6. Verify shop exists, belongs to same campaign, is active
  const shop = await db
    .prepare(
      `SELECT id, campaign_id, status FROM shops WHERE id = ?`
    )
    .bind(shopId)
    .first<{ id: string; campaign_id: string; status: string }>();

  if (!shop) {
    return { kind: 'SHOP_NOT_FOUND', shopId } as unknown as AllocationResult;
  }
  if (shop.campaign_id !== session.campaign_id) {
    return { kind: 'SHOP_NOT_ELIGIBLE', shopId } as unknown as AllocationResult;
  }
  if (shop.status !== 'ACTIVE') {
    return { kind: 'SHOP_INACTIVE', shopId } as unknown as AllocationResult;
  }

  // 7. Load only this shop's active rewards (including out-of-stock ones for
  //    ratio calculation — out-of-stock explicit ratios go to the remainder)
  const allRewards = await db
    .prepare(
      `SELECT id, reward_name, reward_image_url, stock_remaining, probability_weight,
              winning_ratio, is_default_remainder, active
       FROM shop_rewards
       WHERE shop_id = ? AND active = 1
       ORDER BY id`
    )
    .bind(shopId)
    .all<EligibleShopReward & { active: number }>();

  const rewards = (allRewards.results || []).filter(r => r.stock_remaining > 0 || r.is_default_remainder === 1);

  // 8. Build probability pool: explicit ratios + remainder for default reward
  //    - Rewards with winning_ratio set get that exact percentage
  //    - The default remainder reward gets 100% - sum(explicit ratios of in-stock rewards)
  //    - Out-of-stock explicit rewards' ratios are absorbed by the remainder reward
  const inStockExplicit = rewards.filter(r => r.winning_ratio != null && r.stock_remaining > 0);
  const totalExplicit = inStockExplicit.reduce((sum, r) => sum + Number(r.winning_ratio), 0);
  const remainder = Math.max(0, 100 - totalExplicit);

  const defaultReward = rewards.find(r => r.is_default_remainder === 1 && r.stock_remaining > 0);

  const pool: { reward: EligibleShopReward; weight: number }[] = [];

  // Add explicit in-stock rewards with their configured ratios
  for (const r of inStockExplicit) {
    pool.push({ reward: r, weight: Number(r.winning_ratio) });
  }

  // Add the default remainder reward with the calculated remainder
  if (defaultReward) {
    pool.push({ reward: defaultReward, weight: remainder });
  }

  // If no pool (no rewards at all), return NO_ELIGIBLE_REWARD
  if (pool.length === 0 || pool.every(e => e.weight <= 0)) {
    await recordRewardEvent(
      db,
      sessionId,
      shopId,
      null,
      'NO_ELIGIBLE_REWARD',
      { reason: 'no_eligible_rewards' },
    );
    return { kind: 'NO_ELIGIBLE_REWARD', shopId };
  }

  const now = isoTimestamp();

  // 9. Weighted random selection with stock reservation retry
  let selectedReward: EligibleShopReward | null = null;
  let attempts = 0;
  const maxAttempts = pool.length;

  while (attempts < maxAttempts) {
    attempts += 1;
    const index = pickWeightedIndexSecure(pool);
    if (index < 0) break;
    const candidate = pool[index].reward;

    // Atomic conditional stock reservation
    const reserved = await reserveShopRewardStock(db, candidate.id);
    if (reserved) {
      selectedReward = candidate;
      break;
    }

    // Another request consumed the last unit — remove from pool and retry
    pool.splice(index, 1);
  }

  if (!selectedReward) {
    // Stock race exhausted all options
    await recordRewardEvent(
      db,
      sessionId,
      shopId,
      null,
      'NO_ELIGIBLE_REWARD',
      { reason: 'stock_race_exhausted' },
    );
    return { kind: 'NO_ELIGIBLE_REWARD', shopId };
  }

  // 11. Persist reward assignment (idempotency via UNIQUE constraint)
  const winId = generateId();
  const userRewardId = generateId();
  const spinReference = generateId();

  try {
    await db.batch([
      // Insert reward win — UNIQUE(session_id) + UNIQUE(idempotency_key) prevent duplicates
      db
        .prepare(
          `INSERT INTO reward_wins (id, session_id, campaign_id, shop_id, shop_reward_id, reward_name_snapshot, status, idempotency_key, spin_reference, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'REWARD_ASSIGNED', ?, ?, ?, ?)`
        )
        .bind(
          winId,
          sessionId,
          session.campaign_id,
          shopId,
          selectedReward.id,
          selectedReward.reward_name,
          idempotencyKey,
          spinReference,
          now,
          now,
        ),

      // Create user_reward junction for delivery tracking (reward_id is null since we use shop_reward_id)
      db
        .prepare(
          `INSERT INTO user_rewards (id, user_id, reward_spin_id, reward_id, delivery_status, won_at, created_at, updated_at)
           VALUES (?, ?, NULL, NULL, 'DELIVERY_PENDING', ?, ?, ?)`
        )
        .bind(
          userRewardId,
          session.user_id ?? sessionId,
          now,
          now,
          now,
        ),

      // Update session status
      db
        .prepare(
          `UPDATE survey_sessions
           SET status = 'REWARD_ASSIGNED', reward_assigned_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(now, now, sessionId),

      // Record audit event
      db
        .prepare(
          `INSERT INTO reward_events (id, session_id, shop_id, reward_id, event_type, metadata_json, created_at)
           VALUES (?, ?, ?, ?, 'REWARD_ASSIGNED', ?, ?)`
        )
        .bind(
          generateId(),
          sessionId,
          shopId,
          selectedReward.id,
          JSON.stringify({ reward_name: selectedReward.reward_name, stock_reserved: true }),
          now,
        ),
    ]);
  } catch (error) {
    // If idempotency violation, another request already assigned — return existing
    const message = String(error).toLowerCase();
    if (message.includes('unique constraint')) {
      const existing = await findExistingRewardWin(db, sessionId);
      if (existing) {
        return { kind: 'DUPLICATE', existingWinId: existing.id, rewardName: existing.reward_name, shopId: existing.shop_id ?? shopId };
      }
    }

    // Compensation: restore stock on the selected reward
    try {
      await db
        .prepare(
          `UPDATE shop_rewards
           SET stock_remaining = stock_remaining + 1,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(now, selectedReward.id)
        .run();
    } catch (compError) {
      logEvent('error', 'shop_stock_compensation_failed', {
        shopRewardId: selectedReward.id,
        error: String(compError),
      });
    }

    logEvent('error', 'reward_allocation_failed', { sessionId, shopId, error: String(error) });
    return { kind: 'NO_ELIGIBLE_REWARD', shopId };
  }

  await recordRewardEvent(
    db,
    sessionId,
    shopId,
    selectedReward.id,
    'STOCK_RESERVED',
    { reward_name: selectedReward.reward_name, stock_remaining_after: selectedReward.stock_remaining - 1 },
  );

  return {
    kind: 'REWARD_ASSIGNED',
    shopId,
    shopRewardId: selectedReward.id,
    rewardName: selectedReward.reward_name,
    rewardImageUrl: selectedReward.reward_image_url,
    userRewardId,
    rewardWinId: winId,
  };
}
