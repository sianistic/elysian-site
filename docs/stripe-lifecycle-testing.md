# Stripe Lifecycle Testing

Use this checklist to verify the order/payment state machine without relying on return URLs.

## Local webhook forwarding

1. Start local Pages dev:
   `npx wrangler pages dev files`
2. In a second terminal, forward Stripe events to the local webhook endpoint:
   `stripe listen --forward-to localhost:8788/api/stripe/webhook --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed`
3. Copy the webhook signing secret from the `stripe listen` output into `STRIPE_WEBHOOK_SECRET`.

## Important testing note

Use real checkout links created by this app for lifecycle testing. Generic `stripe trigger` events are useful for signature smoke tests, but they do not carry this app's internal `order_id` and `order_payment_session_id` metadata, so they do not fully exercise reconciliation.

## Recommended scenarios

1. Full payment quote:
   - Approve a quote as `full_payment`
   - Generate the payment link
   - Pay it with Stripe test card `4242 4242 4242 4242`
   - Confirm the order reaches `ready_for_fulfillment` and payment reaches `paid`

2. Deposit-first quote:
   - Approve a quote as `deposit_first`
   - Generate the deposit link and pay it
   - Confirm the order reaches `awaiting_balance` and payment reaches `partially_paid`
   - Generate the balance link and pay it
   - Confirm the order reaches `ready_for_fulfillment`

3. Duplicate webhook delivery:
   - Complete a real payment
   - Resend the same event from Stripe
   - Confirm admin shows the same final payment state and no extra amount is added

4. Expired checkout session:
   - Create a payment link but do not pay it
   - Expire the session manually:
     `stripe checkout sessions expire <CHECKOUT_SESSION_ID>`
   - Confirm the latest payment attempt becomes `expired`

5. Failed payment attempt:
   - Use a Stripe test card that produces a failure in Checkout
   - Confirm the payment attempt becomes `failed` and the order returns to a retryable state

## What to inspect in admin

- Order status and payment status
- Deposit vs balance progression
- Payment attempts table by phase
- Order timeline entries
- Webhook deliveries, including delivery count and any last error

## Lightweight automated check

Run:

`node --test tests/order-lifecycle.test.mjs`

This validates the core pure status transitions for full payment, deposit-first flows, payment-link-open state, and quote state mapping.

If your environment blocks the Node test runner from spawning child processes, use:

`node scripts/verify-order-lifecycle.mjs`

This runs the same lifecycle assertions in a single process.
