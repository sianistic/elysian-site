/* ============================================================
   ELYSIAN PCS - Admin Support Logic
   ============================================================ */

var activeTicketId = null;

var TICKET_STATUS_HELP = {
  new: "Fresh intake waiting for first admin ownership.",
  triaged: "An admin owns this ticket and is actively working it.",
  waiting_on_customer: "The next meaningful step depends on customer input or confirmation.",
  resolved: "The issue is believed to be addressed and can be closed when appropriate.",
  closed: "The ticket is finished and out of the active support queue."
};

function formatTicketLabel(value) {
  var labels = {
    new: "New",
    triaged: "Triaged",
    waiting_on_customer: "Waiting on Customer",
    resolved: "Resolved",
    closed: "Closed",
    high: "High",
    medium: "Medium",
    low: "Low",
    customer_message: "Customer message",
    admin_reply: "Admin reply",
    internal_note: "Internal note",
    system_event: "System event"
  };
  var key = String(value || "");
  return labels[key] || key.replace(/_/g, " ");
}

function renderTicketPill(value) {
  return '<span class="status-pill">' + escapeAttr(formatTicketLabel(value)) + '</span>';
}

function describeNotification(metadata) {
  var notification = metadata && metadata.notification;
  if (!notification) return "";
  if (notification.delivered) {
    return "Delivery confirmed via " + (notification.provider || "configured provider");
  }
  var reason = notification.reason ? " / " + notification.reason.replace(/_/g, " ") : "";
  return "Delivery not confirmed via " + (notification.provider || "notification layer") + reason;
}

function renderTicketThread(messages) {
  if (!messages.length) {
    return '<div class="detail-empty">No messages are stored for this ticket yet.</div>';
  }

  return messages.map(function (message) {
    var isAdminOwned = message.authorType === "admin" || message.messageKind === "internal_note";
    var messageClass = isAdminOwned ? "ticket-message admin" : "ticket-message";
    var meta = [
      formatTicketLabel(message.messageKind || message.authorType),
      message.authorName || "Unknown author",
      formatDateTime(message.createdAt)
    ];
    if (message.isInternal) meta.push("Internal only");
    var notificationState = describeNotification(message.metadata || {});

    return '<div class="' + messageClass + '">'
      + '<div class="ticket-message-head">' + escapeAttr(meta.join(" / ")) + '</div>'
      + '<div class="ticket-message-body">' + escapeAttr(message.message || "") + '</div>'
      + (notificationState ? '<div class="table-meta" style="margin-top:0.5rem;">' + escapeAttr(notificationState) + '</div>' : '')
      + '</div>';
  }).join("");
}

function buildLinkedWorkSummary(ticket) {
  var items = [];
  if (ticket.quoteSummary) {
    items.push({
      label: "Quote",
      value: ticket.quoteSummary.id,
      meta: "Status " + formatStatusLabel(ticket.quoteSummary.status)
    });
  }
  if (ticket.orderSummary) {
    items.push({
      label: "Order",
      value: ticket.orderSummary.id,
      meta: formatStatusLabel(ticket.orderSummary.status) + " / " + formatStatusLabel(ticket.orderSummary.paymentStatus)
    });
  }
  if (!items.length) {
    items.push({
      label: "Linked Work",
      value: "Not linked",
      meta: ticket.submittedReference ? ("Submitted reference: " + ticket.submittedReference) : "No quote or order reference was matched."
    });
  }
  return items;
}

