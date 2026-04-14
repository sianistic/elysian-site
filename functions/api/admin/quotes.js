import { jsonResponse } from "../../_lib/http.js";
import {
  createQuoteInitialPaymentLink,
  getOrderForQuote,
  getQuoteRow,
  listQuotesWithOrders,
  normalizeQuoteConfigSnapshot,
  updateQuoteReview,
} from "../../_lib/orders.js";
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
    return jsonResponse({ error: "Quote storage is not configured." }, 500, CORS_HEADERS);
  }

  const quotes = await listQuotesWithOrders(context.env);
  return jsonResponse({ quotes }, 200, CORS_HEADERS);
}

export async function onRequestPost(context) {
  const auth = await requireAdminSession(context);
  if (!auth.ok) return auth.response;

  try {
    if (!context.env.DB) {
      return jsonResponse({ error: "Quote storage is not configured." }, 500, CORS_HEADERS);
    }

    const body = await context.request.json();
    const action = String(body?.action || "");
    const quoteId = String(body?.quoteId || "");

    if (!quoteId) {
      return jsonResponse({ error: "quoteId is required." }, 400, CORS_HEADERS);
    }

    const quote = await getQuoteRow(context.env, quoteId);
    if (!quote) {
      return jsonResponse({ error: "Quote not found." }, 404, CORS_HEADERS);
    }

    if (action === "save_review" || action === "approve") {
      const updatedQuote = await updateQuoteReview(context.env, quote, {
        subtotalCents: body?.subtotalCents,
        paymentMode: body?.paymentMode,
        depositCents: body?.depositCents,
        adminNotes: body?.adminNotes,
        configSnapshot: normalizeQuoteConfigSnapshot(body?.configSnapshot),
      }, action);

      return jsonResponse(
        {
          success: true,
          status: updatedQuote.status,
          quoteId: updatedQuote.id,
        },
        200,
        CORS_HEADERS
      );
    }

    if (action === "create_payment_link") {
      const configError = getFeatureConfigError(context.env, "payment_links");
      if (configError) {
        return jsonResponse({ error: configError }, 500, CORS_HEADERS);
      }

      if (quote.status !== "approved" && quote.status !== "payment_ready") {
        return jsonResponse({ error: "Quote must be approved before a payment link can be created." }, 400, CORS_HEADERS);
      }

      const linkedOrder = await getOrderForQuote(context.env, quote.id);
      if (linkedOrder && linkedOrder.amount_paid_cents > 0) {
        return jsonResponse(
          { error: "This quote already has recorded payments. Use the linked order for the next payment step." },
          400,
          CORS_HEADERS
        );
      }

      const paymentLink = await createQuoteInitialPaymentLink(context.env, quote);
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

    return jsonResponse({ error: "Unsupported quote action." }, 400, CORS_HEADERS);
  } catch (error) {
    console.error("POST /api/admin/quotes error:", error);
    return jsonResponse({ error: error.message || "Unable to update quote." }, 500, CORS_HEADERS);
  }
}
