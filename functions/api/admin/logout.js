import { jsonResponse } from "../../_lib/http.js";
import { buildExpiredSessionCookie, clearAdminSession } from "../../_lib/session.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  await clearAdminSession(context.env, context.request);
  return jsonResponse(
    { success: true },
    200,
    {
      ...CORS_HEADERS,
      "Set-Cookie": buildExpiredSessionCookie(context.request),
    }
  );
}
