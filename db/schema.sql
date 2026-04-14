-- Elysian platform schema
-- Apply with Wrangler D1 migrations or paste into the D1 console.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  specs_json TEXT NOT NULL DEFAULT '{}',
  images_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_mode TEXT NOT NULL DEFAULT 'full_payment',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER,
  balance_due_cents INTEGER,
  request_snapshot_json TEXT NOT NULL DEFAULT '{}',
  config_snapshot_json TEXT NOT NULL DEFAULT '{}',
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_status
  ON quotes (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  quote_id TEXT,
  order_type TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_mode TEXT NOT NULL DEFAULT 'full_payment',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  deposit_cents INTEGER,
  balance_due_cents INTEGER,
  order_item_json TEXT NOT NULL DEFAULT '{}',
  build_snapshot_json TEXT NOT NULL DEFAULT '{}',
  fulfillment_notes TEXT NOT NULL DEFAULT '',
  last_payment_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status, payment_status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_quote_id_unique
  ON orders (quote_id) WHERE quote_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id
  ON order_events (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_payment_sessions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payment_phase TEXT NOT NULL DEFAULT 'full',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'created',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_checkout_url TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_payment_sessions_order_id
  ON order_payment_sessions (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  order_id TEXT,
  related_object_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_delivery_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivery_count INTEGER NOT NULL DEFAULT 1,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_order_id
  ON stripe_webhook_events (order_id, received_at DESC);

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

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  order_id TEXT,
  quote_id TEXT,
  submitted_reference TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  subject TEXT NOT NULL,
  latest_message_preview TEXT NOT NULL DEFAULT '',
  assigned_admin TEXT,
  assigned_at TEXT,
  first_triaged_at TEXT,
  last_customer_message_at TEXT,
  last_internal_note_at TEXT,
  last_public_reply_at TEXT,
  resolved_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets (status, priority, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id
  ON support_tickets (order_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_quote_id
  ON support_tickets (quote_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  author_type TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  message_kind TEXT NOT NULL DEFAULT 'customer_message',
  message TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id
  ON support_ticket_messages (ticket_id, created_at ASC);
