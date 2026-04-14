-- Run this after migration_0003_webhook_reliability.sql on existing databases.
-- It upgrades support tickets from a simple intake queue into a clearer workflow model.

ALTER TABLE support_tickets ADD COLUMN quote_id TEXT;
ALTER TABLE support_tickets ADD COLUMN submitted_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE support_tickets ADD COLUMN assigned_at TEXT;
ALTER TABLE support_tickets ADD COLUMN first_triaged_at TEXT;
ALTER TABLE support_tickets ADD COLUMN last_customer_message_at TEXT;
ALTER TABLE support_tickets ADD COLUMN last_internal_note_at TEXT;
ALTER TABLE support_tickets ADD COLUMN last_public_reply_at TEXT;
ALTER TABLE support_tickets ADD COLUMN resolved_at TEXT;
ALTER TABLE support_tickets ADD COLUMN closed_at TEXT;

ALTER TABLE support_ticket_messages ADD COLUMN message_kind TEXT NOT NULL DEFAULT 'customer_message';
ALTER TABLE support_ticket_messages ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id
  ON support_tickets (order_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_quote_id
  ON support_tickets (quote_id, updated_at DESC);

UPDATE support_tickets
SET status = CASE status
    WHEN 'open' THEN 'new'
    WHEN 'in_progress' THEN 'triaged'
    ELSE status
  END,
  submitted_reference = CASE
    WHEN TRIM(COALESCE(submitted_reference, '')) <> '' THEN submitted_reference
    WHEN TRIM(COALESCE(quote_id, '')) <> '' THEN quote_id
    ELSE COALESCE(order_id, '')
  END;

UPDATE support_ticket_messages
SET message_kind = CASE
    WHEN is_internal = 1 THEN 'internal_note'
    WHEN author_type = 'customer' THEN 'customer_message'
    WHEN author_type = 'system' THEN 'system_event'
    ELSE 'admin_reply'
  END,
  metadata_json = COALESCE(metadata_json, '{}');

UPDATE support_tickets
SET last_customer_message_at = (
      SELECT MAX(created_at)
      FROM support_ticket_messages m
      WHERE m.ticket_id = support_tickets.id
        AND m.message_kind = 'customer_message'
    ),
    last_internal_note_at = (
      SELECT MAX(created_at)
      FROM support_ticket_messages m
      WHERE m.ticket_id = support_tickets.id
        AND m.message_kind = 'internal_note'
    ),
    last_public_reply_at = (
      SELECT MAX(created_at)
      FROM support_ticket_messages m
      WHERE m.ticket_id = support_tickets.id
        AND m.message_kind = 'admin_reply'
    ),
    assigned_at = CASE
      WHEN TRIM(COALESCE(assigned_admin, '')) <> '' THEN COALESCE(assigned_at, updated_at)
      ELSE assigned_at
    END,
    first_triaged_at = CASE
      WHEN status <> 'new' THEN COALESCE(first_triaged_at, updated_at)
      ELSE first_triaged_at
    END,
    resolved_at = CASE
      WHEN status IN ('resolved', 'closed') THEN COALESCE(resolved_at, updated_at)
      ELSE resolved_at
    END,
    closed_at = CASE
      WHEN status = 'closed' THEN COALESCE(closed_at, updated_at)
      ELSE closed_at
    END
WHERE
  last_customer_message_at IS NULL
  OR last_internal_note_at IS NULL
  OR last_public_reply_at IS NULL
  OR assigned_at IS NULL
  OR first_triaged_at IS NULL
  OR resolved_at IS NULL
  OR closed_at IS NULL
  OR TRIM(COALESCE(submitted_reference, '')) = '';
