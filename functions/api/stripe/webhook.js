import { processStripeWebhookEvent } from "../../_lib/orders.js";
import { getFeatureConfigError } from "../../_lib/runtime.js";
import { verifyStripeWebhookSignature } from "../../_lib/stripe.js";

function jsonBody(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const configError = getFeatureConfigError(context.env, "stripe_webhooks");
  if (configError) {
    return jsonBody({ error: configError }, 500);
  }

  const signature = context.request.headers.get("Stripe-Signature");
  const rawBody = await context.request.text();

  let event;
  try {
    event = await verifyStripeWebhookSignature(
      rawBody,
      signature,
      context.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("POST /api/stripe/webhook signature error:", error);
    return jsonBody({ error: error.message || "Webhook signature verification failed." }, 400);
  }

  try {
    const result = await processStripeWebhookEvent(context.env, event);
    return jsonBody({ received: true, duplicate: Boolean(result?.duplicate) });
  } catch (error) {
    console.error("POST /api/stripe/webhook error:", error);
    return jsonBody({ error: error.message || "Webhook processing failed." }, 500);
  }
}
