/* ============================================================
   ELYSIAN PCS - Admin Commerce Logic
   ============================================================ */

function formatDateTime(value) {
  if (!value) return '-';
  var date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

var STATUS_LABELS = {
  requested: 'Requested',
  under_review: 'Under review',
  approved: 'Approved',
  payment_ready: 'Payment link ready',
  awaiting_balance: 'Awaiting balance',
  paid: 'Paid',
  pending_payment: 'Pending payment',
  ready_for_fulfillment: 'Paid and ready',
  unpaid: 'Not paid',
  payment_link_created: 'Payment link created',
  partially_paid: 'Deposit paid',
  expired: 'Expired',
  failed: 'Failed',
  processing: 'Processing',
  processed: 'Processed',
  created: 'Created',
  completed: 'Completed',
  deposit: 'Deposit',
  balance: 'Balance',
  full: 'Full payment',
  full_payment: 'Full payment',
  deposit_first: 'Deposit first'
};

var STATUS_HELP = {
  order: {
    pending_payment: 'No confirmed payment has been recorded yet.',
    awaiting_balance: 'A deposit has been confirmed and the remaining balance is still due.',
    ready_for_fulfillment: 'The order is fully paid and payment work is complete.'
  },
  payment: {
    unpaid: 'No payment attempt has been started yet.',
    payment_link_created: 'A checkout link exists, but Stripe has not confirmed payment.',
    partially_paid: 'A deposit is confirmed and the order still has balance due.',
    paid: 'Stripe confirmed the full amount.',
    expired: 'The latest checkout session expired without payment.',
    failed: 'The latest payment attempt failed.'
  },
  quote: {
    requested: 'Customer requirements were submitted and still need review.',
    under_review: 'Internal build review is in progress.',
    approved: 'Pricing and compatibility are approved, but no payment link is active.',
    payment_ready: 'The quote has an active payment link waiting on Stripe confirmation.',
    awaiting_balance: 'The deposit is confirmed and the remaining balance is still due.',
    paid: 'The linked order is fully paid.'
  }
};

function formatStatusLabel(value) {
  var key = String(value || 'unknown');
  return STATUS_LABELS[key] || key.replace(/_/g, ' ');
}

function getStatusHelp(kind, value) {
  var group = STATUS_HELP[kind] || {};
  return group[String(value || '')] || '';
}

function renderStatusPill(value) {
  return '<span class="status-pill">' + escapeAttr(formatStatusLabel(value)) + '</span>';
}

function getQuoteById(quoteId) {
  return adminQuotes.find(function (item) { return item.id === quoteId; }) || null;
}

function getOrderById(orderId) {
  return adminOrders.find(function (item) { return item.id === orderId; }) || null;
}

function formatEventTypeLabel(value) {
  var labels = {
    order_created: 'Order created',
    payment_link_created: 'Payment link created',
    payment_confirmed: 'Payment confirmed',
    payment_failed: 'Payment failed',
    payment_link_expired: 'Payment link expired',
    webhook_processing_recovered: 'Webhook recovery'
  };
  var key = String(value || '');
  return labels[key] || formatStatusLabel(key);
}

function formatSourceLabel(value) {
  return value === 'stripe_webhook' ? 'Stripe webhook' : formatStatusLabel(value);
}

function renderMetaText(value) {
  return value ? '<div class="table-meta">' + escapeAttr(value) + '</div>' : '';
}

function toggleQuoteDepositField() {
  var mode = document.getElementById('quote-payment-mode');
  var group = document.getElementById('quote-deposit-group');
  if (!mode || !group) return;
  group.style.display = mode.value === 'deposit_first' ? 'block' : 'none';
}

function buildQuoteSummary(quote) {
  var request = quote.requestSnapshot || {};
  return [
    'Quote ID: ' + quote.id,
    'Customer: ' + quote.customerName,
    'Email: ' + quote.customerEmail,
    'Status: ' + formatStatusLabel(quote.status),
    'Budget: ' + (request.budget || '-'),
    'Use Case: ' + (request.useCase || 'mixed'),
    'Timeframe: ' + (request.timeframe || '-'),
    '',
    'Requirements:',
    request.notes || 'No notes provided.'
  ].join('\n');
}

function buildOrderSummaryText(orderSummary) {
  if (!orderSummary) {
    return 'No order linked yet.\nApprove the quote and manually generate the first payment link when ready.';
  }

  var latest = orderSummary.latestPaymentSession;
  var attempts = Array.isArray(orderSummary.paymentSessions) ? orderSummary.paymentSessions : [];
  var lines = [
    'Order ID: ' + orderSummary.id,
    'Order Status: ' + formatStatusLabel(orderSummary.status),
    'Payment Status: ' + formatStatusLabel(orderSummary.paymentStatus),
    'Amount Paid: ' + formatMoneyFromCents(orderSummary.amountPaidCents),
    'Balance Due: ' + formatMoneyFromCents(orderSummary.balanceDueCents),
    'Last Updated: ' + formatDateTime(orderSummary.updatedAt)
  ];

  if (latest) {
    lines.push('Latest Session: ' + formatStatusLabel(latest.phase) + ' / ' + formatStatusLabel(latest.status));
    lines.push('Latest Session Created: ' + formatDateTime(latest.createdAt));
  }

  if (attempts.length) {
    lines.push('');
    lines.push('Payment Attempts:');
    attempts.slice(0, 5).forEach(function (attempt) {
      lines.push(
        '- ' + formatStatusLabel(attempt.phase)
        + ' / ' + formatStatusLabel(attempt.status)
        + ' / ' + formatMoneyFromCents(attempt.amountCents)
        + ' / ' + formatDateTime(attempt.createdAt)
      );
    });
  }

  return lines.join('\n');
}

function fillQuoteModal(quote) {
  activeQuoteId = quote.id;
  document.getElementById('quote-modal-id').value = quote.id;
  document.getElementById('quote-modal-title').textContent = 'Quote Review: ' + quote.id;
  document.getElementById('quote-modal-subtitle').textContent = 'Refine the internal build, confirm compatibility, and approve pricing before you generate a manual payment link.';
  document.getElementById('quote-request-summary').textContent = buildQuoteSummary(quote);
  document.getElementById('quote-order-summary').textContent = buildOrderSummaryText(quote.orderSummary);

  var config = quote.configSnapshot || {};
  var components = config.components || {};
  document.getElementById('quote-config-cpu').value = components.cpu || '';
  document.getElementById('quote-config-gpu').value = components.gpu || '';
  document.getElementById('quote-config-ram').value = components.ram || '';
  document.getElementById('quote-config-storage').value = components.storage || '';
  document.getElementById('quote-config-motherboard').value = components.motherboard || '';
  document.getElementById('quote-config-psu').value = components.psu || '';
  document.getElementById('quote-config-case').value = components.case || '';
  document.getElementById('quote-config-cooling').value = components.cooling || '';
  document.getElementById('quote-compatibility-notes').value = config.compatibilityNotes || '';
  document.getElementById('quote-build-notes').value = config.buildNotes || '';
  document.getElementById('quote-admin-notes').value = quote.adminNotes || '';
  document.getElementById('quote-payment-mode').value = quote.paymentMode || 'full_payment';
  document.getElementById('quote-subtotal').value = quote.subtotalCents ? String((quote.subtotalCents / 100).toFixed(2)) : '';
  document.getElementById('quote-deposit').value = quote.depositCents ? String((quote.depositCents / 100).toFixed(2)) : '';
  toggleQuoteDepositField();
}

function collectQuoteReviewPayload() {
  var subtotal = Math.round(parseFloat(document.getElementById('quote-subtotal').value || '0') * 100);
  var paymentMode = document.getElementById('quote-payment-mode').value;
  var deposit = paymentMode === 'deposit_first'
    ? Math.round(parseFloat(document.getElementById('quote-deposit').value || '0') * 100)
    : 0;

  return {
    quoteId: document.getElementById('quote-modal-id').value,
    subtotalCents: subtotal,
    paymentMode: paymentMode,
    depositCents: deposit,
    adminNotes: document.getElementById('quote-admin-notes').value.trim(),
    configSnapshot: {
      components: {
        cpu: document.getElementById('quote-config-cpu').value.trim(),
        gpu: document.getElementById('quote-config-gpu').value.trim(),
        ram: document.getElementById('quote-config-ram').value.trim(),
        storage: document.getElementById('quote-config-storage').value.trim(),
        motherboard: document.getElementById('quote-config-motherboard').value.trim(),
        psu: document.getElementById('quote-config-psu').value.trim(),
        case: document.getElementById('quote-config-case').value.trim(),
        cooling: document.getElementById('quote-config-cooling').value.trim()
      },
      compatibilityNotes: document.getElementById('quote-compatibility-notes').value.trim(),
      buildNotes: document.getElementById('quote-build-notes').value.trim()
    }
  };
}

function openQuoteModal(quoteId) {
  var quote = getQuoteById(quoteId);
  if (!quote) return;
  fillQuoteModal(quote);
  document.getElementById('quote-modal')?.classList.add('open');
}

function closeQuoteModal() {
  activeQuoteId = null;
  document.getElementById('quote-modal')?.classList.remove('open');
}

function closeOrderDetailModal() {
  document.getElementById('order-detail-modal')?.classList.remove('open');
}

function renderDetailItems(items) {
  return items.map(function (item) {
    return '<div class="detail-inline-item">'
      + '<strong>' + escapeAttr(item.label) + '</strong>'
      + '<div>' + escapeAttr(item.value || '-') + '</div>'
      + (item.meta ? '<div class="table-meta">' + escapeAttr(item.meta) + '</div>' : '')
      + '</div>';
  }).join('');
}

function renderDetailTable(columns, rows, emptyMessage) {
  if (!rows.length) {
    return '<div class="detail-empty">' + escapeAttr(emptyMessage) + '</div>';
  }

  return '<div class="admin-table-wrap"><table class="detail-table"><thead><tr>'
    + columns.map(function (column) { return '<th>' + escapeAttr(column) + '</th>'; }).join('')
    + '</tr></thead><tbody>'
    + rows.map(function (row) {
      return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
    }).join('')
    + '</tbody></table></div>';
}

function buildOrderStatusGuide(order, quote) {
  var lines = [
    'Order status: ' + formatStatusLabel(order.status),
    getStatusHelp('order', order.status) || 'Order state is based on confirmed payment progress.',
    '',
    'Payment status: ' + formatStatusLabel(order.paymentStatus),
    getStatusHelp('payment', order.paymentStatus) || 'Payment state is driven by tracked checkout sessions and Stripe webhooks.'
  ];

  if (quote) {
    lines.push('');
    lines.push('Quote status: ' + formatStatusLabel(quote.status));
    lines.push(getStatusHelp('quote', quote.status) || 'Quote state follows the linked order.');
  }

  return lines.join('\n');
}

function renderPaymentAttemptsTable(attempts) {
  return renderDetailTable(
    ['Phase', 'Status', 'Amount', 'Checkout Session', 'Payment Intent', 'Timing'],
    attempts.map(function (attempt) {
      var timing = 'Created ' + formatDateTime(attempt.createdAt);
      if (attempt.completedAt) timing += '\nCompleted ' + formatDateTime(attempt.completedAt);
      else if (attempt.expiresAt) timing += '\nExpires ' + formatDateTime(attempt.expiresAt);

      return [
        renderStatusPill(attempt.phase),
        renderStatusPill(attempt.status),
        escapeAttr(formatMoneyFromCents(attempt.amountCents)),
        '<div>' + escapeAttr(attempt.stripeCheckoutSessionId || '-') + '</div>'
          + renderMetaText(attempt.url ? 'Stored checkout link available' : ''),
        escapeAttr(attempt.stripePaymentIntentId || '-'),
        '<div style="white-space:pre-wrap;">' + escapeAttr(timing) + '</div>'
      ];
    }),
    'No payment attempts are recorded for this order yet.'
  );
}

function renderOrderEventsTable(events) {
  return renderDetailTable(
    ['When', 'Event', 'Source', 'Context'],
    events.map(function (event) {
      var payloadBits = [];
      if (event.payload.paymentPhase) payloadBits.push('Phase: ' + formatStatusLabel(event.payload.paymentPhase));
      if (event.payload.amountCents) payloadBits.push('Amount: ' + formatMoneyFromCents(event.payload.amountCents));
      if (event.payload.lastPaymentError) payloadBits.push('Error: ' + event.payload.lastPaymentError);
      if (event.payload.sessionId) payloadBits.push('Session: ' + event.payload.sessionId);
      if (event.payload.eventId) payloadBits.push('Webhook: ' + event.payload.eventId);

      return [
        escapeAttr(formatDateTime(event.createdAt)),
        escapeAttr(formatEventTypeLabel(event.type)),
        escapeAttr(formatSourceLabel(event.source)),
        '<div style="white-space:pre-wrap;">' + escapeAttr(payloadBits.join('\n') || '-') + '</div>'
      ];
    }),
    'No order timeline entries yet.'
  );
}

function renderWebhookEventsTable(events) {
  return renderDetailTable(
    ['Event', 'Status', 'Deliveries', 'Timing', 'Notes'],
    events.map(function (event) {
      var timing = [
        'Received ' + formatDateTime(event.receivedAt),
        'Processing ' + formatDateTime(event.processingStartedAt),
        event.processedAt ? 'Processed ' + formatDateTime(event.processedAt) : 'Not processed yet'
      ].join('\n');

      var notes = [];
      if (event.relatedObjectId) notes.push('Object: ' + event.relatedObjectId);
      if (event.lastError) notes.push('Error: ' + event.lastError);

      return [
        '<div>' + escapeAttr(event.type) + '</div>',
        renderStatusPill(event.status),
        '<div>' + escapeAttr(String(event.deliveryCount || 1)) + '</div>'
          + renderMetaText(event.lastDeliveryAt ? 'Last delivery ' + formatDateTime(event.lastDeliveryAt) : ''),
        '<div style="white-space:pre-wrap;">' + escapeAttr(timing) + '</div>',
        '<div style="white-space:pre-wrap;">' + escapeAttr(notes.join('\n') || '-') + '</div>'
      ];
    }),
    'No webhook deliveries are linked to this order yet.'
  );
}

function fillOrderDetailModal(detail) {
  var order = detail.order;
  var quote = detail.quote;
  document.getElementById('order-detail-title').textContent = 'Order Detail: ' + order.id;
  document.getElementById('order-detail-subtitle').textContent = 'Review payment phases, webhook confirmations, and retry context for this order.';
  document.getElementById('order-detail-summary').innerHTML = renderDetailItems([
    { label: 'Order Status', value: formatStatusLabel(order.status), meta: getStatusHelp('order', order.status) },
    { label: 'Payment Status', value: formatStatusLabel(order.paymentStatus), meta: getStatusHelp('payment', order.paymentStatus) },
    { label: 'Payment Mode', value: formatStatusLabel(order.paymentMode) },
    { label: 'Order Total', value: formatMoneyFromCents(order.totalCents) },
    { label: 'Amount Paid', value: formatMoneyFromCents(order.amountPaidCents) },
    { label: 'Balance Due', value: formatMoneyFromCents(order.balanceDueCents) },
    { label: 'Quote', value: quote ? quote.id : 'Not linked', meta: quote ? ('Status ' + formatStatusLabel(quote.status)) : '' },
    { label: 'Last Payment', value: order.lastPaymentAt ? formatDateTime(order.lastPaymentAt) : 'Waiting on webhook confirmation' }
  ]);
  document.getElementById('order-detail-status-guide').textContent = buildOrderStatusGuide(order, quote);
  document.getElementById('order-detail-payments-wrap').innerHTML = renderPaymentAttemptsTable(order.paymentSessions || []);
  document.getElementById('order-detail-events-wrap').innerHTML = renderOrderEventsTable(detail.orderEvents || []);
  document.getElementById('order-detail-webhooks-wrap').innerHTML = renderWebhookEventsTable(detail.webhookEvents || []);
}

async function openOrderDetail(orderId) {
  var modal = document.getElementById('order-detail-modal');
  if (!modal) return;

  document.getElementById('order-detail-title').textContent = 'Order Detail';
  document.getElementById('order-detail-subtitle').textContent = 'Loading order history...';
  document.getElementById('order-detail-summary').innerHTML = '<div class="detail-empty">Loading order summary...</div>';
  document.getElementById('order-detail-status-guide').textContent = 'Loading status guidance...';
  document.getElementById('order-detail-payments-wrap').innerHTML = '<div class="detail-empty">Loading payment attempts...</div>';
  document.getElementById('order-detail-events-wrap').innerHTML = '<div class="detail-empty">Loading order timeline...</div>';
  document.getElementById('order-detail-webhooks-wrap').innerHTML = '<div class="detail-empty">Loading webhook deliveries...</div>';
  modal.classList.add('open');

  try {
    var response = await fetch('/api/admin/orders?orderId=' + encodeURIComponent(orderId), {
      credentials: 'same-origin'
    });
    if (response.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load order detail.');
    fillOrderDetailModal(data);
  } catch (error) {
    document.getElementById('order-detail-status-guide').textContent = error.message || 'Unable to load order detail.';
    document.getElementById('order-detail-summary').innerHTML = '<div class="detail-empty">Order detail could not be loaded.</div>';
    document.getElementById('order-detail-payments-wrap').innerHTML = '<div class="detail-empty">Payment attempts are unavailable.</div>';
    document.getElementById('order-detail-events-wrap').innerHTML = '<div class="detail-empty">Order timeline is unavailable.</div>';
    document.getElementById('order-detail-webhooks-wrap').innerHTML = '<div class="detail-empty">Webhook deliveries are unavailable.</div>';
  }
}

async function saveQuoteAction(action) {
  var payload = collectQuoteReviewPayload();
  if (!payload.quoteId) return;
  if (!payload.subtotalCents) {
    Toast.error('A valid quoted subtotal is required.');
    return;
  }
  if (payload.paymentMode === 'deposit_first' && (!payload.depositCents || payload.depositCents >= payload.subtotalCents)) {
    Toast.error('Deposit amount must be greater than zero and less than the quoted subtotal.');
    return;
  }

  try {
    var response = await fetch('/api/admin/quotes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        quoteId: payload.quoteId,
        subtotalCents: payload.subtotalCents,
        paymentMode: payload.paymentMode,
        depositCents: payload.depositCents,
        adminNotes: payload.adminNotes,
        configSnapshot: payload.configSnapshot
      })
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save quote review.');
    Toast.success(action === 'approve'
      ? 'Quote approved and ready for manual payment link generation.'
      : 'Quote review saved.');
    closeQuoteModal();
    await Promise.all([loadQuotes(), loadOrders()]);
  } catch (error) {
    Toast.error(error.message || 'Unable to update quote.');
  }
}

function saveQuoteReview() {
  return saveQuoteAction('save_review');
}

function approveQuoteFromModal() {
  return saveQuoteAction('approve');
}

async function legacyLoadQuotes() {
  var table = document.getElementById('quotes-table-body');
  if (!table) return;

  try {
    var response = await fetch('/api/admin/quotes', { credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }
    var data = await response.json();
    adminQuotes = data && Array.isArray(data.quotes) ? data.quotes : [];
    renderQuotes();
  } catch (error) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">Unable to load quote requests yet.</td></tr>';
  }
}

function legacyRenderQuotes() {
  var table = document.getElementById('quotes-table-body');
  if (!table) return;

  if (!adminQuotes.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">No quote requests yet.</td></tr>';
    return;
  }

  table.innerHTML = adminQuotes.map(function (quote) {
    var request = quote.requestSnapshot || {};
    var orderSummary = quote.orderSummary;
    var paymentSummary = quote.paymentMode === 'deposit_first'
      ? 'Deposit ' + formatMoneyFromCents(quote.depositCents) + ' / Balance ' + formatMoneyFromCents(quote.balanceDueCents)
      : 'Full payment';
    var linkedOrderSummary = orderSummary
      ? renderStatusPill(orderSummary.paymentStatus)
        + '<div class="table-meta">Order ' + escapeAttr(orderSummary.id) + ' / Paid ' + formatMoneyFromCents(orderSummary.amountPaidCents) + '</div>'
      : '<span class="text-secondary">Not linked yet</span>';
    var latestSession = orderSummary && orderSummary.latestPaymentSession
      ? '<div class="table-meta">Latest session: ' + escapeAttr(formatStatusLabel(orderSummary.latestPaymentSession.phase)) + ' / ' + escapeAttr(formatStatusLabel(orderSummary.latestPaymentSession.status)) + '</div>'
      : '';

    return '<tr>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(quote.customerName) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(quote.customerEmail) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(quote.id) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(request.useCase || 'mixed') + ' / ' + escapeAttr(request.budget || 'No budget') + '</div>'
      +   '<div class="table-meta">' + escapeAttr(request.timeframe || 'No timeframe') + '</div>'
      + '</td>'
      + '<td>'
      +   renderStatusPill(quote.status)
      +   renderMetaText(getStatusHelp('quote', quote.status))
      +   '<div class="table-meta">Updated ' + escapeAttr(formatDateTime(quote.updatedAt)) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + (quote.subtotalCents ? formatMoneyFromCents(quote.subtotalCents) : '-') + '</div>'
      +   '<div class="table-meta">' + escapeAttr(paymentSummary) + '</div>'
      + '</td>'
      + '<td>'
      +   linkedOrderSummary
      +   latestSession
      + '</td>'
      + '<td>'
      +   '<div class="table-actions">'
      +     '<button class="btn btn-ghost btn-sm" onclick="reviewQuote(\'' + quote.id + '\')">Review</button>'
      +     '<button class="btn btn-outline btn-sm" onclick="approveQuote(\'' + quote.id + '\')">Approve</button>'
      +     '<button class="btn btn-primary btn-sm" onclick="createQuotePaymentLink(\'' + quote.id + '\')">Payment Link</button>'
      +   '</div>'
      + '</td>'
      + '</tr>';
  }).join('');
}

function reviewQuote(quoteId) {
  openQuoteModal(quoteId);
}

function approveQuote(quoteId) {
  openQuoteModal(quoteId);
}

async function createQuotePaymentLink(quoteId) {
  try {
    var response = await fetch('/api/admin/quotes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_payment_link',
        quoteId: quoteId
      })
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to create payment link.');

    if (data.paymentLinkUrl) {
      window.prompt('Manual payment link generated. Copy it below.', data.paymentLinkUrl);
      Toast.success(data.reused ? 'Existing manual payment link reopened.' : 'Manual payment link created.');
      await Promise.all([loadQuotes(), loadOrders()]);
    }
  } catch (error) {
    Toast.error(error.message || 'Unable to create payment link.');
  }
}

