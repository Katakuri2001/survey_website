#!/usr/bin/env node

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveBuildEnvironment } from './production-env-guard.mjs';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const requireFromRoot = createRequire(`${rootDirectory}package.json`);
const turboBin = requireFromRoot.resolve('turbo/bin/turbo');
const environment = resolveBuildEnvironment();

const childEnvironment = {
  ...process.env,
  BUILD_TARGET: environment.buildTarget,
  NEXT_PUBLIC_API_BASE: environment.apiBase,
  TURBO_TELEMETRY_DISABLED: '1',
  NEXT_TELEMETRY_DISABLED: '1',
};

console.log(
  `[build] production web build: NEXT_PUBLIC_API_BASE=${environment.apiBase}` +
    (environment.overrodeLocal ? ' (localhost override active)' : ''),
);

const result = spawnSync(process.execPath, [turboBin, 'run', 'build', '--force'], {
  cwd: rootDirectory,
  env: childEnvironment,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[build] could not start Turbo: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
