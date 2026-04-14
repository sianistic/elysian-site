import { jsonResponse } from "../../_lib/http.js";
import { requireAdminSession } from "../../_lib/session.js";
import {
  getSupportTicketDetail,
  listSupportTickets,
  updateSupportTicket,
} from "../../_lib/support.js";

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

  try {
    if (!context.env.DB) {
      return jsonResponse({ error: "Support ticket storage is not configured." }, 500, CORS_HEADERS);
    }

    const url = new URL(context.request.url);
    const ticketId = String(url.searchParams.get("ticketId") || "").trim();
    if (ticketId) {
      const detail = await getSupportTicketDetail(context.env, ticketId);
      if (!detail) {
        return jsonResponse({ error: "Ticket not found." }, 404, CORS_HEADERS);
      }
      return jsonResponse(detail, 200, CORS_HEADERS);
    }

    const tickets = await listSupportTickets(context.env);
    return jsonResponse({ tickets }, 200, CORS_HEADERS);
  } catch (error) {
    console.error("GET /api/admin/tickets error:", error);
    return jsonResponse({ error: "Unable to load support tickets." }, 500, CORS_HEADERS);
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdminSession(context);
  if (!auth.ok) return auth.response;

  try {
    if (!context.env.DB) {
      return jsonResponse({ error: "Support ticket storage is not configured." }, 500, CORS_HEADERS);
    }

    const body = await context.request.json();
    const action = String(body?.action || "");
    if (action !== "update_ticket") {
      return jsonResponse({ error: "Unsupported ticket action." }, 400, CORS_HEADERS);
    }

    const detail = await updateSupportTicket(context.env, {
      ticketId: body?.ticketId,
      status: body?.status,
      priority: body?.priority,
      assignedAdmin: body?.assignedAdmin,
      internalNote: body?.internalNote,
      customerReply: body?.customerReply,
    });

    return jsonResponse({ success: true, detail }, 200, CORS_HEADERS);
  } catch (error) {
    console.error("POST /api/admin/tickets error:", error);
    return jsonResponse({ error: error.message || "Unable to update support ticket." }, 500, CORS_HEADERS);
  }
}
