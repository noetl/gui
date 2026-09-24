/* NoETL landing: simulated domain demos.
 *
 * ⚠ EVERYTHING HERE IS CANNED. No fetch, no XHR, no websocket, no backend of
 * any kind. Each demo is a hand-written playbook plus hand-written step
 * outputs, replayed on a timer in the visitor's browser.
 *
 * The event names are the real ones NoETL records: playbook_started,
 * execution.catalog_snapshot, command.issued, command.claimed,
 * command.started, call.done, command.completed, step.enter,
 * playbook.completed. Showing a made-up lifecycle to explain a real
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
    desc: "Thousands of devices, no single model that can reason over all of them. A hierarchy of small reasoners each takes a narrow slice, decides, and publishes a reduced value upward, ending in one number and one boolean that can be replayed rather than trusted.",
    /* Modelled on the real signal-mesh blueprint (noetl/signal-mesh wiki):
       tier 0 raw ReAct agents per signal class, tier 1 specialized
       aggregators, tier 2 synthesizer emitting a numeric definition-function
       plus a boolean. Agent discovery is A2A, via an Agent Card served at
       /.well-known/agent-card.json and registered in the noetl catalog. */
    /* "Learn more" targets for this tile.
     *
     * ⚠ EVERY ENTRY MUST RESOLVE BEFORE IT SHIPS. A landing page for a
     * pre-launch product is already asking for trust on credit; a 404 behind
     * "read the architecture" spends it. Both entries below were checked for
     * HTTP 200 at build time.
     *
     * The canonical A2A page on noetl.dev is not published yet. The docs
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
        reason: "temp 74.2°C, 8.1 above the 60s rolling mean, sustained rather than a spike",
        act: "publish reduced value 68.0 (confidence 0.88)", out: "temp → 68.0" },
      { step: "tier0_react", tool: "playbook · agent.vibration", tier: "tier 0",
        reason: "RMS within band but third harmonic rising across the window",
        act: "publish reduced value 48.0 (confidence 0.71)", out: "vibration → 48.0" },
      { step: "tier0_react", tool: "playbook · agent.pressure", tier: "tier 0",
        reason: "2.1 bar below setpoint and recovering, so no trip condition",
        act: "publish reduced value 35.0 (confidence 0.93)", out: "pressure → 35.0" },
      { step: "tier1_aggregate", tool: "playbook · agent.site-health", tier: "tier 1",
        reason: "weighted mean over tier 0 only: 0.6·68.0 + 0.4·48.0",
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
      ["threshold", "50.0, exceeded"],
      ["tier 1 inputs", "site-health 60.0 · asset-risk 35.0 · weights 0.7 / 0.3"],
      ["tier 0 inputs", "temp 68.0 · vibration 48.0 · pressure 35.0"],
      ["provenance", "every reasoning step appended to EHDB, so it can be replayed rather than trusted"],
    ],
    caveat: "Design and POC. The signal-mesh is not deployed, so these agents, signals and the verdict are illustrative. The numbers are arranged to show the cascade, not measured.",
  },
  {
    id: "travel",
    label: "Travel",
    title: "Trip planning",
    desc: "Turn a rough request into a costed itinerary. Hotels and flights are resolved through provider tools, then assembled into one render-ready payload.",
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
      ["dates", "14 to 17 Feb 2027 · 3 nights"],
      ["flights", "TAP LIS 1042 · €184 return pp"],
      ["stay", "Baixa boutique · €138/night"],
      ["estimated total", "€742 for 2 travellers"],
    ],
  },
  {
    id: "trading",
    label: "Trading",
    title: "Strategy screen",
    desc: "Pull a universe, compute signals, and size positions against a risk budget, with every input and intermediate recorded as an event.",
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
    desc: "Structure an intake form, check it against a triage protocol, and route to the right queue, with the protocol version recorded alongside the decision.",
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
      ["acuity", "3, urgent but not emergent"],
      ["routed to", "same-day clinic queue"],
      ["SLA", "4 hours"],
      ["clinician review", "required before action"],
    ],
    caveat: "Illustrative only. A real deployment is a decision-support aid: a clinician reviews every output, and nothing is auto-actioned.",
  },
  {
    id: "drugdesign",
    label: "Drug design",
    title: "Probe design pipeline",
    desc: "A campaign run as one playbook: prepare the ligand library, dock it against the target, score poses, fingerprint the interactions, classify behaviour, and record everything with checksums so the run can be cited and repeated.",
    /* SHAPE grounded in a real pipeline (stage order and toolchain: RDKit and
       Meeko for preparation, AutoDock-GPU/Vina for docking, ProLIF for
       interaction fingerprints, a metadata index for the registry).
       ⚠ VALUES ARE NOT. No real compound, target residue or measured affinity
       from that work appears here: it is private research, and a public
       marketing page is not the place to publish someone's unpublished
       results. Every identifier and number below is invented to show the
       orchestration and is labelled as such on screen. */
    yaml: `metadata:
  name: probe-campaign
  path: demo/chem/probe-campaign
  version: "1.0"

workload:
  target: transporter-isoform-A
  library: probe-set-0412
  replicates: 3

workflow:
  - step: start
    tool: { kind: noop }
  - step: validate_context
    tool: { kind: python }        # pin toolchain + inputs
  - step: prepare_ligands
    tool: { kind: python }        # RDKit + Meeko
  - step: dock_provisional
    tool: { kind: playbook }      # AutoDock-GPU lane
  - step: score_poses
    tool: { kind: python }
  - step: analyse_interactions
    tool: { kind: python }        # ProLIF fingerprints
  - step: classify_behaviour
    tool: { kind: python }
  - step: record_campaign
    tool: { kind: playbook }      # registry + checksums
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "validate_context", tool: "python", note: "pin inputs and toolchain versions",
        out: "target + 1 library resolved, 6 deps pinned" },
      { step: "prepare_ligands", tool: "python · RDKit, Meeko", note: "protonate, enumerate conformers, convert",
        out: "48 ligands prepared, 214 conformers" },
      { step: "dock_provisional", tool: "playbook · AutoDock-GPU", note: "provisional docking lane, 3 replicates",
        out: "144 runs complete, 48 best poses" },
      { step: "score_poses", tool: "python", note: "rank by predicted affinity and pose quality",
        out: "top 12 carried forward (illustrative scores)" },
      { step: "analyse_interactions", tool: "python · ProLIF", note: "interaction fingerprints per pose",
        out: "12 fingerprints, 4 contact types" },
      { step: "classify_behaviour", tool: "python", note: "group poses by binding behaviour",
        out: "3 behaviour classes, 1 flagged for review" },
      { step: "record_campaign", tool: "playbook · registry", note: "inputs, configs, code SHAs, checksums",
        out: "campaign recorded, fully replayable" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["campaign", "probe-set-0412 against transporter-isoform-A"],
      ["docked", "48 ligands, 3 replicates, 144 runs"],
      ["carried forward", "12 poses across 3 behaviour classes"],
      ["flagged for review", "1 pose, sent to a chemist, not auto-accepted"],
      ["provenance", "inputs, configs, code SHAs and checksums recorded"],
    ],
    caveat: "Simulated pipeline, not a scientific result. The identifiers, counts and classes above are invented to show how the orchestration runs. Nothing here is a measured affinity or a finding about any real compound or target, and no output of a pipeline like this would be acted on without review by a qualified chemist.",
  },
  {
    id: "callcenter",
    label: "Call centre",
    title: "Routing & summarisation",
    desc: "Transcribe, classify intent, route to a skill group, and leave a summary on the ticket. One playbook, four tools.",
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
      ["sentiment", "negative, escalation flagged"],
      ["routed to", "billing tier 2 · 90s wait"],
      ["ticket", "summary + transcript attached"],
    ],
  },
  {
    id: "sre",
    label: "SRE",
    title: "Incident triage",
    desc: "Correlate an alert with recent deploys, pull the matching runbook, and either remediate or page, with the whole chain replayable afterwards.",
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
      ["action", "rollback proposed, held for human approval"],
    ],
  },
  {
    id: "security",
    label: "Security & compliance",
    title: "Control evidence and authorised testing",
    desc: "One playbook for the audit cycle: confirm scope and authorisation, enumerate the controls, gather evidence from the systems that hold it, run the authorised scanners, triage what comes back, and assemble a package an auditor can actually read.",
    /* ⚠ RESPONSIBLE FRAMING, and it is load-bearing rather than decorative.
       This tile demonstrates ORCHESTRATION of security and compliance work.
       It runs nothing, scans nothing, and reaches no verdict.
       Three rules the content follows:
         1. Authorisation is the FIRST step and it is a gate, because that is
            how authorised testing actually works. A tool that scans before
            checking scope is the problem, not the product.
         2. No exploit detail. Findings appear as severity counts and control
            mappings, never as technique, payload or target specifics.
         3. No pass/fail claim. A tool prepares evidence; an auditor issues
            the opinion. Saying otherwise would be false about how SOC 2
            works and would mislead exactly the reader who most needs it
            right. */
    yaml: `metadata:
  name: control-evidence
  path: demo/sec/control-evidence
  version: "1.0"

