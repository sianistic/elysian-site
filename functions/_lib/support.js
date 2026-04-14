import { createNotifier } from "./notifications.js";

const TICKET_STATUS_ALIASES = {
  open: "new",
  in_progress: "triaged",
};

const TICKET_STATUS_TRANSITIONS = {
  new: ["new", "triaged", "waiting_on_customer", "resolved", "closed"],
  triaged: ["triaged", "waiting_on_customer", "resolved", "closed"],
  waiting_on_customer: ["waiting_on_customer", "triaged", "resolved", "closed"],
  resolved: ["resolved", "triaged", "closed"],
  closed: ["closed", "triaged"],
};

const TICKET_STATUS_LABELS = {
  new: "New",
  triaged: "Triaged",
  waiting_on_customer: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
};

const TICKET_CATEGORIES = new Set([
  "Technical Support",
  "Order Inquiry",
  "Shipping & Delivery",
  "Warranty Claim",
  "Returns & Refunds",
  "Other",
]);

function cleanText(value) {
  return String(value || "").trim();
}

function cleanNullableText(value) {
  const text = cleanText(value);
  return text || null;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTicketStatus(value, fallback = "new") {
  const status = TICKET_STATUS_ALIASES[cleanText(value).toLowerCase()] || cleanText(value).toLowerCase();
  if (status === "new") return "new";
  if (status === "triaged") return "triaged";
  if (status === "waiting_on_customer") return "waiting_on_customer";
  if (status === "resolved") return "resolved";
  if (status === "closed") return "closed";
  return fallback;
}

function normalizeTicketPriority(value, fallback = "medium") {
  const priority = cleanText(value).toLowerCase();
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  if (priority === "medium") return "medium";
  return fallback;
}

function normalizeTicketCategory(value) {
  return TICKET_CATEGORIES.has(value) ? value : "Other";
}

function formatTicketStatusLabel(value) {
  const key = normalizeTicketStatus(value, "");
  return TICKET_STATUS_LABELS[key] || cleanText(value).replace(/_/g, " ") || "Unknown";
}

function isAllowedTicketTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  const allowed = TICKET_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

async function resolveSupportReference(env, rawReference) {
  const submittedReference = cleanText(rawReference);
  if (!submittedReference) {
    return {
      submittedReference: "",
      orderId: null,
      quoteId: null,
      referenceType: "none",
    };
  }

  const order = await env.DB.prepare(
    `SELECT id, quote_id
     FROM orders
     WHERE id = ?1
     LIMIT 1`
  ).bind(submittedReference).first();

  if (order) {
    return {
      submittedReference,
      orderId: order.id,
      quoteId: order.quote_id || null,
      referenceType: "order",
    };
  }

  const quote = await env.DB.prepare(
    `SELECT q.id,
            o.id AS order_id
     FROM quotes q
     LEFT JOIN orders o ON o.quote_id = q.id
     WHERE q.id = ?1
     LIMIT 1`
  ).bind(submittedReference).first();

  if (quote) {
    return {
      submittedReference,
      orderId: quote.order_id || null,
      quoteId: quote.id,
      referenceType: "quote",
    };
  }

  return {
    submittedReference,
    orderId: null,
    quoteId: null,
    referenceType: "unmatched",
  };
}

async function insertTicketMessage(env, ticketId, input) {
  const metadata = JSON.stringify(input.metadata || {});
  await env.DB.prepare(
    `INSERT INTO support_ticket_messages
      (id, ticket_id, author_type, author_name, message_kind, message, is_internal, metadata_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(
    crypto.randomUUID(),
    ticketId,
    cleanText(input.authorType || "system") || "system",
    cleanText(input.authorName || ""),
    cleanText(input.messageKind || "system_event") || "system_event",
    cleanText(input.message || ""),
    input.isInternal ? 1 : 0,
    metadata
  ).run();
}

async function insertSystemEvent(env, ticketId, message, metadata = {}) {
  await insertTicketMessage(env, ticketId, {
    authorType: "system",
    authorName: "System",
    messageKind: "system_event",
    message,
    isInternal: true,
    metadata,
  });
}

function mapTicketRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    orderId: row.order_id || "",
    quoteId: row.quote_id || "",
    submittedReference: row.submitted_reference || "",
    category: row.category,
    priority: row.priority,
    status: normalizeTicketStatus(row.status),
    statusLabel: formatTicketStatusLabel(row.status),
    subject: row.subject,
    latestMessagePreview: row.latest_message_preview || "",
    latestCustomerMessagePreview: row.latest_customer_message || "",
    latestAdminReplyPreview: row.latest_admin_reply || "",
    latestInternalNotePreview: row.latest_internal_note || "",
    assignedAdmin: row.assigned_admin || "",
    assignedAt: row.assigned_at || null,
    firstTriagedAt: row.first_triaged_at || null,
    lastCustomerMessageAt: row.last_customer_message_at || null,
    lastInternalNoteAt: row.last_internal_note_at || null,
    lastPublicReplyAt: row.last_public_reply_at || null,
    resolvedAt: row.resolved_at || null,
    closedAt: row.closed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: parseInt(row.message_count, 10) || 0,
    orderSummary: row.order_id ? {
      id: row.order_id,
      status: row.order_status || "",
      paymentStatus: row.order_payment_status || "",
    } : null,
    quoteSummary: row.quote_id ? {
      id: row.quote_id,
      status: row.quote_status || "",
      paymentMode: row.quote_payment_mode || "",
    } : null,
  };
}

function mapTicketMessageRow(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorType: row.author_type,
    authorName: row.author_name || "",
    messageKind: row.message_kind || (row.is_internal ? "internal_note" : "customer_message"),
    message: row.message || "",
    isInternal: Boolean(row.is_internal),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
  };
}

async function createSupportTicket(env, input = {}) {
  const requesterName = cleanText(input.name);
  const requesterEmail = cleanText(input.email).toLowerCase();
  const submittedReference = cleanText(input.reference || input.orderId);
  const category = normalizeTicketCategory(input.category);
  const priority = normalizeTicketPriority(input.priority);
  const subject = cleanText(input.subject);
  const message = cleanText(input.message);

  if (!requesterName || !requesterEmail || !subject || !message) {
    throw new Error("Missing required support fields.");
  }

  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(requesterEmail)) {
    throw new Error("A valid support email address is required.");
  }

  const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
  const referenceMatch = await resolveSupportReference(env, submittedReference);

  await env.DB.prepare(
    `INSERT INTO support_tickets
      (id, requester_name, requester_email, order_id, quote_id, submitted_reference, category, priority, status, subject, latest_message_preview, last_customer_message_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'new', ?9, ?10, CURRENT_TIMESTAMP)`
  ).bind(
    ticketId,
    requesterName,
    requesterEmail,
    cleanNullableText(referenceMatch.orderId),
    cleanNullableText(referenceMatch.quoteId),
    referenceMatch.submittedReference,
    category,
    priority,
    subject,
    message.slice(0, 180)
  ).run();

  await insertTicketMessage(env, ticketId, {
    authorType: "customer",
    authorName: requesterName,
    messageKind: "customer_message",
    message,
    isInternal: false,
    metadata: {
      source: "public_support_form",
      submittedReference: referenceMatch.submittedReference,
      referenceType: referenceMatch.referenceType,
    },
  });

  const notifier = createNotifier(env);
  let notification = {
    delivered: false,
    provider: "noop",
    reason: "not_attempted",
  };
  try {
    notification = await notifier.send({
      template: "support-ticket-created",
      to: requesterEmail,
      subject: `Elysian support ticket ${ticketId} received`,
      data: {
        ticketId,
        requesterName,
        subject,
        category,
        priority,
        submittedReference: referenceMatch.submittedReference,
      },
    });
  } catch (error) {
    notification = {
      delivered: false,
      provider: "notification-error",
      reason: error.message || "notification_send_failed",
    };
    console.error("Support ticket acknowledgement failed:", error);
  }

  return {
    ticketId,
    status: "new",
    referenceType: referenceMatch.referenceType,
    notification,
  };
}

async function listSupportTickets(env) {
  const result = await env.DB.prepare(
    `SELECT t.*,
            COUNT(m.id) AS message_count,
            o.status AS order_status,
            o.payment_status AS order_payment_status,
            q.status AS quote_status,
            q.payment_mode AS quote_payment_mode,
            (
              SELECT sm.message
              FROM support_ticket_messages sm
              WHERE sm.ticket_id = t.id
                AND sm.message_kind = 'customer_message'
              ORDER BY sm.created_at DESC
              LIMIT 1
            ) AS latest_customer_message,
            (
              SELECT sm.message
              FROM support_ticket_messages sm
              WHERE sm.ticket_id = t.id
                AND sm.message_kind = 'admin_reply'
              ORDER BY sm.created_at DESC
              LIMIT 1
            ) AS latest_admin_reply,
            (
              SELECT sm.message
              FROM support_ticket_messages sm
              WHERE sm.ticket_id = t.id
                AND sm.message_kind = 'internal_note'
              ORDER BY sm.created_at DESC
              LIMIT 1
            ) AS latest_internal_note
     FROM support_tickets t
     LEFT JOIN support_ticket_messages m ON m.ticket_id = t.id
     LEFT JOIN orders o ON o.id = t.order_id
     LEFT JOIN quotes q ON q.id = t.quote_id
     GROUP BY t.id
     ORDER BY
       CASE t.status
         WHEN 'new' THEN 0
         WHEN 'triaged' THEN 1
         WHEN 'waiting_on_customer' THEN 2
         WHEN 'resolved' THEN 3
         ELSE 4
       END,
       CASE t.priority
         WHEN 'high' THEN 0
         WHEN 'medium' THEN 1
         ELSE 2
       END,
       COALESCE(t.last_customer_message_at, t.updated_at) DESC`
  ).all();

  return (result.results || []).map(mapTicketRow);
}

async function getSupportTicketDetail(env, ticketId) {
  const row = await env.DB.prepare(
    `SELECT t.*,
            COUNT(m.id) AS message_count,
            o.status AS order_status,
            o.payment_status AS order_payment_status,
            q.status AS quote_status,
            q.payment_mode AS quote_payment_mode,
            (
              SELECT sm.message
              FROM support_ticket_messages sm
              WHERE sm.ticket_id = t.id
                AND sm.message_kind = 'customer_message'
              ORDER BY sm.created_at DESC
              LIMIT 1
            ) AS latest_customer_message,
            (
              SELECT sm.message
              FROM support_ticket_messages sm
              WHERE sm.ticket_id = t.id
                AND sm.message_kind = 'admin_reply'
              ORDER BY sm.created_at DESC
              LIMIT 1
            ) AS latest_admin_reply,
            (
              SELECT sm.message
              FROM support_ticket_messages sm
              WHERE sm.ticket_id = t.id
                AND sm.message_kind = 'internal_note'
              ORDER BY sm.created_at DESC
              LIMIT 1
            ) AS latest_internal_note
     FROM support_tickets t
     LEFT JOIN support_ticket_messages m ON m.ticket_id = t.id
     LEFT JOIN orders o ON o.id = t.order_id
     LEFT JOIN quotes q ON q.id = t.quote_id
     WHERE t.id = ?1
     GROUP BY t.id`
  ).bind(ticketId).first();

  if (!row) return null;

  const messagesResult = await env.DB.prepare(
    `SELECT id,
            ticket_id,
            author_type,
            author_name,
            message_kind,
            message,
            is_internal,
            metadata_json,
            created_at
     FROM support_ticket_messages
     WHERE ticket_id = ?1
     ORDER BY created_at ASC`
  ).bind(ticketId).all();

  return {
    ticket: mapTicketRow(row),
    messages: (messagesResult.results || []).map(mapTicketMessageRow),
  };
}

async function updateSupportTicket(env, input = {}) {
  const ticketId = cleanText(input.ticketId);
  if (!ticketId) {
    throw new Error("ticketId is required.");
  }

  const current = await env.DB.prepare(
    `SELECT *
     FROM support_tickets
     WHERE id = ?1`
  ).bind(ticketId).first();

  if (!current) {
    throw new Error("Ticket not found.");
  }

  const currentStatus = normalizeTicketStatus(current.status, "new");
  const nextStatus = normalizeTicketStatus(input.status, currentStatus);
  if (!isAllowedTicketTransition(currentStatus, nextStatus)) {
    throw new Error(`Cannot move a ticket from ${formatTicketStatusLabel(currentStatus)} to ${formatTicketStatusLabel(nextStatus)}.`);
  }

  const priority = normalizeTicketPriority(input.priority, current.priority || "medium");
  const internalNote = cleanText(input.internalNote);
  const customerReply = cleanText(input.customerReply);
  if (customerReply && nextStatus === "closed") {
    throw new Error("Closed tickets cannot send a customer-visible reply. Reopen or resolve the ticket first.");
  }
  let assignedAdmin = cleanText(input.assignedAdmin || current.assigned_admin || "");
  if (!assignedAdmin && (nextStatus !== "new" || internalNote || customerReply)) {
    assignedAdmin = "Primary Admin";
  }

  const now = new Date().toISOString();
  const assignedAt = assignedAdmin
    ? (current.assigned_at || now)
    : null;
  const firstTriagedAt = nextStatus !== "new"
    ? (current.first_triaged_at || now)
    : null;
  const lastInternalNoteAt = internalNote ? now : (current.last_internal_note_at || null);
  const lastPublicReplyAt = customerReply ? now : (current.last_public_reply_at || null);
  const resolvedAt = (nextStatus === "resolved" || nextStatus === "closed")
    ? (current.resolved_at || now)
    : null;
  const closedAt = nextStatus === "closed"
    ? (current.closed_at || now)
    : null;
  const latestPreview = customerReply
    ? customerReply.slice(0, 180)
    : (current.latest_message_preview || "");

  await env.DB.prepare(
    `UPDATE support_tickets
     SET status = ?2,
         priority = ?3,
         assigned_admin = ?4,
         assigned_at = ?5,
         first_triaged_at = ?6,
         last_internal_note_at = ?7,
         last_public_reply_at = ?8,
         resolved_at = ?9,
         closed_at = ?10,
         latest_message_preview = ?11,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  ).bind(
    ticketId,
    nextStatus,
    priority,
    cleanNullableText(assignedAdmin),
    assignedAt,
    firstTriagedAt,
    lastInternalNoteAt,
    lastPublicReplyAt,
    resolvedAt,
    closedAt,
    latestPreview
  ).run();

  if (currentStatus !== nextStatus) {
    await insertSystemEvent(
      env,
      ticketId,
      `Status changed from ${formatTicketStatusLabel(currentStatus)} to ${formatTicketStatusLabel(nextStatus)}.`,
      { fromStatus: currentStatus, toStatus: nextStatus }
    );
  }

  const previousAssignee = cleanText(current.assigned_admin || "");
  if (previousAssignee !== assignedAdmin) {
    await insertSystemEvent(
      env,
      ticketId,
      assignedAdmin
        ? `Ticket assigned to ${assignedAdmin}.`
        : "Ticket assignment cleared.",
      { fromAssignedAdmin: previousAssignee, toAssignedAdmin: assignedAdmin || "" }
    );
  }

  if (internalNote) {
    await insertTicketMessage(env, ticketId, {
      authorType: "admin",
      authorName: assignedAdmin || "Primary Admin",
      messageKind: "internal_note",
      message: internalNote,
      isInternal: true,
    });
  }

  if (customerReply) {
    const notifier = createNotifier(env);
    let notification = {
      delivered: false,
      provider: "noop",
      reason: "not_attempted",
    };
    try {
      notification = await notifier.send({
        template: "support-ticket-reply",
        to: current.requester_email,
        subject: `Elysian support update for ${ticketId}`,
        data: {
          ticketId,
          requesterName: current.requester_name,
          subject: current.subject,
          reply: customerReply,
          assignedAdmin: assignedAdmin || "Primary Admin",
        },
      });
    } catch (error) {
      notification = {
        delivered: false,
        provider: "notification-error",
        reason: error.message || "notification_send_failed",
      };
      console.error("Support ticket reply notification failed:", error);
    }

    await insertTicketMessage(env, ticketId, {
      authorType: "admin",
      authorName: assignedAdmin || "Primary Admin",
      messageKind: "admin_reply",
      message: customerReply,
      isInternal: false,
      metadata: {
        notification,
        linkedOrderId: current.order_id || "",
        linkedQuoteId: current.quote_id || "",
      },
    });
  }

  return getSupportTicketDetail(env, ticketId);
}

export {
  createSupportTicket,
  formatTicketStatusLabel,
  getSupportTicketDetail,
  isAllowedTicketTransition,
  listSupportTickets,
  normalizeTicketCategory,
  normalizeTicketPriority,
  normalizeTicketStatus,
  resolveSupportReference,
  updateSupportTicket,
};
