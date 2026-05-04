import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Descriptions, Input, Popover, Space, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";
import {
  connectSSE,
  disconnectSSE,
  executeGatewayPlaybook,
  getSseDiagnostics,
  getUserInfo,
  isAuthenticated,
  logout,
  subscribeConnection,
  subscribeProgress,
  validateSession,
  type SseDiagnostics,
} from "../services/gatewayAuth";
import { resolveApiMode } from "../services/gatewayBaseUrl";
import "../styles/Gateway.css";

const AMADEUS_PLAYBOOK_PATH = "api_integration/amadeus_ai_api";

// Direct-mode result shape — mirrors what executeGatewayPlaybook
// returns so the UI's appendMessage call doesn't have to branch.
type DirectExecutionResult = {
  id: string;
  executionId: string;
  status: string;
  textOutput: string;
};

function extractTextOutput(execution: any): string {
  // Heuristic in priority order. Mirrors how PlaybookRunDialog
  // surfaces an execution's "primary text" — the agent's end-step
  // result.text, the result.text directly, the result if it's a
  // string, or a compact JSON dump as last resort.
  const result = execution?.result;
  if (typeof result === "string") return result;
  if (result?.text && typeof result.text === "string") return result.text;
  if (result?.summary && typeof result.summary === "string") return result.summary;
  if (result?.message && typeof result.message === "string") return result.message;
  if (typeof execution?.text === "string") return execution.text;
  return JSON.stringify(result || execution || {}, null, 2).slice(0, 4000);
}

async function executeDirectMode(
  query: string,
  onProgress: (message: string) => void,
): Promise<DirectExecutionResult> {
  // Direct mode: dispatch the amadeus playbook through /api/execute
  // and poll the execution status until it reaches a terminal state.
  // Same pattern as PlaybookRunDialog uses; no SSE involvement.
  onProgress("Submitting playbook…");
  const response = await apiService.executePlaybookWithPayload({
    path: AMADEUS_PLAYBOOK_PATH,
    workload: { query },
  });
  const executionId = response.execution_id;

  // Poll for completion. 90s ceiling matches the backend's
  // default playbook timeout for HTTP+postgres flows; bump if
  // the amadeus playbook turns out to legitimately take longer.
  const pollIntervalMs = 1500;
  const maxPolls = Math.ceil(90_000 / pollIntervalMs);
  let last: any = null;

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
    last = await apiService.getExecution(executionId);
    const status = String(last?.status || "").toLowerCase();
    if (status === "completed" || status === "succeeded") {
      return {
        id: executionId,
        executionId,
        status: last?.status || "completed",
        textOutput: extractTextOutput(last),
      };
    }
    if (status === "failed" || status === "error" || status === "cancelled") {
      throw new Error(
        `Playbook ${last?.status || "failed"}: ${extractTextOutput(last).slice(0, 600)}`,
      );
    }
    onProgress(`Polling execution ${executionId}… (${last?.status || "running"})`);
  }
  throw new Error(
    `Playbook execution ${executionId} did not complete in ${Math.round(maxPolls * pollIntervalMs / 1000)}s`,
  );
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "—";
  const ago = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return `${new Date(ts).toLocaleTimeString()} (${ago}s ago)`;
}

