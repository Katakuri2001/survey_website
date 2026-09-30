/**
 * k6 load test for the survey + spin flow.
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 *
 * Run against a disposable local or staging environment (never production):
 *
 *   API_BASE=https://staging.example.com/api \
 *   USERS=3000 \
 *   k6 run loadtest/k6-spin.js
 *
 * Environment variables:
 *   API_BASE          Base URL of the API (default http://localhost:8787)
 *   USERS             Number of unique users to seed and run through the flow (default 500)
 *   HOLD              Seconds to hold the peak load (default 60)
 *   RAMP              Seconds to ramp up (default 30)
 *   REQUEST_TIMEOUT   Per-request timeout (default 30s)
 *   SETUP_TIMEOUT     Maximum setup duration (default 30m)
 *
 * Setup validates every response and aborts on an empty/partial seed. The
 * target guard is evaluated during k6 initialization, before setup can send a
 * request to a production host.
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const RAW_API_BASE = String(__ENV.API_BASE || 'http://localhost:8787').trim()
const API_BASE = RAW_API_BASE.replace(/\/+$/, '') || '/'
const USERS = positiveInteger(__ENV.USERS || '500', 'USERS')
const HOLD = positiveInteger(__ENV.HOLD || '60', 'HOLD')
const RAMP = positiveInteger(__ENV.RAMP || '30', 'RAMP')
const REQUEST_TIMEOUT = durationSeconds(__ENV.REQUEST_TIMEOUT || '30', 'REQUEST_TIMEOUT')
const SETUP_TIMEOUT = durationSeconds(__ENV.SETUP_TIMEOUT || '30m', 'SETUP_TIMEOUT')

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
const STAGING_HOST = /(^|[.-])(staging|stage)([.-]|$)/i
const target = parseTarget(API_BASE)
const isLocalTarget = Boolean(target && LOCAL_HOSTS.indexOf(target.hostname) !== -1)
const isStagingTarget = Boolean(target && STAGING_HOST.test(target.hostname))

if (!target) {
  throw new Error(`Invalid API_BASE: ${RAW_API_BASE}. Use an absolute http(s) URL.`)
}
if (!isLocalTarget && !isStagingTarget) {
  throw new Error(
    `Refusing k6 target ${API_BASE}. Load tests are allowed only against localhost/loopback ` +
      'or a host explicitly named staging/stage.',
  )
}
const configTrend = new Trend('config_duration')
const spinTrend = new Trend('spin_duration')
const CONTROLLED_STATUSES = [200, 400, 401, 403, 409, 422, 429]
const expectedResponse = http.expectedStatuses(...CONTROLLED_STATUSES)

export const options = {
  setupTimeout: `${SETUP_TIMEOUT}s`,
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

function positiveInteger(value, name) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer.`)
  return number
}

function durationSeconds(value, name) {
  const match = String(value).trim().toLowerCase().match(/^(\d+)(ms|s|m)?$/)
  if (!match) throw new Error(`${name} must be a duration such as 500ms, 30s, or 5m.`)
  const amount = Number(match[1])
  if (amount < 1) throw new Error(`${name} must be greater than zero.`)
  if (match[2] === 'ms') return Math.max(1, Math.ceil(amount / 1000))
  if (match[2] === 'm') return amount * 60
  return amount
}

function parseTarget(value) {
  const match = String(value).match(/^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?(\/[^?#]*)?$/i)
  if (!match) return null
  return {
    protocol: match[1].toLowerCase(),
    hostname: match[2].replace(/^\[|\]$/g, '').toLowerCase(),
    port: match[3] || '',
  }
}

function json(response) {
  try {
    return response.json()
  } catch (_) {
    return null
  }
}

function requireStatus(response, label, statuses) {
  const okStatus = statuses.indexOf(response.status) !== -1
  check(response, { [`${label} status`]: () => okStatus })
  if (!okStatus) {
    throw new Error(`${label} returned HTTP ${response.status}; body=${response.body}`)
  }
}

function requestParams(headers, phase) {
  return {
    headers,
    tags: { phase },
    timeout: `${REQUEST_TIMEOUT}s`,
  }
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
  const questionsRes = http.get(
    `${API_BASE}/survey/questions?lang=en`,
    requestParams(jsonHeaders(), 'setup-questions'),
  )
  requireStatus(questionsRes, 'setup questions', [200])
  const questionsPayload = json(questionsRes)
  const questions = questionsPayload?.data?.questions
  if (questionsPayload?.success !== true || !Array.isArray(questions) || questions.length === 0) {
    throw new Error('setup questions returned no active survey questions')
  }

  const tokens = []
  for (let i = 0; i < USERS; i += 1) {
    const guestRes = http.post(
      `${API_BASE}/users/guest`,
      JSON.stringify({ fullName: `Load Test ${i}`, phone: uniquePhone(i), dob: '1990-01-01' }),
      requestParams(jsonHeaders(), 'setup-guest'),
    )
    requireStatus(guestRes, `setup guest ${i}`, [200, 201])
    const guestPayload = json(guestRes)
    const token = guestPayload?.data?.token
    if (guestPayload?.success !== true || typeof token !== 'string' || token.length === 0) {
      throw new Error(`setup guest ${i} returned no token`)
    }

    const submitRes = http.post(
      `${API_BASE}/survey/submit`,
      JSON.stringify({
        campaignId: null,
        language: 'en',
        submissionRequestId: `load-${i}-${Date.now()}`,
        answers: buildAnswers(questions),
      }),
      requestParams(jsonHeaders(token), 'setup-submit'),
    )
    requireStatus(submitRes, `setup survey submit ${i}`, [200, 201])
    const submitPayload = json(submitRes)
    if (submitPayload?.success !== true) {
      throw new Error(`setup survey submit ${i} was rejected: ${submitRes.body}`)
    }
    tokens.push(token)
  }

  if (tokens.length === 0) {
    throw new Error('setup completed without any authenticated users')
  }
  console.log(`seeded ${tokens.length}/${USERS} users`)
  return { tokens }
}

export default function (data) {
  if (!data || !Array.isArray(data.tokens) || data.tokens.length === 0) {
    throw new Error('k6 setup returned no tokens; refusing to run an empty workload')
  }
  const token = data.tokens[(__VU - 1) % data.tokens.length]
  if (!token) throw new Error(`k6 VU ${__VU} received an empty token`)

  // Read path: the combined config endpoint the app polls.
  const configRes = http.get(
    `${API_BASE}/public/config?lang=en`,
    requestParams(jsonHeaders(token), 'config'),
  )
  configTrend.add(configRes.timings.duration)
  check(configRes, { 'config 200': (r) => r.status === 200 })

  // Write path: one spin per (user, campaign). Controlled 4xx responses are
  // expected for retries/rate limits, but unexpected statuses still fail the
  // request metric and the explicit check below.
  const spinRes = http.post(
    `${API_BASE}/rewards/spin`,
    JSON.stringify({ campaignId: 'default', productId: 'beer', idempotencyKey: `vu-${__VU}-${__ITER}-${Date.now()}` }),
    { ...requestParams(jsonHeaders(token), 'spin'), responseCallback: expectedResponse },
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