async function legacyLoadOrders() {
  var table = document.getElementById('orders-table-body');
  if (!table) return;

  try {
    var response = await fetch('/api/admin/orders', { credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }
    var data = await response.json();
    adminOrders = data && Array.isArray(data.orders) ? data.orders : [];
    renderOrders();
  } catch (error) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">Unable to load orders yet.</td></tr>';
  }
}

function legacyRenderOrders() {
  var table = document.getElementById('orders-table-body');
  if (!table) return;

  if (!adminOrders.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">No orders have been created yet.</td></tr>';
    return;
  }

  table.innerHTML = adminOrders.map(function (order) {
    var latest = order.latestPaymentSession;
    var attempts = Array.isArray(order.paymentSessions) ? order.paymentSessions : [];
    var paymentPlan = order.paymentMode === 'deposit_first'
      ? 'Deposit ' + formatMoneyFromCents(order.depositCents) + ' / Balance ' + formatMoneyFromCents(order.balanceDueCents)
      : 'Single payment order';
    var sessionSummary = latest
      ? renderStatusPill(latest.status)
        + '<div class="table-meta">' + escapeAttr(formatStatusLabel(latest.phase)) + ' session / ' + escapeAttr(formatDateTime(latest.createdAt)) + '</div>'
      : '<span class="text-secondary">No checkout session yet</span>';
    var webhookSummary = (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_paid')
      ? 'Webhook confirmed ' + escapeAttr(formatDateTime(order.lastPaymentAt))
      : 'Waiting on webhook confirmation';
    var actions = '<div class="table-actions">';
    actions += '<button class="btn btn-ghost btn-sm" onclick="openOrderDetail(\'' + order.id + '\')">Details</button>';
    if (latest && latest.url) {
      actions += '<button class="btn btn-ghost btn-sm" onclick="copyLatestPaymentLink(\'' + order.id + '\')">Copy Link</button>';
    }
    if (order.paymentMode === 'deposit_first' && order.paymentStatus === 'partially_paid' && order.balanceDueCents > 0) {
      actions += '<button class="btn btn-primary btn-sm" onclick="createBalancePaymentLink(\'' + order.id + '\')">Balance Link</button>';
    }
    if (order.quoteId) {
      actions += '<button class="btn btn-outline btn-sm" onclick="reviewQuote(\'' + order.quoteId + '\')">Open Quote</button>';
    }
    actions += '</div>';

    return '<tr>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(order.id) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(order.orderType) + (order.quoteId ? ' / Quote ' + escapeAttr(order.quoteId) : '') + '</div>'
      +   '<div class="table-meta">Created ' + escapeAttr(formatDateTime(order.createdAt)) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(order.customerName || 'Pending checkout details') + '</div>'
      +   '<div class="table-meta">' + escapeAttr(order.customerEmail || 'Email captured at checkout') + '</div>'
      + '</td>'
      + '<td>'
      +   renderStatusPill(order.status)
      +   renderMetaText(getStatusHelp('order', order.status))
      +   '<div class="table-meta">Updated ' + escapeAttr(formatDateTime(order.updatedAt)) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + formatMoneyFromCents(order.amountPaidCents) + ' / ' + formatMoneyFromCents(order.totalCents) + '</div>'
      +   renderStatusPill(order.paymentStatus)
      +   renderMetaText(getStatusHelp('payment', order.paymentStatus))
      +   '<div class="table-meta">' + escapeAttr(paymentPlan) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(webhookSummary) + '</div>'
      +   '<div class="table-meta">Balance due ' + formatMoneyFromCents(order.balanceDueCents) + '</div>'
      + '</td>'
      + '<td>' + sessionSummary + '<div class="table-meta">' + escapeAttr(String(attempts.length)) + ' tracked attempt(s)</div></td>'
      + '<td>' + actions + '</td>'
      + '</tr>';
  }).join('');
}

async function createBalancePaymentLink(orderId) {
  try {
    var response = await fetch('/api/admin/orders', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_balance_payment_link',
        orderId: orderId
      })
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to create the balance payment link.');
    if (data.paymentLinkUrl) {
      window.prompt('Balance payment link generated. Copy it below.', data.paymentLinkUrl);
      Toast.success(data.reused ? 'Existing balance link reopened.' : 'Balance payment link created.');
      await Promise.all([loadQuotes(), loadOrders()]);
    }
  } catch (error) {
    Toast.error(error.message || 'Unable to create the balance payment link.');
  }
}