function ConnectionDiagnostic({ diag }: { diag: SseDiagnostics }) {
  return (
    <Descriptions
      column={1}
      size="small"
      style={{ minWidth: 360, maxWidth: 520 }}
    >
      <Descriptions.Item label="State">
        {diag.connected ? "connected" : diag.readyStateName}
      </Descriptions.Item>
      <Descriptions.Item label="URL">
        <Text code copyable style={{ fontSize: 11 }}>
          {diag.url || "(not configured — gateway URL missing or session token absent)"}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item label="Session token">
        {diag.hasSessionToken ? "present" : "missing — sign in first"}
      </Descriptions.Item>
      <Descriptions.Item label="Client id">
        {diag.clientId || "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Last opened">
        {formatTimestamp(diag.lastOpenAt)}
      </Descriptions.Item>
      <Descriptions.Item label="Last error">
        {diag.lastErrorMessage
          ? `${diag.lastErrorMessage} @ ${formatTimestamp(diag.lastErrorAt)}`
          : "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Reconnect attempts">
        {`${diag.reconnectAttempts} / ${diag.maxReconnectAttempts}`}
      </Descriptions.Item>
    </Descriptions>
  );
}

const { Title, Text } = Typography;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: string;
  executionId?: string;
};

const suggestions = [
  "I want to fly from SFO to JFK tomorrow",
  "Find flights from New York to London next Friday",
  "Show cheapest options from LAX to Tokyo this weekend",
];

function messageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MESSAGES_STORAGE_KEY = "gateway-assistant-messages";

// Load messages from sessionStorage
const loadMessages = (): ChatMessage[] => {
  try {
    const stored = sessionStorage.getItem(MESSAGES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save messages to sessionStorage
const saveMessages = (messages: ChatMessage[]) => {
  try {
    sessionStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore storage errors
  }
};

const GatewayAssistant = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connectionReady, setConnectionReady] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  // Diagnostic snapshot for the connection-indicator popover. Refreshed
  // every 1s while the popover is potentially visible — cheap snapshot
  // of in-memory state, no network calls.
  const [diag, setDiag] = useState<SseDiagnostics>(() => getSseDiagnostics());
  // Cache the api mode at mount so the submit handler doesn't have
  // to re-resolve env vars on every keystroke. Direct mode skips
  // the SSE round-trip and dispatches via apiService instead — the
  // gateway-only path otherwise blocks every submit on local kind
  // setups where the gateway isn't deployed.
  const apiMode = useMemo(() => resolveApiMode(), []);
  const user = useMemo(() => getUserInfo(), []);

  useEffect(() => {
    if (apiMode === "direct") {
      // No gateway → no SSE → the chat is "ready" the moment the
      // page mounts. Skip connectSSE entirely so the indicator
      // doesn't churn through reconnect attempts against a noetl
      // server that has no /events endpoint.
      setConnectionReady(true);
      setDiag(getSseDiagnostics());
      return;
    }

    // Gateway mode: keep the existing SSE-driven flow.
    connectSSE();

    const unsubscribeConnection = subscribeConnection((connected) => {
      setConnectionReady(connected);
      setDiag(getSseDiagnostics());
    });
    const unsubscribeProgress = subscribeProgress((message) => {
      setProgress(message);
    });
    // Tick the diagnostic snapshot so the popover (if open) shows
    // fresh "X seconds ago" timestamps and reconnect attempt counts
    // as they advance.
    const diagTick = window.setInterval(() => setDiag(getSseDiagnostics()), 1000);

    return () => {
      unsubscribeConnection();
      unsubscribeProgress();
      window.clearInterval(diagTick);
      disconnectSSE();
    };
  }, [apiMode]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((previous) => {
      const updated = [...previous, message];
      saveMessages(updated);
      return updated;
    });
  };

  const onSubmit = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || submitting) {
      return;
    }

    // The "real-time connection" check only matters in gateway
    // mode — direct mode dispatches via /api/execute and polls,
    // so SSE readiness isn't a precondition.
    if (apiMode === "gateway" && !connectionReady) {
      setError("Real-time connection is not ready yet. Please wait a moment.");
      return;
    }

    setError(null);
    setProgress(null);
    setSubmitting(true);
    setQuery("");
    appendMessage({ id: messageId(), role: "user", text: trimmed });

    try {
      const result = apiMode === "direct"
        ? await executeDirectMode(trimmed, setProgress)
        : await executeGatewayPlaybook(trimmed);
      appendMessage({
        id: messageId(),
        role: "assistant",
        text: result.textOutput || "No response returned by the playbook.",
        status: result.status,
        executionId: result.executionId || result.id,
      });
    } catch (submitError) {
      const detail = submitError instanceof Error ? submitError.message : "Failed to execute playbook";
      if (detail === "Session expired" || detail === "Not authenticated") {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(detail);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="gateway-assistant-wrap">
      <Card className="gateway-assistant-card" bordered={false}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div className="gateway-header">
            <div>
              <Title level={3} style={{ marginBottom: 4 }}>
                Travel Assistant
              </Title>
              <Text type="secondary">
                Ask flight-search queries and execute playbook `api_integration/amadeus_ai_api`.
              </Text>
            </div>
            <Space>
              {/* Click the tag to see WHY it's still "Connecting" — */}
              {/* shows target URL, EventSource readyState, and last */}
              {/* open/error timestamps. Useful in local-kind setups */}
              {/* where the gateway isn't deployed and the indicator */}
              {/* otherwise sits forever with no explanation. */}
              <Popover
                title="SSE connection diagnostic"
                content={<ConnectionDiagnostic diag={diag} />}
                trigger="click"
                placement="bottomRight"
              >
                <Tag
                  color={connectionReady ? "green" : "orange"}
                  style={{ cursor: "pointer" }}
                >
                  {connectionReady ? "Connected" : "Connecting"}
                </Tag>
              </Popover>
              <Text type="secondary">
                {user?.display_name || user?.email || "Authenticated user"}
              </Text>
              <Button
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                Logout
              </Button>
            </Space>
          </div>

          {error && (
            <Alert type="error" message={error} showIcon closable onClose={() => setError(null)} />
          )}

          <div className="gateway-chat-log">
            {messages.length === 0 && (
              <div className="gateway-chat-empty">
                <Text type="secondary">
                  Start by entering a travel request, or use one of the quick suggestions.
                </Text>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`gateway-message ${message.role}`}>
                <div className="gateway-message-content">
                  <Text>{message.text}</Text>
                  {(message.executionId || message.status) && (
                    <div className="gateway-message-meta">
                      {message.executionId && <Text type="secondary">Execution: {message.executionId}</Text>}
                      {message.status && <Tag>{message.status}</Tag>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {submitting && (
              <div className="gateway-message assistant">
                <div className="gateway-message-content">
                  <Text type="secondary">{progress || "Processing request..."}</Text>
                </div>
              </div>
            )}
          </div>

          <Space wrap>
            {suggestions.map((item) => (
              <Button key={item} size="small" onClick={() => onSubmit(item)} disabled={submitting}>
                {item}
              </Button>
            ))}
          </Space>

          <Input.Search
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about flights..."
            enterButton="Send"
            loading={submitting}
            onSearch={onSubmit}
          />
        </Space>
      </Card>
    </div>
  );
};

export default GatewayAssistant;
