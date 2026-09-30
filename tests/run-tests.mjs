#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(`[test] could not start ${command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

const staticStatus = run(process.execPath, ['--test', 'tests/config.test.mjs']);
if (staticStatus !== 0) process.exit(staticStatus);

if (process.env.RUN_LIVE_API_TESTS === '1') {
  console.log('[test] RUN_LIVE_API_TESTS=1: running the mutating API suites');
  const liveStatus = run(process.execPath, ['tests/api-tests.mjs']);
  if (liveStatus !== 0) process.exit(liveStatus);
  const hardeningStatus = run(process.execPath, ['tests/hardening.test.mjs']);
  if (hardeningStatus !== 0) process.exit(hardeningStatus);
} else {
  console.log('[test] live API/hardening suites skipped; set RUN_LIVE_API_TESTS=1 with a local/staging API to run them');
}
