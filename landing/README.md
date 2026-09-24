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
grep -nE 'fetch\(|XMLHttpRequest|WebSocket|EventSource' public/*.js
```

## Layout

```
public/        static assets, deployed as-is (no build step)
  index.html
  styles.css
  demos.js     the canned domain walkthroughs
  forms.js     question specs for both questionnaires
  app.js       demo player + the chat engine that drives both forms
functions/api/ Cloudflare Pages Functions
  waitlist.js  POST /api/waitlist  -> KV
  feedback.js  POST /api/feedback  -> KV
```

There is no bundler. The page is small enough that a build step would add a
failure mode without buying anything.

## Showcase tiles

Seven tiles, two kinds:

- **Simulated** (A2A agent mesh, travel, trading, healthcare, call centre, SRE)
  — canned walkthroughs, described below.
- **External** (Quantum) — renders as a dashed anchor with an `↗` marker and
  opens the live [saqbit.com](https://saqbit.com) demo instead of simulating
  anything. It is a link because it behaves like one; styling it as a tab
  would imply an in-page simulation that does not exist.

The **A2A agent mesh** tile leads and is selected by default. It models the
real [signal-mesh blueprint](https://github.com/noetl/signal-mesh/wiki/Architecture-Blueprint):
tier-0 ReAct agents per signal class, tier-1 specialized aggregators, a tier-2
synthesizer emitting one number and one boolean, with Agent Cards for A2A
discovery and the load-bearing rule that each tier reduces only the tier
directly below it.

⚠ **Its arithmetic must actually compute.** The page sells auditability, so a
reader who checks the weights has to find them consistent:

```
tier 1  site-health = 0.6·68.0 + 0.4·48.0 = 60.0
tier 1  asset-risk  = max over its slice  = 35.0
tier 2  score       = 0.7·60.0 + 0.3·35.0 = 52.5   > threshold 50.0 -> true
```

The first draft had weights that produced 52.05 while displaying 52.5. If you
change any published value, re-check the chain.

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


## ⚠ The directory is `public/`, not `dist/`

The repo's root `.gitignore` ignores `dist/`. When this site lived in
`landing/dist/`, **every source file was silently excluded from git** — the
first PR committed only the README and the Functions, and the actual page was
never in the repository. Worse, `landing/.wrangler/` (miniflare state, local KV
blobs) *was* committed.

These files are hand-written source, not build output, so `public/` is both
accurate and out of the ignore's way. `landing/.gitignore` now also excludes
`.wrangler/`. If you rename this directory, check `git status` actually shows
the files.

## Intake questionnaires

Both forms are chat questionnaires driven by one engine (`app.js`) from
declarative specs (`forms.js`). Questions are enumerated wherever a fixed set
is honest — `company_size`, `industry`, `role`, `scale`, `timeline`, `hosting`,
`source`, `willingness_to_pay` are all closed sets and `domains` is a
multi-select, so the result is analysable without parsing prose. Only
`use_case`, `stack`, `missing` and `comment` are free text.

⚠ **Partial save.** The waitlist is thirteen questions and some people stop at
nine. Once a name and work email are in, the record is written with
`status: "partial"` and updated in place at the end. The guard on that write
must be set **synchronously** — `recordId` only lands when the response
returns, so guarding on it alone fires a save per answer and each id-less POST
mints a new id. Measured before the fix: 12 partial rows for one run.

Scope is market intent only. Nothing asks for health, financial or otherwise
sensitive data, and nothing should start.

## "Learn more" links on the A2A tile

Rendered from `links: []` in the tile's spec (`demos.js`), not hard-coded in
the DOM, so adding one is a one-line change.

⚠ **Every entry must resolve before it ships.** A landing page for a
pre-launch product is already asking for trust on credit; a 404 behind "read
the architecture" spends it. Verify with:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -L <url>
```

Currently live: the signal-mesh **Architecture Blueprint** and the **wiki
root**, both 200.

**Not yet linked: the canonical A2A page on noetl.dev.** It is not published —
the noetl.dev sitemap lists 261 URLs and none is an A2A or signal-mesh page,
and `noetl/docs` has no such file on `main` or on any open PR branch. When it
lands, add it to that `links` array as
`{ href, label: "Read the docs", kind: "docs" }` and confirm 200 first. It is
deliberately absent rather than guessed: a plausible-looking `/docs/a2a` that
404s is worse than no link at all.

## Copy rule: no dashes

The site copy uses no em-dashes (U+2014), no en-dashes (U+2013), and no spaced
hyphens as sentence breaks. Use a comma, a colon, a period, parentheses, or
restructure the sentence.

Numeric ranges are written out ("2 to 10", "$100 to $1k / month") rather than
hyphenated, so the rule needs no exceptions.

Two things that legitimately contain " - " and must not be "fixed": the YAML
list markers in the displayed playbook source (`  - step: start`), and
arithmetic in the code.

Check the rendered copy, not just the files, since most text is injected by
`demos.js` and `forms.js`:

```sh
grep -c "\xe2\x80\x94" public/*          # em-dash, expect 0 everywhere
```

## Deploy: run ./stamp.sh first

⚠ Pages serves static assets with `cache-control: public, max-age=14400`
(4 hours) but serves index.html with `max-age=0, must-revalidate`. With
unversioned `./app.js` references, a returning visitor keeps the OLD bundle for
up to four hours after a deploy while getting the new HTML, so a copy or logic
change is simply invisible to them and looks like the deploy failed. This bit
us during the dash cleanup: the files on the server were clean while the
browser kept rendering the old strings.

`./stamp.sh` writes a content hash onto each asset URL, so the always-fresh
HTML points at a URL the browser has never cached. It is idempotent.

```sh
./stamp.sh
npx wrangler pages deploy public --project-name noetl-ai --branch main
```

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
npx wrangler pages deploy public --project-name noetl-ai --branch main
```

The KV binding lives on the Pages project (production and preview), so a
deploy needs no extra configuration. Local development with the binding:

```sh
npx wrangler pages dev public --kv WAITLIST
```
