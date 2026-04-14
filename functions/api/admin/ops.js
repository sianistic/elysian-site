import { jsonResponse } from "../../_lib/http.js";
import { listRecentNotificationEvents } from "../../_lib/notifications.js";
import { buildRuntimeChecks, summarizeRuntimeChecks } from "../../_lib/runtime.js";
import { requireAdminSession } from "../../_lib/session.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const auth = await requireAdminSession(context);
  if (!auth.ok) return auth.response;

  try {
    const checks = buildRuntimeChecks(context.env);
    const notifications = await listRecentNotificationEvents(context.env, 12);
    const summary = summarizeRuntimeChecks(checks);
    const failedNotifications = notifications.filter((item) => item.status !== "delivered").length;

    return jsonResponse(
      {
        checks,
        summary: {
          ...summary,
          failedNotifications,
        },
        notifications,
      },
      200,
      CORS_HEADERS
    );
  } catch (error) {
    console.error("GET /api/admin/ops error:", error);
    return jsonResponse({ error: "Unable to load operational status." }, 500, CORS_HEADERS);
  }
}