function copyLatestPaymentLink(orderId) {
  var order = getOrderById(orderId);
  var url = order && order.latestPaymentSession && order.latestPaymentSession.url;
  if (!url) {
    Toast.error('No payment link is currently stored for this order.');
    return;
  }
  window.prompt('Copy the latest payment link below.', url);
}

STATUS_LABELS.open = 'Open';
STATUS_LABELS.in_progress = 'In Progress';
STATUS_LABELS.resolved = 'Resolved';
STATUS_LABELS.closed = 'Closed';
STATUS_LABELS.high = 'High';
STATUS_LABELS.medium = 'Medium';
STATUS_LABELS.low = 'Low';

function updateQuoteSummaries() {
  setElementText('quotes-summary-requested', String(adminQuotes.filter(function (quote) { return quote.status === 'requested'; }).length));
  setElementText('quotes-summary-review', String(adminQuotes.filter(function (quote) { return quote.status === 'under_review'; }).length));
  setElementText('quotes-summary-payment', String(adminQuotes.filter(function (quote) {
    return quote.status === 'approved' || quote.status === 'payment_ready' || quote.status === 'awaiting_balance';
  }).length));
  setElementText('quotes-summary-paid', String(adminQuotes.filter(function (quote) { return quote.status === 'paid'; }).length));
}

