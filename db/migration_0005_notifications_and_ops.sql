-- Run this after migration_0004_ticket_workflow.sql on existing databases.
-- It adds persisted notification delivery logs for operational visibility.

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'failed',
  provider TEXT NOT NULL DEFAULT '',
  response_id TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_events_status
  ON notification_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_entity
  ON notification_events (entity_type, entity_id, created_at DESC);
