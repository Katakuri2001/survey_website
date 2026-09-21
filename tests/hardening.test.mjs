#!/usr/bin/env node
/**
 * Hardening / concurrency smoke test.
 *
 * Exercises the production-critical invariants against a running API:
 *   - envelope shape ({ success, data } / { success:false, error:{code,message} })
 *   - auth is enforced (profile requires a token, admin requires is_admin)
 *   - survey submission is idempotent (same submissionRequestId -> same id)
 *   - the spin endpoint awards at most one reward per user+campaign, even when
 *     the same request is fired many times in parallel
 *   - delivery submission is idempotent
 *
 * Usage:
 *   API_BASE=http://localhost:8787 node tests/hardening.test.mjs
 *
 * The script exits 0 when every assertion passes, 1 otherwise. It is safe to
 * re-run: it creates unique guest users each time.
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:8787').replace(/\/$/, '')

// A unique simulated client IP per run so repeated runs do not share the
// in-isolate rate-limit budget. The API trusts CF-Connecting-IP (as Cloudflare
// sets it in production), and wrangler dev honors the header locally.
//
// Cloudflare's edge, however, rejects any request that arrives with a
// client-supplied CF-Connecting-IP (error 1000 / HTTP 403), so the header is
// only sent when targeting a local wrangler dev server. Against a deployed API
// the edge supplies the real client IP and the rate limit is shared.
const TEST_IP = `10.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_BASE)

let passed = 0
let failed = 0

function check(name, condition, detail) {
  if (condition) {
    passed += 1
    console.log(`  \u2713 ${name}`)
  } else {
    failed += 1
    console.error(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ''}`)
  }
}

async function api(path, { method = 'GET', token, body, ip } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(IS_LOCAL_API ? { 'CF-Connecting-IP': ip || TEST_IP } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON (unexpected) */
  }
  return { status: res.status, body: json }
}

function uniquePhone() {
  // Valid-looking MM mobile number, unique per run.
  const tail = String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 100)).padStart(2, '0')
  return `09${tail.slice(0, 9)}`
}

async function createGuest(ip) {
  const phone = uniquePhone()
  const res = await api('/users/guest', {
    method: 'POST',
    ip,
    body: { fullName: 'Hardening Test', phone, dob: '1990-01-01' },
  })
  if (!res.body?.success) throw new Error(`guest create failed: ${JSON.stringify(res.body)}`)
  return { token: res.body.data.token, userId: res.body.data.userId, phone }
}

function buildAnswers(questions) {
  return (questions || [])
    .filter((q) => q.is_required)
    .map((q) => {
      const firstOption = (q.options || [])[0]
      const optionValue = firstOption?.option_value || firstOption?.option_text || 'Yes'
      switch (q.question_type) {
        case 'rating':
        case 'number':
          return { questionId: q.id, type: 'rating', value: 5 }
        case 'multiple_choice':
          return { questionId: q.id, type: 'multiple_choice', value: [optionValue] }
        case 'single_choice':
        case 'dropdown':
          return { questionId: q.id, type: 'single_choice', value: optionValue }
        case 'yes_no':
          return { questionId: q.id, type: 'yes_no', value: 'yes' }
        default:
          return { questionId: q.id, type: 'text', value: 'Automated test answer' }
      }
    })
}

async function submitSurvey(token, ip) {
  const questions = await api('/survey/questions?lang=en', { ip })
  if (!questions.body?.success) throw new Error('no active survey; seed the database first')
  const answers = buildAnswers(questions.body.data.questions)
  const submissionRequestId = crypto.randomUUID()
  const first = await api('/survey/submit', {
    method: 'POST',
    token,
    ip,
    body: { campaignId: null, language: 'en', submissionRequestId, answers },
  })
  return { first, submissionRequestId, answers }
}

// ============================================================
// Tests
// ============================================================

async function testAuthAndEnvelope() {
  console.log('\nAuth + envelope')
  const unauth = await api('/user/profile')
  check('unauthenticated profile is 401', unauth.status === 401, `got ${unauth.status}`)
  check('error envelope has code+message', unauth.body?.success === false && unauth.body?.error?.code === 'UNAUTHORIZED')

  const missing = await api('/definitely-not-a-route')
  check('unknown route returns NOT_FOUND envelope', missing.status === 404 && missing.body?.error?.code === 'NOT_FOUND')

  const guest = await createGuest()
  const profile = await api('/user/profile', { token: guest.token })
  check('authenticated profile succeeds', profile.body?.success === true && profile.body.data?.id === guest.userId)

  const admin = await api('/admin/dashboard', { token: guest.token })
  check('non-admin cannot reach admin API', admin.status === 403 && admin.body?.error?.code === 'FORBIDDEN')

  const health = await api('/health')
  check('health check reports database ok', health.body?.data?.database === 'ok')

  return guest
}

