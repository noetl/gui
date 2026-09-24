/**
 * POST /api/waitlist — store one waitlist registration in Cloudflare KV.
 *
 * Binding: WAITLIST (KV namespace `noetl-ai-waitlist`). Key: `signup:<id>`.
 *
 * The questionnaire is mostly enumerated so the result is analysable:
 * company_size, industry, role, scale, timeline, hosting and source are all
 * closed sets, `domains` is a multi-select, and only `use_case` and `stack`
 * are free text — the two places where an open answer genuinely beats a menu.
 *
 * ⚠ UPSERT. A record is written as soon as the visitor has given a name and a
 * work email, with status "partial", and updated in place when they finish.
 * Thirteen questions means some people stop at nine; without this, every one
 * of those is data we asked a real person for and then discarded. The client
 * sends back the id it was given, and we only honour ids of our own shape.
 *
 * ⚠ SCOPE: market intent only. Nothing here asks for health, financial or
 * otherwise sensitive data, and nothing here should start.
 */
import { json, str, list, looksLikeEmail, idMatches, newId, normStatus } from "./_store.js";

const CAP = {
  name: 120, email: 254, role: 80, company: 160, company_size: 32,
  industry: 80, use_case: 1200, stack: 600, scale: 48, timeline: 48,
  hosting: 48, source: 64,
};

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.WAITLIST) {
    // Misconfiguration must be loud: a missing binding that silently dropped
    // signups is the exact failure this whole page depends on not having.
    return json({ ok: false, error: "storage not configured" }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid JSON body" }, 400); }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "expected a JSON object" }, 400);
  }

  const status = normStatus(body.status);

  const record = {
    name: str(body.name, CAP.name),
    email: str(body.email, CAP.email),
    role: str(body.role, CAP.role),
    company: str(body.company, CAP.company),
    company_size: str(body.company_size, CAP.company_size),
    industry: str(body.industry, CAP.industry),
    domains: list(body.domains),
    use_case: str(body.use_case, CAP.use_case),
    stack: str(body.stack, CAP.stack),
    scale: str(body.scale, CAP.scale),
    timeline: str(body.timeline, CAP.timeline),
    hosting: str(body.hosting, CAP.hosting),
    source: str(body.source, CAP.source),
  };

  // Email is the one hard requirement — it is both the contact route and the
  // de-duplication key a human would use when reading these back.
  if (!record.email || !looksLikeEmail(record.email)) {
    return json({ ok: false, error: "a valid email is required" }, 400);
  }

  const id = idMatches(body.id, "wl") ? body.id : newId("wl");
  const now = new Date().toISOString();

  // Preserve the original arrival time across the partial -> complete update,
  // so "when did this lead arrive" stays answerable.
  let received_at = now;
  try {
    const prior = await env.WAITLIST.get(`signup:${id}`, "json");
    if (prior && prior.received_at) received_at = prior.received_at;
  } catch { /* first write, or unreadable — `now` is the right answer */ }

  const stored = {
    id, status, received_at, updated_at: now, source_site: "noetl.ai", ...record,
  };

  try {
    await env.WAITLIST.put(`signup:${id}`, JSON.stringify(stored));
  } catch {
    return json({ ok: false, error: "could not store signup" }, 502);
  }

  // Echo only the reference: the visitor knows what they typed, and reflecting
  // the stored record back would hand an attacker a free read oracle.
  return json({ ok: true, id, status });
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "POST only" }, 405);
}
