-- Run this once against an existing D1 database that was created from the
-- earlier schema before the Stripe order lifecycle foundation was added.

ALTER TABLE orders ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'full_payment';
ALTER TABLE orders ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN last_payment_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_quote_id_unique
  ON orders (quote_id) WHERE quote_id IS NOT NULL;

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
  related_object_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  last_error TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status, received_at DESC);
