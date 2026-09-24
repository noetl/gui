/* Text to playbook: the simulated authoring chat.
 *
 * ⚠ THERE IS NO MODEL HERE. Nothing is generated, nothing is inferred, and
 * no request leaves the browser. Each domain has a canned prompt, a canned
 * reply, and a playbook assembled from the SAME steps that tile already
 * runs, so the thing the chat "writes" is exactly the thing the Run button
 * then executes. That consistency is the point: a demo that showed one
 * playbook and ran a different one would be a lie told in two parts.
 *
 * The page labels this "AI generated, simulated" wherever it appears. It is
 * a preview of a capability, not a live model, and saying so plainly costs
 * nothing next to being caught overstating it.
 */

/** Tool kind per step, read off the demo's own tool string. */
window.NOETL_FORGE = {
  /* Keyword routing for free text. Deliberately small and honest: if nothing
   * matches we say so rather than inventing an answer, because a canned demo
   * that pretends to understand arbitrary input is the exact overclaim this
   * page avoids everywhere else. */
  keywords: {
    a2a: ["a2a", "agent", "mesh", "signal", "tier", "sensor", "fleet", "telemetry"],
    travel: ["travel", "trip", "itinerary", "flight", "hotel", "holiday", "booking"],
    trading: ["trade", "trading", "portfolio", "signal", "strategy", "backtest", "equity", "risk budget"],
    healthcare: ["health", "intake", "triage", "clinic", "patient", "protocol"],
    drugdesign: ["drug", "molecule", "ligand", "docking", "compound", "probe", "assay", "chemistry"],
    callcenter: ["call", "contact centre", "contact center", "transcribe", "intent", "routing", "support"],
    sre: ["sre", "incident", "runbook", "oncall", "on call", "outage", "latency", "deploy", "alert"],
    security: ["security", "compliance", "soc 2", "soc2", "audit", "control", "evidence", "pen test", "pentest"],
    slm: ["slm", "model", "fine tune", "fine-tune", "training", "adapter", "eval", "gemma", "dataset"],
    quantum: ["quantum", "qubit", "vqe", "qaoa", "circuit", "hybrid"],
  },

  domains: [
    { id: "a2a", label: "Agent mesh",
      prompt: "Reduce thousands of device signals into one verdict I can audit, with agents per signal class.",
      path: "generated/a2a/signal-mesh",
      workload: { site: "plant-04", window_s: 60, threshold: 50.0 },
      reply: [
        "A tiered mesh fits this. I will give each signal class its own tier 0 agent, have tier 1 reduce only its own children, and let tier 2 emit one number and one boolean.",
        "Each agent publishes its population count alongside its value, so the aggregator weights by how many signals a child summarises rather than by a constant.",
      ] },

    { id: "travel", label: "Travel",
      prompt: "Plan a three night trip to Lisbon for two people and cost it out.",
      path: "generated/travel/trip-plan",
      workload: { city: "Lisbon", nights: 3, travellers: 2 },
      reply: [
        "Straightforward fan out then assemble. Dates resolve first because both provider calls depend on them.",
        "Flights and hotels go through the registered MCP providers rather than raw HTTP, so credentials stay in the provider playbook.",
      ] },

    { id: "trading", label: "Trading",
      prompt: "Screen the S&P 500 for momentum and size positions against a two percent risk budget.",
      path: "generated/trading/momentum-screen",
      workload: { universe: "SP500", lookback_days: 90, risk_budget: 0.02 },
      reply: [
        "Universe from Postgres, factors in DuckDB, then two python steps for ranking and sizing.",
        "Sizing is separate from ranking on purpose, so a change to the risk budget does not silently rewrite the selection.",
      ] },

    { id: "healthcare", label: "Healthcare",
      prompt: "Turn an intake form into a triage decision and route it to the right queue.",
      path: "generated/health/intake-triage",
      workload: { protocol: "ESI-v4", queue: "general" },
      reply: [
        "Structure first, then apply the protocol, then route. The protocol version is recorded with the decision so a later reader knows which rules applied.",
        "This is decision support. The routing step assigns a queue, it does not discharge anyone.",
      ] },

    { id: "drugdesign", label: "Drug design",
      prompt: "Dock a probe library against a target, score the poses and record the campaign.",
      path: "generated/chem/probe-campaign",
      workload: { target: "transporter-isoform-A", library: "probe-set-0412", replicates: 3 },
      reply: [
        "Prepare, dock, score, fingerprint the interactions, classify, then record with checksums so the run can be cited.",
        "The docking lane is its own sub playbook because it runs on different hardware to the rest.",
      ] },

    { id: "callcenter", label: "Call centre",
      prompt: "Transcribe a support call, work out the intent and route it, then summarise it on the ticket.",
      path: "generated/cc/call-routing",
      workload: { locale: "en-GB", max_summary_words: 80 },
      reply: [
        "Four tools, one pass. Transcription and routing are HTTP calls, classification and summarising are python.",
        "Summarising runs after routing so the agent picking up the call already has the wrap up.",
      ] },

    { id: "sre", label: "SRE",
      prompt: "When checkout latency spikes, correlate it with recent deploys and pull the matching runbook.",
      path: "generated/sre/incident-triage",
      workload: { service: "checkout-api", severity: "SEV2" },
      reply: [
        "Signals first, then deploy correlation, then runbook selection, then a guarded action.",
        "The last step proposes a rollback rather than performing one. An automated remediation that nobody approved is how a SEV2 becomes a SEV1.",
      ] },

    { id: "security", label: "Security",
      prompt: "Collect SOC 2 control evidence for the quarter and run the authorised scans.",
      path: "generated/sec/control-evidence",
      workload: { framework: "SOC 2 Type II", window_days: 90, scope_ref: "engagement-2027-014" },
      reply: [
        "Authorisation is the first step and it is a gate. Nothing scans until the scope and the signed engagement check out.",
        "The last step assembles evidence for the auditor. A playbook does not issue the opinion.",
      ] },

    { id: "slm", label: "SLM training",
      prompt: "Fine tune a small model on our traces and only promote it if it clears the parity gate.",
      path: "generated/slm/training-cycle",
      workload: { base_model: "gemma-small", backend: "local", cycle: 3, parity_threshold: 0.98 },
      reply: [
        "Curate, train an adapter, evaluate, then gate. The gate can say no, which is the only reason to have one.",
        "The last step queues the next cycle from whatever scored worst, so this is a loop rather than a job.",
      ] },

    { id: "quantum", label: "Quantum",
      prompt: "Run a hybrid quantum classical optimisation and fall back to the classical solver if the device is busy.",
      path: "generated/quantum/hybrid-optimise",
      workload: { problem: "maxcut-32", backend: "simulator", shots: 1024 },
      reply: [
        "Hybrid loop: build the circuit classically, run the variational step on the backend, then post process.",
        "Backend selection is a workload field rather than a hard coded device, so the same playbook runs on a simulator or on hardware.",
      ],
      /* Quantum's showcase tile links out to the live saqbit demo rather than
         simulating, so unlike the others it has no cascade to borrow. It gets
         its own here. */
      steps: [
        { step: "start", tool: "noop", note: "entry point" },
        { step: "build_circuit", tool: "python", note: "encode the problem as a parameterised circuit",
          out: "32 qubit ansatz, depth 6" },
        { step: "select_backend", tool: "python", note: "simulator or hardware, from the workload",
          out: "simulator selected, queue depth 0" },
        { step: "run_variational", tool: "playbook", note: "optimise the parameters against the backend",
          out: "48 iterations, 1024 shots each" },
        { step: "post_process", tool: "python", note: "decode counts into a solution",
          out: "cut value 214 of a 232 bound" },
        { step: "end", tool: "noop" },
      ],
      result: [
        ["problem", "maxcut-32, illustrative"],
        ["backend", "simulator, chosen from the workload not hard coded"],
        ["iterations", "48 variational rounds at 1024 shots"],
        ["solution", "cut value 214 against a 232 upper bound"],
        ["note", "the live quantum demo is saqbit.com, this is a simulated cascade"],
      ],
      caveat: "Simulated cascade, not a quantum run. Nothing was executed on a simulator or on hardware, and the numbers are invented to show the loop shape. The live quantum work is at saqbit.com.",
    },
  ],
};
