# noetl.ai landing

The **public, unauthenticated** face of noetl.ai: a simulated product demo, a
coming-soon notice, a waitlist and a feedback form.

## Why this is a separate app

The NoETL GUI in this repo talks to a real control plane — catalog, execute,
EHDB. This landing page must never do that for an anonymous visitor.

Rather than gate those features at runtime, the landing is a **separate build
with its own Cloudflare Pages project**. The gated GUI is not bundled here at
all, so an anonymous visitor cannot reach a playbook or an EHDB endpoint from
noetl.ai — not because a flag says no, but because the code is absent.

That property is checkable, and worth re-checking after any change:

```sh
# The only network calls in the bundle must be the two own-origin Functions.
grep -nE 'fetch\(|XMLHttpRequest|WebSocket|EventSource' dist/*.js
```

## Layout

```
dist/          static assets, deployed as-is (no build step)
  index.html
  styles.css
  demos.js     the five canned domain walkthroughs
  app.js       demo player, waitlist chat, feedback form
functions/api/ Cloudflare Pages Functions
  waitlist.js  POST /api/waitlist  -> KV
  feedback.js  POST /api/feedback  -> KV
```

There is no bundler. The page is small enough that a build step would add a
failure mode without buying anything.

## The demo is simulated, and says so

Nothing in `demos.js` executes. Each domain is a hand-written playbook plus
hand-written step outputs replayed on a timer. The page labels this in three
places (hero note, a `demo — simulated` badge, and a per-result line) because
a demo that looks live and is not is the kind of thing that costs trust once
and never earns it back.

The event names are the real ones NoETL records — `playbook_started`,
`execution.catalog_snapshot`, `command.issued`, `command.claimed`,
`call.done`, `command.completed`, `step.enter`, `playbook.completed` — and
every demo playbook carries `metadata.version`, for the same reason real ones
must: without it a playbook registers and then never dispatches.

## Storage

Both Functions write to the KV namespace bound as `WAITLIST`
(`noetl-ai-waitlist`). Keys are `signup:<id>` and `feedback:<id>`.

Only the fields the questionnaire asks for are stored — no IP, no user agent,
no cookie, no analytics id — and field lengths are capped. Neither endpoint
returns `ok` for a write that did not happen: the page tells a visitor they
are on the list based on that response, so a false positive there would
silently lose people.

Read them back with the Cloudflare API:

```sh
# keys
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACC/storage/kv/namespaces/$NS/keys"
# one record
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACC/storage/kv/namespaces/$NS/values/signup:<id>"
```

## Deploy

```sh
npx wrangler pages deploy dist --project-name noetl-ai --branch main
```

The KV binding lives on the Pages project (production and preview), so a
deploy needs no extra configuration. Local development with the binding:

```sh
npx wrangler pages dev dist --kv WAITLIST
```
