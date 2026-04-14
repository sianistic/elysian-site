import { jsonResponse } from "../../_lib/http.js";
import { createSupportTicket } from "../../_lib/support.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    if (!context.env.DB) {
      return jsonResponse({ error: "Support ticket storage is not configured." }, 500, CORS_HEADERS);
    }

    const body = await context.request.json();
    const result = await createSupportTicket(context.env, {
      name: body?.name,
      email: body?.email,
      reference: body?.reference || body?.orderId,
      category: body?.category,
      priority: body?.priority,
      subject: body?.subject,
      message: body?.message,
    });

    return jsonResponse(
      {
        success: true,
        ticketId: result.ticketId,
        status: result.status,
        referenceType: result.referenceType,
      },
      200,
      CORS_HEADERS
    );
  } catch (error) {
    console.error("POST /api/support/tickets error:", error);
    return jsonResponse({ error: error.message || "Unable to create support ticket." }, 500, CORS_HEADERS);
  }
}
