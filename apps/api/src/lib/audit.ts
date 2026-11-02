import type { Context } from 'hono';
import type { AppContext } from '../types';
import { generateId, isoTimestamp } from './ids';
import { logEvent } from './http';

/**
 * Admin audit trail. Always best-effort: a failure to write an audit row must
 * never fail the user-facing admin action that triggered it.
 */
export type AuditCategory =
  | 'account'
  | 'shops'
  | 'rewards'
  | 'inventory'
  | 'surveys'
  | 'users'
  | 'deliveries'
  | 'settings'
  | 'campaigns'
  | 'other';

export type AuditResultStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface AuditLogOptions {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  resourceName?: string | null;
  category?: AuditCategory;
  description?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  resultStatus?: AuditResultStatus;
  failureReason?: string | null;
  metadata?: unknown;
  actorType?: 'ADMIN' | 'SYSTEM' | 'AUTOMATION';
}

// Overloaded logAudit: supports both new-style (options object) and
// legacy-style (action, resourceType, resourceId, metadata) calls.
export async function logAudit(
  c: Context<AppContext>,
  actionOrOptions: string | AuditLogOptions,
  resourceType?: string,
  resourceId?: string | null,
  metadata?: unknown
): Promise<void> {
  let options: AuditLogOptions;
  if (typeof actionOrOptions === 'string') {
    // Legacy-style call
    options = {
      action: actionOrOptions,
      resourceType: resourceType || 'other',
      resourceId: resourceId || null,
      metadata,
    };
  } else {
    options = actionOrOptions;
  }
  const adminId = c.get('userId') || null;
  const requestId = c.get('requestId') || null;

  // Fetch admin name/email for snapshot
  let actorName: string | null = null;
  let actorRole: string | null = null;
  if (adminId) {
    try {
      const user = await c.env.survey_db
        .prepare('SELECT full_name, is_admin FROM users WHERE id = ?')
        .bind(adminId)
        .first<{ full_name: string; is_admin: number }>();
      if (user) {
        actorName = user.full_name;
        actorRole = user.is_admin === 1 ? 'Administrator' : 'User';
      }
    } catch {
      // Best-effort; continue without name
    }
  }

  const actorType = options.actorType || (adminId ? 'ADMIN' : 'SYSTEM');

  try {
    await c.env.survey_db
      .prepare(
        `INSERT INTO audit_logs (
          id, admin_id, action, resource_type, resource_id, metadata,
          actor_type, actor_name_snapshot, actor_role_snapshot, category,
          resource_name_snapshot, description, previous_values, new_values,
          result_status, failure_reason, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId(),
        adminId,
        options.action,
        options.resourceType,
        options.resourceId || null,
        options.metadata === undefined ? null : JSON.stringify(options.metadata),
        actorType,
        actorName,
        actorRole,
        options.category || 'other',
        options.resourceName || null,
        options.description || null,
        options.previousValues === undefined || options.previousValues === null
          ? null
          : JSON.stringify(options.previousValues),
        options.newValues === undefined || options.newValues === null
          ? null
          : JSON.stringify(options.newValues),
        options.resultStatus || 'SUCCESS',
        options.failureReason || null,
        requestId,
        isoTimestamp(),
      )
      .run();
  } catch (error) {
    logEvent('warn', 'audit_write_failed', { action: options.action, resourceType: options.resourceType, error: String(error) });
  }
}

// Backward-compatible wrapper for old-style calls
export async function logAuditLegacy(
  c: Context<AppContext>,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata?: unknown
): Promise<void> {
  await logAudit(c, {
    action,
    resourceType,
    resourceId,
    metadata,
  });
}
