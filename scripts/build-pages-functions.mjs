#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));
const wranglerBin = path.join(rootDirectory, 'node_modules/wrangler/bin/wrangler.js');
const apps = ['survey-web', 'admin-web'];
const failures = [];

if (!fs.existsSync(wranglerBin)) {
  console.error(`Wrangler is not installed at ${wranglerBin}; run npm ci first.`);
  process.exit(1);
}

for (const app of apps) {
  const appDirectory = path.join(rootDirectory, 'apps', app);
  const outputDirectory = path.join(rootDirectory, '.wrangler', 'ci-pages-functions', app);
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  console.log(`[pages-build] compiling ${app} Functions`);
  const result = spawnSync(
    process.execPath,
    [
      wranglerBin,
      'pages',
      'functions',
      'build',
      path.join(appDirectory, 'functions'),
      '--project-directory',
      appDirectory,
      '--build-output-directory',
      path.join(appDirectory, 'out'),
      '--outdir',
      outputDirectory,
      '--output-config-path',
      path.join(outputDirectory, 'config.json'),
      '--output-routes-path',
      path.join(outputDirectory, 'routes.json'),
    ],
    {
      cwd: rootDirectory,
      env: { ...process.env, WRANGLER_LOG: 'warn' },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    failures.push(`${app}: ${result.error.message}`);
  } else if (result.status !== 0) {
    failures.push(`${app}: Wrangler exited with status ${result.status}`);
  } else if (!fs.existsSync(path.join(outputDirectory, 'index.js'))) {
    failures.push(`${app}: Wrangler reported success but produced no index.js`);
  }
}

if (failures.length > 0) {
  console.error('Pages Function build failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Pages Function build passed for ${apps.length} projects.`);
