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

const MAX_LINES = 24;
const COLLAPSED_TEXT_LENGTH = 360;
const COLLAPSED_ACTION_COUNT = 5;
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
const MCP_WORKSPACES: PromptAction[] = [
  { label: "kubernetes", command: "cd /mcp/kubernetes", description: "runtime observability through playbook agent" },
  { label: "noetl", command: "cd /mcp/noetl", description: "NoETL control-plane MCP workspace" },
  { label: "github", command: "cd /mcp/github", description: "repository workflow MCP workspace" },
];
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

function compactJson(value: unknown, maxLength = 240): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength - 3)}...` : serialized;
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
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

function summarizeMcpTools(tools: Array<{ name: string; title?: string; description?: string }>): string {
  if (tools.length === 0) return "no MCP tools exposed";
  return tools
    .slice(0, 18)
    .map((tool) => `${tool.name}${tool.title ? ` :: ${tool.title}` : ""}${tool.description ? ` :: ${tool.description}` : ""}`)
    .join("\n");
}

function extractAgentPayload(execution: ExecutionData): Record<string, unknown> {
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
    execution.result,
    ...(execution.events || []).map((event) => event.result).reverse(),
    ...(execution.events || []).map((event) => event.context).reverse(),
  ];
  for (const candidate of candidates) {
    const payload = unwrap(candidate);
    if (payload) return payload;
  }
  return {};
}

function extractAgentText(execution: ExecutionData): string {
  const payload = extractAgentPayload(execution);
  const text = payload.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  const fallbackSource = Object.keys(payload).length > 0 ? payload : execution.result;
  return compactJson(fallbackSource, 2400);
}

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
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((tool): tool is Record<string, unknown> => Boolean(tool) && typeof tool === "object" && !Array.isArray(tool))
    .map((tool) => ({
      name: String(tool.name || ""),
      title: tool.title == null ? undefined : String(tool.title),
      description: tool.description == null ? undefined : String(tool.description),
    }))
    .filter((tool) => tool.name.length > 0);
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
  if (current === "/mcp" && ["github", "noetl"].includes(normalized)) return `/mcp/${normalized}`;
  if (current === "/mcp" && normalized === "kubernetes") return "/mcp/kubernetes";
  return undefined;
}

function isKubernetesWorkspace(pathname: string): boolean {
  return pathname === "/mcp/kubernetes";
}

function isMcpWorkspace(pathname: string): boolean {
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
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

  const runKubernetesAgent = async (
    workload: Record<string, unknown>,
    label: string,
  ): Promise<ExecutionData> => {
    const response = await apiService.executePlaybookWithPayload({
      path: KUBERNETES_AGENT_PLAYBOOK,
      workload,
      resource_kind: "agent",
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

  const appendMcpWorkspace = () => {
    append({
      tone: "output",
      text: "mcp :: model context server workspaces",
      actions: [
        ...MCP_WORKSPACES,
        { label: "discover", command: "mcp discover", description: "scan catalog resources" },
        { label: "register", command: "mcp register", description: "register a new MCP resource" },
      ],
    });
  };

  const appendKubernetesWorkspace = () => {
    append({
      tone: "output",
      text: [
        "mcp/kubernetes :: Kubernetes runtime workspace",
        `agent=${KUBERNETES_AGENT_PLAYBOOK}`,
        "scope=read-only observability via NoETL playbook execution",
      ].join("\n"),
      actions: KUBERNETES_ACTIONS,
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
    setCwd("/mcp/kubernetes");
    if (normalized === "status") {
      const execution = await runKubernetesAgent({
        method: "tools/list",
      }, "kubernetes mcp status");
      const tools = extractMcpToolsFromExecution(execution);
      const ok = execution.status === "completed";
      append({
        tone: ok ? "success" : "error",
        text: formatKubernetesStatus(execution, tools),
        actions: ok ? KUBERNETES_ACTIONS : [{ label: `open ${execution.execution_id}`, path: `/execution/${execution.execution_id}` }],
      });
    } else if (normalized === "tools") {
      const execution = await runKubernetesAgent({
        method: "tools/list",
      }, "kubernetes mcp tools");
      if (execution.status === "completed") {
        const tools = extractMcpToolsFromExecution(execution);
        append({
          tone: "output",
          text: [
            `kubernetes tools :: ${tools.length}`,
            formatToolsByPrefix(tools),
            summarizeMcpTools(tools),
          ].join("\n"),
          actions: KUBERNETES_ACTIONS,
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
    } else if (normalized === "discover") {
      appendMcpWorkspace();
    } else if (normalized === "register") {
      append({
        tone: "output",
        text: [
          "mcp register :: planned command",
          "today=register MCP resources through catalog/playbook resources",
          "next=add resource discovery and registration wizard",
        ].join("\n"),
      });
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
    setCwd("/mcp/kubernetes");
    const { label, toolName, toolArgs } = resolveKubernetesTool(subjectRaw, args);
    const execution = await runKubernetesAgent({
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
        { label: "pods", command: "pods" },
        { label: "namespaces", command: "namespaces" },
        { label: "events", command: "events" },
        { label: "services", command: "services" },
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
          append({
            tone: "output",
            text: [
              "ls                              list MCP workspaces",
              "cd kubernetes                   enter Kubernetes MCP workspace",
              "cd /mcp/noetl                   reserved NoETL MCP workspace",
              "cd /mcp/github                  reserved GitHub MCP workspace",
              "mcp discover                    show discoverable MCP resources",
              "mcp register                    show registration next step",
            ].join("\n"),
            actions: MCP_WORKSPACES,
          });
        } else if (isKubernetesWorkspace(cwd)) {
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
            actions: KUBERNETES_ACTIONS,
          });
        } else {
          append({
            tone: "output",
            text: [
              "context                         show active NoETL API context",
              "menu                            show clickable navigation menu",
              "ls                              list current workspace options",
              "cd <view|/mcp/kubernetes>       navigate to views or MCP workspaces",
              "open <view|execution_id>        open a view or execution detail",
              "status                          check server health",
              "playbooks [query]               discover catalog playbooks",
              "executions [status]             list recent executions",
              "run <playbook> [json|--set k=v] start a playbook",
              "report <execution_id>           summarize execution state and events",
              "fix <execution_id>              produce a diagnostic report",
              "rerun <execution_id> [json]     rerun an execution",
              "stop <execution_id>             stop a running execution",
              "mcp status|tools                inspect MCP through NoETL agent execution",
              "k8s pods|ns|events|deploy|svc   query Kubernetes through playbook agent",
              "clear                           clear prompt history",
            ].join("\n"),
            actions: [
              { label: "menu", command: "menu" },
              { label: "playbooks", command: "playbooks" },
              { label: "executions", command: "executions" },
              { label: "status", command: "status" },
              { label: "cd /mcp", command: "cd /mcp" },
              { label: "cd /mcp/kubernetes", command: "cd /mcp/kubernetes" },
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
          appendMcpWorkspace();
          return;
        }
        if (isKubernetesWorkspace(cwd)) {
          appendKubernetesWorkspace();
          return;
        }
        if (cwd.startsWith("/mcp/")) {
          appendUnavailableMcpWorkspace(cwd.replace("/mcp/", ""));
          return;
        }
        const currentRoute = ROUTES.find((route) => location.pathname === route.path || location.pathname.startsWith(`${route.path}/`));
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
            { label: "kubernetes", command: "cd /mcp/kubernetes", description: "runtime via playbook agent" },
          ],
        });
      } else if (verb === "cd") {
        const workspacePath = normalizeWorkspacePath(rest, cwd);
        if (workspacePath) {
          setCwd(workspacePath);
          if (!isMcpWorkspace(workspacePath)) navigate(workspacePath);
          append({ tone: "success", text: `directory changed to ${workspacePath}` });
          if (workspacePath === "/mcp") appendMcpWorkspace();
          else if (workspacePath === "/mcp/kubernetes") appendKubernetesWorkspace();
          else if (workspacePath.startsWith("/mcp/")) appendUnavailableMcpWorkspace(workspacePath.replace("/mcp/", ""));
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
        append({ tone: "error", text: `unknown command: ${verb}. type help` });
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
                const visibleText = entry.collapsed ? getCollapsedText(text) : text;
                const canToggle = textOverflows || actionsOverflow;

                return (
                  <>
                    <div className="noetl-prompt-result-head">
                      {visibleText && <span className="noetl-prompt-text">{visibleText}</span>}
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
