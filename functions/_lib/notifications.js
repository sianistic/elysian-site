function cleanText(value) {
  return String(value || "").trim();
}

function cleanNullableText(value) {
  const text = cleanText(value);
  return text || null;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitRecipients(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMoney(value) {
  const cents = parseInt(value, 10) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatPaymentPhase(value) {
  if (value === "deposit") return "deposit";
  if (value === "balance") return "balance";
  return "full payment";
}

function buildEmailTemplate(template, data = {}) {
  const siteUrl = cleanText(data.siteUrl);
  const siteLabel = siteUrl || "the Elysian site";

  switch (template) {
    case "support-ticket-created":
      return {
        subject: `Elysian support ticket ${data.ticketId} received`,
        text: [
          `Hi ${cleanText(data.requesterName) || "there"},`,
          "",
          `We received your support request and created ticket ${data.ticketId}.`,
          `Subject: ${cleanText(data.subject) || "Support request"}`,
          `Category: ${cleanText(data.category) || "Other"}`,
          cleanText(data.submittedReference)
            ? `Reference: ${cleanText(data.submittedReference)}`
            : "",
          "",
          "Our team will review the request and follow up using this email address.",
          cleanText(siteUrl) ? `Site: ${siteLabel}` : "",
        ].filter(Boolean).join("\n"),
        html: `
          <p>Hi ${escapeHtml(data.requesterName || "there")},</p>
          <p>We received your support request and created ticket <strong>${escapeHtml(data.ticketId || "")}</strong>.</p>
          <p><strong>Subject:</strong> ${escapeHtml(data.subject || "Support request")}<br>
          <strong>Category:</strong> ${escapeHtml(data.category || "Other")}${cleanText(data.submittedReference) ? `<br><strong>Reference:</strong> ${escapeHtml(data.submittedReference)}` : ""}</p>
          <p>Our team will review the request and follow up using this email address.</p>
          ${cleanText(siteUrl) ? `<p><a href="${escapeHtml(siteUrl)}">${escapeHtml(siteLabel)}</a></p>` : ""}
        `,
      };
    case "support-ticket-reply":
      return {
        subject: `Elysian support update for ${data.ticketId}`,
        text: [
          `Hi ${cleanText(data.requesterName) || "there"},`,
          "",
          `There is a new update on support ticket ${data.ticketId}.`,
          "",
          cleanText(data.reply),
          "",
          cleanText(data.assignedAdmin) ? `Handled by: ${cleanText(data.assignedAdmin)}` : "",
          cleanText(siteUrl) ? `Site: ${siteLabel}` : "",
        ].filter(Boolean).join("\n"),
        html: `
          <p>Hi ${escapeHtml(data.requesterName || "there")},</p>
          <p>There is a new update on support ticket <strong>${escapeHtml(data.ticketId || "")}</strong>.</p>
          <blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #d4a843;background:#f8f3e7;color:#2b2110;white-space:pre-wrap;">${escapeHtml(data.reply || "")}</blockquote>
          ${cleanText(data.assignedAdmin) ? `<p><strong>Handled by:</strong> ${escapeHtml(data.assignedAdmin)}</p>` : ""}
          ${cleanText(siteUrl) ? `<p><a href="${escapeHtml(siteUrl)}">${escapeHtml(siteLabel)}</a></p>` : ""}
        `,
      };
    case "quote-request-created":
      return {
        subject: `Elysian quote request ${data.quoteId} received`,
        text: [
          `Hi ${cleanText(data.customerName) || "there"},`,
          "",
          `We recorded your custom quote request as ${data.quoteId}.`,
          cleanText(data.budget) ? `Budget: ${cleanText(data.budget)}` : "",
          cleanText(data.useCase) ? `Use case: ${cleanText(data.useCase)}` : "",
          cleanText(data.timeframe) ? `Timeframe: ${cleanText(data.timeframe)}` : "",
          "",
          "An Elysian reviewer will turn your requirements into a real configuration before any payment is requested.",
          cleanText(siteUrl) ? `Site: ${siteLabel}` : "",
        ].filter(Boolean).join("\n"),
        html: `
          <p>Hi ${escapeHtml(data.customerName || "there")},</p>
          <p>We recorded your custom quote request as <strong>${escapeHtml(data.quoteId || "")}</strong>.</p>
          <p>
            ${cleanText(data.budget) ? `<strong>Budget:</strong> ${escapeHtml(data.budget)}<br>` : ""}
            ${cleanText(data.useCase) ? `<strong>Use case:</strong> ${escapeHtml(data.useCase)}<br>` : ""}
            ${cleanText(data.timeframe) ? `<strong>Timeframe:</strong> ${escapeHtml(data.timeframe)}` : ""}
          </p>
          <p>An Elysian reviewer will turn your requirements into a real configuration before any payment is requested.</p>
          ${cleanText(siteUrl) ? `<p><a href="${escapeHtml(siteUrl)}">${escapeHtml(siteLabel)}</a></p>` : ""}
        `,
      };
    case "quote-payment-link-created":
      return {
        subject: `Elysian payment link ready for ${data.quoteId || data.orderId}`,
        text: [
          `Hi ${cleanText(data.customerName) || "there"},`,
          "",
          `Your ${formatPaymentPhase(data.paymentPhase)} for ${data.quoteId || data.orderId} is ready.`,
          `Amount due: ${formatMoney(data.amountCents)}`,
          cleanText(data.paymentUrl) ? `Payment link: ${cleanText(data.paymentUrl)}` : "",
          "",
          "This link was generated after review from the Elysian admin team.",
        ].filter(Boolean).join("\n"),
        html: `
          <p>Hi ${escapeHtml(data.customerName || "there")},</p>
          <p>Your <strong>${escapeHtml(formatPaymentPhase(data.paymentPhase))}</strong> for <strong>${escapeHtml(data.quoteId || data.orderId || "")}</strong> is ready.</p>
          <p><strong>Amount due:</strong> ${escapeHtml(formatMoney(data.amountCents))}</p>
          ${cleanText(data.paymentUrl) ? `<p><a href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;padding:10px 16px;background:#d4a843;color:#111;border-radius:999px;text-decoration:none;font-weight:700;">Open Payment Link</a></p>` : ""}
          <p>This link was generated after review from the Elysian admin team.</p>
        `,
      };
    case "payment-confirmed":
      return {
        subject: `Elysian payment confirmed for ${data.orderId}`,
        text: [
          `Hi ${cleanText(data.customerName) || "there"},`,
          "",
          `We confirmed your ${formatPaymentPhase(data.paymentPhase)} for ${data.orderId}.`,
          `Amount received: ${formatMoney(data.amountCents)}`,
          cleanText(data.remainingBalanceCents) ? `Remaining balance: ${formatMoney(data.remainingBalanceCents)}` : "",
          cleanText(data.remainingBalanceCents) ? "We will contact you when the next payment step is ready." : "Your order is now marked as paid.",
        ].filter(Boolean).join("\n"),
        html: `
          <p>Hi ${escapeHtml(data.customerName || "there")},</p>
          <p>We confirmed your <strong>${escapeHtml(formatPaymentPhase(data.paymentPhase))}</strong> for <strong>${escapeHtml(data.orderId || "")}</strong>.</p>
          <p><strong>Amount received:</strong> ${escapeHtml(formatMoney(data.amountCents))}</p>
          ${parseInt(data.remainingBalanceCents, 10) > 0
            ? `<p><strong>Remaining balance:</strong> ${escapeHtml(formatMoney(data.remainingBalanceCents))}<br>We will contact you when the next payment step is ready.</p>`
            : `<p>Your order is now marked as paid.</p>`}
        `,
      };
    default:
      return {
        subject: cleanText(data.subject) || "Elysian notification",
        text: cleanText(data.message) || "There is an update from Elysian.",
        html: `<p>${escapeHtml(data.message || "There is an update from Elysian.")}</p>`,
      };
  }
}

async function recordNotificationEvent(env, input) {
  if (!env?.DB) return null;

  try {
    await env.DB.prepare(
      `INSERT INTO notification_events
        (id, event_type, entity_type, entity_id, template, channel, audience, recipient, status, provider,
         response_id, error_message, payload_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
    )
      .bind(
        crypto.randomUUID(),
        cleanText(input.eventType || "notification"),
        cleanText(input.entityType || ""),
        cleanText(input.entityId || ""),
        cleanText(input.template || ""),
        cleanText(input.channel || ""),
        cleanText(input.audience || ""),
        cleanText(input.recipient || ""),
        cleanText(input.status || "failed"),
        cleanText(input.provider || ""),
        cleanText(input.responseId || ""),
        cleanText(input.errorMessage || ""),
        JSON.stringify(input.payload || {})
      )
      .run();
  } catch (error) {
    console.warn("Notification event could not be persisted", {
      eventType: input.eventType,
      reason: error.message || "notification_event_insert_failed",
    });
    return null;
  }

  return true;
}

async function postJson(url, options) {
  const response = await fetch(url, {
    method: "POST",
    ...options,
  });

  let rawBody = "";
  try {
    rawBody = await response.text();
  } catch {
    rawBody = "";
  }

  let body = rawBody;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = rawBody;
  }

  return { response, body };
}

async function sendResendEmail(env, payload) {
  const recipient = cleanText(payload.to);
  if (!recipient) {
    const result = {
      delivered: false,
      provider: "resend",
      channel: "email",
      reason: "missing_recipient",
    };
    await recordNotificationEvent(env, {
      ...payload,
      recipient,
      status: "failed",
      provider: result.provider,
      channel: result.channel,
      errorMessage: result.reason,
    });
    return result;
  }

  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM_EMAIL) {
    const result = {
      delivered: false,
      provider: "resend",
      channel: "email",
      reason: "missing_email_configuration",
    };
    console.warn("Email notification skipped", {
      eventType: payload.eventType,
      recipient,
      reason: result.reason,
    });
    await recordNotificationEvent(env, {
      ...payload,
      recipient,
      status: "failed",
      provider: result.provider,
      channel: result.channel,
      errorMessage: result.reason,
    });
    return result;
  }

  try {
    const { response, body } = await postJson("https://api.resend.com/emails", {
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.NOTIFY_FROM_EMAIL,
        to: [recipient],
        subject: cleanText(payload.subject || "Elysian notification"),
        html: payload.html,
        text: payload.text,
        ...(cleanNullableText(env.NOTIFY_REPLY_TO_EMAIL)
          ? { reply_to: cleanNullableText(env.NOTIFY_REPLY_TO_EMAIL) }
          : {}),
      }),
    });

    if (!response.ok) {
      const message = cleanText(body?.message || body?.error || response.statusText || "resend_request_failed");
      throw new Error(message);
    }

    const result = {
      delivered: true,
      provider: "resend",
      channel: "email",
      responseId: cleanText(body?.id),
      reason: null,
    };

    console.info("Notification email delivered", {
      eventType: payload.eventType,
      recipient,
      provider: result.provider,
      responseId: result.responseId,
    });

    await recordNotificationEvent(env, {
      ...payload,
      recipient,
      status: "delivered",
      provider: result.provider,
      channel: result.channel,
      responseId: result.responseId,
    });

    return result;
  } catch (error) {
    const result = {
      delivered: false,
      provider: "resend",
      channel: "email",
      reason: error.message || "resend_request_failed",
    };

    console.error("Notification email failed", {
      eventType: payload.eventType,
      recipient,
      reason: result.reason,
    });

    await recordNotificationEvent(env, {
      ...payload,
      recipient,
      status: "failed",
      provider: result.provider,
      channel: result.channel,
      errorMessage: result.reason,
    });

    return result;
  }
}

