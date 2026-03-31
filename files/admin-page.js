/* ============================================================
   ELYSIAN PCS — Admin Page Logic
   ============================================================ */

// ── Auth ──────────────────────────────────────────────────────
var ADMIN_HASH = 'elysian_admin_2024';

function authenticate() {
  var pw = document.getElementById('admin-pw').value;
  if (pw === ADMIN_HASH || btoa(pw) === 'ZWx5c2lhbl9hZG1pbl8yMDI0') {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('admin-panel').classList.add('visible');
    document.body.classList.add('unlocked');
    sessionStorage.setItem('elysian-admin', '1');
    initAdmin();
  } else {
    document.getElementById('auth-error').style.display = 'block';
    document.getElementById('admin-pw').value = '';
    document.getElementById('admin-pw').focus();
    document.getElementById('admin-pw').style.borderColor = 'var(--accent-red)';
    setTimeout(function () {
      document.getElementById('admin-pw').style.borderColor = '';
    }, 1500);
  }
}

function signOut() {
  sessionStorage.removeItem('elysian-admin');
  location.reload();
}

// Auto-restore session on page load
document.addEventListener('DOMContentLoaded', function () {
  if (sessionStorage.getItem('elysian-admin')) {
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('admin-panel').classList.add('visible');
    document.body.classList.add('unlocked');
    initAdmin();
  }
});

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('admin-sidebar').classList.toggle('collapsed');
}

function switchView(view, btn) {
  document.querySelectorAll('.sidebar-item[data-view]').forEach(function (b) {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.admin-view').forEach(function (v) {
    v.classList.remove('active');
  });
  var viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');

  var labels = { dashboard: 'Dashboard', catalog: 'Catalog Editor', analytics: 'Analytics' };
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.innerHTML = '<span class="text-gold">' + (labels[view] || view) + '</span>';
}

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

async function initAdmin() {
  try {
    var res  = await fetch('/api/pcs');
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
  renderTable();
  updateStats();
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  var n = adminPCs.length;
  var statBuilds = document.getElementById('stat-builds');
  if (statBuilds) statBuilds.textContent = n;
  if (!n) return;

  var prices = adminPCs.map(function (p) { return p.price; });
  var avg    = Math.round(prices.reduce(function (a, b) { return a + b; }, 0) / n);
  var el;

  el = document.getElementById('stat-avg-price');
  if (el) el.textContent = '$' + avg.toLocaleString();

  el = document.getElementById('stat-range');
  if (el) el.textContent = '$' + Math.min.apply(null, prices).toLocaleString();

  el = document.getElementById('stat-range-sub');
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

function renderAnalytics() {
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
  var notif = document.getElementById('notif-unsaved');
  if (notif) notif.style.display = 'inline-flex';
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
      headers: headers,
      body: JSON.stringify({ pcs: payloadPCs })
    });

    if (res.status === 401) {
      var enteredToken = window.prompt('Enter the admin API token for this environment.');
      if (enteredToken) {
        setAdminToken(enteredToken.trim());
        return saveAllChanges();
      }
      Toast.error('Save cancelled: missing admin API token.');
      return;
    }

    if (res.ok) {
      adminPCs = payloadPCs;
      hasUnsaved = false;
      var banner = document.getElementById('save-banner');
      if (banner) banner.classList.remove('visible');
      var notif = document.getElementById('notif-unsaved');
      if (notif) notif.style.display = 'none';
      var savedEl = document.getElementById('stat-saved');
      if (savedEl) savedEl.textContent = new Date().toLocaleTimeString();
      Toast.success('All changes saved to Cloudflare KV!');
    } else {
      var err;
      try {
        err = await res.json();
      } catch (parseError) {
        err = { error: 'Save failed. Check KV binding.' };
      }
      Toast.error(err.error || 'Save failed. Check KV binding.');
    }
  } catch (e) {
    Toast.error('Network error while saving changes. Ensure Functions are deployed.');
  } finally {
    btns.forEach(function (b) { b.disabled = false; b.textContent = 'Save All to KV'; });
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

