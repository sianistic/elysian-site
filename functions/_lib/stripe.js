const STRIPE_API_VERSION = "2026-02-25.clover";
const WEBHOOK_TOLERANCE_SECONDS = 300;

function buildFormBody(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function parseStripeSignature(header) {
  return String(header || "")
    .split(",")
    .reduce((result, part) => {
      const [rawKey, rawValue] = part.split("=");
      const key = String(rawKey || "").trim();
      const value = String(rawValue || "").trim();
      if (!key || !value) return result;
      if (!result[key]) result[key] = [];
      result[key].push(value);
      return result;
    }, {});
}

async function hmacSha256Hex(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyStripeWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  const parsed = parseStripeSignature(signatureHeader);
  const timestamp = parsed.t?.[0];
  const signatures = parsed.v1 || [];

  if (!timestamp || !signatures.length) {
    throw new Error("Missing Stripe-Signature timestamp or v1 signature.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestampNumber = parseInt(timestamp, 10);
  if (!timestampNumber || Math.abs(nowSeconds - timestampNumber) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Stripe webhook timestamp is outside the allowed tolerance.");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = await hmacSha256Hex(secret, signedPayload);
  const valid = signatures.some((candidate) => constantTimeEqual(candidate, expectedSignature));

  if (!valid) {
    throw new Error("Stripe webhook signature verification failed.");
  }

  return JSON.parse(rawBody);
}

async function createStripeCheckoutSession(env, payload) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body: buildFormBody(payload),
  });

  const session = await response.json();
  if (!response.ok || session.error) {
    throw new Error(session.error?.message || "Failed to create Stripe Checkout session.");
  }

  return session;
}

export {
  buildFormBody,
  createStripeCheckoutSession,
  parseStripeSignature,
  verifyStripeWebhookSignature,
};
