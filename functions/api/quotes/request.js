import { jsonResponse } from "../../_lib/http.js";
import { createNotifier } from "../../_lib/notifications.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalizeUseCase(value) {
  const allowed = new Set(["gaming", "creator", "workstation", "mixed", "other"]);
  return allowed.has(value) ? value : "other";
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) {
      return jsonResponse({ error: "Quote storage is not configured." }, 500, CORS_HEADERS);
    }

    const body = await context.request.json();
    const customerName = String(body?.name || "").trim();
    const customerEmail = String(body?.email || "").trim().toLowerCase();
    const budget = String(body?.budget || "").trim();
    const useCase = normalizeUseCase(String(body?.useCase || "").trim().toLowerCase());
    const timeframe = String(body?.timeframe || "").trim();
    const notes = String(body?.notes || "").trim();

    if (!customerName || !customerEmail || !notes) {
      return jsonResponse({ error: "Missing required quote request fields." }, 400, CORS_HEADERS);
    }

    const quoteId = `QTE-${Date.now().toString(36).toUpperCase()}`;
    const requestSnapshot = {
      budget,
      useCase,
      timeframe,
      notes,
      source: "public_quote_request",
    };

    await context.env.DB.prepare(
      `INSERT INTO quotes
        (id, customer_name, customer_email, status, payment_mode, request_snapshot_json, config_snapshot_json)
       VALUES (?1, ?2, ?3, 'requested', 'full_payment', ?4, '{}')`
    )
      .bind(quoteId, customerName, customerEmail, JSON.stringify(requestSnapshot))
      .run();

    const notifier = createNotifier(context.env);
    void notifier.send({
      template: "quote-request-created",
      to: customerEmail,
      subject: `Elysian quote request ${quoteId} received`,
      data: { quoteId, customerName, budget, useCase, timeframe },
    });

    return jsonResponse(
      { success: true, quoteId, status: "requested" },
      200,
      CORS_HEADERS
    );
  } catch (error) {
    console.error("POST /api/quotes/request error:", error);
    return jsonResponse({ error: "Unable to create quote request." }, 500, CORS_HEADERS);
  }
}
