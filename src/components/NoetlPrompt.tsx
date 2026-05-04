import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Input } from "antd";
import { ClearOutlined, EnterOutlined } from "@ant-design/icons";
import type { InputRef } from "antd";
import { apiService } from "../services/api";
import { ExecutionData, PlaybookData } from "../types";

type PromptTone = "input" | "output" | "error" | "success";

interface PromptAction {
  label: string;
  description?: string;
  command?: string;
  path?: string;
}

interface PromptEntry {
  id: number;
  tone: PromptTone;
  prompt?: string;
  text?: string;
  actions?: PromptAction[];
  collapsed?: boolean;
}

interface TerminalTable {
  intro: string;
  columns: string[];
  rows: string[][];
  outro: string;
}

interface TerminalWorkspace {
  name: string;
  path: string;
  description: string;
  agent?: PlaybookData;
  resource?: PlaybookData;
  actions: PromptAction[];
}

const MAX_LINES = 24;
const COLLAPSED_TEXT_LENGTH = 360;
const COLLAPSED_ACTION_COUNT = 5;
const TABLE_ROW_COLLAPSED_COUNT = 8;
const TABLE_HEADER_MARKERS = new Set([
  "DESCRIPTION",
  "NAMESPACE",
  "NAME",
  "KIND",
  "STATUS",
  "TITLE",
  "TOOL",
  "READY",
  "TYPE",
  "APIVERSION",
  "REASON",
  "AGE",
]);
const ROUTES: PromptAction[] = [
  { label: "catalog", path: "/catalog", description: "catalog discovery and playbook launch" },
  { label: "editor", path: "/editor", description: "playbook editor workspace" },
  { label: "execution", path: "/execution", description: "execution observability dashboard" },
  { label: "credentials", path: "/credentials", description: "credential registry" },
  { label: "travel", path: "/travel", description: "gateway assistant workspace" },
  { label: "users", path: "/users", description: "user administration" },
];
const ROUTE_ALIASES: Record<string, string> = {
  admin: "/users",
  build: "/editor",
  observe: "/execution",
  operate: "/execution",
  secrets: "/credentials",
};
const KUBERNETES_AGENT_PLAYBOOK = "automation/agents/kubernetes/runtime";
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const KUBERNETES_ACTIONS: PromptAction[] = [
  { label: "status", command: "status", description: "server health and tool count" },
  { label: "tools", command: "tools", description: "list exposed MCP tools" },
  { label: "namespaces", command: "namespaces", description: "cluster namespaces" },
  { label: "pods", command: "pods", description: "pods across namespaces" },
  { label: "noetl", command: "noetl", description: "NoETL namespace pods" },
  { label: "events", command: "events", description: "recent cluster events" },
  { label: "deployments", command: "deployments", description: "Kubernetes deployments" },
  { label: "services", command: "services", description: "Kubernetes services" },
  { label: "top", command: "top", description: "pod resource usage" },
];

interface NoetlPromptProps {
  className?: string;
}

// Shared agent-result helpers — re-exported here as locals so the
// existing call sites keep working unchanged. The canonical
// implementations live in services/agentResult.ts and are also used
// by PlaybookRunDialog so the two surfaces stay consistent.
import {
  compactJson as _compactJson,
  asRecord as _asRecord,
  extractAgentPayload as _extractAgentPayload,
  extractAgentText as _extractAgentText,
} from "../services/agentResult";

const compactJson = _compactJson;
const asRecord = _asRecord;

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function metadataFor(entry?: PlaybookData): Record<string, unknown> {
  return asRecord(entry?.payload?.metadata) || {};
}

function metaFor(entry?: PlaybookData): Record<string, unknown> {
  return asRecord(entry?.meta) || {};
}

function terminalConfigFor(entry?: PlaybookData): Record<string, unknown> {
  return asRecord(metadataFor(entry).terminal) || asRecord(metaFor(entry).terminal) || {};
}

function capabilitiesFor(entry?: PlaybookData): string[] {
  return [
    ...asStringList(metadataFor(entry).capabilities),
    ...asStringList(metaFor(entry).capabilities),
  ];
}

function isTerminalVisible(entry?: PlaybookData): boolean {
  const terminal = terminalConfigFor(entry);
  if (terminal.visible === false || terminal.visible === "false") return false;
  if (Object.keys(terminal).length > 0) return true;
  return capabilitiesFor(entry).some((capability) => capability.startsWith("mcp:"));
}

