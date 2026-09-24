import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Descriptions, Input, Select, Space, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import apiService from "../services/api";
import type { EhdbEvent, EhdbExecution, EhdbIndex } from "../services/ehdb.types";

const { Text } = Typography;

/**
 * EHDB record browser — read-only.
 *
 * Reads the platform read-model through `/api/ehdb/*`. The server declares
 * this surface `"read_only": true`; nothing in this view can mutate state,
 * and it deliberately offers no write affordances.
 *
 * ⚠ The two tabs page DIFFERENTLY, because the server does:
 *   - Executions: offset pagination + real server-side `path`/`status` filters.
 *   - Events:     forward cursor via `after=` and NO server-side filters.
 * Conflating them produces a filter that silently matches everything or a
 * "next page" that returns page one. Both were verified against prod before
 * this view was written.
 */

const statusColor = (status?: string | null): string => {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED": return "green";
    case "FAILED": return "red";
    case "RUNNING": return "blue";
    case "CANCELLED": return "orange";
    default: return "default";
  }
};

/**
 * How long a non-terminal execution may sit before we call it out.
 *
 * This is the trap that cost real debugging time: an execution that records
 * `playbook_started` and then never receives a command looks identical to one
 * that is merely busy — same status, same spinner, no error anywhere. Naming
 * it in the UI is the whole point.
 */
const STALL_WARN_MINUTES = 10;

function minutesSince(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 60000;
}

/**
 * Flag an execution that is running, has made almost no progress, and has been
 * doing so for a while. `event_count <= 2` is the signature of the stall: a
 * playbook that got `playbook_started` + `execution.catalog_snapshot` and no
 * `command.issued`.
 */
function stallHint(row: EhdbExecution): string | null {
  if (row.terminal) return null;
  const mins = minutesSince(row.started_at);
  if (mins === null || mins < STALL_WARN_MINUTES) return null;
  const events = row.event_count ?? 0;
  if (events <= 2) {
    return `No command issued in ${Math.round(mins)}m — the run recorded its start and then stopped. Usually the playbook never dispatched (a missing metadata.version does exactly this), or the control plane could not advance it.`;
  }
  return `Running ${Math.round(mins)}m without reaching a terminal event.`;
}

