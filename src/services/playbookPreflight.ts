import yaml from "js-yaml";

/**
 * Pre-flight checks run before a playbook is registered.
 *
 * These exist because the failures they catch are SILENT. The server accepts
 * the registration, the catalog shows the playbook, `/api/execute` returns
 * `status: "started"` — and then the execution records `playbook_started`,
 * records `execution.catalog_snapshot`, and stops. No error event, no failure
 * status, no log line. It simply sits at two events until someone notices.
 *
 * Catching that at registration time is the difference between a two-second
 * fix and an afternoon of reading event traces.
 */

export type PreflightSeverity = "error" | "warning";

export interface PreflightFinding {
  severity: PreflightSeverity;
  field: string;
  message: string;
  /** Why this matters — shown under the message, not a restatement of it. */
  detail: string;
}

/**
 * ⚠ `metadata.version` is REQUIRED for a playbook to dispatch.
 *
 * Without it the runtime issues no command at all: `/api/execute` comes back
 * with `commands_generated: 0` and the execution never advances past its
 * catalog snapshot. Confirmed empirically against prod — the same playbook,
 * with `version` added and nothing else changed, went from
 * `commands_generated: 0` to `commands_generated: 1` and ran to completion.
 */
function checkMetadataVersion(doc: any, out: PreflightFinding[]): void {
  const version = doc?.metadata?.version;
  if (version === undefined || version === null || String(version).trim() === "") {
    out.push({
      severity: "error",
      field: "metadata.version",
      message: "metadata.version is missing.",
      detail:
        "Without it the playbook registers and appears in the catalog, but executing it issues no command — /api/execute returns commands_generated: 0 and the run stalls after its catalog snapshot with no error anywhere. Add e.g. version: \"1.0\".",
    });
  }
}

/** A step named as an alternative in an exclusive arc set is marked SKIPPED
 *  when a sibling arc wins — and a SKIPPED step never runs again, even if a
 *  later step routes to it. Using a join target as a branch alternative
 *  therefore strands the run: every step succeeds and the execution never
 *  reaches a terminal event. */
function checkExclusiveArcJoins(doc: any, out: PreflightFinding[]): void {
  const workflow = Array.isArray(doc?.workflow) ? doc.workflow : [];
  const alternatives = new Map<string, number>();
  const incoming = new Map<string, number>();

  for (const step of workflow) {
    const arcs = step?.next?.arcs;
    if (!Array.isArray(arcs)) continue;
    for (const arc of arcs) {
      const target = arc?.step;
      if (typeof target !== "string") continue;
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
    if (arcs.length > 1) {
      for (const arc of arcs) {
        const target = arc?.step;
        if (typeof target !== "string") continue;
        alternatives.set(target, (alternatives.get(target) ?? 0) + 1);
      }
    }
  }

  for (const [step, altCount] of alternatives) {
    if ((incoming.get(step) ?? 0) > altCount) {
      out.push({
        severity: "error",
        field: `workflow.${step}`,
        message: `"${step}" is both a branch alternative and a join target.`,
        detail:
          "When the other branch wins, this step is marked SKIPPED — and a SKIPPED step never runs, even though a later step routes to it. The run will complete every step and still never reach a terminal event. Give the quiet branch its own step that routes onward instead.",
      });
    }
  }
}

/** Python steps see ONLY the names bound through `tool.input`. Referencing
 *  `workload` (or a prior step) directly inside `code` raises NameError at
 *  execution time. */
function checkPythonBindings(doc: any, out: PreflightFinding[]): void {
  const workflow = Array.isArray(doc?.workflow) ? doc.workflow : [];
  for (const step of workflow) {
    const tool = step?.tool;
    if (tool?.kind !== "python" || typeof tool?.code !== "string") continue;
    const bound = new Set(Object.keys(tool.input ?? {}));
    // Strip comments so prose about `workload` does not trip the check.
    const code = tool.code
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("#"))
      .join("\n");
    if (/\bworkload\s*(\.|\[)/.test(code) && !bound.has("workload")) {
      out.push({
        severity: "error",
        field: `workflow.${step?.step ?? "?"}.tool.code`,
        message: `Step "${step?.step ?? "?"}" uses \`workload\` inside code.`,
        detail:
          "A python step sees only the names bound through tool.input. `workload` is available in templates (input / payload / when), not in code — using it there raises NameError: name 'workload' is not defined and fails the step. Bind what you need via tool.input.",
      });
    }
  }
}

function checkStartStep(doc: any, out: PreflightFinding[]): void {
  const workflow = Array.isArray(doc?.workflow) ? doc.workflow : [];
  if (workflow.length === 0) return;
  if (!workflow.some((s: any) => s?.step === "start")) {
    out.push({
      severity: "warning",
      field: "workflow",
      message: "No step named `start`.",
      detail: "The runtime looks for a `start` step as the entry point; without one the playbook may never dispatch.",
    });
  }
}

/**
 * Validate playbook YAML before registration.
 * Unparseable YAML yields a single error and no further checks.
 */
export function preflightPlaybook(source: string): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  let doc: any;
  try {
    doc = yaml.load(source);
  } catch (e: any) {
    return [{
      severity: "error",
      field: "yaml",
      message: "The playbook is not valid YAML.",
      detail: e?.message ? String(e.message) : "Parse failed.",
    }];
  }
  if (!doc || typeof doc !== "object") {
    return [{
      severity: "error",
      field: "yaml",
      message: "The playbook did not parse to an object.",
      detail: "Expected a YAML mapping with metadata and workflow keys.",
    }];
  }
  checkMetadataVersion(doc, findings);
  checkStartStep(doc, findings);
  checkExclusiveArcJoins(doc, findings);
  checkPythonBindings(doc, findings);
  return findings;
}

export const hasBlockingFinding = (f: PreflightFinding[]): boolean =>
  f.some(x => x.severity === "error");
