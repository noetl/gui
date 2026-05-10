import { describe, expect, it } from "vitest";

import { resolveFormButtonEventValue } from "./AppForm";

describe("resolveFormButtonEventValue", () => {
  const values = {
    origin: "SFO",
    destination: "JFK",
    empty: "",
  };

  it("preserves a static string value", () => {
    expect(resolveFormButtonEventValue("travel help", values)).toBe("travel help");
  });

  it("substitutes {fieldId} placeholders from current form values", () => {
    expect(resolveFormButtonEventValue("travel flights from {origin} to {destination}", values)).toBe(
      "travel flights from SFO to JFK",
    );
  });

  it("substitutes missing or empty fields with an empty string", () => {
    expect(resolveFormButtonEventValue("travel from {origin} via {missing} {empty}", values)).toBe(
      "travel from SFO via  ",
    );
  });

  it("preserves non-string values and falls back to the values object when undefined", () => {
    const payload = { action: "submit" };
    expect(resolveFormButtonEventValue(payload, values)).toBe(payload);
    expect(resolveFormButtonEventValue(undefined, values)).toBe(values);
  });
});
