import { formatBuildForStorage, mapBuildRow, normalizeBuild } from "./catalog.js";

async function loadBuildsFromD1(env) {
  if (!env.DB) return null;

  const result = await env.DB.prepare(
    `SELECT id, name, price_cents, category, badge, tags_json, specs_json, images_json
     FROM builds
     ORDER BY price_cents DESC, name ASC`
  ).all();

  const rows = Array.isArray(result?.results) ? result.results : [];
  if (!rows.length) return [];
  return rows.map(mapBuildRow);
}

async function saveBuildsToD1(env, pcs) {
  if (!env.DB) return false;

  const normalized = pcs.map(formatBuildForStorage);
  const existingRows = await env.DB.prepare("SELECT id FROM builds").all();
  const existingIds = new Set((existingRows?.results || []).map((row) => row.id));
  const nextIds = new Set(normalized.map((pc) => pc.id));

  const statements = [];

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      statements.push(env.DB.prepare("DELETE FROM builds WHERE id = ?1").bind(id));
    }
  }

  for (const pc of normalized) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO builds (id, name, price_cents, category, badge, tags_json, specs_json, images_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           price_cents = excluded.price_cents,
           category = excluded.category,
           badge = excluded.badge,
           tags_json = excluded.tags_json,
           specs_json = excluded.specs_json,
           images_json = excluded.images_json,
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        pc.id,
        pc.name,
        pc.price_cents,
        pc.category,
        pc.badge,
        JSON.stringify(pc.tags),
        JSON.stringify(pc.specs),
        JSON.stringify(pc.images)
      )
    );
  }

  if (statements.length) {
    await env.DB.batch(statements);
  }

  return true;
}

async function loadBuildsFromKv(env, kvKey) {
  if (!env.ELYSIAN_DATA) return null;
  const stored = await env.ELYSIAN_DATA.get(kvKey, { type: "json" });
  if (!stored?.pcs || !Array.isArray(stored.pcs)) return null;
  return stored.pcs.map(normalizeBuild);
}

async function saveBuildsToKv(env, kvKey, pcs) {
  if (!env.ELYSIAN_DATA) return false;
  const payload = {
    pcs: pcs.map(normalizeBuild),
    updatedAt: new Date().toISOString(),
  };
  await env.ELYSIAN_DATA.put(kvKey, JSON.stringify(payload));
  return true;
}

export {
  loadBuildsFromD1,
  loadBuildsFromKv,
  saveBuildsToD1,
  saveBuildsToKv,
};
