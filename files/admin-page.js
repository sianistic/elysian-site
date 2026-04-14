/* ============================================================
   ELYSIAN PCS — Admin Page Logic
   ============================================================ */

// ── Auth ──────────────────────────────────────────────────────
function showAdminPanel() {
  var authGate = document.getElementById('auth-gate');
  var panel = document.getElementById('admin-panel');
  if (authGate) authGate.style.display = 'none';
  if (panel) panel.classList.add('visible');
  document.body.classList.add('unlocked');
}

function showAuthError(message) {
  var errorEl = document.getElementById('auth-error');
  var passwordInput = document.getElementById('admin-pw');
  if (errorEl) {
    errorEl.textContent = message || 'Authentication failed. Please try again.';
    errorEl.style.display = 'block';
  }
  if (!passwordInput) return;
  passwordInput.value = '';
  passwordInput.focus();
  passwordInput.style.borderColor = 'var(--accent-red)';
  setTimeout(function () {
    passwordInput.style.borderColor = '';
  }, 1500);
}

async function authenticate() {
  var passwordInput = document.getElementById('admin-pw');
  if (!passwordInput) return;
  var pw = passwordInput.value;
  var button = document.querySelector('#auth-gate .btn.btn-primary');
  var originalText = button ? button.textContent : '';

  if (!pw) {
    return showAuthError('Enter your admin password.');
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Authenticating...';
    }

    var response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: pw })
    });

    var data = await response.json();
    if (!response.ok) {
      return showAuthError(data && data.error ? data.error : 'Authentication failed.');
    }

    showAdminPanel();
    initAdmin();
  } catch (error) {
    showAuthError('Unable to reach the admin service.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

async function signOut() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } finally {
    location.reload();
  }
}

async function restoreAdminSession() {
  try {
    var response = await fetch('/api/admin/session', {
      credentials: 'same-origin'
    });
    if (response.status === 401) return;
    var data = await response.json();
    if (data && data.authenticated) {
      showAdminPanel();
      initAdmin();
    }
  } catch (error) {
    console.warn('Admin session restore failed', error);
  }
}

// Auto-restore session on page load
document.addEventListener('DOMContentLoaded', function () {
  restoreAdminSession();
});

window.addEventListener('hashchange', syncViewFromHash);

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('admin-sidebar').classList.toggle('collapsed');
}

var ADMIN_VIEW_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Operational overview for catalog, commerce, support, and public entry points.',
    context: 'Overview'
  },
  quotes: {
    title: 'Quote Workflow',
    subtitle: 'Review requirements, refine the build, approve pricing, and create manual payment links when you are ready.',
    context: 'Commerce'
  },
  orders: {
    title: 'Order Tracking',
    subtitle: 'Use webhook-confirmed state to investigate payment attempts, balance due, and retry context.',
    context: 'Commerce'
  },
  catalog: {
    title: 'Catalog Editor',
    subtitle: 'Manage public builds, pricing, tags, and positioning without mixing those edits into quote or support work.',
    context: 'Catalog'
  },
  analytics: {
    title: 'Catalog Insights',
    subtitle: 'Review catalog mix, price tiers, and distribution without crowding the operational workspaces.',
    context: 'Catalog'
  },
  support: {
    title: 'Support Tickets',
    subtitle: 'Triage support requests, update ticket ownership, and keep order-linked issues visible to the admin team.',
    context: 'Support'
  },
  operations: {
    title: 'Site & Operations',
    subtitle: 'Keep route context, public entry points, and workflow boundaries easy to reference from one place.',
    context: 'Operations'
  }
};

function getViewButton(view) {
  return document.querySelector('.sidebar-item[data-view="' + view + '"]');
}

function switchView(view, btn) {
  var target = ADMIN_VIEW_META[view] ? view : 'dashboard';
  document.querySelectorAll('.sidebar-item[data-view]').forEach(function (b) {
    b.classList.remove('active');
  });
  var activeButton = btn || getViewButton(target);
  if (activeButton) activeButton.classList.add('active');

  document.querySelectorAll('.admin-view').forEach(function (v) {
    v.classList.remove('active');
  });
  var viewEl = document.getElementById('view-' + target);
  if (viewEl) viewEl.classList.add('active');

  var meta = ADMIN_VIEW_META[target] || ADMIN_VIEW_META.dashboard;
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = '<span class="text-gold">' + meta.title + '</span>';
  var subtitleEl = document.getElementById('topbar-subtitle');
  if (subtitleEl) subtitleEl.textContent = meta.subtitle;
  var contextChip = document.getElementById('topbar-context-chip');
  if (contextChip) contextChip.textContent = meta.context;
  document.title = 'Elysian Admin - ' + meta.title;

  if (window.location.hash !== '#' + target) {
    history.replaceState(null, '', '#' + target);
  }
}

function syncViewFromHash() {
  var view = (window.location.hash || '#dashboard').replace('#', '');
  switchView(view);
}