function fillTicketModal(detail) {
  var ticket = detail.ticket;
  activeTicketId = ticket.id;
  document.getElementById("ticket-modal-id").value = ticket.id;
  document.getElementById("ticket-detail-title").textContent = "Ticket Detail: " + ticket.id;
  document.getElementById("ticket-detail-subtitle").textContent = "Keep ownership, customer communication, and internal notes separated so the support thread stays easy to understand.";

  var summaryItems = [
    { label: "Requester", value: ticket.requesterName || "-" },
    { label: "Email", value: ticket.requesterEmail || "-" },
    { label: "Subject", value: ticket.subject || "-" },
    { label: "Queue State", value: formatTicketLabel(ticket.status), meta: TICKET_STATUS_HELP[ticket.status] || "" },
    { label: "Priority", value: formatTicketLabel(ticket.priority) },
    { label: "Owner", value: ticket.assignedAdmin || "Unassigned", meta: ticket.assignedAt ? ("Assigned " + formatDateTime(ticket.assignedAt)) : "No owner recorded yet" },
    { label: "Submitted Reference", value: ticket.submittedReference || "None provided" },
    { label: "Last Customer Message", value: ticket.lastCustomerMessageAt ? formatDateTime(ticket.lastCustomerMessageAt) : "Not recorded" },
    { label: "Last Public Reply", value: ticket.lastPublicReplyAt ? formatDateTime(ticket.lastPublicReplyAt) : "No admin reply sent yet" },
    { label: "Last Internal Note", value: ticket.lastInternalNoteAt ? formatDateTime(ticket.lastInternalNoteAt) : "No internal note yet" },
    { label: "Created", value: formatDateTime(ticket.createdAt), meta: ticket.messageCount + " total message(s)" }
  ].concat(buildLinkedWorkSummary(ticket));

  document.getElementById("ticket-detail-summary").innerHTML = renderDetailItems(summaryItems);
  document.getElementById("ticket-status").value = ticket.status || "new";
  document.getElementById("ticket-priority").value = ticket.priority || "medium";
  document.getElementById("ticket-assigned-admin").value = ticket.assignedAdmin || "Primary Admin";
  document.getElementById("ticket-internal-note").value = "";
  document.getElementById("ticket-customer-reply").value = "";
  document.getElementById("ticket-detail-thread").innerHTML = renderTicketThread(detail.messages || []);
}

async function openTicketModal(ticketId) {
  activeTicketId = ticketId;
  var modal = document.getElementById("ticket-detail-modal");
  if (!modal) return;

  document.getElementById("ticket-detail-title").textContent = "Ticket Detail";
  document.getElementById("ticket-detail-subtitle").textContent = "Loading support history...";
  document.getElementById("ticket-detail-summary").innerHTML = '<div class="detail-empty">Loading ticket summary...</div>';
  document.getElementById("ticket-detail-thread").innerHTML = '<div class="detail-empty">Loading ticket messages...</div>';
  modal.classList.add("open");

  try {
    var response = await fetch("/api/admin/tickets?ticketId=" + encodeURIComponent(ticketId), {
      credentials: "same-origin"
    });
    if (response.status === 401) {
      window.location.href = "/admin/login/";
      return;
    }
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load ticket detail.");
    fillTicketModal(data);
  } catch (error) {
    document.getElementById("ticket-detail-subtitle").textContent = error.message || "Unable to load ticket detail.";
    document.getElementById("ticket-detail-summary").innerHTML = '<div class="detail-empty">Ticket detail could not be loaded.</div>';
    document.getElementById("ticket-detail-thread").innerHTML = '<div class="detail-empty">Support history is unavailable.</div>';
  }
}

function closeTicketModal() {
  activeTicketId = null;
  document.getElementById("ticket-detail-modal")?.classList.remove("open");
}

function updateTicketSummaries() {
  setElementText("tickets-summary-new", String(adminTickets.filter(function (ticket) { return ticket.status === "new"; }).length));
  setElementText("tickets-summary-triaged", String(adminTickets.filter(function (ticket) { return ticket.status === "triaged"; }).length));
  setElementText("tickets-summary-waiting", String(adminTickets.filter(function (ticket) { return ticket.status === "waiting_on_customer"; }).length));
  setElementText("tickets-summary-high", String(adminTickets.filter(function (ticket) {
    return ticket.priority === "high" && ticket.status !== "resolved" && ticket.status !== "closed";
  }).length));
}

function renderLinkedWorkCell(ticket) {
  var parts = [];
  if (ticket.quoteSummary) {
    parts.push('<div>Quote ' + escapeAttr(ticket.quoteSummary.id) + '</div><div class="table-meta">' + escapeAttr(formatStatusLabel(ticket.quoteSummary.status)) + '</div>');
  }
  if (ticket.orderSummary) {
    parts.push('<div>Order ' + escapeAttr(ticket.orderSummary.id) + '</div><div class="table-meta">' + escapeAttr(formatStatusLabel(ticket.orderSummary.status)) + ' / ' + escapeAttr(formatStatusLabel(ticket.orderSummary.paymentStatus)) + '</div>');
  }
  if (!parts.length) {
    if (ticket.submittedReference) {
      return '<div class="text-secondary">Ref ' + escapeAttr(ticket.submittedReference) + '</div><div class="table-meta">No exact quote or order match</div>';
    }
    return '<span class="text-secondary">Not linked</span>';
  }
  return parts.join("");
}

