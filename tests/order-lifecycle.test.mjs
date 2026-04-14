import test from "node:test";
import assert from "node:assert/strict";

const {
  deriveOrderLifecycle,
  deriveQuoteStatusFromOrder,
} = await import("../functions/_lib/orders.js");

test("full payment marks an order as paid and ready", () => {
  const lifecycle = deriveOrderLifecycle(550000, 550000, "payment_link_created");

  assert.equal(lifecycle.status, "ready_for_fulfillment");
  assert.equal(lifecycle.paymentStatus, "paid");
  assert.equal(lifecycle.balanceDueCents, 0);
  assert.equal(lifecycle.amountPaidCents, 550000);
});

test("deposit payment leaves balance due and order awaiting balance", () => {
  const lifecycle = deriveOrderLifecycle(550000, 150000, "paid");

  assert.equal(lifecycle.status, "awaiting_balance");
  assert.equal(lifecycle.paymentStatus, "partially_paid");
  assert.equal(lifecycle.balanceDueCents, 400000);
  assert.equal(lifecycle.amountPaidCents, 150000);
});

test("open payment link keeps unpaid orders pending", () => {
  const lifecycle = deriveOrderLifecycle(550000, 0, "payment_link_created");

  assert.equal(lifecycle.status, "pending_payment");
  assert.equal(lifecycle.paymentStatus, "payment_link_created");
  assert.equal(lifecycle.balanceDueCents, 550000);
});

test("quote status becomes payment_ready when an approved quote has an active link", () => {
  const status = deriveQuoteStatusFromOrder({
    total_cents: 550000,
    amount_paid_cents: 0,
    payment_status: "payment_link_created",
  }, "approved");

  assert.equal(status, "payment_ready");
});

test("quote status becomes awaiting_balance after a confirmed deposit", () => {
  const status = deriveQuoteStatusFromOrder({
    total_cents: 550000,
    amount_paid_cents: 150000,
    payment_status: "partially_paid",
  }, "payment_ready");

  assert.equal(status, "awaiting_balance");
});

test("quote status falls back to approved after failed or expired attempts", () => {
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
});
