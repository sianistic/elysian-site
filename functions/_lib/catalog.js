const BUILD_CATEGORIES = new Set(["workstation", "gaming", "creator", "entry"]);

function normalizeTags(tags) {
  const source = Array.isArray(tags) ? tags : String(tags || "").split(",");
  return source
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 8);
}

function normalizeBuild(pc) {
  return {
    id: String(pc?.id || "").slice(0, 64),
    name: String(pc?.name || "").slice(0, 120),
    price: Math.max(0, parseInt(pc?.price, 10) || 0),
    category: BUILD_CATEGORIES.has(pc?.category) ? pc.category : "gaming",
    badge: String(pc?.badge || "").slice(0, 40),
    tags: normalizeTags(pc?.tags),
    specs: typeof pc?.specs === "object" && pc?.specs !== null ? pc.specs : {},
    images: Array.isArray(pc?.images) ? pc.images.filter(Boolean).slice(0, 12) : [],
  };
}

function formatBuildForStorage(pc) {
  const normalized = normalizeBuild(pc);
  return {
    ...normalized,
    price_cents: normalized.price * 100,
  };
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapBuildRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: Math.max(0, Math.round((row.price_cents || 0) / 100)),
    category: row.category,
    badge: row.badge || "",
    tags: parseJsonField(row.tags_json, []),
    specs: parseJsonField(row.specs_json, {}),
    images: parseJsonField(row.images_json, []),
  };
}

export {
  formatBuildForStorage,
  mapBuildRow,
  normalizeBuild,
  normalizeTags,
};