function renderSupportTickets() {
  var table = document.getElementById("tickets-table-body");
  if (!table) return;

  updateTicketSummaries();

  if (!adminTickets.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">No support tickets have been created yet.</td></tr>';
    return;
  }

  table.innerHTML = adminTickets.map(function (ticket) {
    var latestPreview = ticket.latestCustomerMessagePreview || ticket.latestAdminReplyPreview || ticket.latestMessagePreview || "No preview yet";
    var queueMeta = ticket.status === "waiting_on_customer" && ticket.lastPublicReplyAt
      ? "Last reply " + formatDateTime(ticket.lastPublicReplyAt)
      : ticket.lastCustomerMessageAt
        ? "Last customer message " + formatDateTime(ticket.lastCustomerMessageAt)
        : "Updated " + formatDateTime(ticket.updatedAt);

    return '<tr>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(ticket.requesterName || "Unknown requester") + '</div>'
      +   '<div class="table-meta">' + escapeAttr(ticket.requesterEmail || "-") + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(ticket.subject || ticket.id) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(ticket.id) + ' / ' + escapeAttr(ticket.category || "general") + '</div>'
      +   '<div class="table-meta">' + escapeAttr(latestPreview) + '</div>'
      + '</td>'
      + '<td>'
      +   renderTicketPill(ticket.status)
      +   '<div class="table-meta">' + escapeAttr(queueMeta) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(ticket.assignedAdmin || "Unassigned") + '</div>'
      +   '<div class="table-meta">' + escapeAttr(formatTicketLabel(ticket.priority)) + ' priority</div>'
      + '</td>'
      + '<td>' + renderLinkedWorkCell(ticket) + '</td>'
      + '<td>'
      +   '<div class="table-actions">'
      +     '<button class="btn btn-ghost btn-sm" onclick="openTicketModal(\'' + escapeAttr(ticket.id) + '\')">Open Ticket</button>'
      +     (ticket.orderSummary ? '<button class="btn btn-outline btn-sm" onclick="openOrderDetail(\'' + escapeAttr(ticket.orderSummary.id) + '\')">Open Order</button>' : '')
      +     (ticket.quoteSummary ? '<button class="btn btn-outline btn-sm" onclick="reviewQuote(\'' + escapeAttr(ticket.quoteSummary.id) + '\')">Open Quote</button>' : '')
      +   '</div>'
      + '</td>'
      + '</tr>';
  }).join("");
}

async function loadTickets() {
  var table = document.getElementById("tickets-table-body");
  if (!table) return;

  try {
    var response = await fetch("/api/admin/tickets", { credentials: "same-origin" });
    if (response.status === 401) {
      window.location.href = "/admin/login/";
      return;
    }
    var data = await response.json();
    adminTickets = data && Array.isArray(data.tickets) ? data.tickets : [];
    renderSupportTickets();
    updateStats();
  } catch (error) {
    adminTickets = [];
    renderSupportTickets();
    updateStats();
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">Unable to load support tickets yet.</td></tr>';
  }
}

async function saveTicketUpdate() {
  var ticketId = document.getElementById("ticket-modal-id").value || activeTicketId;
  if (!ticketId) return;

  try {
    var response = await fetch("/api/admin/tickets", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_ticket",
        ticketId: ticketId,
        status: document.getElementById("ticket-status").value,
        priority: document.getElementById("ticket-priority").value,
        assignedAdmin: document.getElementById("ticket-assigned-admin").value.trim(),
        internalNote: document.getElementById("ticket-internal-note").value.trim(),
        customerReply: document.getElementById("ticket-customer-reply").value.trim()
      })
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to update the ticket.");

    Toast.success("Ticket updated.");
    await loadTickets();
    await openTicketModal(ticketId);
  } catch (error) {
    Toast.error(error.message || "Unable to update the ticket.");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var modal = document.getElementById("ticket-detail-modal");
  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeTicketModal();
    });
  }
});
