/**
 * ELYSIAN PCS — Cloudflare Function
 * /functions/api/checkout.js
 *
 * POST /api/checkout
 * Accepts cart items, creates a Stripe Checkout session,
 * and returns the redirect URL. Stripe Secret Key is stored
 * in Cloudflare Pages environment variables (never in client JS).
 *
 * Required env vars (set in Cloudflare Dashboard → Pages → Settings → Environment variables):
 *   STRIPE_SECRET_KEY  — sk_test_... or sk_live_...
 *   SITE_URL           — https://your-domain.pages.dev (no trailing slash)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const stripeKey = env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return jsonResponse({ error: 'Stripe secret key not configured. Set STRIPE_SECRET_KEY in environment variables.' }, 500);
    }

    const siteUrl = env.SITE_URL || 'http://localhost:8788';

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: 'Cart is empty or invalid.' }, 400);
    }

    // Build Stripe line_items from cart
    const lineItems = items.map(item => {
      // Validate price is a positive integer (Stripe uses cents)
      const unitAmount = Math.round(Math.max(1, parseFloat(item.price) || 0) * 100);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: String(item.name || 'Elysian Build').slice(0, 255),
            description: 'Handcrafted luxury custom PC by Elysian PCs',
            metadata: {
              build_id: String(item.id || '').slice(0, 64)
            }
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      };
    });

    // Create Stripe Checkout Session via API
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody({
        mode: 'payment',
        success_url: `${siteUrl}/index.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/builds.html?checkout=cancelled`,
        ...buildLineItemsFormData(lineItems),
        'billing_address_collection': 'required',
        'shipping_address_collection[allowed_countries][0]': 'US',
        'shipping_address_collection[allowed_countries][1]': 'CA',
        'shipping_address_collection[allowed_countries][2]': 'GB',
        'shipping_address_collection[allowed_countries][3]': 'AU',
        'metadata[source]': 'elysian_website',
        'payment_method_types[0]': 'card',
      })
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok || session.error) {
      console.error('Stripe API error:', session.error);
      return jsonResponse({
        error: session.error?.message || 'Failed to create checkout session.'
      }, 500);
    }

    return jsonResponse({ url: session.url, sessionId: session.id });

  } catch (error) {
    console.error('Checkout function error:', error);
    return jsonResponse({ error: 'Internal server error.' }, 500);
  }
}

/**
 * Flatten an object into URL-encoded form data string.
 */
function buildFormBody(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Convert line_items array to Stripe's form-encoded format.
 * Stripe's API requires: line_items[0][price_data][currency]=usd etc.
 */
function buildLineItemsFormData(lineItems) {
  const result = {};
  lineItems.forEach((item, i) => {
    result[`line_items[${i}][price_data][currency]`] = item.price_data.currency;
    result[`line_items[${i}][price_data][unit_amount]`] = item.price_data.unit_amount;
    result[`line_items[${i}][price_data][product_data][name]`] = item.price_data.product_data.name;
    result[`line_items[${i}][price_data][product_data][description]`] = item.price_data.product_data.description;
    result[`line_items[${i}][quantity]`] = item.quantity;
  });
  return result;
}
