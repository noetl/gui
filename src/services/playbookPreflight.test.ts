import { describe, expect, it } from "vitest";
import { hasBlockingFinding, preflightPlaybook } from "./playbookPreflight";

/**
 * Each case below is built from a defect that actually shipped and actually
 * stalled a run in prod, paired with the corrected form. A check that fires on
 * both, or on neither, is worthless — so every test asserts the negative
 * control too.
 */

const GOOD = `
apiVersion: noetl.io/v2
kind: Playbook
metadata:
  name: demo
  path: demo/playbook
  version: "1.0"
workflow:
  - step: start
    tool: { kind: noop }
    next:
      spec: { mode: exclusive }
      arcs:
        - step: work
  - step: work
    tool:
      kind: python
      input:
        uid: "{{ workload.uid }}"
      code: |
        result = {"uid": uid}
    next:
      spec: { mode: exclusive }
      arcs:
        - step: end
  - step: end
    tool: { kind: noop }
`;

describe("preflightPlaybook", () => {
  it("passes a well-formed playbook", () => {
    const f = preflightPlaybook(GOOD);
    expect(f.filter(x => x.severity === "error")).toEqual([]);
    expect(hasBlockingFinding(f)).toBe(false);
  });

  it("catches a missing metadata.version — the silent no-dispatch", () => {
    const broken = GOOD.replace('  version: "1.0"\n', "");
    const f = preflightPlaybook(broken);
    expect(f.some(x => x.field === "metadata.version" && x.severity === "error")).toBe(true);
    // negative control: the same check must stay quiet on the good doc
    expect(preflightPlaybook(GOOD).some(x => x.field === "metadata.version")).toBe(false);
  });

  it("catches `workload` used inside python code", () => {
    const broken = GOOD.replace(
      '        result = {"uid": uid}',
      '        result = {"uid": workload.get("uid")}',
    );
    const f = preflightPlaybook(broken);
    expect(f.some(x => x.message.includes("`workload` inside code"))).toBe(true);
    expect(preflightPlaybook(GOOD).some(x => x.message.includes("`workload` inside code"))).toBe(false);
  });

  it("does not trip on the word workload inside a comment", () => {
    const commented = GOOD.replace(
      '        result = {"uid": uid}',
      '        # workload.get("uid") would fail here; uid is bound via input\n        result = {"uid": uid}',
    );
    expect(preflightPlaybook(commented).some(x => x.message.includes("`workload` inside code"))).toBe(false);
  });

  it("catches a join target reused as a branch alternative", () => {
    // `end` is both the no-coords alternative and the join from `work`.
    const broken = `
apiVersion: noetl.io/v2
kind: Playbook
metadata: { name: d, path: d/p, version: "1.0" }
workflow:
  - step: start
    tool: { kind: noop }
    next:
      spec: { mode: exclusive }
      arcs:
        - when: "{{ ok }}"
          step: work
        - step: end
  - step: work
    tool: { kind: noop }
    next:
      spec: { mode: exclusive }
      arcs:
        - step: end
  - step: end
    tool: { kind: noop }
`;
    const f = preflightPlaybook(broken);
    expect(f.some(x => x.message.includes("branch alternative and a join target"))).toBe(true);
    expect(preflightPlaybook(GOOD).some(x => x.message.includes("branch alternative and a join target"))).toBe(false);
  });

  it("reports unparseable YAML once and stops", () => {
    const f = preflightPlaybook("metadata:\n  - [unbalanced\n");
    expect(f).toHaveLength(1);
    expect(f[0].field).toBe("yaml");
  });
});