function formatMoneyFromCents(cents) {
  return '$' + ((parseInt(cents, 10) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

var adminQuotes = [];
var adminOrders = [];
var adminTickets = [];
var adminOpsStatus = null;
var activeQuoteId = null;
var adminInitialized = false;

// ── Data ──────────────────────────────────────────────────────
var DEFAULT_PCS = [
  { id:'sovereign-x',    name:'Elysian Sovereign X',    price:6499, category:'workstation', badge:'Flagship',     tags:['4k','workstation','flagship','content creation'], specs:{ CPU:'Intel Core i9-14900KS',          GPU:'NVIDIA RTX 4090 24GB',      RAM:'64GB DDR5-6400',   Storage:'4TB NVMe Gen5 SSD',    Cooling:'420mm Custom Loop',    Case:'Lian Li O11 Dynamic EVO', PSU:'Seasonic PRIME TX-1600W',       OS:'Windows 11 Pro' }},
  { id:'apex-pro',       name:'Elysian Apex Pro',       price:4299, category:'gaming',      badge:'Best Seller',  tags:['1440p','gaming','best seller','high refresh'],     specs:{ CPU:'AMD Ryzen 9 7950X3D',             GPU:'NVIDIA RTX 4080 Super 16GB',RAM:'32GB DDR5-5600',   Storage:'2TB NVMe Gen4 SSD',    Cooling:'360mm AIO',            Case:'Fractal Torrent RGB',     PSU:'Corsair HX1200',                OS:'Windows 11 Pro' }},
  { id:'origin',         name:'Elysian Origin',         price:2899, category:'entry',       badge:'',             tags:['entry level','1440p','starter','value'],           specs:{ CPU:'Intel Core i7-14700K',            GPU:'NVIDIA RTX 4070 Ti Super',  RAM:'32GB DDR5-5200',   Storage:'1TB NVMe Gen4 SSD',    Cooling:'280mm AIO',            Case:'NZXT H9 Flow',            PSU:"be quiet! Straight Power 1000W",OS:'Windows 11 Home' }},
  { id:'aurora-creator', name:'Elysian Aurora Creator', price:5199, category:'creator',     badge:'Creator Pick', tags:['creator','4k','rendering','editing'],              specs:{ CPU:'AMD Ryzen Threadripper PRO 7960X',GPU:'NVIDIA RTX 4090 24GB',      RAM:'128GB DDR5 ECC',   Storage:'8TB NVMe RAID Array',  Cooling:'Custom Hardline Loop', Case:'Enthoo 719 Full Tower',   PSU:'Seasonic PRIME TX-2000W',       OS:'Windows 11 Pro for Workstations' }},
  { id:'spectre-gaming', name:'Elysian Spectre Gaming', price:3499, category:'gaming',      badge:'Gaming',       tags:['gaming','1440p','streaming','rgb'],                specs:{ CPU:'Intel Core i9-14900K',            GPU:'NVIDIA RTX 4080 Super 16GB',RAM:'32GB DDR5-6000',   Storage:'2TB NVMe Gen4 SSD',    Cooling:'360mm AIO',            Case:'Cooler Master HAF 700 EVO',PSU:'Corsair HX1000i',              OS:'Windows 11 Home' }},
  { id:'phantom-mini',   name:'Elysian Phantom Mini',   price:2199, category:'entry',       badge:'Compact',      tags:['budget','entry level','compact','small form factor'], specs:{ CPU:'Intel Core i7-14700KF',           GPU:'NVIDIA RTX 4070 Super',     RAM:'32GB DDR5-5600',   Storage:'1TB NVMe Gen4 SSD',    Cooling:'240mm AIO',            Case:'Lian Li Q58',             PSU:'SFX-L 850W Gold',               OS:'Windows 11 Home' }}
];

var adminPCs       = [];
var editingSpecId  = null;
var hasUnsaved     = false;
var ADMIN_TOKEN_KEY = 'elysian-admin-token';

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeTags(tags) {
  var source = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return source
    .map(function (tag) { return String(tag || '').trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function (tag, idx, arr) { return arr.indexOf(tag) === idx; })
    .slice(0, 8);
}

function deriveTags(pc) {
  var tags = [];
  var price = parseInt(pc && pc.price, 10) || 0;
  var gpu = String(pc && pc.specs && pc.specs.GPU || '').toLowerCase();
  var name = String(pc && pc.name || '').toLowerCase();
  var category = String(pc && pc.category || '').toLowerCase();

  if (category === 'gaming') tags.push('gaming');
  if (category === 'creator') tags.push('creator');
  if (category === 'workstation') tags.push('workstation');
  if (category === 'entry') tags.push('entry level');

  if (price && price < 2500) tags.push('budget');
  if (gpu.indexOf('4090') !== -1 || price >= 5000) tags.push('4k');
  else if (gpu.indexOf('4080') !== -1 || gpu.indexOf('4070') !== -1) tags.push('1440p');

  if (name.indexOf('mini') !== -1 || name.indexOf('compact') !== -1) tags.push('compact');

  return normalizeTags(tags);
}

function normalizePC(pc, fallback) {
  var merged = Object.assign({}, fallback || {}, pc || {});
  merged.specs = (pc && pc.specs && typeof pc.specs === 'object') ? pc.specs : ((fallback && fallback.specs) || {});
  merged.tags = normalizeTags((pc && pc.tags) || (fallback && fallback.tags) || deriveTags(merged));
  return merged;
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function setElementText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadCatalogData() {
  try {
    var res  = await fetch('/api/pcs', { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }
    var data = await res.json();
    adminPCs = (data && data.pcs && data.pcs.length)
      ? data.pcs.map(function (pc) {
          var fallback = DEFAULT_PCS.find(function (item) { return item.id === pc.id; });
          return normalizePC(pc, fallback);
        })
      : DEFAULT_PCS.map(function (pc) { return normalizePC(pc); });
  } catch (e) {
    adminPCs = DEFAULT_PCS.map(function (pc) { return normalizePC(pc); });
  }
}

async function initAdmin() {
  if (adminInitialized) {
    await refreshAdminData(true);
    return;
  }
  adminInitialized = true;
  await refreshAdminData(true);
  syncViewFromHash();
}

async function refreshAdminData(silent) {
  var refreshButton = document.querySelector('.admin-topbar-actions button[onclick="refreshAdminData()"]');
  var originalText = refreshButton ? refreshButton.textContent : '';

  try {
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Refreshing...';
    }

    await loadCatalogData();
    renderTable();
    await Promise.all([
      loadQuotes(),
      loadOrders(),
      loadTickets(),
      typeof loadOperationalStatus === 'function' ? loadOperationalStatus() : Promise.resolve()
    ]);
    updateOperationsContext();
    updateStats();

    if (!silent) {
      Toast.success('Admin data refreshed.');
    }
  } catch (error) {
    console.error('Admin refresh failed:', error);
    if (!silent) {
      Toast.error('Unable to refresh all admin data right now.');
    }
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = originalText || 'Refresh';
    }
  }
}

// ── Stats ─────────────────────────────────────────────────────
function countQuotesNeedingReview() {
  return adminQuotes.filter(function (quote) {
    return quote.status === 'requested' || quote.status === 'under_review';
  }).length;
}

function countOrdersNeedingAttention() {
  return adminOrders.filter(function (order) {
    return order.paymentStatus !== 'paid';
  }).length;
}

function countOpenTickets() {
  return adminTickets.filter(function (ticket) {
    return ticket.status !== 'resolved' && ticket.status !== 'closed';
  }).length;
}

function countOperationalIssues() {
  if (!adminOpsStatus || !adminOpsStatus.summary) return 0;
  return (parseInt(adminOpsStatus.summary.errors, 10) || 0)
    + (parseInt(adminOpsStatus.summary.warnings, 10) || 0)
    + (parseInt(adminOpsStatus.summary.failedNotifications, 10) || 0);
}

function updateBadge(id, count, label) {
  var badge = document.getElementById(id);
  if (!badge) return;
  if (!count) {
    badge.style.display = 'none';
    badge.textContent = '0';
    return;
  }
  badge.style.display = 'inline-flex';
  badge.textContent = label || String(count);
}

function updateWorkspaceBadges() {
  updateBadge('notif-quotes', countQuotesNeedingReview());
  updateBadge('notif-orders', countOrdersNeedingAttention());
  updateBadge('notif-tickets', countOpenTickets());
  updateBadge('notif-operations', countOperationalIssues());
  updateBadge('notif-unsaved', hasUnsaved ? 1 : 0, hasUnsaved ? '!' : '');
}

function renderOverview() {
  var priorityList = document.getElementById('dashboard-priority-list');
  var workspaceMap = document.getElementById('dashboard-workspace-map');
  if (!priorityList || !workspaceMap) return;

  var quoteRequested = adminQuotes.filter(function (quote) { return quote.status === 'requested'; }).length;
  var quoteReview = adminQuotes.filter(function (quote) { return quote.status === 'under_review'; }).length;
  var orderAwaitingBalance = adminOrders.filter(function (order) { return order.status === 'awaiting_balance'; }).length;
  var orderRetryStates = adminOrders.filter(function (order) {
    return order.paymentStatus === 'failed' || order.paymentStatus === 'expired';
  }).length;
  var orderWaitingOnPayment = adminOrders.filter(function (order) {
    return order.paymentStatus === 'payment_link_created' || order.status === 'pending_payment';
  }).length;
  var highPriorityTickets = adminTickets.filter(function (ticket) {
    return ticket.priority === 'high' && ticket.status !== 'resolved' && ticket.status !== 'closed';
  }).length;

  var items = [];
  if (hasUnsaved) {
    items.push({
      title: 'Catalog changes are still local',
      meta: 'You have unpublished catalog edits in progress. Save from the Catalog workspace before leaving the admin panel.',
      actionLabel: 'Save Catalog',
      action: 'saveAllChanges()'
    });
  }
  if (quoteRequested || quoteReview) {
    items.push({
      title: 'Quote review queue needs attention',
      meta: quoteRequested + ' new request(s) and ' + quoteReview + ' in-review quote(s) are waiting on compatibility or pricing work.',
      actionLabel: 'Open Quotes',
      action: 'switchView("quotes")'
    });
  }
  if (orderWaitingOnPayment || orderAwaitingBalance || orderRetryStates) {
    items.push({
      title: 'Orders need payment follow-up',
      meta: orderWaitingOnPayment + ' waiting on first payment, ' + orderAwaitingBalance + ' awaiting balance, and ' + orderRetryStates + ' in retry-relevant states.',
      actionLabel: 'Open Orders',
      action: 'switchView("orders")'
    });
  }
  if (countOpenTickets() || highPriorityTickets) {
    items.push({
      title: 'Support queue needs triage',
      meta: countOpenTickets() + ' active ticket(s) and ' + highPriorityTickets + ' high-priority conversation(s) still need admin follow-up.',
      actionLabel: 'Open Tickets',
      action: 'switchView("support")'
    });
  }
  if (adminOpsStatus && adminOpsStatus.summary && (adminOpsStatus.summary.errors || adminOpsStatus.summary.warnings || adminOpsStatus.summary.failedNotifications)) {
    items.push({
      title: 'Operational readiness needs attention',
      meta: (adminOpsStatus.summary.errors || 0) + ' config error(s), ' + (adminOpsStatus.summary.warnings || 0) + ' warning(s), and ' + (adminOpsStatus.summary.failedNotifications || 0) + ' recent notification failure(s) need review.',
      actionLabel: 'Open Operations',
      action: 'switchView("operations")'
    });
  }

  if (!items.length) {
    priorityList.innerHTML = '<div class="detail-empty">Everything critical is caught up right now. Use the workspace links below for deeper review.</div>';
  } else {
    priorityList.innerHTML = items.map(function (item) {
      return '<div class="attention-item">'
        + '<div>'
        +   '<div class="attention-item-title">' + escapeAttr(item.title) + '</div>'
        +   '<div class="attention-item-meta">' + escapeAttr(item.meta) + '</div>'
        + '</div>'
        + '<div class="attention-actions">'
        +   '<button class="btn btn-ghost btn-sm" type="button" onclick="' + escapeAttr(item.action) + '">' + escapeAttr(item.actionLabel) + '</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  var avgPrice = adminPCs.length
    ? '$' + Math.round(adminPCs.reduce(function (sum, pc) { return sum + pc.price; }, 0) / adminPCs.length).toLocaleString()
    : 'No catalog pricing';

  var workspaces = [
    {
      title: 'Commerce',
      copy: countQuotesNeedingReview() + ' quote(s) need review, and ' + countOrdersNeedingAttention() + ' order(s) still need payment-side attention. Use Quotes for approval work and Orders for Stripe-confirmed state.'
    },
    {
      title: 'Catalog',
      copy: adminPCs.length + ' public build(s) are live in the catalog. Average listed price is ' + avgPrice + '. Unsaved edits stay local until you publish them from the editor.'
    },
    {
      title: 'Support',
      copy: countOpenTickets() + ' ticket(s) are active. Linked order IDs stay visible here so payment and support context do not get mixed together.'
    },
    {
      title: 'Operations',
      copy: 'Keep public entry points, route context, and workflow boundaries in one place so the rest of the admin stays focused on queue work.'
    }
  ];

  workspaceMap.innerHTML = workspaces.map(function (item) {
    return '<div class="workspace-map-card">'
      + '<div class="workspace-map-title">' + escapeAttr(item.title) + '</div>'
      + '<div class="workspace-map-copy">' + escapeAttr(item.copy) + '</div>'
      + '</div>';
  }).join('');
}

function updateOperationsContext() {
  setElementText('ops-current-route', window.location.pathname || '/admin/');
}

function legacyUpdateStats() {
  var n = adminPCs.length;
  setElementText('stat-builds', String(n));
  if (!n) {
    setElementText('stat-builds-sub', 'No public builds are currently listed.');
  } else {
    var prices = adminPCs.map(function (pc) { return pc.price; });
    var avgPrice = Math.round(prices.reduce(function (sum, value) { return sum + value; }, 0) / n);
    setElementText(
      'stat-builds-sub',
      'Average price $' + avgPrice.toLocaleString() + ' across ' + n + ' listed build' + (n === 1 ? '' : 's')
    );
  }

  var quoteReviewCount = countQuotesNeedingReview();
  setElementText('stat-quotes-open', String(quoteReviewCount));
  setElementText('stat-quotes-open-sub', quoteReviewCount
    ? 'New or in-review quote requests waiting on compatibility or pricing'
    : 'Quote queue is currently clear');

  var orderAttentionCount = countOrdersNeedingAttention();
  setElementText('stat-orders-attention', String(orderAttentionCount));

  setElementText('stat-orders-attention-sub', orderAttentionCount
    ? 'Orders still waiting on payment completion or retry action'
    : 'All tracked orders are currently settled');
  if (el) el.textContent = 'min → $' + Math.max.apply(null, prices).toLocaleString();

  // Category progress bars
  var cats = { gaming: 0, workstation: 0, creator: 0, entry: 0 };
  adminPCs.forEach(function (p) { if (cats[p.category] !== undefined) cats[p.category]++; });
  Object.keys(cats).forEach(function (cat) {
    var count = cats[cat];
    var pct   = n ? Math.round((count / n) * 100) : 0;
    var bar   = document.getElementById('prog-' + cat);
    var lbl   = document.getElementById('prog-' + cat + '-pct');
    if (bar) bar.style.width = pct + '%';
    if (lbl) lbl.textContent = count + ' build' + (count !== 1 ? 's' : '');
  });

  // Top builds by price
  var sorted  = adminPCs.slice().sort(function (a, b) { return b.price - a.price; }).slice(0, 5);
  var topList = document.getElementById('top-builds-list');
  if (topList) {
    topList.innerHTML = sorted.map(function (pc) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--border-subtle);">'
        + '<span style="font-size:0.83rem;color:var(--text-secondary);">' + pc.name + '</span>'
        + '<span style="font-family:var(--font-display);font-size:0.85rem;color:var(--gold-pure);">$' + pc.price.toLocaleString() + '</span>'
        + '</div>';
    }).join('');
  }

  renderAnalytics();
}

function legacyRenderAnalytics() {
  var cats      = { gaming: [], workstation: [], creator: [], entry: [] };
  var catColors = { gaming: '#3b82f6', workstation: 'var(--gold-pure)', creator: '#8e44ad', entry: '#27ae60' };
  adminPCs.forEach(function (p) { if (cats[p.category]) cats[p.category].push(p); });

  var catEl = document.getElementById('analytics-categories');
  if (catEl) {
    catEl.innerHTML = Object.keys(cats).map(function (cat) {
      var count = cats[cat].length;
      var pct   = adminPCs.length ? Math.round((count / adminPCs.length) * 100) : 0;
      return '<div class="progress-row" style="margin:0;">'
        + '<div class="progress-label"><span style="text-transform:capitalize;">' + cat + '</span><span>' + count + ' builds (' + pct + '%)</span></div>'
        + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:' + catColors[cat] + ';"></div></div>'
        + '</div>';
    }).join('');
  }

  var tiers = [
    { label: 'Entry ($0–$2.5k)', count: adminPCs.filter(function (p) { return p.price < 2500; }).length },
    { label: 'Mid ($2.5k–$4k)',  count: adminPCs.filter(function (p) { return p.price >= 2500 && p.price < 4000; }).length },
    { label: 'High ($4k–$6k)',   count: adminPCs.filter(function (p) { return p.price >= 4000 && p.price < 6000; }).length },
    { label: 'Elite ($6k+)',     count: adminPCs.filter(function (p) { return p.price >= 6000; }).length }
  ];
  var priceEl = document.getElementById('analytics-prices');
  if (priceEl) {
    priceEl.innerHTML = tiers.map(function (t) {
      var pct = adminPCs.length ? Math.round((t.count / adminPCs.length) * 100) : 0;
      return '<div class="progress-row" style="margin:0;">'
        + '<div class="progress-label"><span>' + t.label + '</span><span>' + t.count + '</span></div>'
        + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:var(--gold-pure);"></div></div>'
        + '</div>';
    }).join('');
  }

  var maxPrice = Math.max.apply(null, adminPCs.map(function (p) { return p.price; }).concat([1]));
  var barsEl   = document.getElementById('analytics-bars');
  if (barsEl) {
    barsEl.innerHTML = adminPCs.slice().sort(function (a, b) { return b.price - a.price; }).map(function (pc) {
      var pct = Math.round((pc.price / maxPrice) * 100);
      return '<div style="display:flex;align-items:center;gap:1rem;">'
        + '<span style="font-size:0.78rem;color:var(--text-secondary);width:200px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + pc.name + '</span>'
        + '<div style="flex:1;height:8px;border-radius:4px;background:var(--bg-primary);overflow:hidden;">'
        + '<div style="height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gold-dim),var(--gold-pure));width:' + pct + '%;transition:width 0.8s var(--ease-gold);"></div>'
        + '</div>'
        + '<span style="font-family:var(--font-display);font-size:0.8rem;color:var(--gold-pure);width:70px;text-align:right;flex-shrink:0;">$' + pc.price.toLocaleString() + '</span>'
        + '</div>';
    }).join('');
  }
}

function updateStats() {
  var n = adminPCs.length;
  setElementText('stat-builds', String(n));
  if (!n) {
    setElementText('stat-builds-sub', 'No public builds are currently listed.');
  } else {
    var prices = adminPCs.map(function (pc) { return pc.price; });
    var avgPrice = Math.round(prices.reduce(function (sum, value) { return sum + value; }, 0) / n);
    setElementText(
      'stat-builds-sub',
      'Average price $' + avgPrice.toLocaleString() + ' across ' + n + ' listed build' + (n === 1 ? '' : 's')
    );
  }

  var quoteReviewCount = countQuotesNeedingReview();
  setElementText('stat-quotes-open', String(quoteReviewCount));
  setElementText('stat-quotes-open-sub', quoteReviewCount
    ? 'New or in-review quote requests waiting on compatibility or pricing'
    : 'Quote queue is currently clear');

  var orderAttentionCount = countOrdersNeedingAttention();
  setElementText('stat-orders-attention', String(orderAttentionCount));
  setElementText('stat-orders-attention-sub', orderAttentionCount
    ? 'Orders still waiting on payment completion or retry action'
    : 'All tracked orders are currently settled');

  var openTicketCount = countOpenTickets();
  setElementText('stat-tickets-open', String(openTicketCount));
  setElementText('stat-tickets-open-sub', openTicketCount
    ? 'Support tickets still needing admin follow-up'
    : 'Support queue is currently clear');

  renderOverview();
  updateWorkspaceBadges();
  renderAnalytics();
}

function renderAnalytics() {
  if (!adminPCs.length) {
    var emptyMessage = '<div class="detail-empty">No catalog builds are available yet.</div>';
    var categories = document.getElementById('analytics-categories');
    var prices = document.getElementById('analytics-prices');
    var bars = document.getElementById('analytics-bars');
    if (categories) categories.innerHTML = emptyMessage;
    if (prices) prices.innerHTML = emptyMessage;
    if (bars) bars.innerHTML = emptyMessage;
    return;
  }

  var cats = { gaming: [], workstation: [], creator: [], entry: [] };
  var catColors = { gaming: '#3b82f6', workstation: 'var(--gold-pure)', creator: '#8e44ad', entry: '#27ae60' };
  adminPCs.forEach(function (pc) {
    if (cats[pc.category]) cats[pc.category].push(pc);
  });

  var catEl = document.getElementById('analytics-categories');
  if (catEl) {
    catEl.innerHTML = Object.keys(cats).map(function (cat) {
      var count = cats[cat].length;
      var pct = adminPCs.length ? Math.round((count / adminPCs.length) * 100) : 0;
      return '<div class="progress-row" style="margin:0;">'
        + '<div class="progress-label"><span style="text-transform:capitalize;">' + cat + '</span><span>' + count + ' builds (' + pct + '%)</span></div>'
        + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:' + catColors[cat] + ';"></div></div>'
        + '</div>';
    }).join('');
  }

  var tiers = [
    { label: 'Entry ($0-$2.5k)', count: adminPCs.filter(function (pc) { return pc.price < 2500; }).length },
    { label: 'Mid ($2.5k-$4k)', count: adminPCs.filter(function (pc) { return pc.price >= 2500 && pc.price < 4000; }).length },
    { label: 'High ($4k-$6k)', count: adminPCs.filter(function (pc) { return pc.price >= 4000 && pc.price < 6000; }).length },
    { label: 'Elite ($6k+)', count: adminPCs.filter(function (pc) { return pc.price >= 6000; }).length }
  ];
  var priceEl = document.getElementById('analytics-prices');
  if (priceEl) {
    priceEl.innerHTML = tiers.map(function (tier) {
      var pct = adminPCs.length ? Math.round((tier.count / adminPCs.length) * 100) : 0;
      return '<div class="progress-row" style="margin:0;">'
        + '<div class="progress-label"><span>' + tier.label + '</span><span>' + tier.count + '</span></div>'
        + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;background:var(--gold-pure);"></div></div>'
        + '</div>';
    }).join('');
  }

  var maxPrice = Math.max.apply(null, adminPCs.map(function (pc) { return pc.price; }).concat([1]));
  var barsEl = document.getElementById('analytics-bars');
  if (barsEl) {
    barsEl.innerHTML = adminPCs.slice().sort(function (a, b) { return b.price - a.price; }).map(function (pc) {
      var pct = Math.round((pc.price / maxPrice) * 100);
      return '<div style="display:flex;align-items:center;gap:1rem;">'
        + '<span style="font-size:0.78rem;color:var(--text-secondary);width:200px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + pc.name + '</span>'
        + '<div style="flex:1;height:8px;border-radius:4px;background:var(--bg-primary);overflow:hidden;">'
        + '<div style="height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gold-dim),var(--gold-pure));width:' + pct + '%;transition:width 0.8s var(--ease-gold);"></div>'
        + '</div>'
        + '<span style="font-family:var(--font-display);font-size:0.8rem;color:var(--gold-pure);width:70px;text-align:right;flex-shrink:0;">$' + pc.price.toLocaleString() + '</span>'
        + '</div>';
    }).join('');
  }
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
    var req = quote.requestSnapshot || {};
    var budget = req.budget || '—';
    var useCase = req.useCase || 'mixed';
    return '<tr>'
      + '<td style="padding:0.9rem 1rem;">'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + quote.customerName + '</div>'
      +   '<div class="text-secondary" style="font-size:0.8rem;">' + quote.customerEmail + '</div>'
      + '</td>'
      + '<td style="padding:0.9rem 1rem;">'
      +   '<div style="font-weight:600;color:var(--text-primary);">' + quote.id + '</div>'
      +   '<div class="text-secondary" style="font-size:0.8rem;text-transform:capitalize;">' + useCase + ' • ' + budget + '</div>'
      + '</td>'
      + '<td style="padding:0.9rem 1rem;text-transform:capitalize;">' + quote.status.replace(/_/g, ' ') + '</td>'
      + '<td style="padding:0.9rem 1rem;text-transform:capitalize;">' + quote.paymentMode.replace(/_/g, ' ') + '</td>'
      + '<td style="padding:0.9rem 1rem;">' + (quote.subtotalCents ? formatMoneyFromCents(quote.subtotalCents) : '—') + '</td>'
      + '<td style="padding:0.9rem 1rem;">'
      +   '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">'
      +     '<button class="btn btn-ghost btn-sm" onclick="reviewQuote(\'' + quote.id + '\')">Review</button>'
      +     '<button class="btn btn-outline btn-sm" onclick="approveQuote(\'' + quote.id + '\')">Approve</button>'
      +     '<button class="btn btn-primary btn-sm" onclick="createQuotePaymentLink(\'' + quote.id + '\')">Payment Link</button>'
      +   '</div>'
      + '</td>'
      + '</tr>';
  }).join('');
}

function legacyReviewQuote(quoteId) {
  var quote = adminQuotes.find(function (item) { return item.id === quoteId; });
  if (!quote) return;
  var request = quote.requestSnapshot || {};
  var summary = [
    'Customer: ' + quote.customerName,
    'Email: ' + quote.customerEmail,
    'Budget: ' + (request.budget || '—'),
    'Use Case: ' + (request.useCase || 'mixed'),
    'Timeframe: ' + (request.timeframe || '—'),
    '',
    'Requirements:',
    request.notes || 'No notes provided.',
  ].join('\n');
  window.alert(summary);
}

async function legacyApproveQuote(quoteId) {
  var quote = adminQuotes.find(function (item) { return item.id === quoteId; });
  if (!quote) return;

  var subtotal = window.prompt('Enter approved subtotal in USD, e.g. 5499.00', quote.subtotalCents ? String((quote.subtotalCents / 100).toFixed(2)) : '');
  if (subtotal === null) return;

  var paymentMode = window.prompt('Payment mode: "full" or "deposit"', quote.paymentMode === 'deposit_first' ? 'deposit' : 'full');
  if (paymentMode === null) return;

  var subtotalCents = Math.round(parseFloat(subtotal) * 100);
  if (!subtotalCents) {
    Toast.error('A valid subtotal is required.');
    return;
  }

  var mode = String(paymentMode).trim().toLowerCase() === 'deposit' ? 'deposit_first' : 'full_payment';
  var depositCents = 0;
  if (mode === 'deposit_first') {
    var deposit = window.prompt('Enter the deposit amount in USD', quote.depositCents ? String((quote.depositCents / 100).toFixed(2)) : '');
    if (deposit === null) return;
    depositCents = Math.round(parseFloat(deposit) * 100);
    if (!depositCents || depositCents >= subtotalCents) {
      Toast.error('Deposit must be less than the subtotal.');
      return;
    }
  }

  try {
    var response = await fetch('/api/admin/quotes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        quoteId: quoteId,
        subtotalCents: subtotalCents,
        paymentMode: mode,
        depositCents: depositCents,
        configSnapshot: quote.configSnapshot || {}
      })
    });
    var data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to approve quote.');
    Toast.success('Quote approved and ready for manual payment link generation.');
    loadQuotes();
  } catch (error) {
    Toast.error(error.message || 'Unable to approve quote.');
  }
}

