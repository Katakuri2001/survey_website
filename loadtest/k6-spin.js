/**
 * k6 load test for the survey + spin flow.
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 *
 * Run against a staging environment (NEVER production first!):
 *
 *   API_BASE=https://staging.example.com/api \
 *   USERS=3000 \
 *   k6 run loadtest/k6-spin.js
 *
 * Environment variables:
 *   API_BASE  Base URL of the API (default http://localhost:8787)
 *   USERS     Number of unique users to seed and run through the flow (default 500)
 *   HOLD      Seconds to hold the peak load (default 60)
 *   RAMP      Seconds to ramp up (default 30)
 *
 * Setup seeds one guest + one completed survey per user so the spin path has
 * real, already-authenticated users. That seeding is intentionally sequential;
 * keep USERS at or below your D1/worker limits while tuning.
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const API_BASE = (__ENV.API_BASE || 'http://localhost:8787').replace(/\/$/, '')
const USERS = Number(__ENV.USERS || 500)
const HOLD = Number(__ENV.HOLD || 60)
const RAMP = Number(__ENV.RAMP || 30)

const configTrend = new Trend('config_duration')
const spinTrend = new Trend('spin_duration')

export const options = {
  scenarios: {
    survey_and_spin: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: `${RAMP}s`, target: USERS },
        { duration: `${HOLD}s`, target: USERS },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    config_duration: ['p(95)<500'],
    spin_duration: ['p(95)<1500'],
  },
}

function jsonHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function uniquePhone(i) {
  const tail = String(100000000 + (i % 899999999)).padStart(9, '0')
  return `09${tail}`
}

function buildAnswers(questions) {
  return (questions || [])
    .filter((q) => q.is_required)
    .map((q) => {
      const first = (q.options || [])[0]
      const optionValue = first?.option_value || first?.option_text || 'Yes'
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
          return { questionId: q.id, type: 'text', value: 'load test' }
      }
    })
}

export function setup() {
  const questionsRes = http.get(`${API_BASE}/survey/questions?lang=en`)
  const questions = questionsRes.json('data.questions') || []
  const tokens = []

  for (let i = 0; i < USERS; i += 1) {
    const guestRes = http.post(
      `${API_BASE}/users/guest`,
      JSON.stringify({ fullName: `Load Test ${i}`, phone: uniquePhone(i), dob: '1990-01-01' }),
      { headers: jsonHeaders() }
    )
    const token = guestRes.json('data.token')
    if (!token) continue

    http.post(
      `${API_BASE}/survey/submit`,
      JSON.stringify({
        campaignId: null,
        language: 'en',
        submissionRequestId: `load-${i}-${Date.now()}`,
        answers: buildAnswers(questions),
      }),
      { headers: jsonHeaders(token) }
    )
    tokens.push(token)
  }

  console.log(`seeded ${tokens.length} users`)
  return { tokens }
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length]
  if (!token) return

  // Read path: the combined config endpoint the app polls.
  const configRes = http.get(`${API_BASE}/public/config?lang=en`, { headers: jsonHeaders(token) })
  configTrend.add(configRes.timings.duration)
  check(configRes, { 'config 200': (r) => r.status === 200 })

  // Write path: one spin per (user, campaign).
  const spinRes = http.post(
    `${API_BASE}/rewards/spin`,
    JSON.stringify({ campaignId: 'default', productId: 'beer', idempotencyKey: `vu-${__VU}-${__ITER}-${Date.now()}` }),
    { headers: jsonHeaders(token) }
  )
  spinTrend.add(spinRes.timings.duration)
  check(spinRes, {
    'spin is a clean success or a controlled rejection': (r) => {
      if (r.status === 200) return true
      const code = r.json('error.code')
      return ['ALREADY_SPUN', 'SPIN_IN_PROGRESS', 'NO_REWARDS_AVAILABLE', 'REWARD_UNAVAILABLE', 'RATE_LIMITED'].includes(code)
    },
  })

  sleep(1)
}
