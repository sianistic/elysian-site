import { createStripeCheckoutSession } from "./stripe.js";
import { createNotifier } from "./notifications.js";

const SHIPPING_COUNTRIES = ["US", "CA", "GB", "AU"];
const QUOTE_COMPONENT_KEYS = ["cpu", "gpu", "ram", "storage", "motherboard", "psu", "case", "cooling"];
const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanNullableText(value) {
  const text = cleanText(value);
  return text || null;
}

function toCents(value) {
  const amount = parseInt(value, 10);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function getSiteUrl(env) {
  return env.SITE_URL || "http://localhost:8788";
}

function toIsoFromUnix(value) {
  const seconds = parseInt(value, 10);
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function parseDateMs(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function extractOrderIdFromStripePayload(payload) {
  const metadata = payload?.metadata || {};
  return cleanText(metadata.order_id || payload?.client_reference_id || "");
}

function isWebhookProcessingStale(row) {
  const startedAt = parseDateMs(row?.processing_started_at || row?.received_at);
  if (!startedAt) return false;
  return (Date.now() - startedAt) > WEBHOOK_PROCESSING_LEASE_MS;
}

function normalizeQuoteComponents(source = {}, fallback = {}) {
  return QUOTE_COMPONENT_KEYS.reduce((result, key) => {
    result[key] = cleanText(source[key] ?? fallback[key] ?? "");
    return result;
  }, {});
}

function normalizeQuoteConfigSnapshot(input = {}, fallback = {}) {
  const fallbackSnapshot = typeof fallback === "object" && fallback !== null ? fallback : {};
  const source = typeof input === "object" && input !== null ? input : {};
  const sourceComponents = source.components || source;
  const fallbackComponents = fallbackSnapshot.components || fallbackSnapshot;

  return {
    components: normalizeQuoteComponents(sourceComponents, fallbackComponents),
    compatibilityNotes: cleanText(source.compatibilityNotes ?? fallbackSnapshot.compatibilityNotes ?? ""),
    buildNotes: cleanText(source.buildNotes ?? fallbackSnapshot.buildNotes ?? ""),
  };
}

function buildShippingFields() {
  return SHIPPING_COUNTRIES.reduce((result, country, index) => {
    result[`shipping_address_collection[allowed_countries][${index}]`] = country;
    return result;
  }, {});
}

function createLineItemsFormData(lineItems) {
  return lineItems.reduce((result, item, index) => {
    result[`line_items[${index}][price_data][currency]`] = item.currency || "usd";
    result[`line_items[${index}][price_data][unit_amount]`] = item.unitAmount;
    result[`line_items[${index}][price_data][product_data][name]`] = item.name;
    result[`line_items[${index}][price_data][product_data][description]`] = item.description;
    result[`line_items[${index}][quantity]`] = item.quantity || 1;
    return result;
  }, {});
}

function buildCheckoutUrls(order, phase, siteUrl) {
  if (order.order_type === "quote") {
    return {
      success_url: `${siteUrl}/request-quote.html?payment=success&order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/request-quote.html?payment=cancelled&order_id=${order.id}&phase=${phase}`,
    };
  }

  return {
    success_url: `${siteUrl}/builds.html?checkout=success&order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/builds.html?checkout=cancelled&order_id=${order.id}`,
  };
}

function buildQuoteLineItem(order, phase, amountCents) {
  const quoteLabel = order.quote_id ? `Quote ${order.quote_id}` : `Order ${order.id}`;
  const name = phase === "deposit"
    ? `Deposit for ${quoteLabel}`
    : phase === "balance"
      ? `Balance payment for ${quoteLabel}`
      : `Full payment for ${quoteLabel}`;

  return [{
    currency: "usd",
    unitAmount: amountCents,
    name,
    description: "Reviewed custom configuration from Elysian PCs",
    quantity: 1,
  }];
}

function buildCatalogLineItems(order) {
  const payload = parseJson(order.order_item_json, {});
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items.map((item) => ({
    currency: "usd",
    unitAmount: toCents(item.unitAmountCents),
    name: cleanText(item.name || "Elysian Build").slice(0, 255),
    description: cleanText(item.description || "Handcrafted luxury custom PC by Elysian PCs"),
    quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
  }));
}

function deriveOrderLifecycle(totalCents, amountPaidCents, currentPaymentStatus) {
  const total = toCents(totalCents);
  const paid = Math.min(total, toCents(amountPaidCents));
  const balance = Math.max(0, total - paid);

  if (total > 0 && paid >= total) {
    return {
      status: "ready_for_fulfillment",
      paymentStatus: "paid",
      balanceDueCents: 0,
      amountPaidCents: paid,
    };
  }

  if (paid > 0) {
    return {
      status: "awaiting_balance",
      paymentStatus: "partially_paid",
      balanceDueCents: balance,
      amountPaidCents: paid,
    };
  }

  const paymentStatus = cleanText(currentPaymentStatus) || "unpaid";
  return {
    status: "pending_payment",
    paymentStatus,
    balanceDueCents: total,
    amountPaidCents: 0,
  };
}

function deriveQuoteStatusFromOrder(order, currentQuoteStatus) {
  const lifecycle = deriveOrderLifecycle(order.total_cents, order.amount_paid_cents, order.payment_status);
  if (lifecycle.paymentStatus === "paid") return "paid";
  if (lifecycle.paymentStatus === "partially_paid") return "awaiting_balance";
  if (order.payment_status === "payment_link_created") return "payment_ready";
  if (order.payment_status === "expired" || order.payment_status === "failed") return "approved";
  return cleanText(currentQuoteStatus) || "approved";
}

async function logOrderEvent(env, orderId, eventType, payload = {}, source = "system") {
  if (!env.DB || !orderId) return;
  await env.DB.prepare(
    `INSERT INTO order_events (id, order_id, event_type, source, payload_json)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(crypto.randomUUID(), orderId, eventType, source, JSON.stringify(payload))
    .run();
}

async function notifyQuoteApproved(env, quote, order) {
  const notifier = createNotifier(env);
  await notifier.sendOperationalAlert({
    eventType: "quote.approved",
    entityType: "quote",
    entityId: quote.id,
    subject: `Quote approved ${quote.id}`,
    message: `${quote.customer_name} has an approved quote ready for payment-link generation.`,
    data: {
      quoteId: quote.id,
      orderId: order?.id || "",
      customerName: quote.customer_name,
      customerEmail: quote.customer_email,
      paymentMode: quote.payment_mode,
      subtotalCents: toCents(quote.subtotal_cents),
      depositCents: toCents(quote.deposit_cents),
    },
  });
}

async function notifyQuotePaymentLinkReady(env, order, paymentLink, phase, amountCents) {
  if (order.order_type !== "quote" || !cleanText(order.customer_email) || paymentLink.reused) {
    return;
  }

  const notifier = createNotifier(env);
  await notifier.send({
    template: "quote-payment-link-created",
    eventType: "quote.payment_link.created.customer",
    entityType: "order",
    entityId: order.id,
    to: order.customer_email,
    subject: `Elysian payment link ready for ${order.quote_id || order.id}`,
    data: {
      customerName: order.customer_name,
      quoteId: order.quote_id,
      orderId: order.id,
      paymentPhase: phase,
      amountCents,
      paymentUrl: paymentLink.url,
    },
  });

  await notifier.sendOperationalAlert({
    eventType: "quote.payment_link.created",
    entityType: "order",
    entityId: order.id,
    subject: `Payment link created for ${order.quote_id || order.id}`,
    message: `A ${formatPaymentPhase(phase)} link is ready for ${order.customer_name || order.customer_email || order.id}.`,
    data: {
      orderId: order.id,
      quoteId: order.quote_id || "",
      paymentPhase: phase,
      amountCents,
      paymentLinkUrl: paymentLink.url,
      customerEmail: order.customer_email,
    },
  });
}

async function notifyOrderPaymentConfirmed(env, order, phase, amountCents, remainingBalanceCents) {
  const notifier = createNotifier(env);

  if (cleanText(order.customer_email)) {
    await notifier.send({
      template: "payment-confirmed",
      eventType: "order.payment.confirmed.customer",
      entityType: "order",
      entityId: order.id,
      to: order.customer_email,
      subject: `Elysian payment confirmed for ${order.id}`,
      data: {
        customerName: order.customer_name,
        orderId: order.id,
        paymentPhase: phase,
        amountCents,
        remainingBalanceCents,
      },
    });
  }

  await notifier.sendOperationalAlert({
    eventType: "order.payment.confirmed",
    entityType: "order",
    entityId: order.id,
    subject: `Payment confirmed for ${order.id}`,
    message: `${formatMoney(amountCents)} was confirmed for ${order.customer_email || order.id}.`,
    data: {
      orderId: order.id,
      quoteId: order.quote_id || "",
      paymentPhase: phase,
      amountCents,
      remainingBalanceCents,
      paymentMode: order.payment_mode,
      paymentStatus: remainingBalanceCents > 0 ? "partially_paid" : "paid",
    },
  });
}

async function notifyOrderPaymentIssue(env, order, phase, issueType, details = {}) {
  const notifier = createNotifier(env);
  await notifier.sendOperationalAlert({
    eventType: `order.payment.${issueType}`,
    entityType: "order",
    entityId: order.id,
    severity: issueType === "failed" ? "warning" : "info",
    subject: `Payment ${issueType} for ${order.id}`,
    message: `${formatPaymentPhase(phase)} for ${order.customer_email || order.id} is now ${issueType}.`,
    data: {
      orderId: order.id,
      quoteId: order.quote_id || "",
      paymentPhase: phase,
      paymentMode: order.payment_mode,
      ...details,
    },
  });
}

async function getQuoteRow(env, quoteId) {
  return env.DB.prepare("SELECT * FROM quotes WHERE id = ?1").bind(quoteId).first();
}

async function getOrderRow(env, orderId) {
  return env.DB.prepare("SELECT * FROM orders WHERE id = ?1").bind(orderId).first();
}

async function getOrderForQuote(env, quoteId) {
  return env.DB.prepare("SELECT * FROM orders WHERE quote_id = ?1").bind(quoteId).first();
}

async function getLatestPaymentSession(env, orderId) {
  return env.DB.prepare(
    `SELECT *
     FROM order_payment_sessions
     WHERE order_id = ?1
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(orderId)
    .first();
}

async function listPaymentSessionsForOrder(env, orderId) {
  const result = await env.DB.prepare(
    `SELECT id,
            payment_phase,
            amount_cents,
            currency,
            status,
            stripe_checkout_session_id,
            stripe_payment_intent_id,
            stripe_checkout_url,
            expires_at,
            completed_at,
            created_at,
            updated_at
     FROM order_payment_sessions
     WHERE order_id = ?1
     ORDER BY created_at DESC`
  )
    .bind(orderId)
    .all();

  return (result?.results || []).map((row) => ({
    id: row.id,
    phase: row.payment_phase,
    amountCents: toCents(row.amount_cents),
    currency: row.currency || "usd",
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || "",
    stripePaymentIntentId: row.stripe_payment_intent_id || "",
    url: row.stripe_checkout_url || "",
    expiresAt: row.expires_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function listOrderEventsForOrder(env, orderId) {
  const result = await env.DB.prepare(
    `SELECT id, event_type, source, payload_json, created_at
     FROM order_events
     WHERE order_id = ?1
     ORDER BY created_at DESC`
  )
    .bind(orderId)
    .all();

  return (result?.results || []).map((row) => ({
    id: row.id,
    type: row.event_type,
    source: row.source,
    payload: parseJson(row.payload_json, {}),
    createdAt: row.created_at,
  }));
}

async function listWebhookEventsForOrder(env, orderId) {
  const result = await env.DB.prepare(
    `SELECT id,
            event_type,
            status,
            related_object_id,
            last_error,
            received_at,
            processing_started_at,
            last_delivery_at,
            delivery_count,
            processed_at
     FROM stripe_webhook_events
     WHERE order_id = ?1
     ORDER BY COALESCE(processed_at, last_delivery_at, received_at) DESC`
  )
    .bind(orderId)
    .all();

  return (result?.results || []).map((row) => ({
    id: row.id,
    type: row.event_type,
    status: row.status,
    relatedObjectId: row.related_object_id || "",
    lastError: row.last_error || "",
    receivedAt: row.received_at || null,
    processingStartedAt: row.processing_started_at || null,
    lastDeliveryAt: row.last_delivery_at || null,
    deliveryCount: parseInt(row.delivery_count, 10) || 1,
    processedAt: row.processed_at || null,
  }));
}

async function getActivePaymentSession(env, orderId, phase) {
  return env.DB.prepare(
    `SELECT *
     FROM order_payment_sessions
     WHERE order_id = ?1
       AND payment_phase = ?2
       AND status = 'created'
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(orderId, phase)
    .first();
}

async function ensureQuoteOrder(env, quoteRow) {
  const existing = await getOrderForQuote(env, quoteRow.id);
  if (existing) return existing;

  const orderId = crypto.randomUUID();
  const lifecycle = deriveOrderLifecycle(quoteRow.subtotal_cents, 0, "unpaid");
  const paymentMode = cleanText(quoteRow.payment_mode) || "full_payment";

  await env.DB.prepare(
    `INSERT INTO orders
      (id, quote_id, order_type, customer_name, customer_email, status, payment_status, payment_mode,
       currency, total_cents, amount_paid_cents, deposit_cents, balance_due_cents,
       order_item_json, build_snapshot_json)
     VALUES (?1, ?2, 'quote', ?3, ?4, ?5, ?6, ?7, 'usd', ?8, 0, ?9, ?10, ?11, ?12)`
  )
    .bind(
      orderId,
      quoteRow.id,
      quoteRow.customer_name,
      quoteRow.customer_email,
      lifecycle.status,
      lifecycle.paymentStatus,
      paymentMode,
      toCents(quoteRow.subtotal_cents),
      toCents(quoteRow.deposit_cents),
      lifecycle.balanceDueCents,
      JSON.stringify({
        label: "custom_quote",
        quoteId: quoteRow.id,
      }),
      quoteRow.config_snapshot_json || "{}"
    )
    .run();

  await logOrderEvent(env, orderId, "order_created", { quoteId: quoteRow.id, paymentMode }, "admin");
  return getOrderRow(env, orderId);
}

async function updateQuoteReview(env, quoteRow, review, action) {
  const currentConfig = normalizeQuoteConfigSnapshot(parseJson(quoteRow.config_snapshot_json, {}));
  const configSnapshot = normalizeQuoteConfigSnapshot(review.configSnapshot, currentConfig);
  const subtotalCents = toCents(review.subtotalCents);
  const paymentMode = review.paymentMode === "deposit_first" ? "deposit_first" : "full_payment";
  const depositCents = paymentMode === "deposit_first" ? toCents(review.depositCents) : 0;
  const balanceDueCents = Math.max(0, subtotalCents - depositCents);
  const adminNotes = cleanText(review.adminNotes ?? quoteRow.admin_notes ?? "");
  const nextStatus = action === "approve"
    ? "approved"
    : (cleanText(quoteRow.status) === "requested" ? "under_review" : cleanText(quoteRow.status) || "under_review");

  if (!subtotalCents) {
    throw new Error("Quoted subtotal must be greater than zero.");
  }
  if (paymentMode === "deposit_first" && (!depositCents || depositCents >= subtotalCents)) {
    throw new Error("Deposit amount must be greater than zero and less than the subtotal.");
  }

  const existingOrder = await getOrderForQuote(env, quoteRow.id);
  if (existingOrder && cleanText(existingOrder.payment_status) === "payment_link_created") {
    throw new Error("A payment link is already active for this quote. Wait for it to expire or create the next payment step from the linked order.");
  }
  if (existingOrder && toCents(existingOrder.amount_paid_cents) > 0) {
    throw new Error("This quote already has recorded payments. Create the next payment step from the order instead of changing the approved totals.");
  }

  await env.DB.prepare(
    `UPDATE quotes
     SET status = ?2,
         payment_mode = ?3,
         subtotal_cents = ?4,
         deposit_cents = ?5,
         balance_due_cents = ?6,
         admin_notes = ?7,
         config_snapshot_json = ?8,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  )
    .bind(
      quoteRow.id,
      nextStatus,
      paymentMode,
      subtotalCents,
      depositCents || null,
      balanceDueCents,
      adminNotes,
      JSON.stringify(configSnapshot)
    )
    .run();

  if (existingOrder) {
    const lifecycle = deriveOrderLifecycle(subtotalCents, 0, "unpaid");
    await env.DB.prepare(
      `UPDATE orders
       SET customer_name = ?2,
           customer_email = ?3,
           payment_mode = ?4,
           total_cents = ?5,
           deposit_cents = ?6,
           balance_due_cents = ?7,
           status = ?8,
           payment_status = ?9,
           build_snapshot_json = ?10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(
        existingOrder.id,
        quoteRow.customer_name,
        quoteRow.customer_email,
        paymentMode,
        subtotalCents,
        depositCents || null,
        lifecycle.balanceDueCents,
        lifecycle.status,
        lifecycle.paymentStatus,
        JSON.stringify(configSnapshot)
      )
      .run();
  }

  const updatedQuote = await getQuoteRow(env, quoteRow.id);
  const linkedOrder = existingOrder || null;

  if (action === "approve" && updatedQuote) {
    console.info("Quote approved", {
      quoteId: updatedQuote.id,
      paymentMode: updatedQuote.payment_mode,
    });
    await notifyQuoteApproved(env, updatedQuote, linkedOrder);
  }

  return updatedQuote;
}

async function createCatalogOrder(env, items) {
  const normalizedItems = items.map((item) => {
    const unitAmountCents = Math.round(Math.max(1, parseFloat(item.price) || 0) * 100);
    return {
      id: cleanText(item.id).slice(0, 80),
      name: cleanText(item.name || "Elysian Build").slice(0, 255),
      unitAmountCents,
      quantity: 1,
      description: "Handcrafted luxury custom PC by Elysian PCs",
    };
  });

  const totalCents = normalizedItems.reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0);
  const lifecycle = deriveOrderLifecycle(totalCents, 0, "unpaid");
  const orderId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO orders
      (id, order_type, customer_name, customer_email, status, payment_status, payment_mode,
       currency, total_cents, amount_paid_cents, balance_due_cents, order_item_json, build_snapshot_json)
     VALUES (?1, 'catalog', '', '', ?2, ?3, 'full_payment', 'usd', ?4, 0, ?5, ?6, '{}')`
  )
    .bind(
      orderId,
      lifecycle.status,
      lifecycle.paymentStatus,
      totalCents,
      lifecycle.balanceDueCents,
      JSON.stringify({ items: normalizedItems })
    )
    .run();

  await logOrderEvent(env, orderId, "order_created", { itemCount: normalizedItems.length }, "system");
  return getOrderRow(env, orderId);
}

async function recordPaymentSession(env, order, sessionId, payload) {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO order_payment_sessions
        (id, order_id, payment_phase, amount_cents, currency, status, stripe_checkout_session_id,
         stripe_checkout_url, expires_at, metadata_json)
       VALUES (?1, ?2, ?3, ?4, 'usd', 'created', ?5, ?6, ?7, ?8)`
    ).bind(
      payload.paymentSessionId,
      order.id,
      payload.phase,
      payload.amountCents,
      sessionId,
      payload.url,
      toIsoFromUnix(payload.expiresAt),
      JSON.stringify(payload.metadata || {})
    ),
    env.DB.prepare(
      `UPDATE orders
       SET stripe_checkout_session_id = ?2,
           payment_status = ?3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(
      order.id,
      sessionId,
      payload.nextPaymentStatus
    ),
  ]);
}

async function createPaymentLinkForOrder(env, order, options = {}) {
  const phase = cleanText(options.phase) || "full";
  const quoteId = cleanText(order.quote_id);
  const active = await getActivePaymentSession(env, order.id, phase);
  if (active) {
    return {
      reused: true,
      url: active.stripe_checkout_url,
      orderId: order.id,
      sessionId: active.stripe_checkout_session_id,
      paymentSessionId: active.id,
    };
  }

  const amountCents = toCents(options.amountCents);
  if (!amountCents) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const paymentSessionId = crypto.randomUUID();
  const metadata = {
    source: quoteId ? "elysian_quote_manual_link" : "elysian_catalog_checkout",
    order_id: order.id,
    order_payment_session_id: paymentSessionId,
    payment_phase: phase,
  };
  if (quoteId) metadata.quote_id = quoteId;

  const lineItems = order.order_type === "quote"
    ? buildQuoteLineItem(order, phase, amountCents)
    : buildCatalogLineItems(order);

  const siteUrl = getSiteUrl(env);
  const checkoutUrls = buildCheckoutUrls(order, phase, siteUrl);
  const payload = {
    mode: "payment",
    client_reference_id: order.id,
    customer_creation: "always",
    billing_address_collection: "required",
    "payment_method_types[0]": "card",
    ...buildShippingFields(),
    ...checkoutUrls,
    ...createLineItemsFormData(lineItems),
    "metadata[source]": metadata.source,
    "metadata[order_id]": metadata.order_id,
    "metadata[order_payment_session_id]": metadata.order_payment_session_id,
    "metadata[payment_phase]": metadata.payment_phase,
    "payment_intent_data[metadata][source]": metadata.source,
    "payment_intent_data[metadata][order_id]": metadata.order_id,
    "payment_intent_data[metadata][order_payment_session_id]": metadata.order_payment_session_id,
    "payment_intent_data[metadata][payment_phase]": metadata.payment_phase,
  };

  if (metadata.quote_id) {
    payload["metadata[quote_id]"] = metadata.quote_id;
    payload["payment_intent_data[metadata][quote_id]"] = metadata.quote_id;
  }
  if (cleanText(order.customer_email)) payload.customer_email = order.customer_email;

  const session = await createStripeCheckoutSession(env, payload);
  const nextPaymentStatus = toCents(order.amount_paid_cents) > 0 ? cleanText(order.payment_status) || "partially_paid" : "payment_link_created";

  await recordPaymentSession(env, order, session.id, {
    paymentSessionId,
    phase,
    amountCents,
    url: session.url,
    expiresAt: session.expires_at,
    metadata,
    nextPaymentStatus,
  });

  if (quoteId && phase !== "balance") {
    await env.DB.prepare(
      `UPDATE quotes
       SET status = 'payment_ready', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(quoteId)
      .run();
  }

  await logOrderEvent(env, order.id, "payment_link_created", {
    phase,
    amountCents,
    sessionId: session.id,
  }, "admin");

  const paymentLink = {
    reused: false,
    url: session.url,
    orderId: order.id,
    sessionId: session.id,
    paymentSessionId,
  };

  console.info("Payment link created", {
    orderId: order.id,
    phase,
    amountCents,
    sessionId: session.id,
  });

  await notifyQuotePaymentLinkReady(env, order, paymentLink, phase, amountCents);

  return paymentLink;
}

async function createQuoteInitialPaymentLink(env, quoteRow) {
  const order = await ensureQuoteOrder(env, quoteRow);
  const amountCents = quoteRow.payment_mode === "deposit_first"
    ? toCents(quoteRow.deposit_cents)
    : toCents(quoteRow.subtotal_cents);
  const phase = quoteRow.payment_mode === "deposit_first" ? "deposit" : "full";
  return createPaymentLinkForOrder(env, order, { phase, amountCents });
}

async function createBalancePaymentLink(env, orderId) {
  const order = await getOrderRow(env, orderId);
  if (!order) {
    throw new Error("Order not found.");
  }
  if (cleanText(order.payment_mode) !== "deposit_first") {
    throw new Error("Only deposit-first orders can generate a balance payment link.");
  }
  if (toCents(order.amount_paid_cents) <= 0 || toCents(order.balance_due_cents) <= 0) {
    throw new Error("This order does not currently have a remaining balance due.");
  }

  return createPaymentLinkForOrder(env, order, {
    phase: "balance",
    amountCents: toCents(order.balance_due_cents),
  });
}

async function processSuccessfulCheckoutSession(env, session) {
  const metadata = session.metadata || {};
  const orderId = cleanText(metadata.order_id || session.client_reference_id);
  if (!orderId) return;

  const order = await getOrderRow(env, orderId);
  if (!order) {
    throw new Error(`Order ${orderId} was not found for Stripe session ${session.id}.`);
  }

  const paymentSession = await env.DB.prepare(
    `SELECT *
     FROM order_payment_sessions
     WHERE stripe_checkout_session_id = ?1
     LIMIT 1`
  )
    .bind(session.id)
    .first();

  const resolvedPaymentSession = paymentSession || (metadata.order_payment_session_id
    ? await env.DB.prepare(
      `SELECT *
       FROM order_payment_sessions
       WHERE id = ?1
       LIMIT 1`
    )
      .bind(metadata.order_payment_session_id)
      .first()
    : null);

  if (!resolvedPaymentSession) {
    throw new Error(`Payment session ${session.id} is not linked to an internal order.`);
  }

  if (cleanText(resolvedPaymentSession.status) === "completed") {
    return;
  }

  const increment = toCents(resolvedPaymentSession.amount_cents || session.amount_total);
  const lifecycle = deriveOrderLifecycle(
    order.total_cents,
    toCents(order.amount_paid_cents) + increment,
    "paid"
  );

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE order_payment_sessions
       SET status = 'completed',
           stripe_checkout_session_id = ?2,
           stripe_checkout_url = COALESCE(?3, stripe_checkout_url),
           stripe_payment_intent_id = ?4,
           stripe_customer_id = ?5,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(
      resolvedPaymentSession.id,
      session.id,
      cleanNullableText(session.url),
      cleanNullableText(session.payment_intent),
      cleanNullableText(session.customer)
    ),
    env.DB.prepare(
      `UPDATE orders
       SET customer_name = COALESCE(NULLIF(?2, ''), customer_name),
           customer_email = COALESCE(NULLIF(?3, ''), customer_email),
           stripe_checkout_session_id = ?4,
           stripe_payment_intent_id = COALESCE(?5, stripe_payment_intent_id),
           stripe_customer_id = COALESCE(?6, stripe_customer_id),
           status = ?7,
           payment_status = ?8,
           amount_paid_cents = ?9,
           balance_due_cents = ?10,
           last_payment_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(
      order.id,
      cleanText(session.customer_details?.name || session.customer_details?.email || ""),
      cleanText(session.customer_details?.email || session.customer_email || ""),
      session.id,
      cleanNullableText(session.payment_intent),
      cleanNullableText(session.customer),
      lifecycle.status,
      lifecycle.paymentStatus,
      lifecycle.amountPaidCents,
      lifecycle.balanceDueCents
    ),
  ]);

  if (order.quote_id) {
    await env.DB.prepare(
      `UPDATE quotes
       SET status = ?2, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(order.quote_id, deriveQuoteStatusFromOrder({
        ...order,
        amount_paid_cents: lifecycle.amountPaidCents,
        payment_status: lifecycle.paymentStatus,
        total_cents: order.total_cents,
      }, "payment_ready"))
      .run();
  }

  await logOrderEvent(env, order.id, "payment_confirmed", {
    sessionId: session.id,
    paymentPhase: resolvedPaymentSession.payment_phase,
    paymentIntentId: session.payment_intent,
    amountCents: increment,
  }, "stripe_webhook");

  console.info("Stripe payment confirmed", {
    orderId: order.id,
    sessionId: session.id,
    paymentPhase: resolvedPaymentSession.payment_phase,
    amountCents: increment,
  });

  await notifyOrderPaymentConfirmed(
    env,
    {
      ...order,
      customer_name: cleanText(session.customer_details?.name || session.customer_details?.email || order.customer_name || ""),
      customer_email: cleanText(session.customer_details?.email || session.customer_email || order.customer_email || ""),
      payment_mode: order.payment_mode,
      quote_id: order.quote_id,
    },
    resolvedPaymentSession.payment_phase,
    increment,
    lifecycle.balanceDueCents
  );
}

async function processExpiredCheckoutSession(env, session) {
  const metadata = session.metadata || {};
  const paymentSession = await env.DB.prepare(
    `SELECT *
     FROM order_payment_sessions
     WHERE stripe_checkout_session_id = ?1
     LIMIT 1`
  )
    .bind(session.id)
    .first();

  const resolvedPaymentSession = paymentSession || (metadata.order_payment_session_id
    ? await env.DB.prepare(
      `SELECT *
       FROM order_payment_sessions
       WHERE id = ?1
       LIMIT 1`
    )
      .bind(metadata.order_payment_session_id)
      .first()
    : null);

  if (!resolvedPaymentSession) {
    return;
  }

  const paymentSessionStatus = cleanText(resolvedPaymentSession.status);
  if (paymentSessionStatus === "completed" || paymentSessionStatus === "expired") {
    return;
  }

  const order = await getOrderRow(env, resolvedPaymentSession.order_id);
  if (!order) return;

  const nextPaymentStatus = toCents(order.amount_paid_cents) > 0 ? "partially_paid" : "expired";
  const nextStatus = toCents(order.amount_paid_cents) > 0 ? "awaiting_balance" : "pending_payment";

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE order_payment_sessions
       SET status = 'expired',
           stripe_checkout_session_id = COALESCE(?2, stripe_checkout_session_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(resolvedPaymentSession.id, cleanNullableText(session.id)),
    env.DB.prepare(
      `UPDATE orders
       SET payment_status = ?2,
           status = ?3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(order.id, nextPaymentStatus, nextStatus),
  ]);

  if (order.quote_id) {
    await env.DB.prepare(
      `UPDATE quotes
       SET status = ?2, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(order.quote_id, deriveQuoteStatusFromOrder({
        ...order,
        payment_status: nextPaymentStatus,
      }, "payment_ready"))
      .run();
  }

  await logOrderEvent(env, order.id, "payment_link_expired", {
    sessionId: session.id,
    paymentPhase: resolvedPaymentSession.payment_phase,
  }, "stripe_webhook");

  console.warn("Stripe payment link expired", {
    orderId: order.id,
    sessionId: session.id,
    paymentPhase: resolvedPaymentSession.payment_phase,
  });

  await notifyOrderPaymentIssue(env, order, resolvedPaymentSession.payment_phase, "expired", {
    sessionId: session.id,
  });
}

async function processFailedPaymentIntent(env, paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  const paymentSession = await env.DB.prepare(
    `SELECT *
     FROM order_payment_sessions
     WHERE stripe_payment_intent_id = ?1
     LIMIT 1`
  )
    .bind(paymentIntent.id)
    .first();

  const resolvedPaymentSession = paymentSession || (metadata.order_payment_session_id
    ? await env.DB.prepare(
      `SELECT *
       FROM order_payment_sessions
       WHERE id = ?1
       LIMIT 1`
    )
      .bind(metadata.order_payment_session_id)
      .first()
    : null);

  if (!resolvedPaymentSession) {
    return;
  }

  const paymentSessionStatus = cleanText(resolvedPaymentSession.status);
  if (paymentSessionStatus === "completed" || paymentSessionStatus === "failed") {
    return;
  }

  const order = await getOrderRow(env, resolvedPaymentSession.order_id || metadata.order_id);
  if (!order) return;

  const nextPaymentStatus = toCents(order.amount_paid_cents) > 0 ? "partially_paid" : "failed";
  const nextStatus = toCents(order.amount_paid_cents) > 0 ? "awaiting_balance" : "pending_payment";

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE order_payment_sessions
       SET status = 'failed',
           stripe_payment_intent_id = COALESCE(?2, stripe_payment_intent_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(resolvedPaymentSession.id, cleanNullableText(paymentIntent.id)),
    env.DB.prepare(
      `UPDATE orders
       SET payment_status = ?2,
           status = ?3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(order.id, nextPaymentStatus, nextStatus),
  ]);

  if (order.quote_id) {
    await env.DB.prepare(
      `UPDATE quotes
       SET status = ?2, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(order.quote_id, deriveQuoteStatusFromOrder({
        ...order,
        payment_status: nextPaymentStatus,
      }, "payment_ready"))
      .run();
  }

  await logOrderEvent(env, order.id, "payment_failed", {
    paymentIntentId: paymentIntent.id,
    paymentPhase: resolvedPaymentSession.payment_phase,
    lastPaymentError: paymentIntent.last_payment_error?.message || "",
  }, "stripe_webhook");

  console.warn("Stripe payment failed", {
    orderId: order.id,
    paymentIntentId: paymentIntent.id,
    paymentPhase: resolvedPaymentSession.payment_phase,
    lastPaymentError: paymentIntent.last_payment_error?.message || "",
  });

  await notifyOrderPaymentIssue(env, order, resolvedPaymentSession.payment_phase, "failed", {
    paymentIntentId: paymentIntent.id,
    lastPaymentError: paymentIntent.last_payment_error?.message || "",
  });
}

async function processStripeWebhookEvent(env, event) {
  const eventType = cleanText(event?.type);
  const payload = event?.data?.object;
  if (!event?.id || !eventType || !payload) {
    throw new Error("Invalid Stripe webhook payload.");
  }

  const payloadJson = JSON.stringify(payload);
  const relatedObjectId = cleanText(payload.id);
  const orderId = extractOrderIdFromStripePayload(payload);
  let recovered = false;
  let recoveryOrderId = orderId;

  const insertResult = await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_webhook_events
      (id, event_type, status, order_id, related_object_id, payload_json,
       processing_started_at, last_delivery_at, delivery_count)
     VALUES (?1, ?2, 'processing', ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`
  )
    .bind(event.id, eventType, cleanNullableText(orderId), relatedObjectId, payloadJson)
    .run();

  if ((insertResult?.meta?.changes || 0) === 0) {
    const existing = await env.DB.prepare(
      `SELECT status,
              order_id,
              received_at,
              processing_started_at
       FROM stripe_webhook_events
       WHERE id = ?1`
    )
      .bind(event.id)
      .first();

    if (existing?.status === "processed") {
      await env.DB.prepare(
        `UPDATE stripe_webhook_events
         SET last_delivery_at = CURRENT_TIMESTAMP,
             delivery_count = COALESCE(delivery_count, 1) + 1
         WHERE id = ?1`
      )
        .bind(event.id)
        .run();
      return { duplicate: true };
    }

    if (existing?.status === "processing") {
      if (!isWebhookProcessingStale(existing)) {
        await env.DB.prepare(
          `UPDATE stripe_webhook_events
           SET last_delivery_at = CURRENT_TIMESTAMP,
               delivery_count = COALESCE(delivery_count, 1) + 1
           WHERE id = ?1`
        )
          .bind(event.id)
          .run();
        return { duplicate: true, inProgress: true };
      }

      const staleLeaseStart = existing.processing_started_at || existing.received_at;
      const reclaim = await env.DB.prepare(
        `UPDATE stripe_webhook_events
         SET order_id = COALESCE(?2, order_id),
             related_object_id = ?3,
             payload_json = ?4,
             processing_started_at = CURRENT_TIMESTAMP,
             last_delivery_at = CURRENT_TIMESTAMP,
             delivery_count = COALESCE(delivery_count, 1) + 1,
             last_error = '',
             processed_at = NULL
         WHERE id = ?1
           AND status = 'processing'
           AND COALESCE(processing_started_at, received_at) = ?5`
      )
        .bind(
          event.id,
          cleanNullableText(orderId),
          relatedObjectId,
          payloadJson,
          staleLeaseStart
        )
        .run();

      if ((reclaim?.meta?.changes || 0) === 0) {
        return { duplicate: true, inProgress: true };
      }

      recovered = true;
      recoveryOrderId = orderId || cleanText(existing.order_id);
      console.warn("Recovered stale Stripe webhook processing lease.", {
        eventId: event.id,
        eventType,
        orderId: recoveryOrderId || "",
        previousProcessingStartedAt: staleLeaseStart,
      });
    }

    if (existing?.status === "failed") {
      const retry = await env.DB.prepare(
        `UPDATE stripe_webhook_events
         SET status = 'processing',
             order_id = COALESCE(?2, order_id),
             related_object_id = ?3,
             payload_json = ?4,
             processing_started_at = CURRENT_TIMESTAMP,
             last_delivery_at = CURRENT_TIMESTAMP,
             delivery_count = COALESCE(delivery_count, 1) + 1,
             last_error = '',
             processed_at = NULL
         WHERE id = ?1`
      )
        .bind(event.id, cleanNullableText(orderId), relatedObjectId, payloadJson)
        .run();

      if ((retry?.meta?.changes || 0) === 0) {
        return { duplicate: true, inProgress: true };
      }

      recovered = true;
      recoveryOrderId = orderId || cleanText(existing.order_id);
      console.warn("Retrying previously failed Stripe webhook event.", {
        eventId: event.id,
        eventType,
        orderId: recoveryOrderId || "",
      });
    }
  }

  if (recovered && recoveryOrderId) {
    await logOrderEvent(env, recoveryOrderId, "webhook_processing_recovered", {
      eventId: event.id,
      eventType,
    }, "stripe_webhook");
  }

  try {
    if (eventType === "checkout.session.completed" && payload.payment_status === "paid") {
      await processSuccessfulCheckoutSession(env, payload);
    } else if (eventType === "checkout.session.expired") {
      await processExpiredCheckoutSession(env, payload);
    } else if (eventType === "payment_intent.payment_failed") {
      await processFailedPaymentIntent(env, payload);
    }

    await env.DB.prepare(
      `UPDATE stripe_webhook_events
       SET status = 'processed',
           processed_at = CURRENT_TIMESTAMP,
           last_delivery_at = CURRENT_TIMESTAMP,
           last_error = ''
       WHERE id = ?1`
    )
      .bind(event.id)
      .run();

    return { duplicate: false };
  } catch (error) {
    await env.DB.prepare(
      `UPDATE stripe_webhook_events
       SET status = 'failed',
           last_delivery_at = CURRENT_TIMESTAMP,
           last_error = ?2
       WHERE id = ?1`
    )
      .bind(event.id, cleanText(error.message))
      .run();
    throw error;
  }
}

function mapPaymentSessionSummary(row) {
  if (!row?.latest_payment_session_id) return null;
  return {
    id: row.latest_payment_session_id,
    phase: row.latest_payment_phase,
    status: row.latest_payment_status,
    url: row.latest_payment_url || "",
    createdAt: row.latest_payment_created_at,
  };
}

function mapOrderEventRow(row) {
  return {
    id: row.id,
    type: row.event_type,
    source: row.source,
    payload: parseJson(row.payload_json, {}),
    createdAt: row.created_at,
  };
}

function mapWebhookEventRow(row) {
  return {
    id: row.id,
    type: row.event_type,
    status: row.status,
    relatedObjectId: row.related_object_id || "",
    lastError: row.last_error || "",
    receivedAt: row.received_at || null,
    processingStartedAt: row.processing_started_at || null,
    lastDeliveryAt: row.last_delivery_at || null,
    deliveryCount: parseInt(row.delivery_count, 10) || 1,
    processedAt: row.processed_at || null,
  };
}

function mapQuoteRow(row, paymentSessions = []) {
  const orderSummary = row.order_id ? {
    id: row.order_id,
    status: row.order_status,
    paymentStatus: row.order_payment_status,
    totalCents: toCents(row.order_total_cents),
    amountPaidCents: toCents(row.order_amount_paid_cents),
    balanceDueCents: toCents(row.order_balance_due_cents),
    latestPaymentSession: mapPaymentSessionSummary(row),
    paymentSessions,
    updatedAt: row.order_updated_at,
  } : null;

  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    status: row.status,
    paymentMode: row.payment_mode,
    subtotalCents: toCents(row.subtotal_cents),
    depositCents: toCents(row.deposit_cents),
    balanceDueCents: toCents(row.balance_due_cents),
    requestSnapshot: parseJson(row.request_snapshot_json, {}),
    configSnapshot: normalizeQuoteConfigSnapshot(parseJson(row.config_snapshot_json, {})),
    adminNotes: row.admin_notes || "",
    orderSummary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrderRow(row, paymentSessions = []) {
  return {
    id: row.id,
    quoteId: row.quote_id || null,
    orderType: row.order_type,
    customerName: row.customer_name || "",
    customerEmail: row.customer_email || "",
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMode: row.payment_mode || "full_payment",
    totalCents: toCents(row.total_cents),
    amountPaidCents: toCents(row.amount_paid_cents),
    depositCents: toCents(row.deposit_cents),
    balanceDueCents: toCents(row.balance_due_cents),
    stripeCheckoutSessionId: row.stripe_checkout_session_id || "",
    stripePaymentIntentId: row.stripe_payment_intent_id || "",
    stripeCustomerId: row.stripe_customer_id || "",
    orderItem: parseJson(row.order_item_json, {}),
    buildSnapshot: normalizeQuoteConfigSnapshot(parseJson(row.build_snapshot_json, {})),
    quoteStatus: row.quote_status || null,
    latestPaymentSession: mapPaymentSessionSummary(row),
    paymentSessions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPaymentAt: row.last_payment_at || null,
  };
}

async function getOrderDetail(env, orderId) {
  const orderResult = await env.DB.prepare(
    `SELECT o.*,
            q.status AS quote_status,
            latest.id AS latest_payment_session_id,
            latest.payment_phase AS latest_payment_phase,
            latest.status AS latest_payment_status,
            latest.stripe_checkout_url AS latest_payment_url,
            latest.created_at AS latest_payment_created_at
     FROM orders o
     LEFT JOIN quotes q ON q.id = o.quote_id
     LEFT JOIN order_payment_sessions latest
       ON latest.id = (
         SELECT ops.id
         FROM order_payment_sessions ops
         WHERE ops.order_id = o.id
         ORDER BY ops.created_at DESC
         LIMIT 1
       )
     WHERE o.id = ?1
     LIMIT 1`
  )
    .bind(orderId)
    .first();

  if (!orderResult) return null;

  const [paymentSessions, orderEventsResult, webhookEventsResult, quoteResult] = await Promise.all([
    listPaymentSessionsForOrder(env, orderId),
    env.DB.prepare(
      `SELECT id, event_type, source, payload_json, created_at
       FROM order_events
       WHERE order_id = ?1
       ORDER BY created_at DESC`
    ).bind(orderId).all(),
    env.DB.prepare(
      `SELECT id,
              event_type,
              status,
              related_object_id,
              last_error,
              received_at,
              processing_started_at,
              last_delivery_at,
              delivery_count,
              processed_at
       FROM stripe_webhook_events
       WHERE order_id = ?1
       ORDER BY COALESCE(processed_at, last_delivery_at, received_at) DESC`
    ).bind(orderId).all(),
    orderResult.quote_id
      ? env.DB.prepare(
        `SELECT id, status, payment_mode, subtotal_cents, deposit_cents, balance_due_cents, updated_at
         FROM quotes
         WHERE id = ?1
         LIMIT 1`
      ).bind(orderResult.quote_id).first()
      : Promise.resolve(null),
  ]);

  return {
    order: mapOrderRow(orderResult, paymentSessions),
    quote: quoteResult
      ? {
        id: quoteResult.id,
        status: quoteResult.status,
        paymentMode: quoteResult.payment_mode,
        subtotalCents: toCents(quoteResult.subtotal_cents),
        depositCents: toCents(quoteResult.deposit_cents),
        balanceDueCents: toCents(quoteResult.balance_due_cents),
        updatedAt: quoteResult.updated_at,
      }
      : null,
    orderEvents: (orderEventsResult?.results || []).map(mapOrderEventRow),
    webhookEvents: (webhookEventsResult?.results || []).map(mapWebhookEventRow),
  };
}

async function listQuotesWithOrders(env) {
  const result = await env.DB.prepare(
    `SELECT q.*,
            o.id AS order_id,
            o.status AS order_status,
            o.payment_status AS order_payment_status,
            o.total_cents AS order_total_cents,
            o.amount_paid_cents AS order_amount_paid_cents,
            o.balance_due_cents AS order_balance_due_cents,
            o.updated_at AS order_updated_at,
            latest.id AS latest_payment_session_id,
            latest.payment_phase AS latest_payment_phase,
            latest.status AS latest_payment_status,
            latest.stripe_checkout_url AS latest_payment_url,
            latest.created_at AS latest_payment_created_at
     FROM quotes q
     LEFT JOIN orders o ON o.quote_id = q.id
     LEFT JOIN order_payment_sessions latest
       ON latest.id = (
         SELECT ops.id
         FROM order_payment_sessions ops
         WHERE ops.order_id = o.id
         ORDER BY ops.created_at DESC
         LIMIT 1
       )
     ORDER BY q.updated_at DESC`
  ).all();

  return Promise.all((result?.results || []).map(async (row) => {
    const paymentSessions = row.order_id
      ? await listPaymentSessionsForOrder(env, row.order_id)
      : [];
    return mapQuoteRow(row, paymentSessions);
  }));
}

async function listOrders(env) {
  const result = await env.DB.prepare(
    `SELECT o.*,
            q.status AS quote_status,
            latest.id AS latest_payment_session_id,
            latest.payment_phase AS latest_payment_phase,
            latest.status AS latest_payment_status,
            latest.stripe_checkout_url AS latest_payment_url,
            latest.created_at AS latest_payment_created_at
     FROM orders o
     LEFT JOIN quotes q ON q.id = o.quote_id
     LEFT JOIN order_payment_sessions latest
       ON latest.id = (
         SELECT ops.id
         FROM order_payment_sessions ops
         WHERE ops.order_id = o.id
         ORDER BY ops.created_at DESC
         LIMIT 1
       )
     ORDER BY o.updated_at DESC`
  ).all();

  return Promise.all((result?.results || []).map(async (row) => {
    const paymentSessions = await listPaymentSessionsForOrder(env, row.id);
    return mapOrderRow(row, paymentSessions);
  }));
}

export {
  createBalancePaymentLink,
  createCatalogOrder,
  createPaymentLinkForOrder,
  createQuoteInitialPaymentLink,
  deriveOrderLifecycle,
  deriveQuoteStatusFromOrder,
  getOrderDetail,
  getOrderForQuote,
  getOrderRow,
  getQuoteRow,
  listOrders,
  listQuotesWithOrders,
  logOrderEvent,
  normalizeQuoteConfigSnapshot,
  processStripeWebhookEvent,
  toCents,
  updateQuoteReview,
};