workload:
  framework: SOC 2 Type II
  window_days: 90
  scope_ref: engagement-2027-014

workflow:
  - step: start
    tool: { kind: noop }
  - step: confirm_authorisation
    tool: { kind: python }        # gate: scope + signed engagement
  - step: enumerate_controls
    tool: { kind: python }
  - step: collect_evidence
    tool: { kind: playbook }      # config, access, change, log systems
  - step: run_authorised_scans
    tool: { kind: playbook }      # in-scope assets only
  - step: triage_findings
    tool: { kind: python }
  - step: check_control_status
    tool: { kind: python }
  - step: build_evidence_pack
    tool: { kind: python }
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "confirm_authorisation", tool: "python", note: "refuses to continue without scope and a signed engagement",
        out: "scope engagement-2027-014 valid, 42 assets in scope" },
      { step: "enumerate_controls", tool: "python", note: "controls for the selected framework",
        out: "64 controls across 5 trust criteria" },
      { step: "collect_evidence", tool: "playbook · evidence sources", note: "config, access reviews, change records, logs",
        out: "58 of 64 controls have evidence for the window" },
      { step: "run_authorised_scans", tool: "playbook · scanner orchestration", note: "in-scope assets only, rate limited",
        out: "42 assets scanned, 17 findings returned" },
      { step: "triage_findings", tool: "python", note: "deduplicate, rank by severity, assign an owner",
        out: "17 to 11 after dedupe: 2 high, 4 medium, 5 low" },
      { step: "check_control_status", tool: "python", note: "map evidence and findings onto each control",
        out: "58 evidenced, 6 gaps, 0 opinions issued" },
      { step: "build_evidence_pack", tool: "python", note: "assemble for the auditor with provenance",
        out: "pack built, every item traceable to its source" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["framework", "SOC 2 Type II, 90 day window (illustrative)"],
      ["controls", "64 enumerated, 58 with evidence, 6 gaps to close"],
      ["authorised scan", "42 in-scope assets, 11 findings after dedupe"],
      ["severity", "2 high, 4 medium, 5 low, each with an owner"],
      ["outcome", "an evidence pack for the auditor, not a pass or fail"],
    ],
    caveat: "Simulated orchestration, not a security assessment. Nothing is scanned and no system is touched. The counts and severities are invented to show the workflow, no technique or exploit detail appears anywhere in this demo, and a tool of this kind prepares evidence rather than reaching a verdict. The SOC 2 opinion is the auditor's to issue, and testing runs only inside a scope someone has signed.",
  },
  {
    id: "slm",
    label: "SLM training",
    title: "Small model training cycle",
    desc: "Fine-tuning as a loop rather than a one-off job: curate the dataset, train an adapter on a small base model, evaluate it against a golden set, hold it at a parity gate, and either register it or feed the failures straight into the next cycle.",
    /* SHAPE grounded in the real SLM work: small Gemma base models, a
       pluggable backend (a local in-cluster runner or a cloud one, selected
       by the playbook rather than baked in), adapters instead of full
       retrains, a schema parity check on structured output, and a model
       registry that records what was promoted and why.
       ⚠ THE NUMBERS ARE INVENTED. No benchmark score here is a measurement.
       Publishing a made-up eval number as though it were real is the easiest
       way to mislead in this domain, so the tile shows the SHAPE of a gate
       and says plainly that the values are illustrative. */
    yaml: `metadata:
  name: slm-training-cycle
  path: demo/slm/training-cycle
  version: "1.0"

workload:
  base_model: gemma-small
  backend: local        # or a cloud runner, chosen here not baked in
  cycle: 3
  parity_threshold: 0.98

workflow:
  - step: start
    tool: { kind: noop }
  - step: curate_dataset
    tool: { kind: python }
  - step: train_adapter
    tool: { kind: playbook }      # pluggable backend
  - step: evaluate_golden_set
    tool: { kind: python }
  - step: schema_parity_gate
    tool: { kind: python }
  - step: decide_promotion
    tool: { kind: python }
  - step: register_model
    tool: { kind: playbook }      # model registry
  - step: queue_next_cycle
    tool: { kind: python }        # failures become cycle 4 data
  - step: end
    tool: { kind: noop }`,
    steps: [
      { step: "start", tool: "noop", note: "entry point" },
      { step: "curate_dataset", tool: "python", note: "gather, deduplicate, split, and version the data",
        out: "18.4k examples, deduped to 16.1k, split 90 / 5 / 5" },
      { step: "train_adapter", tool: "playbook · pluggable backend", note: "adapter on a small base model, not a full retrain",
        out: "adapter trained on gemma-small, 2 epochs" },
      { step: "evaluate_golden_set", tool: "python", note: "score against a held out golden set",
        out: "scored on 640 held out examples (illustrative)" },
      { step: "schema_parity_gate", tool: "python", note: "does structured output still match the schema",
        out: "parity 0.982 against a 0.98 threshold" },
      { step: "decide_promotion", tool: "python", note: "gate decides, and it can say no",
        out: "gate passed, 2 categories still below target" },
      { step: "register_model", tool: "playbook · model registry", note: "version, provenance, and the eval that justified it",
        out: "registered as cycle 3, previous stays rollback ready" },
      { step: "queue_next_cycle", tool: "python", note: "the weak categories become the next dataset",
        out: "cycle 4 queued from 2 weak categories" },
      { step: "end", tool: "noop" },
    ],
    result: [
      ["cycle", "3 of an ongoing loop, not a one off job"],
      ["training", "adapter on a small base model, 16.1k curated examples"],
      ["gate", "schema parity 0.982 against a 0.98 threshold (illustrative)"],
      ["promotion", "registered with the eval that justified it, prior version kept"],
      ["next cycle", "the 2 categories that scored worst become cycle 4 data"],
    ],
    caveat: "Simulated training cycle, not a benchmark. Every number above is invented to show the loop, and none of them is a measurement of any model. A real cycle keeps a person in the loop at the promotion gate: an eval score is evidence for a decision, not the decision itself.",
  },
  {
    id: "quantum",
    label: "Quantum",
    kind: "external",
    title: "Quantum computation cloud",
    desc: "saqbit runs hybrid quantum-classical workflows orchestrated by NoETL. Unlike the tiles above it is not simulated here. The link opens the live saqbit demo.",
    href: "https://saqbit.com",
    hrefLabel: "Open the saqbit demo",
  },
];
