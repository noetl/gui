import React, { useMemo, useRef, useState } from "react";
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
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
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
  const prompt = `noetl@${runtime.displayName}:${location.pathname || "~"}$`;

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
        append({
          tone: "output",
          text: [
            "context                         show active NoETL API context",
            "menu                            show clickable navigation menu",
            "ls                              list current workspace options",
            "cd <view>                       navigate to catalog/editor/execution/etc",
            "open <view|execution_id>        open a view or execution detail",
            "status                          check server health",
            "playbooks [query]               discover catalog playbooks",
            "executions [status]             list recent executions",
            "run <playbook> [json|--set k=v] start a playbook",
            "report <execution_id>           summarize execution state and events",
            "fix <execution_id>              produce a diagnostic report",
            "rerun <execution_id> [json]     rerun an execution",
            "stop <execution_id>             stop a running execution",
            "clear                           clear prompt history",
          ].join("\n"),
          actions: [
            { label: "menu", command: "menu" },
            { label: "playbooks", command: "playbooks" },
            { label: "executions", command: "executions" },
            { label: "status", command: "status" },
          ],
        });
      } else if (verb === "menu") {
        append({
          tone: "output",
          text: "available views",
          actions: ROUTES,
        });
      } else if (verb === "ls") {
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
          ],
        });
      } else if (verb === "cd") {
        const route = resolveRoute(rest);
        if (!route?.path) throw new Error("usage: cd <catalog|editor|execution|credentials|travel|users>");
        navigate(route.path);
        append({ tone: "success", text: `directory changed to ${route.path}` });
      } else if (verb === "open") {
        if (!rest) throw new Error("usage: open <view|execution_id>");
        const route = resolveRoute(rest);
        if (route?.path) {
          navigate(route.path);
          append({ tone: "success", text: `opened ${route.path}` });
        } else if (/^\d+$/.test(rest)) {
          navigate(`/execution/${rest}`);
          append({ tone: "success", text: `opened /execution/${rest}` });
        } else {
          throw new Error(`unknown view or execution id: ${rest}`);
        }
      } else if (verb === "context") {
        append({
          tone: "output",
          text: `${runtime.displayName} :: mode=${runtime.mode} :: api=${runtime.apiBaseUrl} :: skip_auth=${runtime.allowSkipAuth}`,
        });
      } else if (verb === "status") {
        const health = await apiService.getHealth();
        append({ tone: health.status === "ok" || health.status === "healthy" ? "success" : "output", text: compactJson(health) });
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
            `result=${compactJson(execution.result)}`,
          ].join("\n"),
        });
        navigate(`/execution/${execution.execution_id}`);
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
      <div className="noetl-prompt-history">
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
