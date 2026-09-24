/* NoETL landing — interaction.
 *
 * Two kinds of behaviour live here and they are deliberately kept apart:
 *
 *   1. The DEMO, which is pure theatre. It never touches the network.
 *   2. The WAITLIST and FEEDBACK forms, which are the only real network calls
 *      on this page — same-origin POSTs to this site's own Pages Functions.
 *
 * There is no NoETL API client here, no gateway URL, no auth token. An
 * anonymous visitor cannot reach a playbook or an EHDB endpoint from this
 * page because the code to do so is not in the bundle.
 */
(function () {
  "use strict";

  // ───────────────────────── demo ─────────────────────────
  const demos = window.NOETL_DEMOS || [];
  const tabsEl = document.querySelector(".domain-tabs");
  const titleEl = document.querySelector(".demo-title");
  const descEl = document.querySelector(".demo-desc");
  const yamlEl = document.querySelector(".yaml code");
  const eventsEl = document.querySelector(".events");
  const resultPane = document.querySelector(".result-pane");
  const resultEl = document.querySelector(".result");
  const runBtn = document.querySelector(".btn-run");
  const stepBtn = document.querySelector(".btn-step");
  const resetBtn = document.querySelector(".btn-reset");

  let active = 0;
  let cursor = 0;      // index of the next step to play
  let playing = false;
  let timer = null;

  function buildTabs() {
    tabsEl.innerHTML = "";
    demos.forEach((d, i) => {
      // An `external` tile is not a simulation — it opens a live demo
      // elsewhere. Rendering it as an anchor rather than a tab keeps that
      // honest: it looks like a link because it behaves like one.
      if (d.kind === "external") {
        const a = document.createElement("a");
        a.className = "domain-tab domain-tab-ext";
        a.href = d.href;
        a.rel = "noopener";
        a.innerHTML = '<span></span><span class="ext-mark" aria-hidden="true">↗</span>';
        a.firstChild.textContent = d.label;
        a.title = d.hrefLabel || ("Open " + d.href);
        tabsEl.appendChild(a);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "domain-tab" + (i === active ? " active" : "") + (d.featured ? " domain-tab-featured" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(i === active));
      b.textContent = d.label;
      b.addEventListener("click", () => select(i));
      tabsEl.appendChild(b);
    });
  }

  function select(i) {
    const d = demos[i];
    if (!d || d.kind === "external") return;   // link-out tiles are never "selected"
    active = i;
    reset();
    buildTabs();
    titleEl.textContent = d.title;
    descEl.textContent = d.desc;
    yamlEl.textContent = d.yaml;
    renderCards(d);
  }

  /** Agent Cards + the load-bearing tier rule, for mesh demos only. */
  function renderCards(d) {
    const host = document.querySelector(".agents");
    const pane = document.querySelector(".agents-pane");
    if (!host || !pane) return;
    if (!d.cards || !d.cards.length) { pane.hidden = true; return; }
    host.innerHTML = "";
    d.cards.forEach(c => {
      const el = document.createElement("div");
      el.className = "agent-card";
      el.innerHTML =
        '<div class="ac-top"><span class="ac-name"></span><span class="ac-tier"></span></div>' +
        '<div class="ac-skill"></div><div class="ac-reduces"></div>';
      el.querySelector(".ac-name").textContent = c.name;
      el.querySelector(".ac-tier").textContent = c.tier;
      el.querySelector(".ac-skill").textContent = c.skill;
      el.querySelector(".ac-reduces").textContent = "reduces: " + c.reduces;
      host.appendChild(el);
    });
    const ruleEl = document.querySelector(".mesh-rule");
    if (ruleEl) { ruleEl.textContent = d.rule || ""; ruleEl.hidden = !d.rule; }
    // "Learn more" targets. Rendered from the spec so adding the noetl.dev
    // A2A page later is a one-line change in demos.js, not a DOM edit here.
    const moreEl = document.querySelector(".mesh-more");
    if (moreEl) {
      const links = d.links || [];
      moreEl.innerHTML = "";
      links.forEach(l => {
        const a = document.createElement("a");
        a.className = "mesh-link mesh-link-" + (l.kind || "more");
        a.href = l.href;
        a.rel = "noopener";
        a.innerHTML = '<span class="ml-label"></span><span class="ml-mark" aria-hidden="true">↗</span>';
        a.querySelector(".ml-label").textContent = l.label;
        moreEl.appendChild(a);
      });
      moreEl.hidden = links.length === 0;
    }
    pane.hidden = false;
  }

  function evt(type, node, status) {
    const li = document.createElement("li");
    li.className = "event";
    li.innerHTML =
      '<span class="ev-type"></span><span class="ev-node"></span><span class="ev-status"></span>';
    li.querySelector(".ev-type").textContent = type;
    li.querySelector(".ev-node").textContent = node || "";
    const s = li.querySelector(".ev-status");
    s.textContent = status || "";
    if (status) s.classList.add("st-" + status.toLowerCase().replace(/[^a-z]/g, ""));
    eventsEl.appendChild(li);
    eventsEl.scrollTop = eventsEl.scrollHeight;
  }

  /** Play one step as the sequence of events a real execution would record. */
  function playStep() {
    const d = demos[active];
    if (cursor === 0) {
      evt("playbook_started", d.yaml.match(/path:\s*(\S+)/)[1], "STARTED");
      evt("execution.catalog_snapshot", "—", "RECORDED");
    }
    if (cursor >= d.steps.length) return finish();

    const s = d.steps[cursor];
    if (cursor > 0) evt("step.enter", s.step, "ENTERED");
    evt("command.issued", s.step + (s.tier ? "  [" + s.tier + "]" : ""), "PENDING");
    evt("command.claimed", s.tool || s.step, "RUNNING");
    // A ReAct agent's value is in WHY it decided, so the reason and the act
    // are shown as their own lines rather than collapsed into one result.
    if (s.reason) evt("agent.reason", s.reason, "REASONED");
    if (s.act) evt("agent.act", s.act, "ACTED");
    evt("call.done", s.step + (s.out ? " → " + s.out : ""), "COMPLETED");
    evt("command.completed", s.step, "success");
    cursor += 1;
    if (cursor >= d.steps.length) finish();
    return true;
  }

  function finish() {
    if (playing) stop();
    const d = demos[active];
    if (!eventsEl.querySelector(".ev-type-final")) {
      const li = document.createElement("li");
      li.className = "event event-final";
      li.innerHTML = '<span class="ev-type ev-type-final">playbook.completed</span><span class="ev-node">playbook</span><span class="ev-status st-completed">COMPLETED</span>';
      eventsEl.appendChild(li);
      eventsEl.scrollTop = eventsEl.scrollHeight;
    }
    resultEl.innerHTML = "";
    d.result.forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "result-row";
      row.innerHTML = '<span class="rk"></span><span class="rv"></span>';
      row.querySelector(".rk").textContent = k;
      row.querySelector(".rv").textContent = v;
      resultEl.appendChild(row);
    });
    if (d.caveat) {
      const c = document.createElement("p");
      c.className = "result-caveat";
      c.textContent = d.caveat;
      resultEl.appendChild(c);
    }
    const note = document.createElement("p");
    note.className = "result-sim";
    note.textContent = "Simulated result — these values are canned, not computed.";
    resultEl.appendChild(note);
    resultPane.hidden = false;
  }

  function stop() {
    playing = false;
    clearInterval(timer);
    timer = null;
    runBtn.textContent = "Run playbook";
  }

  function run() {
    if (playing) return stop();
    if (cursor >= demos[active].steps.length) reset();
    playing = true;
    runBtn.textContent = "Pause";
    playStep();
    timer = setInterval(() => {
      if (cursor >= demos[active].steps.length) return stop();
      playStep();
    }, 900);
  }

  function reset() {
    stop();
    cursor = 0;
    eventsEl.innerHTML = "";
    resultEl.innerHTML = "";
    resultPane.hidden = true;
  }

  if (demos.length) {
    buildTabs();
    select(0);
    runBtn.addEventListener("click", run);
    stepBtn.addEventListener("click", () => { stop(); playStep(); });
    resetBtn.addEventListener("click", reset);
  }

  // ─────────────────── chat questionnaire engine ───────────────────
  //
  // One engine, two questionnaires (waitlist + feedback). Both are defined
  // declaratively in forms.js; nothing about a specific question lives here.
  //
  // ⚠ PARTIAL SAVE. The waitlist asks thirteen questions, and some people will
  // leave at question nine. A drop-off is still market signal — and someone
  // who gave a name and a work email is still a lead — so once the email is
  // answered the record is written with status "partial" and then updated in
  // place at the end. Without this, every abandoned form is data we asked a
  // real person for and then threw away.

  const FORMS = window.NOETL_FORMS || {};

  function createChat(root, spec) {
    if (!root || !spec) return;

    const logEl = root.querySelector(".chat-log");
    const formEl = root.querySelector(".chat-input");
    const fieldEl = root.querySelector(".chat-field");
    const selectEl = root.querySelector(".chat-select");
    const multiEl = root.querySelector(".chat-multi");
    const progEl = root.querySelector(".chat-progress");
    const restartEl = root.querySelector(".js-restart");
    const sendBtn = formEl.querySelector("button");
    const qs = spec.questions;

    let qi = 0;
    let answers = {};
    let multiSel = new Set();
    let done = false;
    let started = false;     // gates focus; see the scroll note below
    let recordId = null;     // set by the partial save, reused by the final one
    // ⚠ The guard on the partial save must be set SYNCHRONOUSLY. `recordId`
    // only lands when the request returns, so guarding on it alone fires a
    // fresh save on every subsequent answer — and because each id-less POST
    // mints a new id, one person becomes a dozen rows. Measured: 12 partial
    // writes for a single 13-question run before this flag existed.
    let partialSave = null;  // the in-flight promise, awaited before the final write

    function bubble(text, who, extra) {
      const b = document.createElement("div");
      b.className = "bubble " + who + (extra ? " " + extra : "");
      b.textContent = text;
      logEl.appendChild(b);
      logEl.scrollTop = logEl.scrollHeight;
      return b;
    }

    function setProgress() {
      if (!progEl) return;
      progEl.textContent = done ? "done" : (Math.min(qi + 1, qs.length) + " of " + qs.length);
    }

    function hideAllInputs() {
      fieldEl.hidden = true;
      selectEl.hidden = true;
      if (multiEl) multiEl.hidden = true;
    }

    /** Write what we have so far. Never blocks the conversation: a failed
     *  partial save is invisible to the visitor, because the answer that
     *  matters to them is the final one. */
    async function savePartial() {
      try {
        const res = await fetch(spec.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({}, answers, { status: "partial", id: recordId })),
        });
        const data = await res.json().catch(() => ({}));
        if (data && data.ok && data.id) recordId = data.id;
      } catch (_) { /* deliberately silent — see above */ }
    }

    function ask() {
      if (qi >= qs.length) return submit();
      const q = qs[qi];
      bubble(q.q, "bot");
      hideAllInputs();
      multiSel = new Set();

      if (q.type === "choice") {
        selectEl.innerHTML = "";
        const ph = document.createElement("option");
        ph.value = ""; ph.textContent = "Choose…"; ph.disabled = true; ph.selected = true;
        selectEl.appendChild(ph);
        q.options.forEach(o => {
          const el = document.createElement("option");
          el.value = o; el.textContent = o;
          selectEl.appendChild(el);
        });
        selectEl.hidden = false;
        if (started) selectEl.focus();
      } else if (q.type === "multi" && multiEl) {
        multiEl.innerHTML = "";
        q.options.forEach(o => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "chip";
          chip.textContent = o;
          chip.setAttribute("aria-pressed", "false");
          chip.addEventListener("click", () => {
            if (multiSel.has(o)) multiSel.delete(o); else multiSel.add(o);
            chip.classList.toggle("chip-on", multiSel.has(o));
            chip.setAttribute("aria-pressed", String(multiSel.has(o)));
          });
          multiEl.appendChild(chip);
        });
        multiEl.hidden = false;
      } else {
        fieldEl.type = q.type === "email" ? "email" : "text";
        fieldEl.placeholder = q.placeholder || "Type your answer…";
        fieldEl.value = "";
        fieldEl.hidden = false;
        if (started) fieldEl.focus();
      }
      setProgress();
    }

    async function submit() {
      done = true;
      hideAllInputs();
      sendBtn.disabled = true;
      setProgress();
      const pending = bubble("Saving…", "bot", "pending");
      try {
        // Let the partial write finish first so the final one updates that
        // record instead of racing it and creating a second row.
        if (partialSave) { try { await partialSave; } catch (_) {} }
        const res = await fetch(spec.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({}, answers, { status: "complete", id: recordId })),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || ("HTTP " + res.status));
        pending.remove();
        (spec.done ? spec.done(data.id) : ["Saved as " + data.id + "."]).forEach(m => bubble(m, "bot"));
      } catch (err) {
        // ⚠ Never claim a save that did not happen. The visitor decides whether
        // they are on the list based on this message.
        pending.remove();
        bubble("That didn't save — " + (err && err.message ? err.message : "unknown error") +
               ". Nothing was recorded. Please try again.", "bot", "error");
        done = false;
        sendBtn.disabled = false;
        qi = qs.length - 1;
        fieldEl.hidden = false;
      }
    }

    formEl.addEventListener("submit", e => {
      e.preventDefault();
      if (done || qi >= qs.length) return;
      started = true;
      const q = qs[qi];

      let val;
      let shown;
      if (q.type === "multi") {
        val = [...multiSel];
        shown = val.length ? val.join(", ") : "(none)";
      } else if (q.type === "choice") {
        val = selectEl.value;
        shown = val;
        if (!val) { bubble("Pick one of the options to continue.", "bot", "error"); return; }
      } else {
        val = (fieldEl.value || "").trim();
        shown = val || "(empty)";
      }

      // `skip` is honoured only where the question says it is optional.
      const skipped = q.optional && (
        (q.type === "multi" && val.length === 0) ||
        (typeof val === "string" && (val === "" || /^skip$/i.test(val)))
      );

      if (!skipped && q.validate) {
        const ok = q.validate(val);
        if (ok !== true) {
          bubble(shown, "me");
          bubble(ok, "bot", "error");
          if (q.type !== "multi" && q.type !== "choice") fieldEl.value = "";
          return;
        }
      }

      answers[q.key] = skipped ? "" : val;
      bubble(skipped ? "skip" : shown, "me");
      qi += 1;

      // Once we have a contactable identity, persist — exactly once.
      if (!partialSave && answers.email) partialSave = savePartial();

      ask();
    });

    if (restartEl) {
      restartEl.addEventListener("click", () => {
        started = true; done = false; qi = 0; answers = {}; recordId = null;
        logEl.innerHTML = "";
        sendBtn.disabled = false;
        ask();
      });
    }

    ask();
  }

  createChat(document.querySelector("#waitlist .chat"), FORMS.waitlist);
  createChat(document.querySelector("#feedback .chat"), FORMS.feedback);
})();
