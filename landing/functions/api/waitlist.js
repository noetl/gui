/**
 * POST /api/waitlist — store one waitlist signup in Cloudflare KV.
 *
 * Binding: WAITLIST (KV namespace `noetl-ai-waitlist`).
 *
 * Privacy posture, deliberate and narrow:
 *   - Only the five fields the questionnaire asks for are persisted. Anything
 *     else in the body is dropped rather than stored "just in case".
 *   - No IP address, no user agent, no cookie, no analytics identifier.
 *   - Field lengths are capped so a paste cannot turn this into a file store.
 *
 * Honesty posture: this endpoint either stores the record and says so, or
 * fails loudly. It never returns ok for a write that did not happen — the
 * page tells the visitor they are on the list based on this response.
 */

const LIMITS = { name: 120, email: 254, domain: 64, use_case: 1000, org: 160 };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// Deliberately permissive: this gate exists to catch typos, not to adjudicate
// which addresses are real. Rejecting valid-but-unusual addresses would lose
// signups for no benefit.
const looksLikeEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.WAITLIST) {
    // Misconfiguration must be loud. A missing binding silently dropping
    // signups is the exact failure this whole page depends on not having.
    return json({ ok: false, error: "storage not configured" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON body" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "expected a JSON object" }, 400);
  }

  const record = {
    name: clean(body.name, LIMITS.name),
    email: clean(body.email, LIMITS.email),
    domain: clean(body.domain, LIMITS.domain),
    use_case: clean(body.use_case, LIMITS.use_case),
    org: clean(body.org, LIMITS.org),
  };

  if (!record.email || !looksLikeEmail(record.email)) {
    return json({ ok: false, error: "a valid email is required" }, 400);
  }

  const id = `wl_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const stored = {
    id,
    received_at: new Date().toISOString(),
    source: "noetl.ai",
    ...record,
  };

  try {
    await env.WAITLIST.put(`signup:${id}`, JSON.stringify(stored));
  } catch (err) {
    return json({ ok: false, error: "could not store signup" }, 502);
  }

  // Echo only the reference. The visitor already knows what they typed, and
  // reflecting the stored record back gives an attacker a free read oracle.
  return json({ ok: true, id });
}

/** Anything other than POST is a mistake worth naming rather than 404-ing. */
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "POST only" }, 405);
}
