/**
 * Shared helpers for the two intake endpoints.
 *
 * Posture, in order of importance:
 *
 *   1. NEVER report a save that did not happen. The page tells a visitor they
 *      are on the list based on our `ok`, so a false positive silently loses a
 *      real person.
 *   2. Store only declared fields. Anything not in the schema is dropped
 *      rather than kept "just in case" — an intake form is not a place to
 *      accumulate whatever a client felt like sending.
 *   3. No ambient identifiers: no IP, user agent, cookie or analytics id.
 */

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** Trim and cap a scalar; anything non-string becomes "". */
export const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Normalise a multi-select to a de-duplicated array of capped strings.
 * Accepts an array or a comma-joined string — being tolerant costs nothing and
 * avoids dropping a legitimate answer if the client ever changes shape.
 */
export function list(v, maxItems = 12) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string" && v.trim()) arr = v.split(",");
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const s = str(raw, 64);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Deliberately permissive: catches typos, does not adjudicate real addresses. */
export const looksLikeEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/**
 * Client-supplied ids are only honoured if they match the shape we mint, so an
 * upsert cannot be aimed at an arbitrary key in the namespace.
 */
export const idMatches = (id, prefix) =>
  typeof id === "string" && new RegExp(`^${prefix}_[a-z0-9]{1,12}_[0-9a-f]{8}$`).test(id);

export const newId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

/** "partial" while the visitor is mid-questionnaire, "complete" at the end. */
export const normStatus = (v) => (v === "complete" ? "complete" : "partial");
