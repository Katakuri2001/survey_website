#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

/**
 * Resolve the public API base used by a static production build.
 *
 * Next gives `.env.local` precedence over `.env.production`.  That is useful in
 * development, but it means a developer's ignored file can accidentally be
 * compiled into a deployable bundle.  The build wrapper calls this module and
 * puts the returned value in the child process environment, where it wins over
 * every dotenv file.
 */

const DEFAULT_PRODUCTION_API_BASE = '/api';
const DEFAULT_LOCAL_API_BASE = 'http://localhost:8787';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const STAGING_HOST = /(^|[.-])(staging|stage)([.-]|$)/i;

function cleanBase(value) {
  return String(value ?? '').trim().replace(/\/+$/, '') || '/';
}

function hostnameOf(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('/')) return null;

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    // Catch the common shorthand (for example `localhost:8787`) before
    // reporting an invalid target to the caller.
    return raw.match(/^(?:\[[^\]]+\]|[^/:?#]+)/)?.[0]?.toLowerCase() ?? null;
  }
}

export function isLocalApiBase(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('/')) return false;
  const host = hostnameOf(raw);
  if (!host) return false;
  return LOCAL_HOSTS.has(host) || host === 'localhost';
}

export function isStagingApiBase(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('/')) return false;
  const host = hostnameOf(raw);
  return Boolean(host && STAGING_HOST.test(host));
}

export function isSafeProductionApiBase(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  if (raw.startsWith('/')) return !raw.startsWith('//');
  if (isLocalApiBase(raw)) return false;

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === 'https:' || isLocalApiBase(raw);
  } catch {
    return false;
  }
}

export function resolveBuildEnvironment(env = process.env) {
  const buildTarget = String(env.BUILD_TARGET || 'production').trim().toLowerCase();
  const configured = String(env.PRODUCTION_API_BASE || env.NEXT_PUBLIC_API_BASE || '').trim();
  const localBuild = buildTarget === 'local' || env.ALLOW_LOCAL_API_BUILD === '1';

  if (localBuild) {
    return {
      apiBase: cleanBase(configured || DEFAULT_LOCAL_API_BASE),
      buildTarget: 'local',
      localBuild: true,
      overrodeLocal: false,
    };
  }

  let apiBase = cleanBase(configured || DEFAULT_PRODUCTION_API_BASE);
  const overrodeLocal = isLocalApiBase(apiBase);
  if (overrodeLocal) apiBase = DEFAULT_PRODUCTION_API_BASE;

  if (!isSafeProductionApiBase(apiBase)) {
    throw new Error(
      `Unsafe production NEXT_PUBLIC_API_BASE: ${configured || '(empty)'}. ` +
        'Use /api or an HTTPS non-local origin.',
    );
  }

  return { apiBase, buildTarget: 'production', localBuild: false, overrodeLocal };
}

/** Refuse live/destructive suites unless they point at a disposable target. */
export function assertSafeLiveTarget(value, env = process.env) {
  const raw = String(value ?? '').trim();
  const host = hostnameOf(raw);
  const isLocal = isLocalApiBase(raw);
  const isStaging = isStagingApiBase(raw);

  if (!raw || raw.startsWith('/') || !host || (!isLocal && !isStaging)) {
    throw new Error(
      `Refusing live test target ${raw || '(empty)'}. ` +
        'Only localhost/loopback or an explicitly named staging/stage host is allowed.',
    );
  }

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('Live test targets must use HTTP(S) without embedded credentials.');
    }
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw error;
  }

  if (env.REQUIRE_HTTPS_STAGING === '1' && !isLocal && new URL(raw).protocol !== 'https:') {
    throw new Error('Staging live tests must use HTTPS when REQUIRE_HTTPS_STAGING=1.');
  }

  return { raw, host, isLocal, isStaging };
}

export function assertDestructiveTarget(value, env = process.env) {
  assertSafeLiveTarget(value, env);
  if (env.ALLOW_DESTRUCTIVE_TESTS !== '1') {
    throw new Error(
      'Destructive stock contention testing is disabled. Set ALLOW_DESTRUCTIVE_TESTS=1 only against a disposable local/staging database.',
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = resolveBuildEnvironment();
    const suffix = result.overrodeLocal
      ? ' (a localhost value was overridden; ignored dotenv files cannot win)'
      : '';
    console.log(`[build-env] ${result.buildTarget}: NEXT_PUBLIC_API_BASE=${result.apiBase}${suffix}`);
  } catch (error) {
    console.error(`[build-env] ${error.message}`);
    process.exitCode = 1;
  }
}
