# 🖥️ ELYSIAN PCS — Deployment Guide

## Project Structure

```
elysian-pcs/
├── index.html              ← Landing / Home
├── builds.html             ← Product Catalog (KV-powered)
├── support.html            ← EmailJS Support Tickets
├── admin.html              ← Password-Protected Dashboard
├── style.css               ← Dark & Gold Theme Framework
├── main.js                 ← Shared JS (Particles, Cart, Theme...)
├── partials.js             ← Nav + Footer HTML injection
├── wrangler.toml           ← Cloudflare Pages config
├── assets/
│   └── logo.jpg            ← ⚠️ PLACE YOUR logo (image_08d4a3.jpg) HERE
└── functions/
    └── api/
        ├── pcs.js          ← KV data sync (GET/POST)
        └── checkout.js     ← Stripe Checkout session creator
```

---

## Step 1 — Add Your Logo

Rename `image_08d4a3.jpg` to `logo.jpg` and place it in the `assets/` folder.

---

## Step 2 — Create KV Namespace

```bash
npx wrangler kv:namespace create ELYSIAN_DATA
```

Copy the returned `id` and paste it into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "ELYSIAN_DATA"
id = "paste_your_id_here"
```

---

## Step 3 — Set Environment Secrets

**Via CLI (recommended):**
```bash
# Stripe secret key (NEVER expose in client JS)
npx wrangler pages secret put STRIPE_SECRET_KEY
# → paste: sk_test_51T7Snf...

# Optional: Admin token for POST /api/pcs protection
npx wrangler pages secret put ADMIN_TOKEN
# → paste: a strong random string

# Your deployed site URL (for Stripe success/cancel redirects)
npx wrangler pages secret put SITE_URL
# → paste: https://elysian-pcs.pages.dev
```

**Via Cloudflare Dashboard:**
Pages → Your Project → Settings → Environment Variables → Add variable (encrypted)

---

## Step 4 — Deploy to Cloudflare Pages

**Option A — Git Integration (Recommended):**
1. Push this folder to a GitHub/GitLab repo
2. In Cloudflare Dashboard: Pages → Create project → Connect to Git
3. Select your repo
4. Build command: *(leave empty)*
5. Build output directory: `/`
6. Click Deploy

**Option B — Direct Upload:**
```bash
npx wrangler pages deploy . --project-name=elysian-pcs
```

---

## Step 5 — EmailJS Setup

1. Go to https://emailjs.com and sign in
2. Create a new **Email Service** (connect your Gmail: d4yohero@gmail.com)
3. Create a template with ID `template_5furaoz`
4. In the template, map these variables:
   - `{{from_name}}` — Customer name
   - `{{from_email}}` — Customer email  
   - `{{ticket_id}}` — Auto-generated ticket ID
   - `{{order_id}}` — Order reference
   - `{{category}}` — Issue category
   - `{{priority}}` — Priority level
   - `{{subject}}` — Ticket subject
   - `{{message}}` — Full message body
   - `{{timestamp}}` — When submitted

**Suggested template HTML for branding:**
```html
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0c;color:#f0ece4;padding:2rem;border:1px solid #d4a843;">
  <img src="YOUR_LOGO_URL" width="48" style="border-radius:8px;">
  <h2 style="color:#d4a843;font-family:Georgia;">ELYSIAN PCS — Support Ticket</h2>
  <p><strong>Ticket ID:</strong> {{ticket_id}}</p>
  <p><strong>From:</strong> {{from_name}} ({{from_email}})</p>
  <p><strong>Order ID:</strong> {{order_id}}</p>
  <p><strong>Category:</strong> {{category}} | <strong>Priority:</strong> {{priority}}</p>
  <p><strong>Subject:</strong> {{subject}}</p>
  <hr style="border-color:#333;">
  <p>{{message}}</p>
  <hr style="border-color:#333;">
  <small style="color:#5c5856;">Submitted: {{timestamp}}</small>
</div>
```

---

## Admin Panel

**URL:** `https://your-site.pages.dev/admin.html`

**Default Password:** `elysian_admin_2024`

⚠️ **Change the password before going live!**
Open `admin.html` and replace `elysian_admin_2024` on this line:
```js
const ADMIN_HASH = 'elysian_admin_2024';
```
With your own secure password.

For production, implement proper auth (Cloudflare Access, JWT, etc.)

---

## Stripe Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined |
| `4000 0025 0000 3155` | 3D Secure |

Use any future expiry and any 3-digit CVC.

---

## Customization Checklist

- [ ] Replace `assets/logo.jpg` with your actual logo
- [ ] Update `ADMIN_HASH` password in `admin.html`
- [ ] Set all 3 environment secrets in Cloudflare
- [ ] Create KV namespace and update `wrangler.toml`
- [ ] Configure EmailJS template
- [ ] Update social media links in `partials.js`
- [ ] Update `SITE_URL` in `wrangler.toml`
- [ ] Switch Stripe keys from test (`pk_test_`) to live (`pk_live_`) when ready

---

## Theme Customization

All colors are CSS variables in `style.css`. Key ones:

```css
--gold-pure: #d4a843;    /* Primary gold */
--gold-light: #f0c96b;   /* Lighter gold for text */
--bg-primary: #0a0a0c;   /* Darkest background */
--bg-card: #16161d;      /* Card backgrounds */
```

Change `--gold-pure` to any color to completely rebrand the accent scheme.
