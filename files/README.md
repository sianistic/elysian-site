# ELYSIAN PCS - Deployment Guide

## Project Structure

```text
elysian-site/
|-- wrangler.jsonc
|-- functions/
|   `-- api/
|       |-- pcs.js
|       `-- checkout.js
`-- files/
    |-- index.html
    |-- builds.html
    |-- support.html
    |-- admin.html
    |-- style.css
    |-- main.js
    |-- partials.js
    `-- assets/
        `-- logo.jpg
```

## Step 1 - Add Your Logo

Rename `image_08d4a3.jpg` to `logo.jpg` and place it in `files/assets/`.

## Step 2 - Create KV Namespace

```bash
npx wrangler kv:namespace create ELYSIAN_DATA
```

Copy the returned `id` into the production binding in `wrangler.jsonc`.

## Step 3 - Set Environment Secrets

Via CLI:

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY
npx wrangler pages secret put ADMIN_TOKEN
```

Keep `SITE_URL` in `wrangler.jsonc` aligned with your deployed domain.

## Step 4 - Deploy to Cloudflare Pages

Recommended Git setup:

1. Push this repo to GitHub or GitLab.
2. In Cloudflare Pages, connect the repo to the existing `elysian-site` project.
3. Set the project root to `/`.
4. Set the build output directory to `files`.
5. Leave the build command empty.

Direct upload:

```bash
npx wrangler pages deploy files --project-name=elysian-site
```

## Admin Panel

URL: `https://elysian-site.pages.dev/admin.html`

Default password: `elysian_admin_2024`

Change that value in `files/admin.html` before going live.

## Customization Checklist

- Replace `files/assets/logo.jpg` with your production logo.
- Update `ADMIN_HASH` in `files/admin.html`.
- Set `STRIPE_SECRET_KEY` and `ADMIN_TOKEN` in Cloudflare.
- Create the KV namespace and update `wrangler.jsonc`.
- Keep `SITE_URL` in `wrangler.jsonc` aligned with production.
