/* ============================================================
   ELYSIAN PCS — SHARED PARTIALS (injected by each page)
   ============================================================ */

function renderNav() {
  return `
  <!-- Page Loader -->
  <div id="page-loader" class="page-loader">
    <img src="assets/logo.jpg" alt="Elysian PCs" class="loader-logo" onerror="this.style.display='none'">
    <div class="loader-bar"><div class="loader-bar-fill"></div></div>
  </div>

  <!-- Aurora Background -->
  <div id="aurora-bg" aria-hidden="true">
    <div id="aurora-layer"></div>
  </div>

  <!-- Cart Overlay -->
  <div id="cart-overlay" class="cart-overlay"></div>

  <!-- ═══ CART SIDEBAR ═══ -->
  <aside id="cart-sidebar" class="cart-sidebar" role="complementary" aria-label="Shopping Cart">

    <!-- Header -->
    <div class="cart-header">
      <div class="cart-header-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--gold-pure);flex-shrink:0;">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <h3>Your Shopping Cart</h3>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="cart-item-count-label" id="cart-item-count-label">0 items</span>
        <button id="cart-close" class="cart-close" aria-label="Close cart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="cart-divider"></div>

    <!-- Scrollable Items -->
    <div class="cart-items" id="cart-items-list">
      <div id="cart-empty" class="cart-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="color:var(--text-muted);margin-bottom:0.75rem;">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p style="font-family:var(--font-display);font-size:0.85rem;letter-spacing:0.06em;margin-bottom:0.3rem;">Your cart is empty</p>
        <p class="text-muted" style="font-size:0.8rem;">Start shopping!</p>
      </div>
    </div>

    <!-- Footer: totals + checkout -->
    <div class="cart-footer" id="cart-footer" style="display:none;">
      <div class="cart-divider" style="margin-bottom:1.25rem;"></div>

      <div class="cart-totals">
        <div class="cart-totals-row">
          <span>Subtotal</span>
          <span id="cart-subtotal">$0</span>
        </div>
        <div class="cart-totals-row">
          <span>Shipping</span>
          <span id="cart-shipping">$0</span>
        </div>
        <div class="cart-totals-row">
          <span>Tax (8%)</span>
          <span id="cart-tax">$0</span>
        </div>
      </div>

      <div class="cart-divider" style="margin:1rem 0;"></div>

      <div class="cart-totals-row cart-grand-total">
        <span>Total</span>
        <span id="cart-total-amount">$0</span>
      </div>

      <button id="btn-checkout" class="btn btn-primary btn-full btn-lg" style="margin-top:1.25rem;">
        Proceed to Checkout
      </button>
    </div>

  </aside>

  <div class="site-ribbon" role="presentation">
    <div class="site-ribbon-inner">
      <span>Signature builds available now</span>
      <span>Custom quotes reviewed before payment</span>
      <span>Secure Stripe checkout and tracked support</span>
      <a href="request-quote.html">Plan a custom build</a>
    </div>
  </div>

  <!-- Navbar -->
  <nav class="navbar" role="navigation" aria-label="Main navigation">
    <a href="index.html" class="nav-logo">
      <img src="assets/logo.jpg" alt="Elysian PCs Logo" onerror="this.style.display='none'">
      <span>ELYSIAN <span>PCS</span></span>
    </a>

    <ul class="nav-links">
      <li><a href="index.html">Home</a></li>
      <li><a href="builds.html">Builds</a></li>
      <li><a href="support.html">Support</a></li>
    </ul>

    <div class="nav-actions">
      <a href="request-quote.html" class="nav-cta">
        Request a Quote
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 17L17 7"></path>
          <path d="M8 7h9v9"></path>
        </svg>
      </a>
      <button class="theme-toggle" aria-label="Toggle theme"></button>
      <button class="cart-btn" aria-label="Open cart">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <span class="cart-count" style="display:none">0</span>
      </button>
      <button id="nav-hamburger" class="nav-hamburger" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>

  <div id="nav-mobile" class="nav-mobile">
    <a href="index.html">Home</a>
    <a href="builds.html">Builds</a>
    <a href="support.html">Support</a>
  </div>`;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-topband">
        <div>
          <div class="footer-heading">Choose The Right Path</div>
          <p>Browse a listed build when the published configuration already fits, or request a custom quote when you want the system reviewed and refined before payment.</p>
        </div>
        <div class="footer-topband-actions">
          <a href="builds.html" class="btn btn-primary">Browse Builds</a>
          <a href="request-quote.html" class="btn btn-outline">Request A Quote</a>
        </div>
      </div>
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="assets/logo.jpg" alt="Elysian PCs Logo" onerror="this.style.display='none'">
          <div class="footer-brand-name text-gold">ELYSIAN PCS</div>
          <p>Premium systems with clearer buying paths: listed builds for immediate checkout, custom quotes for reviewed configurations, and tracked support after the sale.</p>
          <p class="text-secondary" style="margin-top:1rem;font-size:0.82rem;">Publish public proof links only when the real profiles or case-study pages are ready.</p>
        </div>
        <div>
          <div class="footer-heading">Explore</div>
          <ul class="footer-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="builds.html">All Builds</a></li>
            <li><a href="support.html">Support</a></li>
            <li><a href="request-quote.html">Quote Request</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">Buying Paths</div>
          <ul class="footer-links">
            <li><a href="builds.html">Buy a listed build</a></li>
            <li><a href="request-quote.html">Request a custom quote</a></li>
            <li><a href="support.html">Support an active order</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">What To Expect</div>
          <ul class="footer-links">
            <li><span class="text-secondary">Custom builds are reviewed before payment is requested.</span></li>
            <li><span class="text-secondary">Final pricing and build details are confirmed during quote approval.</span></li>
            <li><span class="text-secondary">Support tickets stay tied to quote and order references.</span></li>
          </ul>
        </div>
      </div>
      <div class="gold-divider"></div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} Elysian PCs. All rights reserved.</p>
        <p>Crafted for those who demand perfection.</p>
      </div>
    </div>
  </footer>`;
}

// Inject partials
document.addEventListener('DOMContentLoaded', () => {
  const navSlot = document.getElementById('nav-slot');
  if (navSlot) navSlot.innerHTML = renderNav();
  const footerSlot = document.getElementById('footer-slot');
  if (footerSlot) footerSlot.innerHTML = renderFooter();
});

