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

## The drug design tile, and what it deliberately does not say

Its SHAPE is grounded in a real pipeline: the stage order (prepare, dock,
score, fingerprint interactions, classify, record) and the toolchain names
(RDKit, Meeko, AutoDock-GPU, ProLIF, a metadata index with checksums) come
from a working drug design project.

⚠ **None of its values do, and none should be added.** That repository is
private research. No real compound name, target residue or measured affinity
appears on this page, because a public pre-launch marketing site is not the
place to publish someone's unpublished results. Every identifier and number in
the tile is invented to demonstrate orchestration.

For the same reason there is no "learn more" link on this tile: the source
repository is private, so linking it would send visitors to a 404 at best.

The on-screen caveat says plainly that it is a simulated pipeline and not a
scientific result, that nothing shown is a measured affinity or a finding
about a real compound, and that no output of such a pipeline would be acted on
without review by a qualified chemist. Keep that caveat. A sensitive domain is
exactly where a demo must not be mistaken for a claim.

## The security and compliance tile, and its three rules

Presented as ONE narrative rather than two sub-flows, because a SOC 2 evidence
cycle genuinely contains an authorised penetration test. Splitting them would
have needed new UI to say something the single flow already says.

Three rules the content follows. They are load-bearing, not decoration, and a
change that breaks one is a change worth rejecting:

1. **Authorisation is the first step and it is a gate.** The flow refuses to
   continue without a scope and a signed engagement, because that is how
   authorised testing works. A tool that scans before checking scope is the
   problem, not the product.
2. **No exploit detail.** Findings appear only as severity counts and control
   mappings. No technique, payload, or target specifics appear anywhere.
3. **No pass or fail claim.** A tool prepares evidence; the auditor issues the
   opinion. The result row says so in as many words: "an evidence pack for the
   auditor, not a pass or fail". Claiming otherwise would be false about how
   SOC 2 works, and would mislead exactly the reader who most needs it right.

Nothing is scanned and no system is touched. Every count is invented.

## The SLM training tile

Shows fine-tuning as a LOOP rather than a one-off job, because that is the
part people get wrong: curate, train an adapter, evaluate, hold at a parity
gate, register, and feed the weakest categories into the next cycle. The
result rows name the cycle number and say where cycle 4's data comes from, so
the iteration is visible rather than implied.

Shape grounded in the real SLM work: small Gemma-class base models, a
pluggable backend selected by the playbook rather than baked into the image,
adapters instead of full retrains, a schema parity check on structured output,
and a model registry that records what was promoted and why.

⚠ **Every number is invented.** No score in this tile is a measurement of any
model. Publishing a made-up eval number as though it were real is the easiest
way to mislead in this domain, so the tile shows the shape of a gate and says
plainly that the values are illustrative. The caveat also states that a real
cycle keeps a person at the promotion gate: an eval score is evidence for a
decision, not the decision itself.

## The Console entry

Two links to console.noetl.ai: a pill in the header nav and a card above the link
grid, both styled apart from the simulated tiles because they mean something
different. The demo is public and anonymous; the console needs an account and
signs in through the NoETL gateway.

⚠ **Not deployed yet, deliberately.** console.noetl.ai does not resolve, so
shipping these links would put a dead link on a public page. Deploy them the
moment the CNAME exists:

```sh
./stamp.sh && npx wrangler pages deploy public --project-name noetl-ai --branch main
```

## A2A tile: population weights, and two worked examples

⚠ **Weights are derived from signal counts. Never write a constant.**

The blueprint gives a tier-0 agent one job: emit "a reduced value AND its
population weight". An aggregator weights each child by how many signals that
child summarises, and the rule the design calls its most important one is that
skipping a tier "silently corrupts the population weights, and the result
looks entirely reasonable".

An earlier version of this tile hard-coded 0.6/0.4 and 0.7/0.3. The numbers
looked right and the demo contradicted the invariant it was showcasing. Those
same figures now fall out of the counts:

```
industrial  temp 840/1400 = 0.60, vibration 560/1400 = 0.40  -> 60.0
            tier 2: 1400/2000 = 0.70, 600/2000 = 0.30        -> 52.5
cyber       network 1200/2000 = 0.60, endpoint 800/2000 = 0.40 -> 64.0
            tier 2: 2000/3000 = 0.667, 1000/3000 = 0.333     -> 60.0
```

If you change a population, change nothing else. The weights and the verdict
must follow from it, and a reader can check the arithmetic on screen.

⚠ **No confidence scores.** A previous version printed a per-agent confidence
that nothing consumed. A number on screen that feeds no decision is noise
dressed as rigour, and the blueprint has no such field. What a tier-0 agent
actually publishes next to its value is the population weight, so that is what
is shown.

Two scenarios share one player: industrial telemetry and a security detection
(network, endpoint and identity correlating into one verdict). Same cascade,
same rule, different signal classes, which is the point.

## Text to playbook (the forge)

A featured section above the ten tiles: describe a workflow, get a NoETL
playbook, press Run and watch it execute. Prompt, playbook, run and result all
happen in one chat.

⚠ **No model, no network.** Every reply lives in `forge.js`. The section is
labelled "AI generated, simulated" in two places, because a chat that looks
like an LLM and is not is the single easiest thing on this site to be caught
overstating.

⚠ **The generated playbook is assembled from the SAME steps that then run.**
`buildPlaybook()` reads the matching tile's step list and renders YAML from
it, so Run executes exactly what was shown. A demo that displayed one playbook
and ran another would be a lie told in two parts. Quantum is the one domain
with its own cascade in `forge.js`, because its tile links out to saqbit
rather than simulating.

Generated playbooks carry `metadata.version`. That is not decoration: without
it a playbook registers and then never dispatches, which is the trap the
console pre-flight also catches. Emitting one without it would be shipping a
broken example.

Free text is routed by keyword. When nothing matches, the assistant says so
and points at the suggestions rather than guessing, because a canned demo that
pretends to understand arbitrary input is the same overclaim in a smaller box.

## ⚠ .forge-log children must never shrink

`.forge-log` is a flex column with `max-height: 560px`. Flex children default
to `flex-shrink: 1` on the main axis, which here is vertical, so once the
transcript is taller than the container every entry becomes a shrink
candidate.

A text bubble survives that: its text gives it a min-content floor. A playbook
card does not, because it sets `overflow: hidden`, and the CSS automatic
minimum size of a scroll container is **zero**. The cards were therefore
flattened to their 2px of border while still reporting `display: block`,
`visibility: visible` and `opacity: 1`, with the YAML and the Run button
present in the DOM. Copying the page showed everything; nothing painted.

That is also why it looked intermittent: nothing shrinks until the log
overflows, so the first card or two rendered and everything after collapsed.

`.forge-log > * { flex: 0 0 auto; }` fixes it. Measured on the live site:
2px to 436.4px. Any new child of that container inherits the same trap, so do
not remove it.

Related, found while measuring: `.fbubble.bot` sets `align-self: flex-start`
at specificity (0,2,0), which silently beat a bare `.fplaybook` at (0,1,0), so
the intended `align-self: stretch` never applied and the cards sized to
fit-content. Those selectors now carry two classes. Measured: 331px to 987px.

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
