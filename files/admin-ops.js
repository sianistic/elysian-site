/* ============================================================
   ELYSIAN PCS - Admin Operations Logic
   ============================================================ */

function renderOpsStatusPill(status) {
  var label = status === 'ok'
    ? 'Ready'
    : status === 'warning'
      ? 'Warning'
      : 'Action Needed';
  return '<span class="status-pill">' + escapeAttr(label) + '</span>';
}

function renderRuntimeChecks(checks) {
  var container = document.getElementById('ops-runtime-checks');
  var summary = document.getElementById('ops-runtime-summary');
  if (!container || !summary) return;

  if (!checks.length) {
    summary.textContent = 'No runtime checks are available.';
    container.innerHTML = '<div class="detail-empty">Runtime checks are unavailable.</div>';
    return;
  }

  var errors = checks.filter(function (check) { return check.status === 'error'; }).length;
  var warnings = checks.filter(function (check) { return check.status === 'warning'; }).length;
  summary.textContent = errors
    ? errors + ' blocking config issue(s) and ' + warnings + ' warning(s) detected.'
    : warnings
      ? 'No blocking config issues, but ' + warnings + ' warning(s) should be reviewed.'
      : 'All tracked runtime checks are currently ready.';

  container.innerHTML = checks.map(function (check) {
    return '<div class="workspace-map-card">'
      + '<div class="workspace-map-title">' + escapeAttr(check.label) + '</div>'
      + '<div style="margin:0.45rem 0 0.65rem;">' + renderOpsStatusPill(check.status) + '</div>'
      + '<div class="workspace-map-copy">' + escapeAttr(check.message) + '</div>'
      + '</div>';
  }).join('');
}

function renderNotificationFeed(events) {
  var summary = document.getElementById('ops-notification-summary');
  var container = document.getElementById('ops-notification-feed');
  if (!summary || !container) return;

  if (!events.length) {
    summary.textContent = 'No notification attempts have been recorded yet.';
    container.innerHTML = '<div class="detail-empty">Notification activity will appear here once ticket, quote, or payment events are sent.</div>';
    return;
  }

  var failed = events.filter(function (event) { return event.status !== 'delivered'; }).length;
  summary.textContent = failed
    ? failed + ' of the most recent notification attempts did not confirm delivery.'
    : 'Recent notification attempts were delivered successfully.';

  container.innerHTML = events.map(function (event) {
    var title = event.eventType || event.template || 'notification';
    var meta = [
      event.channel || 'channel',
      event.audience || 'audience',
      event.provider || 'provider',
      formatDateTime(event.createdAt)
    ].filter(Boolean).join(' / ');

    var recipient = event.recipient || 'No recipient recorded';
    var detail = event.errorMessage || (event.responseId ? ('Response ' + event.responseId) : 'Delivered successfully');

    return '<div class="workspace-map-card">'
      + '<div class="workspace-map-title">' + escapeAttr(title.replace(/\./g, ' ')) + '</div>'
      + '<div style="margin:0.45rem 0 0.35rem;">' + renderOpsStatusPill(event.status === 'delivered' ? 'ok' : 'error') + '</div>'
      + '<div class="workspace-map-copy">' + escapeAttr(recipient) + '</div>'
      + '<div class="table-meta" style="margin-top:0.5rem;">' + escapeAttr(meta) + '</div>'
      + '<div class="table-meta" style="margin-top:0.35rem;">' + escapeAttr(detail) + '</div>'
      + '</div>';
  }).join('');
}

async function loadOperationalStatus() {
  try {
    var response = await fetch('/api/admin/ops', { credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }

    var data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load operational status.');
    }

    adminOpsStatus = data;
    renderRuntimeChecks(data.checks || []);
    renderNotificationFeed(data.notifications || []);
  } catch (error) {
    adminOpsStatus = null;
    var summary = document.getElementById('ops-runtime-summary');
    var checks = document.getElementById('ops-runtime-checks');
    var notificationSummary = document.getElementById('ops-notification-summary');
    var notificationFeed = document.getElementById('ops-notification-feed');
    if (summary) summary.textContent = error.message || 'Unable to load runtime checks.';
    if (checks) checks.innerHTML = '<div class="detail-empty">Runtime checks could not be loaded.</div>';
    if (notificationSummary) notificationSummary.textContent = 'Notification activity is unavailable right now.';
    if (notificationFeed) notificationFeed.innerHTML = '<div class="detail-empty">Notification activity could not be loaded.</div>';
  }
}