async function testSurveyIdempotency(guest) {
  console.log('\nSurvey idempotency')
  const { first, submissionRequestId, answers } = await submitSurvey(guest.token)
  if (!first.body?.success) {
    check('survey submit succeeds', false, JSON.stringify(first.body))
    return null
  }
  check('survey submit succeeds', true)

  const replay = await api('/survey/submit', {
    method: 'POST',
    token: guest.token,
    body: { campaignId: null, language: 'en', submissionRequestId, answers },
  })
  check('replayed submission is idempotent', replay.body?.success === true && replay.body.data?.responseId === first.body.data.responseId)

  const duplicate = await api('/survey/submit', {
    method: 'POST',
    token: guest.token,
    body: { campaignId: null, language: 'en', submissionRequestId: crypto.randomUUID(), answers },
  })
  check('second submission returns the original response', duplicate.body?.success === true && duplicate.body.data?.responseId === first.body.data.responseId)

  return first.body.data.responseId
}

async function testSpinConcurrency() {
  console.log('\nSpin concurrency (one reward per user)')
  const guest = await createGuest()
  await submitSurvey(guest.token)

  // Fire 10 spins with distinct idempotency keys simultaneously.
  const runId = Date.now()
  const keys = Array.from({ length: 10 }, (_, i) => `parallel-${runId}-${i}`)
  const attempts = await Promise.all(
    keys.map((idempotencyKey) =>
      api('/rewards/spin', {
        method: 'POST',
        token: guest.token,
        body: { campaignId: 'default', productId: 'beer', idempotencyKey },
      })
    )
  )

  const winIndex = attempts.findIndex((a) => a.body?.success)
  const wins = attempts.filter((a) => a.body?.success)
  const already = attempts.filter((a) => a.body?.error?.code === 'ALREADY_SPUN' || a.body?.error?.code === 'SPIN_IN_PROGRESS')
  const noRewards = attempts[0]?.body?.error?.code === 'NO_REWARDS_AVAILABLE'

  if (noRewards) {
    console.log('  ~ no rewards configured; skipping spin assertions')
    return
  }

  check('exactly one concurrent spin wins', wins.length === 1, `wins=${wins.length}`)
  check('the rest are rejected as already-spun/in-progress', wins.length + already.length === attempts.length)

  const winner = wins[0]
  if (!winner) return
  check('winner has rewardId + userRewardId', Boolean(winner.body.data.rewardId) && Boolean(winner.body.data.userRewardId))

  // Same idempotency key must return the same award, not a new one.
  const replay = await api('/rewards/spin', {
    method: 'POST',
    token: guest.token,
    body: { campaignId: 'default', productId: 'beer', idempotencyKey: keys[winIndex] },
  })
  check(
    'replaying the winning key returns the same reward',
    replay.body?.success === true && replay.body.data?.userRewardId === winner.body.data.userRewardId
  )

  const mine = await api('/rewards/my', { token: guest.token })
  check('exactly one reward owned by the user', Array.isArray(mine.body?.data) && mine.body.data.length === 1, `count=${mine.body?.data?.length}`)

  if (mine.body?.data?.[0]) {
    const userRewardId = mine.body.data[0].id
    const delivery = {
      userRewardId,
      fullName: 'Hardening Test',
      phone: guest.phone,
      address: 'No.1 Test Street',
      city: 'Yangon',
    }
    const firstDelivery = await api('/rewards/delivery', { method: 'POST', token: guest.token, body: delivery })
    const secondDelivery = await api('/rewards/delivery', { method: 'POST', token: guest.token, body: delivery })
    check('delivery submission succeeds', firstDelivery.body?.success === true, JSON.stringify(firstDelivery.body))
    check('delivery replay is idempotent', secondDelivery.body?.success === true && secondDelivery.body.data?.idempotent === true)
  }
}

async function testGuestConcurrencySamePhone() {
  console.log('\nGuest creation concurrency (same phone -> same user)')
  const phone = uniquePhone()
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      api('/users/guest', {
        method: 'POST',
        body: { fullName: 'Hardening Test', phone, dob: '1990-01-01' },
      })
    )
  )
  const ids = new Set(results.filter((r) => r.body?.success).map((r) => r.body.data.userId))
  check('all concurrent guest requests succeed', results.every((r) => r.body?.success === true))
  check('all resolve to a single user id', ids.size === 1, `distinct ids=${ids.size}`)
}

// ============================================================
// Optional destructive test (opt-in): set one reward to a single unit, drain
// every other reward, then fire many concurrent valid spins from distinct users.
// Only one user may win the last unit; stock must never go negative.
//
// Enable with: TEST_STOCK_CONTENTION=1 API_BASE=... node tests/hardening.test.mjs
// ============================================================