function workspaceNameFor(entry?: PlaybookData): string | undefined {
  const terminal = terminalConfigFor(entry);
  const workspace = terminal.workspace;
  if (typeof workspace === "string" && workspace.trim()) {
    return workspace.replace(/^\/?mcp\/?/i, "").trim().toLowerCase();
  }

  const scope = asStringList(terminal.scopes || terminal.scope)
    .find((item) => item.startsWith("/mcp/") || item.startsWith("mcp/"));
  if (scope) {
    return scope.replace(/^\/?mcp\//i, "").trim().toLowerCase();
  }

  const capability = capabilitiesFor(entry).find((item) => item.startsWith("mcp:"));
  if (capability) return capability.slice("mcp:".length).trim().toLowerCase();

  const name = metadataFor(entry).name || entry?.path?.split("/").pop();
  return typeof name === "string" && name.trim() ? name.trim().toLowerCase() : undefined;
}

function descriptionFor(entry?: PlaybookData): string {
  const metadata = metadataFor(entry);
  return String(metadata.description || metadata.name || entry?.path || "registered catalog resource");
}

function parseJsonText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatExecution(execution: ExecutionData): string {
  const parts = [
    execution.execution_id,
    execution.status,
    execution.path || "unknown",
    `${execution.progress ?? 0}%`,
  ];
  if (execution.duration_human) parts.push(execution.duration_human);
  if (execution.error) parts.push(`error=${compactJson(execution.error)}`);
  return parts.join(" | ");
}

function parseWorkload(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  const workload: Record<string, unknown> = {};
  const setPattern = /(?:--set\s+)?([A-Za-z0-9_.-]+)=("[^"]*"|'[^']*'|[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = setPattern.exec(trimmed)) !== null) {
    const key = match[1];
    const rawValue = match[2].replace(/^["']|["']$/g, "");
    const numericValue = Number(rawValue);
    workload[key] = Number.isFinite(numericValue) && rawValue.trim() !== "" ? numericValue : rawValue;
  }
  return workload;
}

function summarizePlaybooks(playbooks: PlaybookData[]): { text: string; actions?: PromptAction[] } {
  if (playbooks.length === 0) return { text: "no playbooks found" };
  const visible = playbooks.slice(0, 8);
  return {
    text: visible.map((playbook) => {
    const description = playbook.payload?.metadata?.description || playbook.payload?.metadata?.name || "";
    return `${playbook.path} :: ${playbook.catalog_id}${description ? ` :: ${description}` : ""}`;
    }).join("\n"),
    actions: visible.map((playbook) => ({
      label: `run ${playbook.path}`,
      description: playbook.catalog_id,
      command: `run ${playbook.path}`,
    })),
  };
}

function summarizeExecutions(executions: ExecutionData[]): { text: string; actions?: PromptAction[] } {
  if (executions.length === 0) return { text: "no executions found" };
  const visible = executions.slice(0, 8);
  return {
    text: visible.map(formatExecution).join("\n"),
    actions: visible.flatMap((execution) => [
      {
        label: `open ${execution.execution_id}`,
        description: execution.path,
        path: `/execution/${execution.execution_id}`,
      },
      {
        label: `report ${execution.execution_id}`,
        command: `report ${execution.execution_id}`,
      },
    ]),
  };
}

const extractAgentPayload = _extractAgentPayload;
const extractAgentText = _extractAgentText;

function extractMcpToolsFromExecution(execution: ExecutionData): Array<{ name: string; title?: string; description?: string }> {
  const payload = extractAgentPayload(execution);
  const raw = parseJsonText(payload.raw);
  const result = parseJsonText(payload.result);
  const text = parseJsonText(payload.text);
  const source = asRecord(raw) || asRecord(result) || asRecord(text) || payload;
  const nestedResult = parseJsonText(source.result);
  const toolSource = asRecord(nestedResult) || source;
  const tools = toolSource
    ? toolSource.tools
    : undefined;
  if (!Array.isArray(tools)) return extractToolNamesFromText(toolSource?.text || payload.text);
  return tools
    .filter((tool): tool is Record<string, unknown> => Boolean(tool) && typeof tool === "object" && !Array.isArray(tool))
    .map((tool) => ({
      name: String(tool.name || ""),
      title: tool.title == null ? undefined : String(tool.title),
      description: tool.description == null ? undefined : String(tool.description),
    }))
    .filter((tool) => tool.name.length > 0);
}

function extractToolNamesFromText(value: unknown): Array<{ name: string }> {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-zA-Z][a-zA-Z0-9_.:-]*$/.test(line))
    .map((name) => ({ name }));
}

function formatMcpToolsTable(tools: Array<{ name: string; title?: string; description?: string }>): string {
  if (tools.length === 0) return "no MCP tools exposed";
  const rows = tools.slice(0, 40).map((tool) => [
    tool.name,
    tool.title || "tool",
    tool.description || "-",
  ]);
  const widths = [4, 4, 11];
  rows.forEach((row) => {
    row.forEach((cell, index) => {
      widths[index] = Math.min(48, Math.max(widths[index], cell.length));
    });
  });
  const formatRow = (row: string[]) => row
    .map((cell, index) => {
      const clipped = cell.length > 48 ? `${cell.slice(0, 45)}...` : cell;
      return clipped.padEnd(widths[index]);
    })
    .join("  ")
    .trimEnd();
  return [
    formatRow(["NAME", "KIND", "DESCRIPTION"]),
    ...rows.map(formatRow),
  ].join("\n");
}