async function sendWebhookNotification(env, payload) {
  if (!env.NOTIFY_WEBHOOK_URL) {
    const result = {
      delivered: false,
      provider: "webhook",
      channel: "webhook",
      reason: "missing_webhook_configuration",
    };
    await recordNotificationEvent(env, {
      ...payload,
      recipient: cleanText(env.NOTIFY_WEBHOOK_URL),
      status: "failed",
      provider: result.provider,
      channel: result.channel,
      errorMessage: result.reason,
    });
    return result;
  }

  try {
    const { response, body } = await postJson(env.NOTIFY_WEBHOOK_URL, {
      headers: {
        "Content-Type": "application/json",
        ...(env.NOTIFY_WEBHOOK_BEARER_TOKEN
          ? { Authorization: `Bearer ${env.NOTIFY_WEBHOOK_BEARER_TOKEN}` }
          : {}),
        ...(env.NOTIFY_WEBHOOK_SECRET
          ? { "X-Elysian-Notify-Secret": env.NOTIFY_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({
        eventType: payload.eventType,
        subject: payload.subject,
        severity: payload.severity || "info",
        entityType: payload.entityType || "",
        entityId: payload.entityId || "",
        data: payload.data || {},
        sentAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const message = cleanText(body?.message || body?.error || response.statusText || "webhook_request_failed");
      throw new Error(message);
    }

    const result = {
      delivered: true,
      provider: "webhook",
      channel: "webhook",
      responseId: "",
      reason: null,
    };

    console.info("Operational webhook delivered", {
      eventType: payload.eventType,
      target: env.NOTIFY_WEBHOOK_URL,
    });

    await recordNotificationEvent(env, {
      ...payload,
      recipient: env.NOTIFY_WEBHOOK_URL,
      status: "delivered",
      provider: result.provider,
      channel: result.channel,
    });

    return result;
  } catch (error) {
    const result = {
      delivered: false,
      provider: "webhook",
      channel: "webhook",
      reason: error.message || "webhook_request_failed",
    };

    console.error("Operational webhook failed", {
      eventType: payload.eventType,
      target: env.NOTIFY_WEBHOOK_URL,
      reason: result.reason,
    });

    await recordNotificationEvent(env, {
      ...payload,
      recipient: env.NOTIFY_WEBHOOK_URL,
      status: "failed",
      provider: result.provider,
      channel: result.channel,
      errorMessage: result.reason,
    });

    return result;
  }
}

function summarizeNotificationResults(results) {
  const delivered = results.some((item) => item && item.delivered);
  const providers = results
    .map((item) => cleanText(item?.provider))
    .filter(Boolean)
    .filter((provider, index, list) => list.indexOf(provider) === index);
  const primaryFailure = results.find((item) => item && !item.delivered);

  return {
    delivered,
    provider: providers.length > 1 ? "multi" : (providers[0] || "noop"),
    channels: results,
    reason: delivered ? null : cleanText(primaryFailure?.reason || "notification_not_delivered"),
  };
}

async function listRecentNotificationEvents(env, limit = 12) {
  if (!env?.DB) return [];

  let result;
  try {
    result = await env.DB.prepare(
      `SELECT id,
              event_type,
              entity_type,
              entity_id,
              template,
              channel,
              audience,
              recipient,
              status,
              provider,
              response_id,
              error_message,
              payload_json,
              created_at
       FROM notification_events
       ORDER BY created_at DESC
       LIMIT ?1`
    )
      .bind(Math.max(1, Math.min(50, parseInt(limit, 10) || 12)))
      .all();
  } catch (error) {
    console.warn("Notification event list unavailable", {
      reason: error.message || "notification_event_query_failed",
    });
    return [];
  }

  return (result?.results || []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    template: row.template || "",
    channel: row.channel || "",
    audience: row.audience || "",
    recipient: row.recipient || "",
    status: row.status || "failed",
    provider: row.provider || "",
    responseId: row.response_id || "",
    errorMessage: row.error_message || "",
    payload: (() => {
      try {
        return JSON.parse(row.payload_json || "{}");
      } catch {
        return {};
      }
    })(),
    createdAt: row.created_at,
  }));
}

function createNotifier(env) {
  return {
    async send({ template, to, subject, data, eventType, entityType, entityId, audience = "customer" }) {
      try {
        const rendered = buildEmailTemplate(template, data || {});
        return await sendResendEmail(env, {
          eventType: cleanText(eventType || template),
          entityType: cleanText(entityType || ""),
          entityId: cleanText(entityId || ""),
          template,
          audience,
          to,
          subject: cleanText(subject || rendered.subject),
          text: rendered.text,
          html: rendered.html,
          payload: data || {},
        });
      } catch (error) {
        console.error("Notification send wrapper failed", {
          template,
          eventType,
          reason: error.message || "notification_wrapper_failed",
        });
        return {
          delivered: false,
          provider: "notification-error",
          channel: "email",
          reason: error.message || "notification_wrapper_failed",
        };
      }
    },

    async sendOperationalAlert({ eventType, subject, message, data, entityType = "", entityId = "", severity = "info" }) {
      try {
        const alertMessage = cleanText(message || "");
        const html = `
          <p>${escapeHtml(subject || "Elysian operational event")}</p>
          ${alertMessage ? `<p>${escapeHtml(alertMessage)}</p>` : ""}
          <pre style="white-space:pre-wrap;background:#111827;color:#f9fafb;padding:12px;border-radius:12px;">${escapeHtml(JSON.stringify(data || {}, null, 2))}</pre>
        `;
        const text = [cleanText(subject || "Elysian operational event"), "", alertMessage, "", JSON.stringify(data || {}, null, 2)]
          .filter(Boolean)
          .join("\n");

        const results = [];
        const recipients = splitRecipients(env.ADMIN_ALERT_EMAIL);
        for (const recipient of recipients) {
          results.push(await sendResendEmail(env, {
            eventType: cleanText(eventType || "ops.alert"),
            entityType: cleanText(entityType),
            entityId: cleanText(entityId),
            template: "ops-alert",
            audience: "internal",
            to: recipient,
            subject: cleanText(subject || "Elysian operational event"),
            text,
            html,
            payload: data || {},
          }));
        }

        if (env.NOTIFY_WEBHOOK_URL) {
          results.push(await sendWebhookNotification(env, {
            eventType: cleanText(eventType || "ops.alert"),
            entityType: cleanText(entityType),
            entityId: cleanText(entityId),
            subject: cleanText(subject || "Elysian operational event"),
            severity,
            data: data || {},
            payload: data || {},
          }));
        }

        if (!results.length) {
          const result = {
            delivered: false,
            provider: "noop",
            channel: "internal",
            reason: "missing_internal_notification_target",
          };
          console.warn("Operational alert skipped", {
            eventType,
            reason: result.reason,
          });
          await recordNotificationEvent(env, {
            eventType: cleanText(eventType || "ops.alert"),
            entityType: cleanText(entityType),
            entityId: cleanText(entityId),
            template: "ops-alert",
            audience: "internal",
            recipient: "",
            status: "failed",
            provider: result.provider,
            channel: result.channel,
            errorMessage: result.reason,
            payload: data || {},
          });
          return result;
        }

        return summarizeNotificationResults(results);
      } catch (error) {
        console.error("Operational alert wrapper failed", {
          eventType,
          reason: error.message || "ops_alert_wrapper_failed",
        });
        return {
          delivered: false,
          provider: "notification-error",
          channel: "internal",
          reason: error.message || "ops_alert_wrapper_failed",
        };
      }
    },
  };
}

export {
  createNotifier,
  listRecentNotificationEvents,
};
