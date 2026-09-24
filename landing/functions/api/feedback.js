/**
 * POST /api/feedback — store one feedback response in Cloudflare KV.
 *
 * Binding: WAITLIST (shared namespace). Key: `feedback:<id>`.
 *
 * Same posture as the waitlist: declared fields only, capped, no ambient
 * identifiers, and never an `ok` for a write that did not happen.
 *
 * Email is optional here on purpose — feedback should not cost the sender an
 * address. `willingness_to_pay` is a bounded band rather than a number, and
 * includes an explicit "rather not say": a forced answer to that question is
 * worse than no answer, because it poisons the analysis with noise.
 */
import { json, str, looksLikeEmail, idMatches, newId, normStatus } from "./_store.js";

const CAP = { resonated: 64, missing: 2000, willingness_to_pay: 64, comment: 2000, email: 254 };

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.WAITLIST) return json({ ok: false, error: "storage not configured" }, 500);

  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid JSON body" }, 400); }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "expected a JSON object" }, 400);
  }

  const record = {
    resonated: str(body.resonated, CAP.resonated),
    missing: str(body.missing, CAP.missing),
    willingness_to_pay: str(body.willingness_to_pay, CAP.willingness_to_pay),
    comment: str(body.comment, CAP.comment),
    email: str(body.email, CAP.email),
  };

  // The substantive answer is the point of the form; without it there is
  // nothing to store worth storing.
  if (!record.missing) {
    return json({ ok: false, error: "tell us what's missing — that field is required" }, 400);
  }
  // An unparseable address is dropped rather than rejected: the feedback is
  // still worth keeping, and the sender said the email was optional anyway.
  if (record.email && !looksLikeEmail(record.email)) record.email = "";

  const id = idMatches(body.id, "fb") ? body.id : newId("fb");
  const now = new Date().toISOString();

  let received_at = now;
  try {
    const prior = await env.WAITLIST.get(`feedback:${id}`, "json");
    if (prior && prior.received_at) received_at = prior.received_at;
  } catch { /* first write */ }

  const stored = {
    id, status: normStatus(body.status), received_at, updated_at: now,
    source_site: "noetl.ai", ...record,
  };

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
