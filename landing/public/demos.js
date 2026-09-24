/* NoETL landing — simulated domain demos.
 *
 * ⚠ EVERYTHING HERE IS CANNED. No fetch, no XHR, no websocket, no backend of
 * any kind. Each demo is a hand-written playbook plus hand-written step
 * outputs, replayed on a timer in the visitor's browser.
 *
 * The event names are the real ones NoETL records — playbook_started,
 * execution.catalog_snapshot, command.issued, command.claimed,
 * command.started, call.done, command.completed, step.enter,
 * playbook.completed — because showing a made-up lifecycle to explain a real
 * product would be the one dishonest thing on an otherwise honest page.
 *
 * `metadata.version` appears in every playbook below for the same reason it
 * appears in real ones: without it a playbook registers and then never
 * dispatches.
 */
window.NOETL_DEMOS = [
  {
    id: "a2a",
    label: "A2A agent mesh",
    featured: true,
    kind: "mesh",
    title: "Tiered A2A / ReAct signal mesh",
    desc: "Thousands of devices, no single model that can reason over all of them. A hierarchy of small reasoners each takes a narrow slice, decides, and publishes a reduced value upward — ending in one number and one boolean that can be replayed rather than trusted.",
    /* Modelled on the real signal-mesh blueprint (noetl/signal-mesh wiki):
       tier 0 raw ReAct agents per signal class, tier 1 specialized
       aggregators, tier 2 synthesizer emitting a numeric definition-function
       plus a boolean. Agent discovery is A2A — an Agent Card served at
       /.well-known/agent-card.json and registered in the noetl catalog. */
    /* "Learn more" targets for this tile.
     *
     * ⚠ EVERY ENTRY MUST RESOLVE BEFORE IT SHIPS. A landing page for a
     * pre-launch product is already asking for trust on credit; a 404 behind
     * "read the architecture" spends it. Both entries below were checked for
     * HTTP 200 at build time.
     *
     * The canonical A2A page on noetl.dev is not published yet — the docs
     * sitemap lists 261 URLs and none of them is an A2A/signal-mesh page. When
     * it lands, add it here as `{ href, label: "Read the docs", kind: "docs" }`
     * and verify 200 first. Deliberately absent rather than guessed: linking a
     * plausible-looking /docs/a2a that 404s is worse than linking nothing. */
    links: [
      { href: "https://github.com/noetl/signal-mesh/wiki/Architecture-Blueprint",
        label: "Read the architecture", kind: "blueprint" },
      { href: "https://github.com/noetl/signal-mesh/wiki",
        label: "Browse the wiki", kind: "wiki" },
    ],
    rule: "Each tier reduces only the tier directly below it. An aggregator that reaches past its tier to touch raw signals has skipped a level and broken the weights.",
    cards: [
      { name: "agent.temp",       tier: "tier 0", skill: "observe → reason → act", reduces: "device 01 · temp" },
      { name: "agent.vibration",  tier: "tier 0", skill: "observe → reason → act", reduces: "device 02 · vibration" },
      { name: "agent.pressure",   tier: "tier 0", skill: "observe → reason → act", reduces: "device N · pressure" },
      { name: "agent.site-health", tier: "tier 1", skill: "weighted mean",  reduces: "tier 0 · temp, vibration" },
      { name: "agent.asset-risk",  tier: "tier 1", skill: "max",            reduces: "tier 0 · pressure" },
      { name: "agent.synthesizer", tier: "tier 2", skill: "definition-function + threshold", reduces: "tier 1 · all aggregators" },
    ],
    yaml: `metadata:
  name: signal-mesh-cascade
  path: demo/a2a/signal-mesh
  version: "1.0"

workload:
  site: plant-04
  window_s: 60
  threshold: 50.0

# Discovery is A2A: each agent publishes an Agent Card at
# /.well-known/agent-card.json and registers the same content
# in the noetl catalog. Work between tiers is an A2A Task
# { id, from, to, state }.

workflow:
  - step: collect
    tool: { kind: http }          # collector shards A + B
  - step: tier0_react
    tool: { kind: playbook }      # raw ReAct agents
  - step: tier1_aggregate
    tool: { kind: playbook }      # specialized aggregators
  - step: tier2_synthesize
    tool: { kind: python }        # numeric definition-function
  - step: emit_verdict
    tool: { kind: noop }`,
    steps: [
      { step: "collect", tool: "http · collector shards", note: "sharded by device / region",
        out: "3 signal classes · 1,284 samples in 60s window" },
      { step: "tier0_react", tool: "playbook · agent.temp", tier: "tier 0",
        reason: "temp 74.2°C, 8.1 above the 60s rolling mean — sustained, not a spike",
        act: "publish reduced value 68.0 (confidence 0.88)", out: "temp → 68.0" },
      { step: "tier0_react", tool: "playbook · agent.vibration", tier: "tier 0",
        reason: "RMS within band but third harmonic rising across the window",
        act: "publish reduced value 48.0 (confidence 0.71)", out: "vibration → 48.0" },
      { step: "tier0_react", tool: "playbook · agent.pressure", tier: "tier 0",
        reason: "2.1 bar below setpoint, recovering — no trip condition",
        act: "publish reduced value 35.0 (confidence 0.93)", out: "pressure → 35.0" },
      { step: "tier1_aggregate", tool: "playbook · agent.site-health", tier: "tier 1",
        reason: "weighted mean over tier 0 only — 0.6·68.0 + 0.4·48.0",
        act: "publish 60.0", out: "site-health → 60.0" },
      { step: "tier1_aggregate", tool: "playbook · agent.asset-risk", tier: "tier 1",
        reason: "max over its slice; pressure alone is the risk input",
        act: "publish 35.0", out: "asset-risk → 35.0" },
      { step: "tier2_synthesize", tool: "python · agent.synthesizer", tier: "tier 2",
        reason: "definition-function over tier 1 only: 0.7·60.0 + 0.3·35.0",
        act: "score 52.5, threshold 50.0 → true", out: "52.5 · true" },
      { step: "emit_verdict", tool: "noop", note: "verdict appended to the event log", out: "replayable from D1" },
    ],
    result: [
      ["verdict", "52.5 · true"],
      ["threshold", "50.0 — exceeded"],
      ["tier 1 inputs", "site-health 60.0 · asset-risk 35.0 · weights 0.7 / 0.3"],
      ["tier 0 inputs", "temp 68.0 · vibration 48.0 · pressure 35.0"],
      ["provenance", "every reasoning step appended to EHDB — replayable, not trusted"],
    ],
    caveat: "Design and POC. The signal-mesh is not deployed — these agents, signals and the verdict are illustrative, and the numbers are arranged to show the cascade, not measured.",
  },
  {
    id: "travel",
    label: "Travel",
    title: "Trip planning",
    desc: "Turn a rough request into a costed itinerary — hotels and flights resolved through provider tools, then assembled into one render-ready payload.",
    yaml: `metadata:
  name: trip-plan
  path: demo/travel/trip-plan
  version: "1.0"

workload:
  city: Lisbon
  nights: 3
  travellers: 2

workflow:
  - step: start
    tool: { kind: noop }
  - step: resolve_dates
    tool: { kind: python }
  - step: search_flights
    tool: { kind: playbook }     # mcp/duffel
  - step: search_hotels
    tool: { kind: playbook }     # mcp/hotelbeds
  - step: build_itinerary
    tool: { kind: python }
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "resolve_dates", tool: "python", note: "derive stay window from offset", out: "check_in 2027-02-14 · check_out 2027-02-17" },
      { step: "search_flights", tool: "playbook → mcp/duffel", note: "provider offer search", out: "6 offers · best LIS return €184" },
      { step: "search_hotels", tool: "playbook → mcp/hotelbeds", note: "availability in radius", out: "12 properties · 4 under €150/night" },
      { step: "build_itinerary", tool: "python", note: "assemble render payload", out: "3 days · 2 travellers · est. €742" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["destination", "Lisbon, Portugal"],
      ["dates", "14–17 Feb 2027 · 3 nights"],
      ["flights", "TAP LIS 1042 · €184 return pp"],
      ["stay", "Baixa boutique · €138/night"],
      ["estimated total", "€742 for 2 travellers"],
    ],
  },
  {
    id: "trading",
    label: "Trading",
    title: "Strategy screen",
    desc: "Pull a universe, compute signals, and size positions against a risk budget — every input and intermediate recorded as an event.",
    yaml: `metadata:
  name: momentum-screen
  path: demo/trading/momentum-screen
  version: "1.0"

workload:
  universe: SP500
  lookback_days: 90
  risk_budget: 0.02

workflow:
  - step: start
    tool: { kind: noop }
  - step: load_universe
    tool: { kind: postgres }
  - step: compute_signals
    tool: { kind: duckdb }
  - step: rank_candidates
    tool: { kind: python }
  - step: size_positions
    tool: { kind: python }
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "load_universe", tool: "postgres", note: "constituents as of date", out: "503 symbols loaded" },
      { step: "compute_signals", tool: "duckdb", note: "90d momentum + vol", out: "503 rows · 4 factors" },
      { step: "rank_candidates", tool: "python", note: "rank and cut", out: "top 25 by risk-adj momentum" },
      { step: "size_positions", tool: "python", note: "apply 2% risk budget", out: "25 positions · gross 0.94x" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["universe", "S&P 500 · 503 names"],
      ["signal", "90-day momentum, vol-adjusted"],
      ["selected", "25 positions"],
      ["gross exposure", "0.94x"],
      ["risk budget", "2.0% · within limit"],
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    title: "Intake triage assist",
    desc: "Structure an intake form, check it against a triage protocol, and route to the right queue — with the protocol version recorded alongside the decision.",
    yaml: `metadata:
  name: intake-triage
  path: demo/health/intake-triage
  version: "1.0"

workload:
  protocol: ESI-v4
  queue: general

workflow:
  - step: start
    tool: { kind: noop }
  - step: structure_intake
    tool: { kind: python }
  - step: apply_protocol
    tool: { kind: python }
  - step: route_queue
    tool: { kind: http }
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "structure_intake", tool: "python", note: "normalise form fields", out: "9 fields · 0 missing required" },
      { step: "apply_protocol", tool: "python", note: "ESI-v4 rules", out: "acuity 3 · no red flags" },
      { step: "route_queue", tool: "http", note: "assign to queue", out: "queue: same-day · SLA 4h" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["protocol", "ESI-v4 (version recorded with decision)"],
      ["acuity", "3 — urgent, not emergent"],
      ["routed to", "same-day clinic queue"],
      ["SLA", "4 hours"],
      ["clinician review", "required before action"],
    ],
    caveat: "Illustrative only. A real deployment is a decision-support aid: a clinician reviews every output, and nothing is auto-actioned.",
  },
  {
    id: "callcenter",
    label: "Call centre",
    title: "Routing & summarisation",
    desc: "Transcribe, classify intent, route to a skill group, and leave a summary on the ticket — one playbook, four tools.",
    yaml: `metadata:
  name: call-routing
  path: demo/cc/call-routing
  version: "1.0"

workload:
  locale: en-GB
  max_summary_words: 80

workflow:
  - step: start
    tool: { kind: noop }
  - step: transcribe
    tool: { kind: http }
  - step: classify_intent
    tool: { kind: python }
  - step: route_agent
    tool: { kind: http }
  - step: summarise
    tool: { kind: python }
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "transcribe", tool: "http", note: "speech to text", out: "4m12s · confidence 0.94" },
      { step: "classify_intent", tool: "python", note: "intent + sentiment", out: "billing_dispute · negative" },
      { step: "route_agent", tool: "http", note: "skill-group assignment", out: "queue: billing-tier2 · wait 90s" },
      { step: "summarise", tool: "python", note: "80-word wrap-up", out: "summary attached to ticket" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["call length", "4m 12s"],
      ["intent", "billing dispute (0.91)"],
      ["sentiment", "negative — escalation flagged"],
      ["routed to", "billing tier 2 · 90s wait"],
      ["ticket", "summary + transcript attached"],
    ],
  },
  {
    id: "sre",
    label: "SRE",
    title: "Incident triage",
    desc: "Correlate an alert with recent deploys, pull the matching runbook, and either remediate or page — with the whole chain replayable afterwards.",
    yaml: `metadata:
  name: incident-triage
  path: demo/sre/incident-triage
  version: "1.0"

workload:
  service: checkout-api
  severity: SEV2

workflow:
  - step: start
    tool: { kind: noop }
  - step: gather_signals
    tool: { kind: http }
  - step: correlate_deploys
    tool: { kind: postgres }
  - step: select_runbook
    tool: { kind: python }
  - step: remediate_or_page
    tool: { kind: http }
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "gather_signals", tool: "http", note: "metrics + recent errors", out: "p99 2.4s (was 180ms) · 5xx 3.1%" },
      { step: "correlate_deploys", tool: "postgres", note: "deploys in window", out: "1 deploy 12m ago · checkout-api v4.2.0" },
      { step: "select_runbook", tool: "python", note: "match symptom to runbook", out: "runbook: latency-after-deploy" },
      { step: "remediate_or_page", tool: "http", note: "guarded action", out: "rollback proposed · awaiting approval" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["service", "checkout-api · SEV2"],
      ["symptom", "p99 180ms → 2.4s, 5xx at 3.1%"],
      ["correlated", "deploy v4.2.0, 12 minutes prior"],
      ["runbook", "latency-after-deploy"],
      ["action", "rollback proposed — held for human approval"],
    ],
  },
  {
    id: "quantum",
    label: "Quantum",
    kind: "external",
    title: "Quantum computation cloud",
    desc: "saqbit runs hybrid quantum-classical workflows orchestrated by NoETL. Unlike the tiles above it is not simulated here — the link opens the live saqbit demo.",
    href: "https://saqbit.com",
    hrefLabel: "Open the saqbit demo",
  },
];
