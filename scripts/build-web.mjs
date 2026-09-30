#!/usr/bin/env node

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolveBuildEnvironment } from './production-env-guard.mjs';

const appDirectory = process.cwd();
const requireFromApp = createRequire(`${appDirectory}/package.json`);
const nextBin = requireFromApp.resolve('next/dist/bin/next');
const environment = resolveBuildEnvironment();

const childEnvironment = {
  ...process.env,
  BUILD_TARGET: environment.buildTarget,
  NEXT_PUBLIC_API_BASE: environment.apiBase,
  // Keep CI/build output deterministic and avoid telemetry in automation.
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_ENV: 'production',
};

console.log(
  `[build-web] ${appDirectory}: NEXT_PUBLIC_API_BASE=${environment.apiBase}` +
    (environment.overrodeLocal ? ' (localhost override active)' : ''),
);

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: appDirectory,
  env: childEnvironment,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[build-web] could not start Next: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