async function legacyCreateQuotePaymentLink(quoteId) {
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
      Toast.success('Manual payment link created.');
      loadQuotes();
    }
  } catch (error) {
    Toast.error(error.message || 'Unable to create payment link.');
  }
}

// ── Table ─────────────────────────────────────────────────────
function renderTable() {
  var tbody = document.getElementById('pc-editor-body');
  if (!tbody) return;
  tbody.innerHTML = adminPCs.map(function (pc, idx) {
    var tagsValue = normalizeTags(pc.tags).join(', ');
    return '<tr>'
      + '<td><input class="inline-input" value="' + escapeAttr(pc.name) + '" onchange="adminPCs[' + idx + '].name=this.value;markDirty()" style="min-width:180px;"></td>'
      + '<td><input class="inline-input" type="number" value="' + pc.price + '" onchange="adminPCs[' + idx + '].price=parseInt(this.value)||0;updateStats();markDirty()" style="width:100px;"></td>'
      + '<td><select class="inline-input" onchange="adminPCs[' + idx + '].category=this.value;markDirty()" style="width:130px;">'
      + ['workstation','gaming','creator','entry'].map(function (c) {
          return '<option value="' + c + '"' + (pc.category === c ? ' selected' : '') + '>' + c + '</option>';
        }).join('')
      + '</select></td>'
      + '<td><input class="inline-input" value="' + escapeAttr(pc.badge || '') + '" onchange="adminPCs[' + idx + '].badge=this.value;markDirty()" style="width:120px;"></td>'
      + '<td><input class="inline-input" value="' + escapeAttr(tagsValue) + '" placeholder="budget, 1440p, creator" onchange="adminPCs[' + idx + '].tags=normalizeTags(this.value);markDirty()" style="min-width:220px;"></td>'
      + '<td><div style="display:flex;gap:0.5rem;">'
      + '<button class="btn btn-ghost btn-sm" onclick="openSpecModal(' + idx + ')">Specs</button>'
      + '<button class="btn btn-sm" style="background:rgba(192,57,43,0.12);color:var(--accent-red);border:1px solid rgba(192,57,43,0.25);" onclick="deletePC(' + idx + ')">Delete</button>'
      + '</div></td>'
      + '</tr>';
  }).join('');
}

