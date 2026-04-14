import { jsonResponse } from "../../_lib/http.js";
import { getAdminSession } from "../../_lib/session.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const session = await getAdminSession(context.env, context.request);
  return jsonResponse(
    {
      authenticated: Boolean(session),
      expiresAt: session?.expires_at || null,
    },
    200,
    CORS_HEADERS
  );
}
