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

  <!-- Particles -->
  <canvas id="particles-canvas"></canvas>

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
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="assets/logo.jpg" alt="Elysian PCs Logo" onerror="this.style.display='none'">
          <div class="footer-brand-name text-gold">ELYSIAN PCS</div>
          <p>Handcrafted luxury computing built for those who demand the absolute best. Every machine is a masterpiece.</p>
          <div class="social-links">
            <a href="#" class="social-icon twitter" aria-label="Twitter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" class="social-icon instagram" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="#" class="social-icon discord" aria-label="Discord">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            </a>
          </div>
        </div>
        <div>
          <div class="footer-heading">Explore</div>
          <ul class="footer-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="builds.html">All Builds</a></li>
            <li><a href="support.html">Support</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">Company</div>
          <ul class="footer-links">
            <li><a href="#">About Us</a></li>
            <li><a href="#">Warranty</a></li>
            <li><a href="#">Shipping</a></li>
            <li><a href="#">Returns</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-heading">Legal</div>
          <ul class="footer-links">
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Cookie Policy</a></li>
          </ul>
        </div>
      </div>
      <div class="gold-divider"></div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} Elysian PCs. All rights reserved.</p>
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