function formatToolsByPrefix(tools: Array<{ name: string; title?: string; description?: string }>): string {
  if (tools.length === 0) return "tools=0";
  const counts = tools.reduce<Record<string, number>>((acc, tool) => {
    const prefix = tool.name.includes("_") ? tool.name.split("_")[0] : "other";
    acc[prefix] = (acc[prefix] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([prefix, count]) => `${prefix}=${count}`)
    .join(" ");
}

function workspaceFromPath(pathname: string): string {
  return pathname || "/catalog";
}

function normalizeWorkspacePath(target: string, current: string): string | undefined {
  const trimmed = target.trim();
  if (!trimmed || trimmed === "." || trimmed === "~" || trimmed === "/") return "/catalog";
  if (trimmed === "..") {
    const parts = current.split("/").filter(Boolean);
    if (parts.length <= 1) return "/catalog";
    return `/${parts.slice(0, -1).join("/")}`;
  }

  const normalized = trimmed.replace(/^\/+/, "").toLowerCase();
  if (normalized === "mcp") return "/mcp";
  if (normalized === "k8s" || normalized === "kubernetes") return "/mcp/kubernetes";
  if (normalized.startsWith("mcp/")) return `/${normalized}`;
  if (current === "/mcp" && normalized) return `/mcp/${normalized}`;
  return undefined;
}

function isKubernetesWorkspace(pathname: string): boolean {
  return pathname === "/mcp/kubernetes";
}

function isMcpWorkspace(pathname: string): boolean {
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
}

function isGenericMcpWorkspace(pathname: string): boolean {
  return pathname.startsWith("/mcp/") && !isKubernetesWorkspace(pathname);
}

function isKubernetesSubject(verb: string): boolean {
  return [
    "namespaces",
    "namespace",
    "ns",
    "pods",
    "pod",
    "po",
    "noetl",
    "events",
    "event",
    "deployments",
    "deployment",
    "deploy",
    "services",
    "service",
    "svc",
    "logs",
    "log",
    "top",
    "get",
    "describe",
  ].includes(verb);
}

function buildMcpWorkspaces(agents: PlaybookData[], resources: PlaybookData[]): TerminalWorkspace[] {
  const workspaces = new Map<string, TerminalWorkspace>();
  const versionNumber = (entry?: PlaybookData): number => {
    const parsed = Number(entry?.version ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  for (const resource of resources) {
    const name = workspaceNameFor(resource);
    if (!name) continue;
    workspaces.set(name, {
      name,
      path: `/mcp/${name}`,
      description: descriptionFor(resource),
      resource,
      actions: [
        { label: `cd /mcp/${name}`, command: `cd /mcp/${name}`, description: "open workspace" },
      ],
    });
  }

  for (const agent of agents.filter(isTerminalVisible)) {
    const name = workspaceNameFor(agent);
    if (!name) continue;
    const existing = workspaces.get(name);
    if (existing?.agent && versionNumber(existing.agent) > versionNumber(agent)) {
      continue;
    }
    const actions = name === "kubernetes"
      ? KUBERNETES_ACTIONS
      : [
        { label: "status", command: "status", description: "inspect through agent playbook" },
        { label: "tools", command: "tools", description: "list MCP tools through agent playbook" },
      ];
    workspaces.set(name, {
      name,
      path: `/mcp/${name}`,
      description: descriptionFor(agent),
      resource: existing?.resource,
      agent,
      actions,
    });
  }

  return Array.from(workspaces.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function formatKubernetesStatus(execution: ExecutionData, tools: Array<{ name: string; title?: string; description?: string }>): string {
  const payload = extractAgentPayload(execution);
  const initialize = asRecord(payload.initialize);
  return [
    `kubernetes :: ${execution.status === "completed" ? "healthy" : execution.status}`,
    `workspace=/mcp/kubernetes`,
    `agent=${KUBERNETES_AGENT_PLAYBOOK}`,
    `execution=${execution.execution_id}`,
    `tools=${tools.length}`,
    formatToolsByPrefix(tools),
    initialize?.protocolVersion ? `protocol=${initialize.protocolVersion}` : "",
  ].filter(Boolean).join("\n");
}

function parseKubernetesArgs(parts: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const positional: string[] = [];
  for (const part of parts) {
    const match = part.match(/^([A-Za-z0-9_.-]+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2];
    } else {
      positional.push(part);
    }
  }
  if (positional[0]) args.name = positional[0];
  if (positional[1]) args.namespace = positional[1];
  if (positional[2]) args.container = positional[2];
  return args;
}

function formatMcpToolResult(text: string): string {
  return text.trim().length > 0 ? text.trim() : "-";
}

function resolveRoute(target: string): PromptAction | undefined {
  const normalized = target.trim().replace(/^\/+/, "").toLowerCase();
  if (!normalized || normalized === "." || normalized === "~" || normalized === "/") {
    return ROUTES.find((route) => route.path === "/catalog");
  }
  const aliased = ROUTE_ALIASES[normalized];
  return ROUTES.find((route) => route.label === normalized || route.path === `/${normalized}` || route.path === aliased);
}

function getCollapsedText(text: string): string {
  if (text.length <= COLLAPSED_TEXT_LENGTH) return text;
  return `${text.slice(0, COLLAPSED_TEXT_LENGTH - 3)}...`;
}

function findTableHeaderLine(lines: string[]): number {
  return lines.findIndex((line) => {
    const cells = line.trim().split(/\s{2,}/).filter(Boolean);
    if (cells.length < 3) return false;
    const markerCount = cells.filter((cell) => TABLE_HEADER_MARKERS.has(cell.toUpperCase())).length;
    return markerCount >= 2;
  });
}

function parseFixedWidthRow(line: string, starts: number[]): string[] {
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? line.length;
    return line.slice(start, end).trim();
  });
}

function parseTerminalTable(text: string): TerminalTable | undefined {
  const lines = text.split("\n");
  const headerIndex = findTableHeaderLine(lines);
  if (headerIndex < 0) return undefined;

  const headerLine = lines[headerIndex];
  const matches = Array.from(headerLine.matchAll(/\S+/g));
  if (matches.length < 3) return undefined;

  const columns = matches.map((match) => match[0]);
  const starts = matches.map((match) => match.index ?? 0);
  const rows: string[][] = [];
  const outroLines: string[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) {
      if (rows.length > 0) outroLines.push(line);
      continue;
    }
    const parsed = parseFixedWidthRow(line, starts);
    const nonEmpty = parsed.filter(Boolean).length;
    if (nonEmpty >= Math.min(2, columns.length)) {
      rows.push(parsed);
    } else {
      outroLines.push(line);
    }
  }

  if (rows.length === 0) return undefined;
  return {
    intro: lines.slice(0, headerIndex).join("\n").trim(),
    columns,
    rows,
    outro: outroLines.join("\n").trim(),
  };
}

function renderTerminalTable(table: TerminalTable, collapsed?: boolean) {
  const rows = collapsed ? table.rows.slice(0, TABLE_ROW_COLLAPSED_COUNT) : table.rows;
  return (
    <div className="noetl-prompt-table-wrap">
      <table className="noetl-prompt-table">
        <thead>
          <tr>
            <th>#</th>
            {table.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("|")}`}>
              <td>{rowIndex}</td>
              {table.columns.map((column, columnIndex) => (
                <td key={`${rowIndex}-${column}`}>{row[columnIndex] || "-"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {collapsed && table.rows.length > rows.length && (
        <div className="noetl-prompt-table-more">... {table.rows.length - rows.length} more rows</div>
      )}
    </div>
  );
}

const NoetlPrompt: React.FC<NoetlPromptProps> = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<InputRef>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [cwd, setCwd] = useState(workspaceFromPath(location.pathname));
  const [history, setHistory] = useState<PromptEntry[]>([
    {
      id: 1,
      tone: "output",
      text: "type `help` for playbooks, executions, reports, reruns, and diagnostics",
      actions: [
        { label: "menu", command: "menu" },
        { label: "ls", command: "ls" },
        { label: "help", command: "help" },
      ],
    },
  ]);

  const runtime = useMemo(() => apiService.getRuntimeContext(), []);
  const prompt = `noetl@${runtime.displayName}:${cwd || "~"}$`;

  useEffect(() => {
    if (!isMcpWorkspace(cwd)) {
      setCwd(workspaceFromPath(location.pathname));
    }
  }, [cwd, location.pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const historyEl = historyRef.current;
      if (historyEl) {
        historyEl.scrollTop = historyEl.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [history]);

  const append = (entry: Omit<PromptEntry, "id">) => {
    setHistory((current) => [...current, { ...entry, id: Date.now() + Math.random() }].slice(-MAX_LINES));
  };

  const updateEntry = (id: number, patch: Partial<PromptEntry>) => {
    setHistory((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };

  const removeEntry = (id: number) => {
    setHistory((current) => current.filter((entry) => entry.id !== id));
  };

  const handleAction = (action: PromptAction) => {
    if (action.path) {
      navigate(action.path);
      setCwd(workspaceFromPath(action.path));
      append({ tone: "success", text: `opened ${action.path}` });
      return;
    }
    if (action.command) {
      runCommand(action.command);
    }
  };

  const resolvePlaybook = async (target: string): Promise<{ catalog_id?: string; path?: string; label: string }> => {
    const playbooks = await apiService.getPlaybooks();
    const match = playbooks.find((playbook) => playbook.catalog_id === target || playbook.path === target);
    if (match) {
      return { catalog_id: match.catalog_id, path: match.path, label: match.path };
    }
    return { path: target, label: target };
  };

  const discoverMcpWorkspaces = async (): Promise<TerminalWorkspace[]> => {
    const [agents, mcpResources] = await Promise.all([
      apiService.getAgentPlaybooks(),
      apiService.getCatalogResources("mcp").catch(() => []),
    ]);
    return buildMcpWorkspaces(agents, mcpResources);
  };

  const resolveMcpWorkspace = async (name: string): Promise<TerminalWorkspace | undefined> => {
    const normalized = name.replace(/^\/?mcp\/?/i, "").trim().toLowerCase();
    const workspaces = await discoverMcpWorkspaces();
    return workspaces.find((workspace) => workspace.name === normalized || workspace.path === `/mcp/${normalized}`);
  };

  const runMcpAgent = async (
    workspace: TerminalWorkspace,
    workload: Record<string, unknown>,
    label: string,
  ): Promise<ExecutionData> => {
    if (!workspace.agent) {
      throw new Error(`mcp/${workspace.name} has no registered terminal agent playbook`);
    }
    const response = await apiService.executePlaybookWithPayload({
      catalog_id: workspace.agent.catalog_id,
      path: workspace.agent.catalog_id ? undefined : workspace.agent.path,
      workload,
      resource_kind: workspace.agent.kind?.toLowerCase() === "agent" ? "agent" : "playbook",
    });
    append({
      tone: "success",
      text: `started ${label} :: execution=${response.execution_id}`,
      actions: [
        { label: `open ${response.execution_id}`, path: `/execution/${response.execution_id}` },
        { label: `report ${response.execution_id}`, command: `report ${response.execution_id}` },
      ],
    });

    let execution = await apiService.getExecution(response.execution_id, { page_size: 40 });
    for (let i = 0; i < 20 && !TERMINAL_STATUSES.has(execution.status); i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      execution = await apiService.getExecution(response.execution_id, { page_size: 40 });
    }
    return execution;
  };

  const appendMcpWorkspace = async () => {
    const workspaces = await discoverMcpWorkspaces();
    if (workspaces.length === 0) {
      append({
        tone: "output",
        text: [
          "mcp :: no registered MCP workspaces",
          "discover=register MCP service resources and terminal-visible agent playbooks in the catalog",
          "gui=operational; MCP commands are unavailable until catalog resources are registered",
        ].join("\n"),
        actions: [
          { label: "catalog", path: "/catalog" },
          { label: "playbooks", command: "playbooks" },
          { label: "help", command: "help" },
        ],
      });
      return;
    }
    append({
      tone: "output",
      text: "mcp :: model context server workspaces",
      actions: [
        ...workspaces.map((workspace) => ({
          label: workspace.name,
          command: `cd ${workspace.path}`,
          description: workspace.agent ? workspace.description : `${workspace.description} (no terminal agent)`,
        })),
        { label: "discover", command: "mcp discover", description: "scan catalog resources" },
      ],
    });
  };

  const appendKubernetesWorkspace = async () => {
    const workspace = await resolveMcpWorkspace("kubernetes");
    if (!workspace) {
      appendUnavailableMcpWorkspace("kubernetes");
      return;
    }
    append({
      tone: "output",
      text: [
        "mcp/kubernetes :: Kubernetes runtime workspace",
        `agent=${workspace.agent?.path || "-"}`,
        "scope=read-only observability via NoETL playbook execution",
      ].join("\n"),
      actions: workspace.actions,
    });
  };

  const appendRegisteredMcpWorkspace = async (name: string) => {
    if (name === "kubernetes") {
      await appendKubernetesWorkspace();
      return;
    }
    const workspace = await resolveMcpWorkspace(name);
    if (!workspace) {
      appendUnavailableMcpWorkspace(name);
      return;
    }
    append({
      tone: "output",
      text: [
        `mcp/${workspace.name} :: ${workspace.description}`,
        `agent=${workspace.agent?.path || "-"}`,
        "scope=operations through NoETL playbook execution",
      ].join("\n"),
      actions: workspace.actions,
    });
  };

  const appendUnavailableMcpWorkspace = (name: string) => {
    append({
      tone: "output",
      text: [
        `mcp/${name} :: not registered in this workspace yet`,
        "next=discover or register the MCP server resource in the catalog",
      ].join("\n"),
      actions: [
        { label: "cd /mcp", command: "cd /mcp" },
        { label: "discover", command: "mcp discover" },
        { label: "register", command: "mcp register" },
      ],
    });
  };

  const runMcpCommand = async (subcommand = "status") => {
    const normalized = subcommand.toLowerCase();
    if (normalized === "discover") {
      setCwd("/mcp");
      await appendMcpWorkspace();
      return;
    }
    if (normalized === "register") {
      append({
        tone: "output",
        text: [
          "mcp register :: catalog registration required",
          "register MCP services with resource_type=mcp",
          "register terminal agents with metadata.agent=true and metadata.terminal.visible=true",
        ].join("\n"),
      });
      return;
    }
    const workspaceName = cwd.startsWith("/mcp/") ? cwd.replace("/mcp/", "") : "";
    let workspace = workspaceName ? await resolveMcpWorkspace(workspaceName) : undefined;
    if (!workspace && !workspaceName) {
      const workspaces = await discoverMcpWorkspaces();
      workspace = workspaces.length === 1
        ? workspaces[0]
        : workspaces.find((candidate) => candidate.name === "kubernetes");
    }
    if (!workspace) {
      throw new Error("no MCP terminal workspace selected. run `mcp discover` then `cd /mcp/<name>`");
    }
    setCwd(workspace.path);
    if (normalized === "status") {
      const execution = await runMcpAgent(workspace, {
        method: "tools/list",
      }, `${workspace.name} mcp status`);
      const tools = extractMcpToolsFromExecution(execution);
      const ok = execution.status === "completed";
      append({
        tone: ok ? "success" : "error",
        text: workspace.name === "kubernetes"
          ? formatKubernetesStatus(execution, tools)
          : [
            `${workspace.name} :: ${execution.status}`,
            `workspace=${workspace.path}`,
            `agent=${workspace.agent?.path || "-"}`,
            `execution=${execution.execution_id}`,
            `tools=${tools.length}`,
          ].join("\n"),
        actions: ok ? workspace.actions : [{ label: `open ${execution.execution_id}`, path: `/execution/${execution.execution_id}` }],
      });
    } else if (normalized === "tools") {
      const execution = await runMcpAgent(workspace, {
        method: "tools/list",
      }, `${workspace.name} mcp tools`);
      if (execution.status === "completed") {
        const tools = extractMcpToolsFromExecution(execution);
        append({
          tone: "output",
          text: [
            `${workspace.name} tools :: ${tools.length}`,
            formatToolsByPrefix(tools),
            formatMcpToolsTable(tools),
          ].join("\n"),
          actions: workspace.actions,
        });
      } else {
        const executionError = (execution as ExecutionData & { error?: unknown }).error;
        append({
          tone: "error",
          text: [
            "kubernetes mcp tools unavailable",
            `status=${execution.status}`,
            `execution=${execution.execution_id}`,
            ...(executionError ? [`error=${String(executionError)}`] : []),
          ].join("\n"),
        });
      }
    } else {
      throw new Error("usage: mcp status|tools|discover|register");
    }
  };

  const resolveKubernetesTool = (subjectRaw: string, args: string[]): { label: string; toolName: string; toolArgs: Record<string, unknown> } => {
    const subject = subjectRaw.toLowerCase();
    let toolName = "";
    let toolArgs: Record<string, unknown> = {};
    if (subject === "namespaces" || subject === "namespace" || subject === "ns") {
      toolName = "namespaces_list";
    } else if (subject === "pods" || subject === "pod" || subject === "po") {
      if (args[0]) {
        toolName = "pods_list_in_namespace";
        toolArgs = { namespace: args[0] };
      } else {
        toolName = "pods_list";
      }
    } else if (subject === "noetl") {
      toolName = "pods_list_in_namespace";
      toolArgs = { namespace: "noetl" };
    } else if (subject === "events" || subject === "event") {
      toolName = "events_list";
      if (args[0]) toolArgs = { namespace: args[0] };
    } else if (subject === "deployments" || subject === "deployment" || subject === "deploy") {
      toolName = "resources_list";
      toolArgs = { apiVersion: "apps/v1", kind: "Deployment" };
      if (args[0]) toolArgs.namespace = args[0];
    } else if (subject === "services" || subject === "service" || subject === "svc") {
      toolName = "resources_list";
      toolArgs = { apiVersion: "v1", kind: "Service" };
      if (args[0]) toolArgs.namespace = args[0];
    } else if (subject === "logs" || subject === "log") {
      const parsed = parseKubernetesArgs(args);
      if (!parsed.name) throw new Error("usage: logs <pod> [namespace] [container]");
      toolName = "pods_log";
      toolArgs = {
        name: parsed.name,
        namespace: parsed.namespace,
        container: parsed.container,
        tail: 120,
      };
    } else if (subject === "top") {
      toolName = "pods_top";
      toolArgs = args[0] ? { namespace: args[0], all_namespaces: false } : { all_namespaces: true };
    } else if (subject === "get" || subject === "describe") {
      const [kindRaw = "", name = "", namespace] = args;
      if (!kindRaw || !name) throw new Error(`usage: ${subject} <pod|deployment|service> <name> [namespace]`);
      const kind = kindRaw.toLowerCase();
      const kindMap: Record<string, { apiVersion: string; kind: string }> = {
        pod: { apiVersion: "v1", kind: "Pod" },
        pods: { apiVersion: "v1", kind: "Pod" },
        deployment: { apiVersion: "apps/v1", kind: "Deployment" },
        deployments: { apiVersion: "apps/v1", kind: "Deployment" },
        service: { apiVersion: "v1", kind: "Service" },
        services: { apiVersion: "v1", kind: "Service" },
        svc: { apiVersion: "v1", kind: "Service" },
      };
      const resolved = kindMap[kind];
      if (!resolved) throw new Error(`unsupported resource kind: ${kindRaw}`);
      toolName = "resources_get";
      toolArgs = { ...resolved, name };
      if (namespace) toolArgs.namespace = namespace;
    } else {
      throw new Error("usage: pods [namespace] | namespaces | events [namespace] | deployments [namespace] | services [namespace] | logs <pod> [namespace] [container] | top [namespace] | describe <kind> <name> [namespace]");
    }
    return { label: subject, toolName, toolArgs };
  };

  const runKubernetesCommand = async (subjectRaw = "pods", args: string[] = []) => {
    const workspace = await resolveMcpWorkspace("kubernetes");
    if (!workspace) {
      throw new Error("mcp/kubernetes is not registered. Register the Kubernetes MCP service and terminal agent playbook first.");
    }
    setCwd(workspace.path);
    const { label, toolName, toolArgs } = resolveKubernetesTool(subjectRaw, args);
    const execution = await runMcpAgent(workspace, {
      method: "tools/call",
      tool: toolName,
      arguments: toolArgs,
    }, `k8s ${label}`);
    append({
      tone: execution.status === "completed" ? "output" : "error",
      text: [
        `${label} :: ${execution.status}`,
        `execution=${execution.execution_id}`,
        `tool=${toolName}`,
        formatMcpToolResult(extractAgentText(execution)),
      ].join("\n"),
      actions: [
        { label: `open ${execution.execution_id}`, path: `/execution/${execution.execution_id}` },
        ...workspace.actions.slice(0, 5),
      ],
    });
  };

  const runGenericMcpTool = async (subjectRaw: string, args: string[] = []) => {
    const workspaceName = cwd.replace("/mcp/", "");
    const workspace = await resolveMcpWorkspace(workspaceName);
    if (!workspace) {
      throw new Error(`mcp/${workspaceName} is not registered. run \`mcp discover\` then \`cd /mcp/<name>\``);
    }
    const toolName = subjectRaw.toLowerCase() === "call" ? args[0] : subjectRaw;
    const payloadParts = subjectRaw.toLowerCase() === "call" ? args.slice(1) : args;
    if (!toolName) {
      throw new Error("usage: call <tool> [json|--set key=value]");
    }
    const toolArgs = parseWorkload(payloadParts.join(" "));
    const execution = await runMcpAgent(workspace, {
      method: "tools/call",
      tool: toolName,
      arguments: toolArgs,
    }, `${workspace.name} ${toolName}`);
    append({
      tone: execution.status === "completed" ? "output" : "error",
      text: [
        `${toolName} :: ${execution.status}`,
        `execution=${execution.execution_id}`,
        `tool=${toolName}`,
        formatMcpToolResult(extractAgentText(execution)),
      ].join("\n"),
      actions: [
        { label: `open ${execution.execution_id}`, path: `/execution/${execution.execution_id}` },
        ...workspace.actions.slice(0, 5),
      ],
    });
  };

  const runCommand = async (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    append({ tone: "input", prompt, text: trimmed });
    setCommand("");

    const [verbRaw = "", ...restParts] = trimmed.split(/\s+/);
    const verb = verbRaw.toLowerCase();
    const rest = restParts.join(" ");

    if (verb === "clear") {
      setHistory([]);
      return;
    }

    setBusy(true);
    try {
      if (verb === "help") {
        if (cwd === "/mcp") {
          const workspaces = await discoverMcpWorkspaces();
          append({
            tone: "output",
            text: [
              "ls                              list MCP workspaces",
              "mcp discover                    show registered MCP services and terminal agents",
              "cd <workspace>                  enter a registered MCP workspace",
              "mcp register                    show registration guidance",
            ].join("\n"),
            actions: workspaces.map((workspace) => ({
              label: workspace.name,
              command: `cd ${workspace.path}`,
              description: workspace.description,
            })),
          });
        } else if (isKubernetesWorkspace(cwd)) {
          const workspace = await resolveMcpWorkspace("kubernetes");
          append({
            tone: "output",
            text: [
              "status                          check Kubernetes MCP server health",
              "tools                           list exposed Kubernetes MCP tools",
              "namespaces                      list namespaces",
              "pods [namespace]                list pods",
              "noetl                           list NoETL namespace pods",
              "events [namespace]              list Kubernetes events",
              "deployments [namespace]         list deployments",
              "services [namespace]            list services",
              "describe <kind> <name> [ns]     fetch pod/deployment/service detail",
              "logs <pod> [namespace] [ctr]    tail pod logs",
              "top [namespace]                 show pod resource usage",
              "cd /mcp                         return to MCP workspaces",
            ].join("\n"),
            actions: workspace?.actions || [{ label: "mcp discover", command: "mcp discover" }],
          });
        } else if (isGenericMcpWorkspace(cwd)) {
          const workspaceName = cwd.replace("/mcp/", "");
          const workspace = await resolveMcpWorkspace(workspaceName);
          append({
            tone: "output",
            text: [
              "status                          inspect selected MCP workspace through its agent playbook",
              "tools                           list exposed MCP tools",
              "call <tool> [json|--set k=v]    invoke an MCP tool through NoETL execution",
              "cd /mcp                         return to MCP workspaces",
              "mcp discover                    refresh registered MCP workspace list",
            ].join("\n"),
            actions: workspace?.actions || [{ label: "mcp discover", command: "mcp discover" }],
          });
        } else {
          append({
            tone: "output",
            text: [
              "context                         show active NoETL API context",
              "menu                            show clickable navigation menu",
              "ls                              list current workspace options",
              "cd <view|/mcp>                  navigate to views or MCP workspaces",
              "open <view|execution_id>        open a view or execution detail",
              "status                          check server health",
              "playbooks [query]               discover catalog playbooks",
              "executions [status]             list recent executions",
              "run <playbook> [json|--set k=v] start a playbook",
              "report <execution_id>           summarize execution state and events",
              "fix <execution_id>              produce a diagnostic report",
              "rerun <execution_id> [json]     rerun an execution",
              "stop <execution_id>             stop a running execution",
              "mcp discover                    discover registered MCP terminal scopes",
              "k8s pods|ns|events|deploy|svc   query Kubernetes if its agent is registered",
              "clear                           clear prompt history",
            ].join("\n"),
            actions: [
              { label: "menu", command: "menu" },
              { label: "playbooks", command: "playbooks" },
              { label: "executions", command: "executions" },
              { label: "status", command: "status" },
              { label: "cd /mcp", command: "cd /mcp" },
            ],
          });
        }
      } else if (verb === "menu") {
        append({
          tone: "output",
          text: "available views",
          actions: ROUTES,
        });
      } else if (verb === "ls") {
        if (cwd === "/mcp") {
          await appendMcpWorkspace();
          return;
        }
        if (isKubernetesWorkspace(cwd)) {
          await appendKubernetesWorkspace();
          return;
        }
        if (cwd.startsWith("/mcp/")) {
          await appendRegisteredMcpWorkspace(cwd.replace("/mcp/", ""));
          return;
        }
        const currentRoute = ROUTES.find((route) => location.pathname === route.path || location.pathname.startsWith(`${route.path}/`));
        const workspaces = await discoverMcpWorkspaces();
        append({
          tone: "output",
          text: currentRoute
            ? `${currentRoute.label} :: ${currentRoute.description}`
            : "workspace",
          actions: [
            ...ROUTES,
            { label: "playbooks", command: "playbooks", description: "catalog entries" },
            { label: "executions", command: "executions", description: "recent execution processes" },
            { label: "mcp", command: "cd /mcp", description: "model context server workspaces" },
            ...workspaces.slice(0, 4).map((workspace) => ({
              label: workspace.name,
              command: `cd ${workspace.path}`,
              description: workspace.description,
            })),
          ],
        });
      } else if (verb === "cd") {
        const workspacePath = normalizeWorkspacePath(rest, cwd);
        if (workspacePath) {
          setCwd(workspacePath);
          if (!isMcpWorkspace(workspacePath)) navigate(workspacePath);
          append({ tone: "success", text: `directory changed to ${workspacePath}` });
          if (workspacePath === "/mcp") await appendMcpWorkspace();
          else if (workspacePath.startsWith("/mcp/")) await appendRegisteredMcpWorkspace(workspacePath.replace("/mcp/", ""));
          return;
        }
        const route = resolveRoute(rest);
        if (!route?.path) throw new Error("usage: cd <catalog|editor|execution|credentials|travel|users>");
        navigate(route.path);
        setCwd(workspaceFromPath(route.path));
        append({ tone: "success", text: `directory changed to ${route.path}` });
      } else if (verb === "open") {
        if (!rest) throw new Error("usage: open <view|execution_id>");
        const route = resolveRoute(rest);
        if (route?.path) {
          navigate(route.path);
          setCwd(workspaceFromPath(route.path));
          append({ tone: "success", text: `opened ${route.path}` });
        } else if (/^\d+$/.test(rest)) {
          navigate(`/execution/${rest}`);
          setCwd(`/execution/${rest}`);
          append({ tone: "success", text: `opened /execution/${rest}` });
        } else {
          throw new Error(`unknown view or execution id: ${rest}`);
        }
      } else if (verb === "context") {
        append({
          tone: "output",
          text: `${runtime.displayName} :: mode=${runtime.mode} :: api=${runtime.apiBaseUrl} :: skip_auth=${runtime.allowSkipAuth}`,
        });
      } else if (isKubernetesWorkspace(cwd) && (verb === "status" || verb === "tools")) {
        await runMcpCommand(verb);
      } else if (isKubernetesWorkspace(cwd) && isKubernetesSubject(verb)) {
        await runKubernetesCommand(verb, restParts);
      } else if (isGenericMcpWorkspace(cwd) && (verb === "status" || verb === "tools")) {
        await runMcpCommand(verb);
      } else if (isGenericMcpWorkspace(cwd) && verb === "call") {
        await runGenericMcpTool(verb, restParts);
      } else if (verb === "status") {
        const health = await apiService.getHealth();
        append({ tone: health.status === "ok" || health.status === "healthy" ? "success" : "output", text: compactJson(health) });
      } else if (verb === "mcp") {
        await runMcpCommand(restParts[0] || "status");
      } else if (verb === "k8s" || verb === "kube" || verb === "kubectl") {
        await runKubernetesCommand(restParts[0] || "pods", restParts.slice(1));
      } else if (verb === "playbooks" || verb === "catalog") {
        const playbooks = rest ? await apiService.searchPlaybooks(rest) : await apiService.getPlaybooks();
        append({ tone: "output", ...summarizePlaybooks(playbooks) });
      } else if (verb === "executions" || verb === "ps") {
        let executions = await apiService.getExecutions();
        if (rest) {
          executions = executions.filter((execution) => execution.status === rest.toLowerCase());
        }
        append({ tone: "output", ...summarizeExecutions(executions) });
      } else if (verb === "run") {
        const [target = "", ...payloadParts] = restParts;
        if (!target) throw new Error("usage: run <playbook-path-or-catalog-id> [json|--set key=value]");
        const playbook = await resolvePlaybook(target);
        const workload = parseWorkload(payloadParts.join(" "));
        const response = await apiService.executePlaybookWithPayload({
          catalog_id: playbook.catalog_id,
          path: playbook.catalog_id ? undefined : playbook.path,
          version: "latest",
          workload,
        });
        append({ tone: "success", text: `started ${playbook.label} :: execution=${response.execution_id}` });
        navigate(`/execution/${response.execution_id}`);
      } else if (verb === "report") {
        if (!rest) throw new Error("usage: report <execution_id>");
        const execution = await apiService.getExecution(rest, { page_size: 20 });
        append({
          tone: "output",
          text: [
            formatExecution(execution),
            `events=${execution.events?.length || 0}`,
            execution.path === KUBERNETES_AGENT_PLAYBOOK
              ? `output=${extractAgentText(execution)}`
              : `result=${compactJson(execution.result)}`,
          ].join("\n"),
          actions: execution.path === KUBERNETES_AGENT_PLAYBOOK ? KUBERNETES_ACTIONS : undefined,
        });
        navigate(`/execution/${execution.execution_id}`);
        setCwd(`/execution/${execution.execution_id}`);
      } else if (verb === "fix" || verb === "diagnose") {
        if (!rest) throw new Error("usage: fix <execution_id>");
        const report = await apiService.analyzeExecution(rest, {
          max_events: 200,
          event_sample_size: 20,
          include_playbook_content: true,
        });
        append({ tone: "output", text: compactJson(report, 1800) });
      } else if (verb === "rerun") {
        const [executionId = "", ...payloadParts] = restParts;
        if (!executionId) throw new Error("usage: rerun <execution_id> [json]");
        const response = await apiService.rerunExecution(executionId, parseWorkload(payloadParts.join(" ")));
        append({ tone: "success", text: `rerun started :: execution=${response.execution_id}` });
        navigate(`/execution/${response.execution_id}`);
      } else if (verb === "stop") {
        if (!rest) throw new Error("usage: stop <execution_id>");
        await apiService.stopExecution(rest);
        append({ tone: "success", text: `stop requested :: execution=${rest}` });
      } else {
        // Bare verb that matches a known route or alias (e.g. `travel`,
        // `users`, `editor`, `credentials`, `admin`, `build`, `observe`,
        // `operate`, `secrets`) is treated as shorthand for `cd <route>`.
        // Verbs that have explicit handlers above (catalog, mcp, k8s,
        // playbooks, executions, etc.) never reach here, so this can't
        // shadow them.
        const route = resolveRoute(verb);
        if (route?.path) {
          navigate(route.path);
          setCwd(workspaceFromPath(route.path));
          append({ tone: "success", text: `directory changed to ${route.path}` });
        } else {
          append({ tone: "error", text: `unknown command: ${verb}. type help` });
        }
      }
    } catch (error: any) {
      append({ tone: "error", text: error?.message || "command failed" });
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <section className={`noetl-prompt${className ? ` ${className}` : ""}`} aria-label="NoETL command prompt">
      <div ref={historyRef} className="noetl-prompt-history">
        {history.map((entry) => (
          <div key={entry.id} className={`noetl-prompt-line ${entry.tone}`}>
            {entry.prompt && <span className="noetl-prompt-prefix">{entry.prompt}</span>}
            <div className="noetl-prompt-result">
              {(() => {
                const text = entry.text || "";
                const textOverflows = text.length > COLLAPSED_TEXT_LENGTH;
                const actions = entry.actions || [];
                const actionsOverflow = actions.length > COLLAPSED_ACTION_COUNT;
                const visibleActions = entry.collapsed ? actions.slice(0, COLLAPSED_ACTION_COUNT) : actions;
                const table = !entry.prompt ? parseTerminalTable(text) : undefined;
                const tableOverflows = Boolean(table && table.rows.length > TABLE_ROW_COLLAPSED_COUNT);
                const visibleText = table
                  ? ""
                  : entry.collapsed ? getCollapsedText(text) : text;
                const canToggle = textOverflows || actionsOverflow || tableOverflows;

                return (
                  <>
                    <div className="noetl-prompt-result-head">
                      {table ? (
                        <div className="noetl-prompt-structured">
                          {table.intro && <span className="noetl-prompt-text">{table.intro}</span>}
                          {renderTerminalTable(table, entry.collapsed)}
                          {table.outro && <span className="noetl-prompt-text">{entry.collapsed ? getCollapsedText(table.outro) : table.outro}</span>}
                        </div>
                      ) : (
                        visibleText && <span className="noetl-prompt-text">{visibleText}</span>
                      )}
                      {!entry.prompt && (
                        <div className="noetl-prompt-line-tools">
                          {canToggle && (
                            <button
                              aria-label={entry.collapsed ? "Show more output" : "Show less output"}
                              className="noetl-prompt-tool"
                              onClick={() => updateEntry(entry.id, { collapsed: !entry.collapsed })}
                              title={entry.collapsed ? "show more" : "show less"}
                              type="button"
                            >
                              {entry.collapsed ? "+" : "-"}
                            </button>
                          )}
                          <button
                            aria-label="Close output"
                            className="noetl-prompt-tool"
                            onClick={() => removeEntry(entry.id)}
                            title="close"
                            type="button"
                          >
                            x
                          </button>
                        </div>
                      )}
                    </div>
                    {visibleActions.length > 0 && (
                      <div className="noetl-prompt-actions">
                        {visibleActions.map((action) => (
                          <button
                            key={`${entry.id}-${action.label}-${action.path || action.command}`}
                            className="noetl-prompt-action"
                            type="button"
                            onClick={() => handleAction(action)}
                          >
                            <span>{action.label}</span>
                            {action.description && <small>{action.description}</small>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
      <form
        className="noetl-prompt-form"
        onSubmit={(event) => {
          event.preventDefault();
          runCommand(command);
        }}
      >
        <label className="noetl-prompt-prefix" htmlFor="noetl-prompt-input">{prompt}</label>
        <Input
          ref={inputRef}
          id="noetl-prompt-input"
          value={command}
          disabled={busy}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runCommand(command);
            }
          }}
          placeholder="help"
          autoComplete="off"
        />
        <Button htmlType="submit" loading={busy} icon={<EnterOutlined />} aria-label="Run command" />
        <Button
          htmlType="button"
          icon={<ClearOutlined />}
          aria-label="Clear prompt"
          onClick={() => setHistory([])}
        />
      </form>
    </section>
  );
};

export default NoetlPrompt;
