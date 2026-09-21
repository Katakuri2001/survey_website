import type { Context } from 'hono';
import type { AppContext } from '../types';
import { generateId } from './ids';
import { logEvent } from './http';

/**
 * Admin audit trail. Always best-effort: a failure to write an audit row must
 * never fail the user-facing admin action that triggered it.
 */
export async function logAudit(
  c: Context<AppContext>,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata?: unknown
): Promise<void> {
  const adminId = c.get('userId') || null;
  try {
    await c.env.survey_db
      .prepare(
        `INSERT INTO audit_logs (id, admin_id, action, resource_type, resource_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId(),
        adminId,
        action,
        resourceType,
        resourceId,
        metadata === undefined ? null : JSON.stringify(metadata)
      )
      .run();
  } catch (error) {
    logEvent('warn', 'audit_write_failed', { action, resourceType, error: String(error) });
  }
}
