import { jsonResponse } from "../_lib/http.js";
import { createCatalogOrder, createPaymentLinkForOrder } from "../_lib/orders.js";
import { getFeatureConfigError } from "../_lib/runtime.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const configError = getFeatureConfigError(env, "checkout");
    if (configError) {
      return jsonResponse(
        { error: configError },
        500,
        CORS_HEADERS
      );
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return jsonResponse({ error: "Cart is empty or invalid." }, 400, CORS_HEADERS);
    }

    const order = await createCatalogOrder(env, items);
    const checkout = await createPaymentLinkForOrder(env, order, {
      phase: "full",
      amountCents: order.total_cents,
    });

    return jsonResponse(
      {
        url: checkout.url,
        sessionId: checkout.sessionId,
        orderId: checkout.orderId,
      },
      200,
      CORS_HEADERS
    );
  } catch (error) {
    console.error("POST /api/checkout error:", error);
    return jsonResponse({ error: error.message || "Unable to create checkout session." }, 500, CORS_HEADERS);
  }
}
