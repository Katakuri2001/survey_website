-- Migration number: 0024 2026-11-03T00:00:00.000Z
-- Enhanced audit log for Activity & Audit History.

-- Add new columns to audit_logs for human-readable activity tracking.
-- All columns are nullable to preserve existing records.

ALTER TABLE audit_logs ADD COLUMN actor_type TEXT DEFAULT 'ADMIN';
ALTER TABLE audit_logs ADD COLUMN actor_name_snapshot TEXT;
ALTER TABLE audit_logs ADD COLUMN actor_role_snapshot TEXT;
ALTER TABLE audit_logs ADD COLUMN category TEXT;
ALTER TABLE audit_logs ADD COLUMN resource_name_snapshot TEXT;
ALTER TABLE audit_logs ADD COLUMN description TEXT;
ALTER TABLE audit_logs ADD COLUMN previous_values TEXT;
ALTER TABLE audit_logs ADD COLUMN new_values TEXT;
ALTER TABLE audit_logs ADD COLUMN result_status TEXT DEFAULT 'SUCCESS';
ALTER TABLE audit_logs ADD COLUMN failure_reason TEXT;
ALTER TABLE audit_logs ADD COLUMN request_id TEXT;

-- Indexes for efficient filtering and search
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result_status ON audit_logs(result_status);