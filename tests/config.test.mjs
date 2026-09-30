#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertDestructiveTarget,
  assertSafeLiveTarget,
  resolveBuildEnvironment,
} from '../scripts/production-env-guard.mjs';
import { checkArtifactDirectory } from '../scripts/check-artifacts.mjs';
import { validateMigrations } from '../scripts/validate-migrations.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const rootPackage = readJson('package.json');
const surveyPackage = readJson('apps/survey-web/package.json');
const apiPackage = readJson('apps/api/package.json');
const rootLock = readJson('package-lock.json');
const surveyLock = readJson('apps/survey-web/package-lock.json');
const vercel = readJson('vercel.json');

const liveTarget = (value) => assertSafeLiveTarget(value);

test('root scripts separate safe tests from opt-in live suites', () => {
  assert.equal(rootPackage.scripts.test, 'node tests/run-tests.mjs');
  assert.doesNotMatch(rootPackage.scripts.test, /turbo run test/);
  assert.match(rootPackage.scripts['test:api'], /api-tests\.mjs/);
  assert.match(rootPackage.scripts['test:hardening'], /hardening\.test\.mjs/);
  assert.match(rootPackage.scripts['test:live'], /test:api.*test:hardening/);
  assert.match(rootPackage.scripts.prebuild, /production-env-guard/);
  assert.match(rootPackage.scripts.postbuild, /check-artifacts/);
});

test('survey manifest and standalone lockfile contain mm-nrc', () => {
  assert.equal(surveyPackage.dependencies['mm-nrc'], '^0.2.5');
  assert.equal(surveyLock.packages[''].dependencies['mm-nrc'], '^0.2.5');
  assert.equal(surveyLock.packages['node_modules/mm-nrc']?.version, '0.2.5');
  assert.equal(
    surveyLock.packages['node_modules/next']?.version,
    rootLock.packages['node_modules/next']?.version,
  );
  assert.equal(
    surveyLock.packages['node_modules/eslint-config-next']?.version,
    rootLock.packages['node_modules/eslint-config-next']?.version,
  );
});

test('D1 helper commands use the current Wrangler syntax', () => {
  assert.match(apiPackage.scripts['d1:migrate'], /wrangler d1 migrations create survey-db/);
  assert.match(apiPackage.scripts['d1:apply'], /wrangler d1 migrations apply survey-db/);
  assert.doesNotMatch(apiPackage.scripts['d1:execute'], /--command=/);
  assert.doesNotMatch(apiPackage.scripts['d1:push'], /--file=/);
  assert.match(apiPackage.scripts.deploy, /--env production/);
  assert.match(apiPackage.scripts['d1:apply:production'], /--env production/);
});

test('the production environment guard overrides ignored localhost values', () => {
  const resolved = resolveBuildEnvironment({
    BUILD_TARGET: 'production',
    NEXT_PUBLIC_API_BASE: 'http://localhost:8787',
  });
  assert.equal(resolved.apiBase, '/api');
  assert.equal(resolved.overrodeLocal, true);
  assert.throws(() => resolveBuildEnvironment({ BUILD_TARGET: 'production', NEXT_PUBLIC_API_BASE: 'http://example.test' }));
});

test('live and destructive suites refuse production or arbitrary hosts', () => {
  liveTarget('http://localhost:8787');
  liveTarget('https://api.staging.example.com/api');
  assert.throws(() => liveTarget('https://myanmarbeer.boom.com.mm/api'));
  assert.throws(
    () => assertDestructiveTarget('http://localhost:8787', { ALLOW_DESTRUCTIVE_TESTS: '0' }),
  );
  assert.doesNotThrow(() =>
    assertDestructiveTarget('http://localhost:8787', { ALLOW_DESTRUCTIVE_TESTS: '1' }),
  );
});

test('migration validation accepts the ordered repository migrations', () => {
  assert.deepEqual(validateMigrations(path.join(root, 'migrations')), []);
});

test('k6 has setup timeout, response, token, and target guards', () => {
  const source = fs.readFileSync(path.join(root, 'loadtest/k6-spin.js'), 'utf8');
  for (const marker of [
    'setupTimeout',
    'requireStatus',
    'setup guest',
    'token.length === 0',
    'Refusing k6 target',
    'http.expectedStatuses',
  ]) {
    assert.ok(source.includes(marker), `missing k6 safety marker: ${marker}`);
  }
});

test('artifact checker rejects localhost content in a static bundle', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'survey-artifact-'));
  try {
    fs.writeFileSync(path.join(temporary, 'index.html'), '<script src="/app.js"></script>');
    fs.writeFileSync(path.join(temporary, 'app.js'), 'const api="http://localhost:8787";');
    const errors = checkArtifactDirectory(temporary);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /localhost/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('Vercel is a valid single static-export configuration', () => {
  assert.equal(vercel.projects, undefined);
  assert.match(vercel.outputDirectory, /\/out$/);
  assert.match(vercel.buildCommand, /survey-web/);
});
