/* ============================================================
   ELYSIAN PCS — SHARED JAVASCRIPT
   Aurora BG · Cart · Theme · Nav · Toast · Scroll Reveal
   ============================================================ */

// ── Theme Engine ────────────────────────────────────────────
var ThemeEngine = ThemeEngine || (() => {
  const KEY = 'elysian-theme';
  const root = document.documentElement;

  function get() { return localStorage.getItem(KEY) || 'dark'; }

  function set(theme) {
    localStorage.setItem(KEY, theme);
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.innerHTML = theme === 'dark'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    });
  }

  function toggle() { set(get() === 'dark' ? 'light' : 'dark'); }

  function init() {
    set(get());
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
  }

  return { init, get, set, toggle };
})();

// ── Toast Notifications ──────────────────────────────────────
var Toast = Toast || (() => {
  let container;

  function init() {
    container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }

  const ICONS = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  function show(message, type = 'info', duration = 3500) {
    if (!container) init();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${ICONS[type]}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.4s ease forwards';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  return { init, show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

// ── Cart Engine ──────────────────────────────────────────────
var Cart = Cart || (() => {
  const KEY = 'elysian-cart';

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  function add(item) {
    const items = get();
    const existing = items.find(i => i.id === item.id);
    if (existing) {
      Toast.info(`${item.name} is already in your cart.`);
      return;
    }
    items.push(item);
    save(items);
    render();
    Toast.success(`${item.name} added to cart!`);
    openCart();
  }

  function remove(id) {
    const items = get().filter(i => i.id !== id);
    save(items);
    render();
    Toast.info('Item removed from cart.');
  }

  function clear() { save([]); render(); }

  function count() { return get().length; }

  function total() { return get().reduce((s, i) => s + i.price, 0); }

  function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function render() {
    const items = get();
    const c = items.length;

    // ── Badge counts ──
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = c;
      el.style.display = c > 0 ? 'flex' : 'none';
    });

    // ── Item count label ──
    const countLabel = document.getElementById('cart-item-count-label');
    if (countLabel) countLabel.textContent = `${c} item${c !== 1 ? 's' : ''}`;

    const list   = document.getElementById('cart-items-list');
    const footer = document.getElementById('cart-footer');
    const empty  = document.getElementById('cart-empty');
    if (!list) return;

    // Clear items but keep empty state el
    Array.from(list.children).forEach(child => {
      if (child.id !== 'cart-empty') child.remove();
    });

    if (c === 0) {
      if (empty)  empty.style.display  = 'flex';
      if (footer) footer.style.display = 'none';
      return;
    }

    if (empty)  empty.style.display  = 'none';
    if (footer) footer.style.display = 'block';

    // ── Render each item ──
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div class="cart-item-img-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(212,168,67,0.3)" stroke-width="1">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-per">${fmt(item.price)} per item</div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-price">${fmt(item.price)}</div>
          <button class="cart-item-remove" aria-label="Remove ${item.name}" title="Remove">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>`;
      el.querySelector('.cart-item-remove').addEventListener('click', () => remove(item.id));
      list.appendChild(el);
    });

    // ── Totals ──
    const subtotal = total();
    const shipping = subtotal > 0 ? 5 : 0;
    const tax      = subtotal * 0.08;
    const grand    = subtotal + shipping + tax;

    const s  = document.getElementById('cart-subtotal');
    const sh = document.getElementById('cart-shipping');
    const tx = document.getElementById('cart-tax');
    const gr = document.getElementById('cart-total-amount');
    if (s)  s.textContent  = fmt(subtotal);
    if (sh) sh.textContent = fmt(shipping);
    if (tx) tx.textContent = fmt(tax);
    if (gr) gr.textContent = fmt(grand);
  }

  function openCart() {
    document.getElementById('cart-sidebar')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
  }

  function closeCart() {
    document.getElementById('cart-sidebar')?.classList.remove('open');
    document.getElementById('cart-overlay')?.classList.remove('open');
  }

  function init() {
    render();
    document.querySelectorAll('.cart-btn').forEach(btn => {
      btn.addEventListener('click', openCart);
    });
    document.getElementById('cart-close')?.addEventListener('click', closeCart);
    document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

    document.getElementById('btn-checkout')?.addEventListener('click', async () => {
      const items = get();
      if (!items.length) return Toast.error('Your cart is empty!');
      await initiateCheckout(items);
    });
  }

  async function initiateCheckout(items) {
    const btn = document.getElementById('btn-checkout');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        Toast.error(data.error || 'Checkout failed. Please try again.');
      }
    } catch (e) {
      Toast.error('Network error. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
    }
  }

  return { init, add, remove, clear, count, total, get, render, openCart, closeCart };
})();

// ── Navbar ───────────────────────────────────────────────────
var Navbar = Navbar || (() => {
  function init() {
    const navbar = document.querySelector('.navbar');
    const hamburger = document.getElementById('nav-hamburger');
    const mobileNav = document.getElementById('nav-mobile');

    // Scroll shrink
    if (navbar) {
      window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 40);
      });
    }

    // Hamburger toggle
    if (hamburger && mobileNav) {
      hamburger.addEventListener('click', () => {
        mobileNav.classList.toggle('open');
      });
    }

    // Active link
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
      if (a.getAttribute('href') === current) a.classList.add('active');
    });
  }

  return { init };
})();

// ── Scroll Reveal ────────────────────────────────────────────
var ScrollReveal = ScrollReveal || (() => {
  function init() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
  }

  return { init };
})();

// ── Page Loader ──────────────────────────────────────────────
function initPageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 600);
  });
}

// ── KV Data Fetch (builds page) ──────────────────────────────
async function fetchPCData() {
  try {
    const res = await fetch('/api/pcs');
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch {
    return null;
  }
}

// ── Global Init (guard against double-load) ──────────────────
if (!window.__elysianLoaded) {
  window.__elysianLoaded = true;
  document.addEventListener('DOMContentLoaded', () => {
    initPageLoader();
    ThemeEngine.init();
    Navbar.init();
    Cart.init();
    Toast.init();
    ScrollReveal.init();
  });
}
