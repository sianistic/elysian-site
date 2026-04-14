import { buildCookie, jsonResponse, parseCookies } from "./http.js";

const SESSION_COOKIE = "elysian_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(String(a || ""));
  const bBytes = encoder.encode(String(b || ""));

  if (aBytes.byteLength !== bBytes.byteLength) {
    return !crypto.subtle.timingSafeEqual(aBytes, aBytes);
  }

  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || null;
}

function getUserAgent(request) {
  return request.headers.get("User-Agent") || "";
}

async function createAdminSession(env, request) {
  if (!env.DB) {
    throw new Error("D1 binding DB not configured");
  }

  const sessionId = crypto.randomUUID();
  const rawToken = generateToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO admin_sessions (id, session_token_hash, expires_at, ip_address, user_agent)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(sessionId, tokenHash, expiresAt, getClientIp(request), getUserAgent(request))
    .run();

  return {
    sessionId,
    rawToken,
    expiresAt,
  };
}

async function verifyAdminPassword(env, password) {
  if (!env.ADMIN_PASSWORD) {
    return { ok: false, reason: "ADMIN_PASSWORD secret is not configured." };
  }

  const ok = await timingSafeEqual(password, env.ADMIN_PASSWORD);
  return {
    ok,
    reason: ok ? null : "Invalid credentials.",
  };
}

async function getAdminSession(env, request) {
  if (!env.DB) return null;

  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT id, expires_at
     FROM admin_sessions
     WHERE session_token_hash = ?1`
  )
    .bind(tokenHash)
    .first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?1").bind(row.id).run();
    return null;
  }

  await env.DB.prepare(
    "UPDATE admin_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?1"
  )
    .bind(row.id)
    .run();

  return row;
}

async function requireAdminSession(context) {
  const session = await getAdminSession(context.env, context.request);
  if (!session) {
    return {
      ok: false,
      response: jsonResponse({ error: "Unauthorized" }, 401),
    };
  }

  return { ok: true, session };
}

async function clearAdminSession(env, request) {
  if (!env.DB) return;
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare("DELETE FROM admin_sessions WHERE session_token_hash = ?1")
    .bind(tokenHash)
    .run();
}

function shouldUseSecureCookie(request) {
  const url = new URL(request.url);
  return url.protocol === "https:";
}

function buildSessionCookie(request, token) {
  return buildCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

function buildExpiredSessionCookie(request) {
  return buildCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export {
  buildExpiredSessionCookie,
  buildSessionCookie,
  clearAdminSession,
  createAdminSession,
  getAdminSession,
  requireAdminSession,
  verifyAdminPassword,
};
