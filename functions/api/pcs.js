/**
 * ELYSIAN PCS - Cloudflare Pages Function
 * /functions/api/pcs.js
 *
 * GET  /api/pcs - Returns all PC data from KV (falls back to defaults)
 * POST /api/pcs - Saves updated PC data to KV (admin only)
 *
 * KV Namespace Binding: ELYSIAN_DATA
 * Wrangler config: ./wrangler.jsonc
 */

import { jsonResponse } from "../_lib/http.js";
import { normalizeBuild, normalizeTags } from "../_lib/catalog.js";
import {
  loadBuildsFromD1,
  loadBuildsFromKv,
  saveBuildsToD1,
  saveBuildsToKv,
} from "../_lib/storage.js";
import { requireAdminSession } from "../_lib/session.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
};

const KV_KEY = "elysian_pcs_data";

const DEFAULT_PCS = [
  {
    id: "sovereign-x",
    name: "Elysian Sovereign X",
    price: 6499,
    category: "workstation",
    badge: "Flagship",
    tags: ["4k", "workstation", "flagship", "content creation"],
    specs: {
      CPU: "Intel Core i9-14900KS",
      GPU: "NVIDIA RTX 4090 24GB",
      RAM: "64GB DDR5-6400",
      Storage: "4TB NVMe Gen5 SSD",
      Cooling: "420mm Custom Loop",
      Case: "Lian Li O11 Dynamic EVO",
      PSU: "Seasonic PRIME TX-1600W",
      OS: "Windows 11 Pro"
    }
  },
  {
    id: "apex-pro",
    name: "Elysian Apex Pro",
    price: 4299,
    category: "gaming",
    badge: "Best Seller",
    tags: ["1440p", "gaming", "best seller", "high refresh"],
    specs: {
      CPU: "AMD Ryzen 9 7950X3D",
      GPU: "NVIDIA RTX 4080 Super 16GB",
      RAM: "32GB DDR5-5600",
      Storage: "2TB NVMe Gen4 SSD",
      Cooling: "360mm AIO",
      Case: "Fractal Torrent RGB",
      PSU: "Corsair HX1200",
      OS: "Windows 11 Pro"
    }
  },
  {
    id: "origin",
    name: "Elysian Origin",
    price: 2899,
    category: "entry",
    badge: "",
    tags: ["entry level", "1440p", "starter", "value"],
    specs: {
      CPU: "Intel Core i7-14700K",
      GPU: "NVIDIA RTX 4070 Ti Super",
      RAM: "32GB DDR5-5200",
      Storage: "1TB NVMe Gen4 SSD",
      Cooling: "280mm AIO",
      Case: "NZXT H9 Flow",
      PSU: "be quiet! Straight Power 1000W",
      OS: "Windows 11 Home"
    }
  },
  {
    id: "aurora-creator",
    name: "Elysian Aurora Creator",
    price: 5199,
    category: "creator",
    badge: "Creator Pick",
    tags: ["creator", "4k", "rendering", "editing"],
    specs: {
      CPU: "AMD Ryzen Threadripper PRO 7960X",
      GPU: "NVIDIA RTX 4090 24GB",
      RAM: "128GB DDR5 ECC",
      Storage: "8TB NVMe RAID Array",
      Cooling: "Custom Hardline Loop",
      Case: "Enthoo 719 Full Tower",
      PSU: "Seasonic PRIME TX-2000W",
      OS: "Windows 11 Pro for Workstations"
    }
  },
  {
    id: "spectre-gaming",
    name: "Elysian Spectre Gaming",
    price: 3499,
    category: "gaming",
    badge: "Gaming",
    tags: ["gaming", "1440p", "streaming", "rgb"],
    specs: {
      CPU: "Intel Core i9-14900K",
      GPU: "NVIDIA RTX 4080 Super 16GB",
      RAM: "32GB DDR5-6000",
      Storage: "2TB NVMe Gen4 SSD",
      Cooling: "360mm AIO",
      Case: "Cooler Master HAF 700 EVO",
      PSU: "Corsair HX1000i",
      OS: "Windows 11 Home"
    }
  },
  {
    id: "phantom-mini",
    name: "Elysian Phantom Mini",
    price: 2199,
    category: "entry",
    badge: "Compact",
    tags: ["budget", "entry level", "compact", "small form factor"],
    specs: {
      CPU: "Intel Core i7-14700KF",
      GPU: "NVIDIA RTX 4070 Super",
      RAM: "32GB DDR5-5600",
      Storage: "1TB NVMe Gen4 SSD",
      Cooling: "240mm AIO",
      Case: "Lian Li Q58",
      PSU: "SFX-L 850W Gold",
      OS: "Windows 11 Home"
    }
  }
];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  try {
    const d1Builds = await loadBuildsFromD1(env);
    if (Array.isArray(d1Builds) && d1Builds.length) {
      return jsonResponse(
        { pcs: d1Builds, source: "d1" },
        200,
        { ...CORS_HEADERS, "Cache-Control": "no-store" }
      );
    }

    const kvBuilds = await loadBuildsFromKv(env, KV_KEY);
    if (Array.isArray(kvBuilds) && kvBuilds.length) {
      if (env.DB) {
        await saveBuildsToD1(env, kvBuilds);
      }
      return jsonResponse(
        { pcs: kvBuilds, source: "kv" },
        200,
        { ...CORS_HEADERS, "Cache-Control": "no-store" }
      );
    }

    if (env.DB) {
      await saveBuildsToD1(env, DEFAULT_PCS);
      return jsonResponse(
        { pcs: DEFAULT_PCS, source: "seeded_d1" },
        200,
        { ...CORS_HEADERS, "Cache-Control": "no-store" }
      );
    }

    if (env.ELYSIAN_DATA) {
      await saveBuildsToKv(env, KV_KEY, DEFAULT_PCS);
      return jsonResponse(
        { pcs: DEFAULT_PCS, source: "seeded_kv" },
        200,
        { ...CORS_HEADERS, "Cache-Control": "no-store" }
      );
    }

    console.warn("No D1 or KV binding found - returning defaults");
    return jsonResponse(
      { pcs: DEFAULT_PCS, source: "defaults" },
      200,
      { ...CORS_HEADERS, "Cache-Control": "no-store" }
    );
  } catch (error) {
    console.error("GET /api/pcs error:", error);
    return jsonResponse(
      { pcs: DEFAULT_PCS, source: "error_fallback", error: error.message },
      200,
      { ...CORS_HEADERS, "Cache-Control": "no-store" }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const adminToken = context.request.headers.get("X-Admin-Token");
    const expectedToken = context.env.ADMIN_TOKEN;
    const sessionAuth = await requireAdminSession(context);

    const hasTokenAuth = expectedToken && adminToken === expectedToken;
    if (!sessionAuth.ok && !hasTokenAuth) {
      return jsonResponse({ error: "Unauthorized" }, 401, CORS_HEADERS);
    }

    if (!context.env.DB && !context.env.ELYSIAN_DATA) {
      return jsonResponse(
        { error: "No build storage configured. Bind D1 DB or KV ELYSIAN_DATA." },
        500,
        CORS_HEADERS
      );
    }

    const body = await context.request.json();

    if (!body.pcs || !Array.isArray(body.pcs)) {
      return jsonResponse({ error: "Invalid payload: expected { pcs: [...] }" }, 400, CORS_HEADERS);
    }

    if (!body.pcs.length) {
      return jsonResponse({ error: "Catalog must contain at least one PC." }, 400, CORS_HEADERS);
    }

    const sanitized = body.pcs.map((pc) => normalizeBuild({
      ...pc,
      tags: normalizeTags(pc.tags),
    }));

    const invalidEntry = sanitized.find(pc => !pc.id || !pc.name);
    if (invalidEntry) {
      return jsonResponse({ error: "Each PC must have a non-empty id and name." }, 400, CORS_HEADERS);
    }

    const ids = sanitized.map(pc => pc.id);
    if (new Set(ids).size !== ids.length) {
      return jsonResponse({ error: "Each PC id must be unique." }, 400, CORS_HEADERS);
    }

    if (context.env.DB) {
      await saveBuildsToD1(context.env, sanitized);
    }
    if (context.env.ELYSIAN_DATA) {
      await saveBuildsToKv(context.env, KV_KEY, sanitized);
    }

    const updatedAt = new Date().toISOString();
    return jsonResponse({ success: true, count: sanitized.length, updatedAt }, 200, CORS_HEADERS);
  } catch (error) {
    console.error("POST /api/pcs error:", error);
    return jsonResponse({ error: "Internal server error", detail: error.message }, 500, CORS_HEADERS);
  }
}
