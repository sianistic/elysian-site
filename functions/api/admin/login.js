import { jsonResponse } from "../../_lib/http.js";
import { getFeatureConfigError } from "../../_lib/runtime.js";
import { buildSessionCookie, createAdminSession, verifyAdminPassword } from "../../_lib/session.js";

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
    const configError = getFeatureConfigError(context.env, "admin_auth");
    if (configError) {
      return jsonResponse(
        { error: configError },
        500,
        CORS_HEADERS
      );
    }

    const body = await context.request.json();
    const password = String(body?.password || "");

    if (!password) {
      return jsonResponse({ error: "Password is required." }, 400, CORS_HEADERS);
    }

    const result = await verifyAdminPassword(context.env, password);
    if (!result.ok) {
      return jsonResponse({ error: result.reason }, 401, CORS_HEADERS);
    }

    const session = await createAdminSession(context.env, context.request);
    return jsonResponse(
      {
        success: true,
        expiresAt: session.expiresAt,
      },
      200,
      {
        ...CORS_HEADERS,
        "Set-Cookie": buildSessionCookie(context.request, session.rawToken),
      }
    );
  } catch (error) {
    return jsonResponse({ error: error.message || "Unable to sign in." }, 500, CORS_HEADERS);
  }
}
