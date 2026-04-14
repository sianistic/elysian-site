import { jsonResponse } from "../../_lib/http.js";
import { createBalancePaymentLink, getOrderDetail, listOrders } from "../../_lib/orders.js";
import { getFeatureConfigError } from "../../_lib/runtime.js";
import { requireAdminSession } from "../../_lib/session.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const auth = await requireAdminSession(context);
  if (!auth.ok) return auth.response;

  if (!context.env.DB) {
    return jsonResponse({ error: "Order storage is not configured." }, 500, CORS_HEADERS);
  }

  const url = new URL(context.request.url);
  const orderId = String(url.searchParams.get("orderId") || "").trim();
  if (orderId) {
    const detail = await getOrderDetail(context.env, orderId);
    if (!detail) {
      return jsonResponse({ error: "Order not found." }, 404, CORS_HEADERS);
    }
    return jsonResponse(detail, 200, CORS_HEADERS);
  }

  const orders = await listOrders(context.env);
  return jsonResponse({ orders }, 200, CORS_HEADERS);
}

export async function onRequestPost(context) {
  const auth = await requireAdminSession(context);
  if (!auth.ok) return auth.response;

  try {
    if (!context.env.DB) {
      return jsonResponse({ error: "Order storage is not configured." }, 500, CORS_HEADERS);
    }

    const body = await context.request.json();
    const action = String(body?.action || "");
    const orderId = String(body?.orderId || "");

    if (!orderId) {
      return jsonResponse({ error: "orderId is required." }, 400, CORS_HEADERS);
    }

    if (action === "create_balance_payment_link") {
      const configError = getFeatureConfigError(context.env, "payment_links");
      if (configError) {
        return jsonResponse({ error: configError }, 500, CORS_HEADERS);
      }

      const paymentLink = await createBalancePaymentLink(context.env, orderId);
      return jsonResponse(
        {
          success: true,
          orderId: paymentLink.orderId,
          sessionId: paymentLink.sessionId,
          paymentLinkUrl: paymentLink.url,
          reused: paymentLink.reused,
        },
        200,
        CORS_HEADERS
      );
    }

    return jsonResponse({ error: "Unsupported order action." }, 400, CORS_HEADERS);
  } catch (error) {
    console.error("POST /api/admin/orders error:", error);
    return jsonResponse({ error: error.message || "Unable to update order." }, 500, CORS_HEADERS);
  }
}
