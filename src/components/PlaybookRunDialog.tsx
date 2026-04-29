import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Alert,
  Spin,
  Tag,
  Typography,
  Button,
  Space,
} from "antd";
import { PlayCircleOutlined, FileTextOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { apiService } from "../services/api";
import { extractAgentText } from "../services/agentResult";
import type { ExecutionData, UiSchema, UiSchemaField } from "../types";
import "../styles/PlaybookRunDialog.css";

const { Title, Text, Paragraph } = Typography;

/**
 * Friendly playbook launcher. Pulls `/api/catalog/{path}/ui_schema` for
 * the inferred workload form, renders one input per top-level workload
 * key based on the field kind, and after submit subscribes to the
 * execution status until terminal so the user sees the agent's text
 * payload inline without leaving the catalog page.
 */

type RunDialogProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Catalog path (no .yaml). When omitted the dialog stays in a "no
   * playbook selected" state — the parent controls when to render us.
   */
  path?: string;
  /** Friendly heading override; falls back to the schema's title or the path. */
  fallbackTitle?: string;
};

type RunPhase = "form" | "loading-schema" | "schema-error" | "running" | "terminal";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const PlaybookRunDialog: React.FC<RunDialogProps> = ({ open, onClose, path, fallbackTitle }) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [phase, setPhase] = useState<RunPhase>("loading-schema");
  const [schema, setSchema] = useState<UiSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  // Epoch counter incremented every time we start or stop a polling
  // session. The async tick() captures the epoch it was scheduled
  // under and bails out before touching state or rescheduling if the
  // epoch has moved on — covers the case where stopPolling() fires
  // while an in-flight getExecution() is still resolving.
  const pollEpochRef = useRef<number>(0);

  // Local helper used by both the open/path effect and handleSubmit so
  // we never leak a polling loop tied to a previous execution / path.
  const stopPolling = () => {
    pollEpochRef.current += 1;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollStartedAtRef.current = null;
  };

  // Reset state whenever the dialog re-opens for a new playbook AND
  // tear down any in-flight polling when ``open`` flips false or the
  // path changes — Modal `destroyOnClose` only unmounts our children,
  // not us, so without this cleanup setExecutionData would keep firing
  // after the user has closed the dialog or switched to a different
  // playbook.
  useEffect(() => {
    if (!open || !path) {
      stopPolling();
      return;
    }
    stopPolling();
    setPhase("loading-schema");
    setSchema(null);
    setError(null);
    setExecutionId(null);
    setExecutionData(null);
    form.resetFields();

    let cancelled = false;
    apiService
      .getUiSchema(path, "latest")
      .then((next) => {
        if (cancelled) return;
        setSchema(next);
        setPhase("form");
        // Pre-populate defaults so simple "click run" cases work without
        // the user typing anything.
        const initial: Record<string, unknown> = {};
        for (const field of next.fields) {
          if (field.default !== undefined && field.default !== null) {
            initial[field.name] = field.default as unknown;
          }
        }
        form.setFieldsValue(initial);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.response?.data?.detail || err?.message || "ui_schema unavailable";
        setError(String(detail));
        setPhase("schema-error");
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [open, path, form]);

  const startPolling = (id: string) => {
    stopPolling();
    // Capture the epoch under which this polling session started.
    // Every awaited tick re-checks it before mutating state or
    // scheduling a follow-up so an in-flight request that resolves
    // *after* stopPolling() can't restart the loop.
    const epoch = pollEpochRef.current;
    pollStartedAtRef.current = Date.now();
    const tick = async () => {
      if (epoch !== pollEpochRef.current) return;
      try {
        const next = await apiService.getExecution(id);
        if (epoch !== pollEpochRef.current) return;
        setExecutionData(next);
        if (isTerminalStatus(next.status)) {
          setPhase("terminal");
          stopPolling();
          return;
        }
      } catch (err) {
        // Network blip — keep polling unless we've passed the timeout
        // or the session was cancelled while the request was in flight.
        if (epoch !== pollEpochRef.current) return;
      }
      const elapsed = Date.now() - (pollStartedAtRef.current || Date.now());
      if (elapsed >= POLL_TIMEOUT_MS) {
        setPhase("terminal");
        setError("Polling timed out. Open the execution detail page for live status.");
        stopPolling();
        return;
      }
      if (epoch !== pollEpochRef.current) return;
      pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  };

  const handleSubmit = async () => {
    if (!path || !schema) return;
    setSubmitting(true);
    // Clear any error / stale execution data from a previous attempt so
    // a successful resubmit doesn't keep showing a leftover warning in
    // the result panel.
    setError(null);
    setExecutionData(null);
    try {
      const values = await form.validateFields();
      const workload = buildWorkloadFromForm(values, schema.fields);
      const response = await apiService.executePlaybookWithPayload({
        path,
        // Pin to the same version the ui_schema came from. Without this
        // an upstream catalog re-register between schema fetch and run
        // could route the click to a different version than the form
        // shape expects.
        version: schema.version || "latest",
        workload,
      });
      setExecutionId(response.execution_id);
      setPhase("running");
      startPolling(response.execution_id);
    } catch (err: any) {
      // Form validation failures from form.validateFields() carry
      // .errorFields; surface them above the form rather than as a
      // toast/inline panel by leaving the form open.
      if (err?.errorFields) {
        setSubmitting(false);
        return;
      }
      const detail = err?.response?.data?.detail || err?.message || "execute failed";
      setError(String(detail));
    } finally {
      setSubmitting(false);
    }
  };

  const heading = useMemo(() => {
    if (schema?.title) return schema.title;
    if (fallbackTitle) return fallbackTitle;
    return path || "Run playbook";
  }, [schema, fallbackTitle, path]);

  return (
    <Modal
      title={
        <Space size={8}>
          <PlayCircleOutlined />
          <span>{heading}</span>
          {schema?.kind && <Tag color="processing">{schema.kind}</Tag>}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={renderFooter({
        phase,
        submitting,
        onClose,
        onSubmit: handleSubmit,
        executionId,
        navigate,
      })}
      width={720}
      destroyOnClose
      maskClosable={phase !== "running"}
      className="playbook-run-dialog"
    >
      {phase === "loading-schema" && (
        <div className="playbook-run-dialog-loading">
          <Spin /> <Text type="secondary">Loading workload form…</Text>
        </div>
      )}

      {phase === "schema-error" && (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the inferred workload form"
          description={
            <>
              <div>{error}</div>
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                The catalog endpoint <code>/api/catalog/{`{path}`}/ui_schema</code> may not be
                available on this noetl version. Use the JSON payload modal on the catalog
                row instead.
              </Paragraph>
            </>
          }
        />
      )}

      {phase === "form" && schema && (
        <>
          {schema.description_markdown && (
            // metadata.description from the playbook YAML. Phase 1 renders
            // it as preformatted text (CSS preserves whitespace + line
            // wraps) — markdown rendering is a follow-up that needs a
            // real markdown library + sanitiser added to the GUI deps.
            <pre className="playbook-run-dialog-description">
              {schema.description_markdown}
            </pre>
          )}
          {schema.fields.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="No workload fields"
              description="This playbook has no `workload:` block — submit will run it with an empty payload."
            />
          ) : (
            <Form layout="vertical" form={form} className="playbook-run-dialog-form">
              {schema.fields.map((field) => renderField(field))}
            </Form>
          )}
        </>
      )}

      {(phase === "running" || phase === "terminal") && (
        <ExecutionResultPanel
          executionId={executionId}
          execution={executionData}
          phase={phase}
          error={error}
        />
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Field renderers
// ---------------------------------------------------------------------------

function renderField(field: UiSchemaField): React.ReactNode {
  const label = (
    <Space size={6}>
      <span>{field.name}</span>
      {field.secret && <Tag color="error">secret</Tag>}
      {field.credential_glob && <Tag color="purple">credential: {field.credential_glob}</Tag>}
    </Space>
  );

  const help = field.description || undefined;
  const commonProps = {
    name: field.name,
    label,
    help,
    initialValue: field.default,
  } as const;

  switch (field.kind) {
    case "boolean":
      return (
        <Form.Item key={field.name} {...commonProps} valuePropName="checked">
          <Switch />
        </Form.Item>
      );
    case "integer":
      return (
        <Form.Item key={field.name} {...commonProps}>
          <InputNumber step={1} style={{ width: "100%" }} />
        </Form.Item>
      );
    case "number":
      return (
        <Form.Item key={field.name} {...commonProps}>
          <InputNumber step={0.01} style={{ width: "100%" }} />
        </Form.Item>
      );
    case "enum":
      return (
        <Form.Item key={field.name} {...commonProps}>
          <Select
            options={(field.options || []).map((opt) => ({
              label: String(opt),
              value: opt as never,
            }))}
            placeholder="Select…"
          />
        </Form.Item>
      );
    case "array":
      return (
        <Form.Item
          key={field.name}
          {...commonProps}
          help={help || "Comma-separated values; press Enter to add a tag."}
        >
          <Select mode="tags" tokenSeparators={[","]} placeholder="Add values…" />
        </Form.Item>
      );
    case "object":
    case "null":
      return (
        <Form.Item
          key={field.name}
          {...commonProps}
          help={help || "Edit as JSON. Defaults to the value declared in the playbook."}
          getValueFromEvent={(event) => event.target.value}
          getValueProps={(value) => ({
            value: typeof value === "string" ? value : JSON.stringify(value, null, 2),
          })}
          // Block submit when the user typed something that doesn't
          // parse — silent fallback to the default would dispatch an
          // execution with a payload the user didn't intend.
          rules={[{ validator: validateJsonText }]}
        >
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
        </Form.Item>
      );
    case "string":
    default:
      if (field.secret) {
        return (
          <Form.Item key={field.name} {...commonProps}>
            <Input.Password />
          </Form.Item>
        );
      }
      return (
        <Form.Item key={field.name} {...commonProps}>
          <Input />
        </Form.Item>
      );
  }
}

/**
 * Antd Form async validator for object/null fields. Runs at submit
 * time via `form.validateFields()` and rejects the form if the user
 * typed something that doesn't parse. An empty / whitespace-only
 * string is treated as "leave at the playbook's declared default" —
 * passes validation and `coerceFieldValue` returns the default
 * instead of attempting `JSON.parse("")` (which would otherwise
 * throw and surface as a non-form runtime error).
 */
async function validateJsonText(_rule: unknown, value: unknown): Promise<void> {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || value.trim() === "") return;
  try {
    JSON.parse(value);
  } catch (err) {
    throw new Error("Invalid JSON — fix the value before running.");
  }
}

// ---------------------------------------------------------------------------
// Workload assembly
// ---------------------------------------------------------------------------

function buildWorkloadFromForm(
  values: Record<string, unknown>,
  fields: UiSchemaField[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.name in values)) continue;
    out[field.name] = coerceFieldValue(values[field.name], field);
  }
  return out;
}

function coerceFieldValue(raw: unknown, field: UiSchemaField): unknown {
  if (raw === undefined) return field.default;

  switch (field.kind) {
    case "object":
    case "null":
      if (typeof raw !== "string") return raw;
      // Empty / whitespace-only input is treated as "no override";
      // returning the playbook's declared default avoids an
      // ``JSON.parse("")`` SyntaxError that ``validateJsonText`` lets
      // through (so the user can clear the textarea to revert to
      // the default without seeing a validation error). The two
      // helpers must agree on this case.
      if (raw.trim() === "") return field.default;
      // ``validateJsonText`` rejects the form before this runs when the
      // user typed invalid JSON, so we can parse here without falling
      // back silently — a parse error at this point is a genuine
      // programming bug worth surfacing.
      return JSON.parse(raw);
    case "integer":
      return Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : field.default;
    case "number":
      return Number.isFinite(Number(raw)) ? Number(raw) : field.default;
    case "boolean":
      return Boolean(raw);
    case "array":
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean);
      return field.default;
    default:
      return raw;
  }
}

// ---------------------------------------------------------------------------
// Execution result panel
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function isTerminalStatus(status?: string): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status.toLowerCase());
}

const ExecutionResultPanel: React.FC<{
  executionId: string | null;
  execution: ExecutionData | null;
  phase: RunPhase;
  error: string | null;
}> = ({ executionId, execution, phase, error }) => {
  const status = (execution?.status || "running").toLowerCase();
  const tone = status === "failed" ? "error" : status === "completed" ? "success" : "processing";

  const text = useMemo(() => (execution ? extractAgentText(execution) : ""), [execution]);

  return (
    <div className="playbook-run-dialog-result">
      <Space size={8} className="playbook-run-dialog-result-head">
        <Tag color={tone}>{status.toUpperCase()}</Tag>
        {executionId && <Text code>{executionId}</Text>}
        {execution?.duration_human && <Text type="secondary">{execution.duration_human}</Text>}
      </Space>

      {phase === "running" && (
        <div className="playbook-run-dialog-result-pending">
          <Spin /> <Text type="secondary">Polling execution every {POLL_INTERVAL_MS / 1000}s…</Text>
        </div>
      )}

      {error && (
        <Alert type="warning" showIcon message="Result panel notice" description={error} />
      )}

      {text && (
        <pre className="playbook-run-dialog-result-text">{text}</pre>
      )}
    </div>
  );
};

// extractAgentText lives in services/agentResult.ts and is shared with
// NoetlPrompt so the terminal and the run dialog can't disagree on
// what the agent's output looks like.

// ---------------------------------------------------------------------------
// Footer rendering
// ---------------------------------------------------------------------------

function renderFooter({
  phase,
  submitting,
  onClose,
  onSubmit,
  executionId,
  navigate,
}: {
  phase: RunPhase;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  executionId: string | null;
  navigate: ReturnType<typeof useNavigate>;
}): React.ReactNode {
  if (phase === "running" || phase === "terminal") {
    return (
      <Space>
        {executionId && (
          <Button
            type="default"
            icon={<FileTextOutlined />}
            onClick={() => {
              navigate(`/execution/${executionId}`);
              onClose();
            }}
          >
            Open in execution detail
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </Space>
    );
  }

  if (phase === "form") {
    return (
      <Space>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={submitting}
          onClick={onSubmit}
        >
          Run
        </Button>
      </Space>
    );
  }

  return <Button onClick={onClose}>Close</Button>;
}

export default PlaybookRunDialog;