function markDirty() {
  hasUnsaved = true;
  var banner = document.getElementById('save-banner');
  if (banner) banner.classList.add('visible');
  updateWorkspaceBadges();
  renderOverview();
}

function openSpecModal(idx) {
  editingSpecId = idx;
  var pc = adminPCs[idx];
  var titleEl = document.getElementById('spec-modal-title');
  if (titleEl) titleEl.textContent = 'Specs: ' + pc.name;
  var fields = document.getElementById('spec-editor-fields');
  if (fields) {
    fields.innerHTML = Object.keys(pc.specs).map(function (k) {
      return '<div class="form-group" style="margin:0;">'
        + '<label class="form-label">' + k + '</label>'
        + '<input class="form-control" data-spec-key="' + k + '" value="' + pc.specs[k] + '">'
        + '</div>';
    }).join('');
  }
  var modal = document.getElementById('spec-modal');
  if (modal) modal.classList.add('open');
}

function closeSpecModal() {
  var modal = document.getElementById('spec-modal');
  if (modal) modal.classList.remove('open');
  editingSpecId = null;
}

function saveSpecsFromModal() {
  if (editingSpecId === null) return;
  document.querySelectorAll('#spec-editor-fields input[data-spec-key]').forEach(function (input) {
    adminPCs[editingSpecId].specs[input.dataset.specKey] = input.value;
  });
  markDirty();
  closeSpecModal();
  Toast.success('Specs updated!');
}

