#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
]);
// Match URLs, rather than the bare word "localhost": Next's URL parser
// legitimately contains that word in its runtime code.
const forbiddenLocalhost = /(?:https?:\/\/|\/\/)(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/gi;

function filesIn(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`symbolic links are not allowed in deploy artifacts: ${fullPath}`);
    }
    if (entry.isDirectory()) files.push(...filesIn(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function isTextArtifact(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return textExtensions.has(extension) || path.basename(filePath).startsWith('_');
}

export function checkArtifactDirectory(directory, { allowLocalhost = false } = {}) {
  const absoluteDirectory = path.resolve(directory);
  if (!fs.existsSync(absoluteDirectory) || !fs.statSync(absoluteDirectory).isDirectory()) {
    return [`missing artifact directory: ${absoluteDirectory}`];
  }

  const errors = [];
  let files;
  try {
    files = filesIn(absoluteDirectory);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  if (files.length === 0) return [`artifact directory is empty: ${absoluteDirectory}`];
  if (!files.some((filePath) => path.basename(filePath) === 'index.html')) {
    errors.push(`artifact directory has no index.html: ${absoluteDirectory}`);
  }

  for (const filePath of files) {
    const relativePath = path.relative(absoluteDirectory, filePath);
    const baseName = path.basename(filePath);
    if (baseName === '.env' || baseName.startsWith('.env.')) {
      errors.push(`environment file leaked into artifact: ${relativePath}`);
    }
    if (baseName.endsWith('.map')) {
      errors.push(`source map must not be deployed: ${relativePath}`);
    }
    if (!isTextArtifact(filePath)) continue;

    let contents;
    try {
      contents = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      errors.push(`could not read artifact ${relativePath}: ${error.message}`);
      continue;
    }

    if (!allowLocalhost) {
      const matches = [...contents.matchAll(forbiddenLocalhost)].map((match) => match[0]);
      if (matches.length > 0) {
        errors.push(
          `localhost/loopback URL found in ${relativePath}: ${[...new Set(matches)].join(', ')}`,
        );
      }
    }
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const allowLocalhost = args.includes('--allow-localhost') || process.env.BUILD_TARGET === 'local';
  const directories = args.filter((arg) => !arg.startsWith('--'));
  const targets = directories.length > 0
    ? directories
    : [
        path.join(repositoryRoot, 'apps/survey-web/out'),
        path.join(repositoryRoot, 'apps/admin-web/out'),
      ];

  const errors = targets.flatMap((directory) => checkArtifactDirectory(directory, { allowLocalhost }));
  if (errors.length > 0) {
    console.error('Artifact check failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Artifact check passed (${targets.length} static output director${targets.length === 1 ? 'y' : 'ies'}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