function updateOrderSummaries() {
  setElementText('orders-summary-pending', String(adminOrders.filter(function (order) {
    return order.status === 'pending_payment' || order.paymentStatus === 'payment_link_created';
  }).length));
  setElementText('orders-summary-balance', String(adminOrders.filter(function (order) { return order.status === 'awaiting_balance'; }).length));
  setElementText('orders-summary-risk', String(adminOrders.filter(function (order) {
    return order.paymentStatus === 'failed' || order.paymentStatus === 'expired';
  }).length));
  setElementText('orders-summary-paid', String(adminOrders.filter(function (order) { return order.paymentStatus === 'paid'; }).length));
}

async function loadQuotes() {
  var table = document.getElementById('quotes-table-body');
  if (!table) return;

  try {
    var response = await fetch('/api/admin/quotes', { credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }
    var data = await response.json();
    adminQuotes = data && Array.isArray(data.quotes) ? data.quotes : [];
    renderQuotes();
    updateStats();
  } catch (error) {
    adminQuotes = [];
    renderQuotes();
    updateStats();
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">Unable to load quote requests yet.</td></tr>';
  }
}

function renderQuotes() {
  var table = document.getElementById('quotes-table-body');
  if (!table) return;

  updateQuoteSummaries();

  if (!adminQuotes.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">No quote requests yet.</td></tr>';
    return;
  }

  table.innerHTML = adminQuotes.map(function (quote) {
    var request = quote.requestSnapshot || {};
    var orderSummary = quote.orderSummary;
    var isDeposit = quote.paymentMode === 'deposit_first';
    var paymentSummary = isDeposit
      ? 'Deposit ' + formatMoneyFromCents(quote.depositCents) + ' / Balance ' + formatMoneyFromCents(quote.balanceDueCents)
      : 'Full payment';
    var linkedOrderSummary = orderSummary
      ? renderStatusPill(orderSummary.paymentStatus)
        + '<div class="table-meta">Order ' + escapeAttr(orderSummary.id) + ' / Paid ' + formatMoneyFromCents(orderSummary.amountPaidCents) + '</div>'
      : '<span class="text-secondary">Not linked yet</span>';
    var latestSession = orderSummary && orderSummary.latestPaymentSession
      ? '<div class="table-meta">Latest session: ' + escapeAttr(formatStatusLabel(orderSummary.latestPaymentSession.phase)) + ' / ' + escapeAttr(formatStatusLabel(orderSummary.latestPaymentSession.status)) + '</div>'
      : '';
    var paymentLinkAllowed = quote.status === 'approved' || quote.status === 'payment_ready' || quote.status === 'awaiting_balance';
    var paymentLinkLabel = orderSummary && orderSummary.latestPaymentSession && orderSummary.latestPaymentSession.url
      ? 'Reopen Link'
      : 'Payment Link';

    return '<tr>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(quote.customerName) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(quote.customerEmail) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(quote.id) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(request.useCase || 'mixed') + ' / ' + escapeAttr(request.budget || 'No budget') + '</div>'
      +   '<div class="table-meta">' + escapeAttr(request.timeframe || 'No timeframe') + '</div>'
      + '</td>'
      + '<td>'
      +   renderStatusPill(quote.status)
      +   renderMetaText(getStatusHelp('quote', quote.status))
      +   '<div class="table-meta">Updated ' + escapeAttr(formatDateTime(quote.updatedAt)) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + (quote.subtotalCents ? formatMoneyFromCents(quote.subtotalCents) : '-') + '</div>'
      +   '<div class="table-meta">' + escapeAttr(paymentSummary) + '</div>'
      + '</td>'
      + '<td>'
      +   linkedOrderSummary
      +   latestSession
      + '</td>'
      + '<td>'
      +   '<div class="table-actions">'
      +     '<button class="btn btn-ghost btn-sm" onclick="reviewQuote(\'' + quote.id + '\')">Open Review</button>'
      +     (orderSummary ? '<button class="btn btn-outline btn-sm" onclick="openOrderDetail(\'' + orderSummary.id + '\')">Open Order</button>' : '')
      +     (paymentLinkAllowed ? '<button class="btn btn-primary btn-sm" onclick="createQuotePaymentLink(\'' + quote.id + '\')">' + paymentLinkLabel + '</button>' : '')
      +   '</div>'
      + '</td>'
      + '</tr>';
  }).join('');
}

async function loadOrders() {
  var table = document.getElementById('orders-table-body');
  if (!table) return;

  try {
    var response = await fetch('/api/admin/orders', { credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }
    var data = await response.json();
    adminOrders = data && Array.isArray(data.orders) ? data.orders : [];
    renderOrders();
    updateStats();
  } catch (error) {
    adminOrders = [];
    renderOrders();
    updateStats();
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">Unable to load orders yet.</td></tr>';
  }
}

function renderOrders() {
  var table = document.getElementById('orders-table-body');
  if (!table) return;

  updateOrderSummaries();

  if (!adminOrders.length) {
    table.innerHTML = '<tr><td colspan="6" class="text-secondary" style="padding:1rem;">No orders have been created yet.</td></tr>';
    return;
  }

  table.innerHTML = adminOrders.map(function (order) {
    var latest = order.latestPaymentSession;
    var attempts = Array.isArray(order.paymentSessions) ? order.paymentSessions : [];
    var paymentPlan = order.paymentMode === 'deposit_first'
      ? 'Deposit ' + formatMoneyFromCents(order.depositCents) + ' / Balance ' + formatMoneyFromCents(order.balanceDueCents)
      : 'Single payment order';
    var sessionSummary = latest
      ? renderStatusPill(latest.status)
        + '<div class="table-meta">' + escapeAttr(formatStatusLabel(latest.phase)) + ' session / ' + escapeAttr(formatDateTime(latest.createdAt)) + '</div>'
      : '<span class="text-secondary">No checkout session yet</span>';
    var webhookSummary = (order.paymentStatus === 'paid' || order.paymentStatus === 'partially_paid')
      ? 'Webhook confirmed ' + escapeAttr(formatDateTime(order.lastPaymentAt))
      : 'Waiting on webhook confirmation';
    var actions = '<div class="table-actions">';
    actions += '<button class="btn btn-ghost btn-sm" onclick="openOrderDetail(\'' + order.id + '\')">Details</button>';
    if (latest && latest.url) {
      actions += '<button class="btn btn-outline btn-sm" onclick="copyLatestPaymentLink(\'' + order.id + '\')">Copy Link</button>';
    }
    if (order.paymentMode === 'deposit_first' && order.paymentStatus === 'partially_paid' && order.balanceDueCents > 0) {
      actions += '<button class="btn btn-primary btn-sm" onclick="createBalancePaymentLink(\'' + order.id + '\')">Balance Link</button>';
    }
    if (order.quoteId) {
      actions += '<button class="btn btn-outline btn-sm" onclick="reviewQuote(\'' + order.quoteId + '\')">Open Quote</button>';
    }
    actions += '</div>';

    return '<tr>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(order.id) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(order.orderType) + (order.quoteId ? ' / Quote ' + escapeAttr(order.quoteId) : '') + '</div>'
      +   '<div class="table-meta">Created ' + escapeAttr(formatDateTime(order.createdAt)) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + escapeAttr(order.customerName || 'Pending checkout details') + '</div>'
      +   '<div class="table-meta">' + escapeAttr(order.customerEmail || 'Email captured at checkout') + '</div>'
      + '</td>'
      + '<td>'
      +   renderStatusPill(order.status)
      +   renderMetaText(getStatusHelp('order', order.status))
      +   '<div class="table-meta">Updated ' + escapeAttr(formatDateTime(order.updatedAt)) + '</div>'
      + '</td>'
      + '<td>'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + formatMoneyFromCents(order.amountPaidCents) + ' / ' + formatMoneyFromCents(order.totalCents) + '</div>'
      +   renderStatusPill(order.paymentStatus)
      +   renderMetaText(getStatusHelp('payment', order.paymentStatus))
      +   '<div class="table-meta">' + escapeAttr(paymentPlan) + '</div>'
      +   '<div class="table-meta">' + escapeAttr(webhookSummary) + '</div>'
      +   '<div class="table-meta">Balance due ' + formatMoneyFromCents(order.balanceDueCents) + '</div>'
      + '</td>'
      + '<td>' + sessionSummary + '<div class="table-meta">' + escapeAttr(String(attempts.length)) + ' tracked attempt(s)</div></td>'
      + '<td>' + actions + '</td>'
      + '</tr>';
  }).join('');
}

document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('quote-modal');
  if (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeQuoteModal();
    });
  }

  var orderModal = document.getElementById('order-detail-modal');
  if (orderModal) {
    orderModal.addEventListener('click', function (event) {
      if (event.target === orderModal) closeOrderDetailModal();
    });
  }
});
