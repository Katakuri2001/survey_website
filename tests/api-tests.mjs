#!/usr/bin/env node
/**
 * Survey platform — API gate subset (test.md §0 companion).
 *
 * Replaces the old volatile /tmp script with a durable, deterministic suite
 * covering: service/auth, public reads, survey submit (+idempotent replay),
 * spin (+one-spin-per-response), delivery guard rails, admin authz,
 * analytics reads, and the P5b reward-status derivation rules.
 *
 * Usage (API must be running locally):
 *   API_BASE=http://localhost:8787 node tests/api-tests.mjs
 */

const API = (process.env.API_BASE || 'http://localhost:8787').replace(/\/+$/, '');
const RUN = Date.now().toString(36);

let pass = 0;
let fail = 0;
const failures = [];

function check(cond, label, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${pass + fail}  ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL      ${label}${extra ? ` — ${extra}` : ''}`);
  }
}

async function call(method, path, { token, body } = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, json };
  } catch (err) {
    return { status: 0, json: null, err: String(err) };
  }
}

const ok = (r) => r.json?.success === true;
const code = (r) => r.json?.error?.code;
const data = (r) => r.json?.data;
const isMM = (s) => typeof s === 'string' && /[\u1000-\u109F]/.test(s);

function answerFor(q) {
  const t = String(q.question_type || '').toLowerCase();
  const opt = Array.isArray(q.options) ? q.options[0] : null;
  const v = opt ? (opt.option_value ?? opt.option_text) : null;
  if (t.includes('checkbox') || t.includes('multi')) return v != null ? [v] : ['option-a'];
  if (v != null) return v;
  if (t.includes('rating')) return 4;
  return 'Gate test answer';
}

async function main() {
  console.log(`API gate subset → ${API} (run ${RUN})\n`);

  // ------------------------------------------------------------
  console.log('A. Service & auth');
  const root = await call('GET', '/');
  check(ok(root) && typeof data(root) === 'object', 'GET / → service root responds', root.err);

  const health = await call('GET', '/health');
  check(ok(health) && data(health)?.status === 'ok' && data(health)?.database === 'ok',
    'GET /health → status ok, database ok', JSON.stringify(health.json));

  const email = `gate-${RUN}@test.local`;
  const phone = `09${String(Date.now()).slice(-9)}`;
  const reg = await call('POST', '/auth/register', {
    body: { fullName: 'Gate Tester', email, phone, password: 'gatepass123', age: 28, gender: 'male', city: 'Yangon', township: 'Hlaing' },
  });
  const userToken = data(reg)?.token;
  check(ok(reg) && Boolean(userToken) && data(reg)?.user?.id, 'API-01 register → token + user', JSON.stringify(reg.json));

  const dup = await call('POST', '/auth/register', {
    body: { fullName: 'Gate Dup', email, phone: `09${String(Date.now() + 1).slice(-9)}`, password: 'gatepass123' },
  });
  check(!ok(dup) && dup.status >= 400, 'API-02 duplicate email → success:false', `status ${dup.status}`);

  const login = await call('POST', '/auth/login', { body: { email, password: 'gatepass123' } });
  check(ok(login) && Boolean(data(login)?.token), 'API-03 login correct → token', JSON.stringify(login.json));

  const loginBad = await call('POST', '/auth/login', { body: { email, password: 'wrong-password' } });
  check(!ok(loginBad) && loginBad.status >= 400, 'API-04 login wrong password → success:false', `status ${loginBad.status}`);

  const admin = await call('POST', '/auth/admin/login', { body: { email: 'admin@myanmarbeer.com', password: 'admin' } });
  const adminToken = data(admin)?.token;
  check(ok(admin) && Boolean(adminToken), 'API-05a admin login → token', JSON.stringify(admin.json));

  const adminAsUser = await call('POST', '/auth/admin/login', { body: { email, password: 'gatepass123' } });
  check(!ok(adminAsUser) && adminAsUser.status >= 400, 'API-05b normal user on admin login → rejected', `status ${adminAsUser.status}`);

  const prof = await call('GET', '/user/profile', { token: userToken });
  check(ok(prof) && data(prof)?.email === email, 'API-06a profile with token → own profile', JSON.stringify(prof.json));

  const profNoTok = await call('GET', '/user/profile');
  check(!ok(profNoTok) && profNoTok.status === 401, 'API-06b profile without token → 401', `status ${profNoTok.status}`);

  const patch = await call('PATCH', '/user/profile', { token: userToken, body: { occupation: 'QA Gate', city: 'Yangon' } });
  check(ok(patch), 'API-07a PATCH profile → success', JSON.stringify(patch.json));
  const profBack = await call('GET', '/user/profile', { token: userToken });
  check(ok(profBack) && data(profBack)?.occupation === 'QA Gate', 'API-07b profile read-back → occupation updated', JSON.stringify(profBack.json));

  // ------------------------------------------------------------
  console.log('B. Public reads');
  const prodEn = await call('GET', '/products?lang=en');
  check(ok(prodEn) && Array.isArray(data(prodEn)) && data(prodEn).some((p) => p.id === 'beer' || /beer/i.test(String(p.name))),
    'API-08a products en → contains beer', JSON.stringify(prodEn.json)?.slice(0, 200));

  const prodMy = await call('GET', '/products?lang=my');
  check(ok(prodMy) && Array.isArray(data(prodMy)) && data(prodMy).some((p) => isMM(p.name)),
    'API-08b products my → Myanmar translation', JSON.stringify(prodMy.json)?.slice(0, 200));

  const camps = await call('GET', '/campaigns?lang=en');
  check(ok(camps) && Array.isArray(data(camps)) && data(camps).length >= 1,
    'API-09 campaigns → active campaign(s) present', JSON.stringify(camps.json)?.slice(0, 200));

  // Latest active survey — same resolution rule as POST /survey/submit.
  const qEn = await call('GET', '/survey/questions?lang=en');
  const questions = data(qEn)?.questions ?? [];
  const ordered = questions.every((q, i) => i === 0 || questions[i - 1].display_order <= q.display_order);
  check(ok(qEn) && Boolean(data(qEn)?.version) && questions.length >= 1 && ordered &&
    questions.every((q) => Array.isArray(q.options)),
    'API-10a questions en → version + ordered questions + options arrays', JSON.stringify(qEn.json)?.slice(0, 200));

  const qMy = await call('GET', '/survey/questions?lang=my');
  check(ok(qMy) && (data(qMy)?.questions ?? []).some((q) => isMM(q.question_text)),
    'API-10b questions my → Myanmar question text', JSON.stringify(qMy.json)?.slice(0, 200));

  const qUnknown = await call('GET', '/survey/questions/gate-unknown-product?lang=en');
  check(qUnknown.status < 500 && !ok(qUnknown), 'API-11 unknown product → graceful success:false (no 5xx)', `status ${qUnknown.status}`);

  // ------------------------------------------------------------
  console.log('C. Survey submit');
  const missing = await call('POST', '/survey/submit', {
    token: userToken,
    body: { language: 'en', answers: [{ questionId: 'gate-bogus-question', value: 'x' }] },
  });
  check(!ok(missing) && missing.status === 422, 'API-13 missing required answer → 422', `status ${missing.status} ${JSON.stringify(missing.json)}`);

  const required = questions.filter((q) => q.is_required === 1 || q.is_required === true);
  const answers = required.map((q) => ({ questionId: q.id, type: q.question_type, value: answerFor(q) }));
  const requestId = `gate-${RUN}-main`;
  const submit = await call('POST', '/survey/submit', {
    token: userToken,
    body: { language: 'en', submissionRequestId: requestId, answers },
  });
  const responseId = data(submit)?.responseId;
  check(ok(submit) && Boolean(responseId), 'API-12 submit full → responseId', JSON.stringify(submit.json)?.slice(0, 300));

  const replay = await call('POST', '/survey/submit', {
    token: userToken,
    body: { language: 'en', submissionRequestId: requestId, answers },
  });
  check(ok(replay) && data(replay)?.idempotent === true && data(replay)?.responseId === responseId,
    'API-12b replay same submissionRequestId → idempotent', JSON.stringify(replay.json));

  // ------------------------------------------------------------
  console.log('D. Rewards & spin');
  const rewEn = await call('GET', '/rewards?lang=en');
  check(ok(rewEn) && Array.isArray(data(rewEn)) && data(rewEn).length >= 1,
    'API-14a rewards en → active list (design: 4 active)', `len ${Array.isArray(data(rewEn)) ? data(rewEn).length : '?'}`);

  const rewMy = await call('GET', '/rewards?lang=my');
  check(ok(rewMy) && Array.isArray(data(rewMy)) && data(rewMy).some((r) => isMM(r.name)),
    'API-14b rewards my → Myanmar translation', JSON.stringify(rewMy.json)?.slice(0, 200));

  const idem = `gate-${RUN}-spin1`;
  const spin = await call('POST', '/rewards/spin', { token: userToken, body: { idempotencyKey: idem } });
  const userRewardId = data(spin)?.userRewardId;
  check(ok(spin) && Boolean(userRewardId) && Boolean(data(spin)?.rewardName),
    'API-15 spin → userRewardId + rewardName', JSON.stringify(spin.json));

  const spin2 = await call('POST', '/rewards/spin', { token: userToken, body: { idempotencyKey: `${idem}-b` } });
  check(!ok(spin2) && ['ALREADY_SPUN', 'SPIN_IN_PROGRESS'].includes(code(spin2)),
    'API-16 second spin for same response → ALREADY_SPUN/SPIN_IN_PROGRESS', `got ${code(spin2)} (status ${spin2.status})`);

  const spinNoTok = await call('POST', '/rewards/spin', { body: { idempotencyKey: `${idem}-c` } });
  check(!ok(spinNoTok) && spinNoTok.status === 401, 'API-18 spin without token → 401', `status ${spinNoTok.status}`);

  const myRewards = await call('GET', '/rewards/my', { token: userToken });
  check(ok(myRewards) && Array.isArray(data(myRewards)) && JSON.stringify(data(myRewards)).includes(String(userRewardId)),
    'API-22 rewards/my → contains spun reward', JSON.stringify(myRewards.json)?.slice(0, 300));

  // ------------------------------------------------------------
  console.log('E. Delivery guard rails');
  const delNoTok = await call('POST', '/rewards/delivery', {
    body: { userRewardId: 'x', fullName: 'A', phone: '0912345678', address: 'a', city: 'b' },
  });
  check(!ok(delNoTok) && delNoTok.status === 401, 'API-19a delivery without token → 401', `status ${delNoTok.status}`);

  const delBogus = await call('POST', '/rewards/delivery', {
    token: userToken,
    body: { userRewardId: 'gate-nonexistent-reward', fullName: 'Gate Tester', phone: '0912345678', address: 'No.1, Test St', city: 'Yangon' },
  });
  check(!ok(delBogus) && delBogus.status >= 400 && delBogus.status < 500,
    'API-21 delivery unknown userRewardId → 4xx success:false', `status ${delBogus.status}`);

  // ------------------------------------------------------------
  console.log('F. Admin authz & analytics');
  const dashNoTok = await call('GET', '/admin/dashboard');
  check(!ok(dashNoTok) && dashNoTok.status === 401, 'API-23a dashboard no token → 401', `status ${dashNoTok.status}`);

  const dashUser = await call('GET', '/admin/dashboard', { token: userToken });
  check(!ok(dashUser) && dashUser.status === 403, 'API-23b dashboard user token → 403', `status ${dashUser.status}`);

  const dash = await call('GET', '/admin/dashboard', { token: adminToken });
  check(ok(dash) && typeof data(dash)?.totalParticipants === 'number' && typeof data(dash)?.completionRate === 'number',
    'API-23c dashboard admin → totals', JSON.stringify(dash.json));

  const checks = [
    ['API-24 popularity', '/admin/analytics/popularity'],
    ['API-25 ratings', '/admin/analytics/ratings'],
    ['API-26 age-groups', '/admin/analytics/age-groups?productId=beer'],
    ['API-27 comparison', '/admin/analytics/comparison'],
    ['API-28 trend', '/admin/analytics/trend?period=7'],
    ['API-29 admin questions list', '/admin/survey/questions'],
    ['API-36a admin rewards list', '/admin/rewards'],
  ];
  for (const [label, path] of checks) {
    const r = await call('GET', path, { token: adminToken });
    check(ok(r) && Array.isArray(data(r)), `${label} → array`, JSON.stringify(r.json)?.slice(0, 200));
  }

  const inv = await call('GET', '/admin/rewards/inventory', { token: adminToken });
  check(ok(inv) && Array.isArray(data(inv)?.rewards) && data(inv)?.summary && typeof data(inv)?.summary === 'object',
    'API-37 inventory → rewards + summary', JSON.stringify(inv.json)?.slice(0, 200));

  // ------------------------------------------------------------
  console.log('G. P5b reward-status derivation');
  const gateName = `Gate P5b ${RUN}`;
  const create = await call('POST', '/admin/rewards', {
    token: adminToken,
    body: { name: gateName, description: 'gate-created reward', totalQuantity: 3, weight: 1, lowStockThreshold: 0, requiresDelivery: true },
  });
  const rewardId = data(create)?.id;
  check(ok(create) && Boolean(rewardId), 'P5b-1a create reward → id', JSON.stringify(create.json));

  const findGate = async () => (data(await call('GET', '/admin/rewards', { token: adminToken })) ?? [])
    .find((r) => r.id === rewardId);

  const created = await findGate();
  check(created?.status === 'AVAILABLE', 'P5b-1b new reward → status AVAILABLE', `got ${created?.status}`);

  const drain = await call('PATCH', `/admin/rewards/${rewardId}/stock`, {
    token: adminToken,
    body: { adjustment: -3, reason: 'gate drain' },
  });
  const drained = await findGate();
  check(ok(drain) && data(drain)?.newQuantity === 0 && drained?.status === 'EXHAUSTED',
    'P5b-2 drain stock to 0 → newQuantity 0 + status EXHAUSTED',
    `newQuantity ${data(drain)?.newQuantity}, status ${drained?.status}`);

  const forceAvail = await call('PATCH', `/admin/rewards/${rewardId}`, {
    token: adminToken,
    body: { status: 'AVAILABLE' },
  });
  const afterForce = await findGate();
  check(ok(forceAvail) && afterForce?.status === 'EXHAUSTED',
    'P5b-3 set AVAILABLE at qty 0 → derives EXHAUSTED', `got ${afterForce?.status}`);

  const pause = await call('PATCH', `/admin/rewards/${rewardId}`, { token: adminToken, body: { status: 'PAUSED' } });
  const stockNudge = await call('PATCH', `/admin/rewards/${rewardId}/stock`, {
    token: adminToken,
    body: { adjustment: 0, reason: 'gate sticky check' },
  });
  const afterPause = await findGate();
  check(ok(pause) && ok(stockNudge) && afterPause?.status === 'PAUSED',
    'P5b-4 PAUSED sticky through stock adjustment → stays PAUSED', `got ${afterPause?.status}`);

  const unknownId = await call('PATCH', '/admin/rewards/gate-unknown-id-999', {
    token: adminToken,
    body: { status: 'AVAILABLE' },
  });
  check(unknownId.status === 404 || (!ok(unknownId) && unknownId.status >= 400),
    'P5b-5 unknown reward id → 4xx/404', `status ${unknownId.status}`);

  // Cleanup: hide the gate reward from the active wheel (keeps history rows).
  await call('PATCH', `/admin/rewards/${rewardId}`, { token: adminToken, body: { isActive: 0 } });

  // ------------------------------------------------------------
  const total = pass + fail;
  console.log(`\nAPI gate subset: ${pass}/${total} passed${fail ? `, ${fail} FAILED` : ''}`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
