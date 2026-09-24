/**
 * POST /api/feedback — store one feedback note in Cloudflare KV.
 *
 * Same binding and same posture as the waitlist: store only what was asked
 * for, cap it, never claim a write that did not happen. Email is optional
 * here by design — feedback should not cost the sender an address.
 */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.WAITLIST) return json({ ok: false, error: "storage not configured" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }

  const message = clean(body && body.message, 4000);
  const email = clean(body && body.email, 254);
  if (!message) return json({ ok: false, error: "message is required" }, 400);

  const id = `fb_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const stored = { id, received_at: new Date().toISOString(), source: "noetl.ai", message, email };

  try {
    await env.WAITLIST.put(`feedback:${id}`, JSON.stringify(stored));
  } catch {
    return json({ ok: false, error: "could not store feedback" }, 502);
  }
  return json({ ok: true, id });
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "POST only" }, 405);
}
