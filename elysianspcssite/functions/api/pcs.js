// This function handles both fetching and updating your PC builds globally
export async function onRequest(context) {
  const { request, env } = context;
  const KV = env.ELYSIAN_DATA; // You will name your KV namespace this in Cloudflare

  if (request.method === "GET") {
    const data = await KV.get("pc_builds");
    return new Response(data || "[]", { headers: { "Content-Type": "application/json" } });
  }

  if (request.method === "POST") {
    const body = await request.json();
    await KV.put("pc_builds", JSON.stringify(body));
    return new Response(JSON.stringify({ success: true }));
  }
}