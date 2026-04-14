# Repository Guidelines

## Project Structure & Module Organization
This repository is a Cloudflare Pages site with static assets in `files/` and Pages Functions in `functions/api/`.

- `files/`: public pages, browser JS, CSS, and images (`index.html`, `builds.html`, `main.js`, `style.css`, `assets/logo.jpg`)
- `functions/api/`: serverless endpoints for checkout and catalog data (`checkout.js`, `pcs.js`)
- `components/ui/`: dormant React/TSX handoff components; they are not part of the live site build
- `wrangler.jsonc`: Pages output, compatibility date, KV bindings, and environment vars

## Build, Test, and Development Commands
There is no `package.json` or formal build step. Cloudflare serves `files/` directly.

- `npx wrangler pages dev files`: run the site locally with Pages Functions
- `npx wrangler pages deploy files --project-name=elysian-site`: deploy the static site and functions
- `npx wrangler kv:namespace create ELYSIAN_DATA`: create the KV namespace used by `functions/api/pcs.js`
- `npx wrangler pages secret put STRIPE_SECRET_KEY`: set Stripe secret for `/api/checkout`
- `npx wrangler pages secret put ADMIN_TOKEN`: set admin auth for catalog updates

## Coding Style & Naming Conventions
Use 2-space indentation in JavaScript, semicolons, and double quotes to match the existing code. Keep client scripts in plain browser JavaScript and keep Pages Functions framework-free.

Use lowercase kebab-case for HTML filenames (`support.html`) and data IDs (`sovereign-x`). Export Cloudflare handlers as `onRequestGet`, `onRequestPost`, and `onRequestOptions`.

## Testing Guidelines
There is no automated test suite yet. Validate changes with local Pages dev and manual smoke tests:

- open the affected page in `wrangler pages dev`
- verify API responses for `/api/pcs` and `/api/checkout`
- confirm admin flows and checkout redirects still work

If you add automated tests, keep them next to the code they cover or under a top-level `tests/` directory, and name them after the target module (example: `pcs.test.js`).

## Commit & Pull Request Guidelines
Recent history uses short, imperative commit subjects such as `Restore production stylesheet` and `Flatten repo root for Pages deployment`. Follow that pattern: one-line, present tense, outcome-focused.

Pull requests should include a concise summary, note any Cloudflare config or secret changes, link the related issue when applicable, and attach screenshots for UI changes to pages under `files/`.

## Security & Configuration Tips
Do not commit live secrets. Keep `STRIPE_SECRET_KEY` and `ADMIN_TOKEN` in Cloudflare secrets, keep `SITE_URL` accurate in `wrangler.jsonc`, and treat `files/admin.html` credentials as setup defaults that must be changed before production.

## Project Goals
This site is a custom PC brand/storefront. Priorities are:
- smooth performance on mid-range desktop PCs
- preserving the premium visual feel while reducing GPU-heavy effects
- completing and hardening Stripe checkout
- keeping deployment compatible with Cloudflare Pages and Pages Functions

## Assistant Behavior
Before making large changes:
- explain what is currently happening
- identify risks and dependencies
- ask questions if business logic is unclear

Prefer improving the current static/Cloudflare setup over introducing a new framework unless explicitly requested.