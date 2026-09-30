#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const migrationsDirectory = path.join(repositoryRoot, 'migrations');
const migrationPattern = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/;

export function validateMigrations(directory = migrationsDirectory) {
  const errors = [];
  if (!fs.existsSync(directory)) return [`missing migrations directory: ${directory}`];

  const names = fs.readdirSync(directory).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0) return [`no SQL migrations found in ${directory}`];

  const numbers = new Map();
  let previous = -1;
  for (const name of names) {
    const match = name.match(migrationPattern);
    if (!match) {
      errors.push(`invalid migration filename: ${name}`);
      continue;
    }

    const number = Number(match[1]);
    if (numbers.has(number)) errors.push(`duplicate migration number ${match[1]}: ${numbers.get(number)} and ${name}`);
    numbers.set(number, name);
    if (number <= previous) errors.push(`migration files are not in numeric order: ${name}`);
    previous = number;

    const contents = fs.readFileSync(path.join(directory, name), 'utf8');
    if (!contents.trim()) errors.push(`migration is empty: ${name}`);
    if (!/\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|PRAGMA)\b/i.test(contents)) {
      errors.push(`migration has no recognizable SQL statement: ${name}`);
    }
  }

  return errors;
}

function main() {
  const errors = validateMigrations();
  if (errors.length > 0) {
    console.error('Migration validation failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('Migration validation passed (filenames, ordering, and SQL content).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
