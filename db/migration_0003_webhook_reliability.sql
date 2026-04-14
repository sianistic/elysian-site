-- Run this after migration_0002_commerce_lifecycle.sql on existing databases.
-- It adds operational metadata for webhook recovery and admin visibility.

ALTER TABLE stripe_webhook_events ADD COLUMN order_id TEXT;
ALTER TABLE stripe_webhook_events ADD COLUMN processing_started_at TEXT;
ALTER TABLE stripe_webhook_events ADD COLUMN last_delivery_at TEXT;
ALTER TABLE stripe_webhook_events ADD COLUMN delivery_count INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_order_id
  ON stripe_webhook_events (order_id, received_at DESC);

UPDATE stripe_webhook_events
SET processing_started_at = COALESCE(processing_started_at, received_at),
    last_delivery_at = COALESCE(last_delivery_at, processed_at, received_at),
    delivery_count = COALESCE(delivery_count, 1)
WHERE processing_started_at IS NULL
   OR last_delivery_at IS NULL
   OR delivery_count IS NULL;
