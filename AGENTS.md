# Repository Guidelines

## Project Structure & Module Organization
This repo is a Cloudflare Pages storefront. Public pages and browser scripts live in `files/`, while Pages Functions live in `functions/`.

- `files/`: public pages, shared UI scripts, CSS, and assets (`index.html`, `builds.html`, `request-quote.html`, `support.html`, `main.js`, `partials.js`, `style.css`)
- `files/admin/`: routed admin surface and supporting admin scripts
- `functions/api/`: checkout, admin, quote, support, and Stripe webhook endpoints
- `functions/_lib/`: shared server helpers for sessions, orders, notifications, support, and runtime checks
- `db/`: D1 schema and incremental migrations
- `components/ui/`: dormant React/TSX handoff components; not part of the live site build

## Build, Test, and Development Commands
There is no `package.json` build pipeline. Cloudflare serves `files/` directly.

- `npx wrangler pages dev files`: run the site locally with Pages Functions
- `npx wrangler pages deploy files --project-name=elysian-site`: deploy Pages output
- `npx wrangler d1 execute elysian-db --remote --file=db/schema.sql`: bootstrap a fresh production D1 database
- `npx wrangler d1 execute elysian-db --remote --file=db/migration_0005_notifications_and_ops.sql`: apply a specific incremental migration
- `node --check files/partials.js`: quick syntax check for a touched browser script
- `git diff --check`: catch whitespace and patch-format issues before commit

## Coding Style & Naming Conventions
Use plain browser JavaScript and framework-free Pages Functions. Match the existing style: 2-space indentation, semicolons, and double quotes in JS. Keep filenames lowercase kebab-case (`request-quote.html`), and keep Cloudflare handlers exported as `onRequestGet`, `onRequestPost`, or `onRequestOptions`.

## Testing Guidelines
There is no full automated suite yet, so use targeted checks and smoke tests.

- run `npx wrangler pages dev files`
- verify `/api/pcs`, `/api/quotes/request`, `/api/support/tickets`, `/api/admin/*`, and `/api/stripe/webhook`
- confirm admin login, quote flow, support ticket flow, and Stripe-driven order updates

If you add tests, keep them in `tests/` or next to the module they cover and name them after the workflow (`order-lifecycle.test.mjs`).

## Commit & Pull Request Guidelines
Use short, imperative commit subjects such as `Bind production D1 database`. PRs should summarize user-facing impact, list required Cloudflare config or migration steps, and include screenshots for changes under `files/`.

## Security & Configuration Tips
Do not commit live secrets. Required production config now includes `DB`, `ADMIN_PASSWORD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SITE_URL`. Customer notifications also require `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL`; `ADMIN_ALERT_EMAIL` is strongly recommended. Preview deployments need their own D1 binding or admin, quotes, checkout, and support flows will fail by design.