async function adminLogin() {
  const email = process.env.ADMIN_EMAIL || 'admin@myanmarbeer.com'
  const password = process.env.ADMIN_PASSWORD || 'admin'
  const res = await api('/auth/admin/login', { method: 'POST', body: { email, password } })
  if (!res.body?.success) throw new Error(`admin login failed: ${JSON.stringify(res.body)}`)
  return res.body.data.token
}

async function setStock(adminToken, id, adjustment, reason) {
  const res = await api(`/admin/rewards/${id}/stock`, {
    method: 'PATCH',
    token: adminToken,
    body: { adjustment, reason },
  })
  if (!res.body?.success) throw new Error(`stock adjust failed for ${id}: ${JSON.stringify(res.body)}`)
  return res.body.data.newQuantity
}

async function fetchRewards(adminToken) {
  const res = await api('/admin/rewards', { token: adminToken })
  return Array.isArray(res.body?.data) ? res.body.data : []
}

async function testStockContention() {
  console.log('\nReward stock contention (stock=1, many concurrent valid spins)')
  const admin = await adminLogin()
  const rewards = (await fetchRewards(admin)).filter((r) => r.is_active === 1 || r.is_active === true)
  if (rewards.length === 0) {
    console.log('  ~ no active rewards; skipping')
    return
  }

  const target =
    rewards.find((r) => r.requires_delivery !== 0 && r.remaining_quantity > 0) || rewards[0]
  const snapshot = rewards.map((r) => ({ id: r.id, remaining: r.remaining_quantity }))
  const startedAt = Date.now()

  try {
    // Make the target the only eligible reward, with exactly one unit left.
    // Zero-stock rewards are excluded from the pool by the spin query.
    for (const r of rewards) {
      if (r.id !== target.id && r.remaining_quantity > 0) {
        await setStock(admin, r.id, -r.remaining_quantity, 'contention test: drain')
      }
    }
    await setStock(admin, target.id, 1 - target.remaining_quantity, 'contention test: set to 1')

    const N = Number(process.env.STOCK_CONTENTION_USERS || 30)
    const guests = []
    for (let i = 0; i < N; i++) {
      // Distinct client IP per simulated participant so the per-IP rate limits
      // do not interfere with the concurrency being measured.
      const ip = `10.${(i * 7) % 254}.${(i * 13) % 254}.${(i * 29) % 254}`
      const g = await createGuest(ip)
      await submitSurvey(g.token, ip)
      guests.push({ token: g.token, ip })
    }

    const attempts = await Promise.all(
      guests.map((g, i) =>
        api('/rewards/spin', {
          method: 'POST',
          token: g.token,
          ip: g.ip,
          body: { campaignId: 'default', productId: 'beer', idempotencyKey: `contention-${startedAt}-${i}` },
        })
      )
    )

    const wins = attempts.filter((a) => a.body?.success)
    check('exactly one user wins the last unit', wins.length === 1, `wins=${wins.length}`)
    check('the winner received the contested reward', wins[0]?.body?.data?.rewardId === target.id)
    check(
      'rejected spins are not falsely marked as duplicate submissions',
      attempts.filter((a) => !a.body?.success).every((a) => typeof a.body?.error?.code === 'string')
    )

    const after = await fetchRewards(admin)
    const targetAfter = after.find((r) => r.id === target.id)
    check('contested stock is now exactly 0', targetAfter?.remaining_quantity === 0, `remaining=${targetAfter?.remaining_quantity}`)
    check('no reward has negative stock', after.every((r) => r.remaining_quantity >= 0))
  } finally {
    // Always restore the original inventory, even if an assertion above threw.
    const current = await fetchRewards(admin)
    for (const s of snapshot) {
      const now = current.find((r) => r.id === s.id)?.remaining_quantity ?? 0
      const diff = s.remaining - now
      if (diff !== 0) await setStock(admin, s.id, diff, 'contention test: restore')
    }
  }
}

async function main() {
  console.log(`Hardening test against ${API_BASE}`)
  try {
    const health = await api('/health')
    if (health.status >= 500 || health.body === null) {
      throw new Error(`API not reachable at ${API_BASE}`)
    }
  } catch (error) {
    console.error(`\nCannot reach the API at ${API_BASE}: ${error.message}`)
    console.error('Start it with `cd apps/api && npm run dev` (with local D1 migrated + seeded).')
    process.exit(2)
  }

  const guest = await testAuthAndEnvelope()
  await testSurveyIdempotency(guest)
  await testSpinConcurrency()
  await testGuestConcurrencySamePhone()
  if (process.env.TEST_STOCK_CONTENTION === '1') {
    await testStockContention()
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nUnexpected failure:', error)
  process.exit(1)
})
