/**
 * ELYSIAN PCS — Cloudflare Function
 * /functions/api/pcs.js
 *
 * GET  /api/pcs  — Returns all PC data from KV (falls back to defaults)
 * POST /api/pcs  — Saves updated PC data to KV (admin only)
 *
 * KV Namespace Binding: ELYSIAN_DATA
 * Wrangler config: { kv_namespaces: [{ binding: "ELYSIAN_DATA", id: "YOUR_KV_ID" }] }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

const KV_KEY = 'elysian_pcs_data';

// Default PC data (used if KV is empty)
const DEFAULT_PCS = [
  {
    id: 'sovereign-x',
    name: 'Elysian Sovereign X',
    price: 6499,
    category: 'workstation',
    badge: 'Flagship',
    tags: ['4k', 'workstation', 'flagship', 'content creation'],
    specs: {
      CPU: 'Intel Core i9-14900KS',
      GPU: 'NVIDIA RTX 4090 24GB',
      RAM: '64GB DDR5-6400',
      Storage: '4TB NVMe Gen5 SSD',
      Cooling: '420mm Custom Loop',
      Case: 'Lian Li O11 Dynamic EVO',
      PSU: 'Seasonic PRIME TX-1600W',
      OS: 'Windows 11 Pro'
    }
  },
  {
    id: 'apex-pro',
    name: 'Elysian Apex Pro',
    price: 4299,
    category: 'gaming',
    badge: 'Best Seller',
    tags: ['1440p', 'gaming', 'best seller', 'high refresh'],
    specs: {
      CPU: 'AMD Ryzen 9 7950X3D',
      GPU: 'NVIDIA RTX 4080 Super 16GB',
      RAM: '32GB DDR5-5600',
      Storage: '2TB NVMe Gen4 SSD',
      Cooling: '360mm AIO',
      Case: 'Fractal Torrent RGB',
      PSU: 'Corsair HX1200',
      OS: 'Windows 11 Pro'
    }
  },
  {
    id: 'origin',
    name: 'Elysian Origin',
    price: 2899,
    category: 'entry',
    badge: '',
    tags: ['entry level', '1440p', 'starter', 'value'],
    specs: {
      CPU: 'Intel Core i7-14700K',
      GPU: 'NVIDIA RTX 4070 Ti Super',
      RAM: '32GB DDR5-5200',
      Storage: '1TB NVMe Gen4 SSD',
      Cooling: '280mm AIO',
      Case: 'NZXT H9 Flow',
      PSU: "be quiet! Straight Power 1000W",
      OS: 'Windows 11 Home'
    }
  },
  {
    id: 'aurora-creator',
    name: 'Elysian Aurora Creator',
    price: 5199,
    category: 'creator',
    badge: 'Creator Pick',
    tags: ['creator', '4k', 'rendering', 'editing'],
    specs: {
      CPU: 'AMD Ryzen Threadripper PRO 7960X',
      GPU: 'NVIDIA RTX 4090 24GB',
      RAM: '128GB DDR5 ECC',
      Storage: '8TB NVMe RAID Array',
      Cooling: 'Custom Hardline Loop',
      Case: 'Enthoo 719 Full Tower',
      PSU: 'Seasonic PRIME TX-2000W',
      OS: 'Windows 11 Pro for Workstations'
    }
  },
  {
    id: 'spectre-gaming',
    name: 'Elysian Spectre Gaming',
    price: 3499,
    category: 'gaming',
    badge: 'Gaming',
    tags: ['gaming', '1440p', 'streaming', 'rgb'],
    specs: {
      CPU: 'Intel Core i9-14900K',
      GPU: 'NVIDIA RTX 4080 Super 16GB',
      RAM: '32GB DDR5-6000',
      Storage: '2TB NVMe Gen4 SSD',
      Cooling: '360mm AIO',
      Case: 'Cooler Master HAF 700 EVO',
      PSU: 'Corsair HX1000i',
      OS: 'Windows 11 Home'
    }
  },
  {
    id: 'phantom-mini',
    name: 'Elysian Phantom Mini',
    price: 2199,
    category: 'entry',
    badge: 'Compact',
    tags: ['budget', 'entry level', 'compact', 'small form factor'],
    specs: {
      CPU: 'Intel Core i7-14700KF',
      GPU: 'NVIDIA RTX 4070 Super',
      RAM: '32GB DDR5-5600',
      Storage: '1TB NVMe Gen4 SSD',
      Cooling: '240mm AIO',
      Case: 'Lian Li Q58',
      PSU: 'SFX-L 850W Gold',
      OS: 'Windows 11 Home'
    }
  }
];

function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return source
    .map(tag => String(tag || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 8);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  try {
    // Check KV binding exists
    if (!env.ELYSIAN_DATA) {
      console.warn('ELYSIAN_DATA KV binding not found — returning defaults');
      return jsonResponse({ pcs: DEFAULT_PCS, source: 'defaults' });
    }

    const stored = await env.ELYSIAN_DATA.get(KV_KEY, { type: 'json' });

    if (!stored || !stored.pcs || !Array.isArray(stored.pcs)) {
      // First time: seed KV with defaults
      await env.ELYSIAN_DATA.put(KV_KEY, JSON.stringify({ pcs: DEFAULT_PCS }));
      return jsonResponse({ pcs: DEFAULT_PCS, source: 'seeded' });
    }

    return jsonResponse({ pcs: stored.pcs, source: 'kv', updatedAt: stored.updatedAt });

  } catch (error) {
    console.error('GET /api/pcs error:', error);
    return jsonResponse({ pcs: DEFAULT_PCS, source: 'error_fallback', error: error.message }, 200);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    // Validate admin token
    const adminToken = request.headers.get('X-Admin-Token');
    const expectedToken = env.ADMIN_TOKEN;

    // If ADMIN_TOKEN env var is set, enforce it
    if (expectedToken && adminToken !== expectedToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!env.ELYSIAN_DATA) {
      return jsonResponse({ error: 'KV namespace ELYSIAN_DATA not bound. Add it to your wrangler.toml.' }, 500);
    }

    const body = await request.json();

    // Validate structure
    if (!body.pcs || !Array.isArray(body.pcs)) {
      return jsonResponse({ error: 'Invalid payload: expected { pcs: [...] }' }, 400);
    }

    if (!body.pcs.length) {
      return jsonResponse({ error: 'Catalog must contain at least one PC.' }, 400);
    }

    // Sanitize each PC entry
    const sanitized = body.pcs.map(pc => ({
      id: String(pc.id || '').slice(0, 64),
      name: String(pc.name || '').slice(0, 120),
      price: Math.max(0, parseInt(pc.price) || 0),
      category: ['workstation', 'gaming', 'creator', 'entry'].includes(pc.category) ? pc.category : 'gaming',
      badge: String(pc.badge || '').slice(0, 40),
      tags: normalizeTags(pc.tags),
      specs: typeof pc.specs === 'object' && pc.specs !== null ? pc.specs : {}
    }));

    const invalidEntry = sanitized.find(pc => !pc.id || !pc.name);
    if (invalidEntry) {
      return jsonResponse({ error: 'Each PC must have a non-empty id and name.' }, 400);
    }

    const ids = sanitized.map(pc => pc.id);
    if (new Set(ids).size !== ids.length) {
      return jsonResponse({ error: 'Each PC id must be unique.' }, 400);
    }

    const payload = {
      pcs: sanitized,
      updatedAt: new Date().toISOString()
    };

    await env.ELYSIAN_DATA.put(KV_KEY, JSON.stringify(payload));

    return jsonResponse({ success: true, count: sanitized.length, updatedAt: payload.updatedAt });

  } catch (error) {
    console.error('POST /api/pcs error:', error);
    return jsonResponse({ error: 'Internal server error', detail: error.message }, 500);
  }
}