function addNewPC() {
  adminPCs.push({
    id: 'custom-' + Date.now(),
    name: 'New Custom Build',
    price: 3000,
    category: 'gaming',
    badge: '',
    tags: ['gaming', '1440p'],
    specs: { CPU:'TBD', GPU:'TBD', RAM:'TBD', Storage:'TBD', Cooling:'TBD', Case:'TBD', PSU:'TBD', OS:'Windows 11 Home' }
  });
  renderTable();
  updateStats();
  markDirty();
  switchView('catalog', document.querySelector('[data-view="catalog"]'));
  Toast.info('New build added — fill in the details.');
}

function deletePC(idx) {
  if (!confirm('Delete "' + adminPCs[idx].name + '"?')) return;
  adminPCs.splice(idx, 1);
  renderTable();
  updateStats();
  markDirty();
  Toast.info('Build removed.');
}

async function saveAllChanges() {
  var btns = document.querySelectorAll('[onclick="saveAllChanges()"]');
  btns.forEach(function (b) { b.disabled = true; b.textContent = 'Saving...'; });
  try {
    var payloadPCs = adminPCs.map(function (pc) { return normalizePC(pc); });
    var headers = { 'Content-Type': 'application/json' };
    var adminToken = getAdminToken();
    if (adminToken) headers['X-Admin-Token'] = adminToken;

    var res = await fetch('/api/pcs', {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: JSON.stringify({ pcs: payloadPCs })
    });

    if (res.status === 401) {
      window.location.href = '/admin/login/';
      return;
    }

    if (res.ok) {
      adminPCs = payloadPCs;
      hasUnsaved = false;
      var banner = document.getElementById('save-banner');
      if (banner) banner.classList.remove('visible');
      updateStats();
      Toast.success('Catalog changes saved.');
    } else {
      var err;
      try {
        err = await res.json();
      } catch (parseError) {
        err = { error: 'Save failed. Check the catalog storage bindings.' };
      }
      Toast.error(err.error || 'Save failed. Check the catalog storage bindings.');
    }
  } catch (e) {
    Toast.error('Network error while saving changes. Ensure Functions are deployed.');
  } finally {
    btns.forEach(function (b) { b.disabled = false; b.textContent = 'Save Catalog'; });
  }
}

// Spec modal overlay close
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('spec-modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closeSpecModal();
    });
  }
});