export default function EhdbRecords() {
  const [index, setIndex] = useState<EhdbIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const [executions, setExecutions] = useState<EhdbExecution[]>([]);
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pathFilter, setPathFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const LIMIT = 50;

  const [events, setEvents] = useState<EhdbEvent[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [atEnd, setAtEnd] = useState(false);

  const loadIndex = useCallback(async () => {
    try {
      setIndex(await apiService.getEhdbIndex());
      setIndexError(null);
    } catch (e: any) {
      setIndexError(e?.message || "Could not reach /api/ehdb.");
    }
  }, []);

  const loadExecutions = useCallback(async (nextOffset: number) => {
    setExecLoading(true);
    setExecError(null);
    try {
      const page = await apiService.getEhdbExecutions({
        limit: LIMIT,
        offset: nextOffset,
        path: pathFilter.trim() || undefined,
        status: statusFilter,
      });
      setExecutions(page.executions || []);
      setOffset(page.offset ?? nextOffset);
    } catch (e: any) {
      setExecError(e?.message || "Failed to load EHDB executions.");
      setExecutions([]);
    } finally {
      setExecLoading(false);
    }
  }, [pathFilter, statusFilter]);

  /** `reset` starts a fresh scan; otherwise continue from the stored cursor. */
  const loadEvents = useCallback(async (reset: boolean) => {
    setEvLoading(true);
    setEvError(null);
    try {
      const page = await apiService.scanEhdbEvents({
        limit: 100,
        after: reset ? null : cursor,
      });
      const batch = page.events || [];
      setEvents(prev => (reset ? batch : [...prev, ...batch]));
      setCursor(page.next_cursor ?? null);
      // No next_cursor means the server reached the end of the log.
      setAtEnd(!page.next_cursor);
    } catch (e: any) {
      setEvError(e?.message || "Failed to scan EHDB events.");
    } finally {
      setEvLoading(false);
    }
  }, [cursor]);

  useEffect(() => { void loadIndex(); }, [loadIndex]);
  useEffect(() => { void loadExecutions(0); }, [loadExecutions]);
  useEffect(() => { void loadEvents(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const stalled = useMemo(
    () => executions.filter(r => stallHint(r) !== null).length,
    [executions],
  );

  const execColumns = [
    {
      title: "execution_id", dataIndex: "execution_id", key: "execution_id", width: 200,
      render: (v: string) => <Text code copyable={{ text: v }}>{v}</Text>,
    },
    { title: "path", dataIndex: "path", key: "path", render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: "status", dataIndex: "status", key: "status", width: 120,
      render: (v: string | null, row: EhdbExecution) => (
        <Space size={4}>
          <Tag color={statusColor(v)}>{v || "—"}</Tag>
          {row.terminal ? null : <Tag>live</Tag>}
        </Space>
      ),
    },
    { title: "events", dataIndex: "event_count", key: "event_count", width: 90 },
    { title: "started", dataIndex: "started_at", key: "started_at", width: 210,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: "progress", key: "progress",
      render: (_: unknown, row: EhdbExecution) => {
        const hint = stallHint(row);
        if (!hint) {
          return row.terminal
            ? <Text type="secondary">done</Text>
            : <Text type="secondary">in flight</Text>;
        }
        return (
          <Tooltip title={hint}>
            <Tag color="warning">not advancing</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const eventColumns = [
    { title: "event_id", dataIndex: "event_id", key: "event_id", width: 190,
      render: (v: string) => <Text code>{v}</Text> },
    { title: "execution_id", dataIndex: "execution_id", key: "execution_id", width: 190,
      render: (v: string | null) => v ? <Text code copyable={{ text: v }}>{v}</Text> : "—" },
    { title: "event_type", dataIndex: "event_type", key: "event_type", width: 210 },
    { title: "node", dataIndex: "node_name", key: "node_name" },
    { title: "status", dataIndex: "status", key: "status", width: 120,
      render: (v: string | null) => <Tag color={statusColor(v)}>{v || "—"}</Tag> },
    { title: "created_at", dataIndex: "created_at", key: "created_at", width: 210 },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        size="small"
        title="EHDB records (read-only)"
        extra={<Button icon={<ReloadOutlined />} onClick={() => { void loadIndex(); void loadExecutions(offset); }}>refresh</Button>}
        style={{ marginBottom: 12 }}
      >
        {indexError ? (
          <Alert
            type="error"
            showIcon
            message="EHDB query API unreachable"
            description={
              <>
                <div>{indexError}</div>
                <div style={{ marginTop: 6 }}>
                  The GUI reached its configured API base but <Text code>/api/ehdb</Text> did not answer.
                  A CDN 200 on the app itself says nothing about the backend — check that the API
                  origin for this hostname is correct and reachable.
                </div>
              </>
            }
          />
        ) : index ? (
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="service">{index.service}</Descriptions.Item>
            <Descriptions.Item label="read only">{String(index.read_only)}</Descriptions.Item>
            <Descriptions.Item label="routes">{(index.endpoints || []).length}</Descriptions.Item>
            <Descriptions.Item label="tiers">{Object.keys(index.tiers || {}).join(", ")}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">loading…</Text>
        )}
      </Card>

      {stalled > 0 && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message={`${stalled} execution${stalled === 1 ? "" : "s"} on this page ${stalled === 1 ? "is" : "are"} not advancing`}
          description="Marked 'not advancing' below. An execution with 2 or fewer events that has been running for a while never got its first command — most often a playbook registered without metadata.version."
        />
      )}

      <Tabs
        defaultActiveKey="executions"
        items={[
          {
            key: "executions",
            label: "Executions (projection)",
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Input
                    placeholder="filter by path"
                    value={pathFilter}
                    allowClear
                    onChange={e => setPathFilter(e.target.value)}
                    style={{ width: 280 }}
                  />
                  <Select
                    placeholder="status"
                    allowClear
                    style={{ width: 160 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={["RUNNING", "COMPLETED", "FAILED", "CANCELLED"].map(s => ({ value: s, label: s }))}
                  />
                  <Text type="secondary">filters run server-side</Text>
                </Space>
                {execError && <Alert type="error" showIcon message={execError} style={{ marginBottom: 12 }} />}
                <Table
                  size="small"
                  rowKey="execution_id"
                  loading={execLoading}
                  dataSource={executions}
                  columns={execColumns}
                  pagination={false}
                  scroll={{ x: true }}
                />
                <Space style={{ marginTop: 12 }}>
                  <Button disabled={offset === 0 || execLoading} onClick={() => void loadExecutions(Math.max(0, offset - LIMIT))}>
                    previous
                  </Button>
                  <Button disabled={executions.length < LIMIT || execLoading} onClick={() => void loadExecutions(offset + LIMIT)}>
                    next
                  </Button>
                  <Text type="secondary">offset {offset}</Text>
                </Space>
              </>
            ),
          },
          {
            key: "events",
            label: "Event log (eventlog)",
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Forward-only scan by global sequence"
                  description="This tab pages forward with a cursor and has no server-side filters. To see the events of one execution, open it from the Executions tab instead — that route really does scope."
                />
                {evError && <Alert type="error" showIcon message={evError} style={{ marginBottom: 12 }} />}
                <Table
                  size="small"
                  rowKey="event_id"
                  loading={evLoading}
                  dataSource={events}
                  columns={eventColumns}
                  pagination={false}
                  scroll={{ x: true }}
                />
                <Space style={{ marginTop: 12 }}>
                  <Button disabled={evLoading} onClick={() => { setCursor(null); setAtEnd(false); void loadEvents(true); }}>
                    restart scan
                  </Button>
                  <Button type="primary" disabled={evLoading || atEnd} onClick={() => void loadEvents(false)}>
                    {atEnd ? "end of log" : "load more"}
                  </Button>
                  <Text type="secondary">{events.length} loaded</Text>
                </Space>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
