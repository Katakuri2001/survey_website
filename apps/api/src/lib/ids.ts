/**
 * Identifier and timestamp helpers shared by every route module.
 */

export function generateId(): string {
  return crypto.randomUUID();
}

/** ISO-8601 timestamp with milliseconds, matching `new Date().toISOString()`. */
export function isoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * SQLite/D1 `datetime('now')` style timestamp (`YYYY-MM-DD HH:MM:SS`, UTC).
 * Some legacy columns were written with `datetime('now')`, so writes that must
 * match those columns use this format.
 */
export function sqlTimestamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
