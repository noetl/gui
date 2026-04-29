import type { ExecutionData } from "../types";

/**
 * Helpers for surfacing the result of an agent / playbook execution.
 *
 * Originally lived inline in both NoetlPrompt.tsx and
 * PlaybookRunDialog.tsx. Centralised here so the two UI surfaces can't
 * diverge — the terminal prompt and the catalog Run dialog need to
 * agree on what an agent's output is and how to format it as plain
 * text for the user.
 */

/**
 * Stringify ``value`` for display, capping at ``maxLength`` characters.
 * Mirrors the prior NoetlPrompt behaviour: empty / null / undefined
 * collapse to ``"-"``; strings pass through; everything else gets
 * JSON-stringified; truncation appends ``"..."``.
 */
export function compactJson(value: unknown, maxLength = 240): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > maxLength
      ? `${serialized.slice(0, maxLength - 3)}...`
      : serialized;
  } catch {
    return String(value);
  }
}

/**
 * Narrow ``value`` to a plain record. Returns ``undefined`` for
 * arrays, primitives, and ``null``.
 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Walk an ExecutionData looking for the agent-style payload —
 * ``{text, raw, method, tool, server, arguments}`` — that the
 * kubernetes runtime agent and friends emit. Falls back through
 * ``execution.result`` first, then each event's ``result`` and
 * ``context`` in reverse chronological order.
 */
export function extractAgentPayload(execution: ExecutionData): Record<string, unknown> {
  const unwrap = (candidate: unknown): Record<string, unknown> | undefined => {
    const item = asRecord(candidate);
    if (!item) return undefined;
    if (
      typeof item.text === "string"
      || item.raw
      || item.method
      || item.tool
      || item.server
      || item.arguments
    ) {
      return item;
    }
    for (const key of ["context", "data", "result"]) {
      const nested = unwrap(item[key]);
      if (nested) return nested;
    }
    return undefined;
  };

  const candidates: unknown[] = [
    (execution as { result?: unknown }).result,
    ...((execution.events || []).map((event: any) => event.result).reverse()),
    ...((execution.events || []).map((event: any) => event.context).reverse()),
  ];
  for (const candidate of candidates) {
    const payload = unwrap(candidate);
    if (payload) return payload;
  }
  return {};
}

/**
 * Best-effort plain-text extraction for an agent execution. Falls
 * back to a compact JSON of the entire result (capped at 2400 chars)
 * when no ``text`` field is found.
 */
export function extractAgentText(execution: ExecutionData): string {
  const payload = extractAgentPayload(execution);
  const text = payload.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  const fallbackSource =
    Object.keys(payload).length > 0
      ? payload
      : (execution as { result?: unknown }).result;
  return compactJson(fallbackSource, 2400);
}
