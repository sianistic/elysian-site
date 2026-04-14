import assert from "node:assert/strict";

const {
  deriveOrderLifecycle,
  deriveQuoteStatusFromOrder,
} = await import("../functions/_lib/orders.js");

const checks = [
  {
    name: "full payment marks an order as paid and ready",
    run() {
      const lifecycle = deriveOrderLifecycle(550000, 550000, "payment_link_created");
      assert.equal(lifecycle.status, "ready_for_fulfillment");
      assert.equal(lifecycle.paymentStatus, "paid");
      assert.equal(lifecycle.balanceDueCents, 0);
      assert.equal(lifecycle.amountPaidCents, 550000);
    },
  },
  {
    name: "deposit payment leaves balance due and order awaiting balance",
    run() {
      const lifecycle = deriveOrderLifecycle(550000, 150000, "paid");
      assert.equal(lifecycle.status, "awaiting_balance");
      assert.equal(lifecycle.paymentStatus, "partially_paid");
      assert.equal(lifecycle.balanceDueCents, 400000);
      assert.equal(lifecycle.amountPaidCents, 150000);
    },
  },
  {
    name: "open payment link keeps unpaid orders pending",
    run() {
      const lifecycle = deriveOrderLifecycle(550000, 0, "payment_link_created");
      assert.equal(lifecycle.status, "pending_payment");
      assert.equal(lifecycle.paymentStatus, "payment_link_created");
      assert.equal(lifecycle.balanceDueCents, 550000);
    },
  },
  {
    name: "quote status becomes payment_ready when an approved quote has an active link",
    run() {
      const status = deriveQuoteStatusFromOrder({
        total_cents: 550000,
        amount_paid_cents: 0,
        payment_status: "payment_link_created",
      }, "approved");
      assert.equal(status, "payment_ready");
    },
  },
  {
    name: "quote status becomes awaiting_balance after a confirmed deposit",
    run() {
      const status = deriveQuoteStatusFromOrder({
        total_cents: 550000,
        amount_paid_cents: 150000,
        payment_status: "partially_paid",
      }, "payment_ready");
      assert.equal(status, "awaiting_balance");
    },
  },
  {
    name: "quote status falls back to approved after failed or expired attempts",
    run() {
      assert.equal(deriveQuoteStatusFromOrder({
        total_cents: 550000,
        amount_paid_cents: 0,
        payment_status: "failed",
      }, "payment_ready"), "approved");

      assert.equal(deriveQuoteStatusFromOrder({
        total_cents: 550000,
        amount_paid_cents: 0,
        payment_status: "expired",
      }, "payment_ready"), "approved");
    },
  },
];

for (const check of checks) {
  check.run();
  console.log(`ok - ${check.name}`);
}

console.log("All order lifecycle verification checks passed.");
