// Common types used across the application

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface PlaybookMetadata extends JsonObject {
  description?: string;
  name?: string;
}

export interface PlaybookPayload extends JsonObject {
  metadata?: PlaybookMetadata;
  workflow?: JsonValue[];
}

export interface PlaybookMeta extends JsonObject {
  registered_at?: string;
}

export type ExecutionStatus = "running" | "completed" | "failed" | "pending" | "cancelled";

export interface ServerStatus {
  status: "ok" | "healthy" | "error" | "warning" | string;
  message: string;
  timestamp: string;
}

// export interface PlaybookData {
//   id: string;
//   name: string;
//   kind: string;
//   version: number;
//   meta: any;
//   timestamp: string;
//   status: "active" | "inactive" | "draft";
//   tasks_count: number;
//   updated_at: string;
//   description?: string;
//   created_at?: string;
// }
export interface PlaybookData {
  catalog_id: string
  path: string
  version: string
  kind?: string
  content?: string
  layout?: JsonValue
  payload?: PlaybookPayload
  status: "active" | "inactive" | "draft";
  meta?: PlaybookMeta
  created_at?: string
}

export interface CredentialData {
  id: string;
  name: string;
  type: string;
  meta?: JsonValue;
  tags?: string[];
  description?: string;
  created_at: string;
  updated_at: string;
  data?: JsonValue;
}

export interface ExecutionEvent {
  execution_id: string;
  event_id: number;
  event_type: string;
  node_id?: string;
  node_name?: string;
  status?: string;
  created_at?: string;
  timestamp?: string;
  duration?: number;
  context?: JsonValue;
  result?: JsonValue;
  meta?: JsonValue;
  input_context?: JsonValue;
  output_result?: JsonValue;
  normalized_status?: string;
  error?: string;
  catalog_id?: string;
  parent_execution_id?: string;
  parent_event_id?: string;
}
export interface ExecutionData {
  execution_id: string;
  path: string;
  version: string;
  status: ExecutionStatus;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  duration_human?: string;
  progress: number;
  result?: JsonValue;
  error?: string;
  parent_execution_id?: string;
  events?: Array<ExecutionEvent>;
  pagination?: {
    page: number;
    page_size: number;
    total_events: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Inferred workload form for a catalog resource, served by
 * `GET /api/catalog/{path}/ui_schema`. The shape mirrors
 * noetl/server/api/mcp/schema.py so changes have to be made on both
 * sides at once.
 */
export interface UiSchemaField {
  name: string;
  kind: "string" | "integer" | "number" | "boolean" | "object" | "array" | "null" | "enum";
  default?: JsonValue;
  description?: string | null;
  secret?: boolean;
  credential_glob?: string | null;
  options?: JsonValue[] | null;
  children?: UiSchemaField[] | null;
}

export interface UiSchema {
  path: string;
  version: number;
  kind: string;
  title?: string | null;
  description_markdown?: string | null;
  exposed_in_ui?: boolean;
  fields: UiSchemaField[];
  generated_at: string;
}

export interface DashboardStats {
  total_playbooks: number;
  total_executions: number;
  active_executions: number;
  success_rate: number;
  recent_executions: ExecutionData[];
}

export interface MenuItemType {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export interface AppContextType {
  serverStatus: ServerStatus | null;
  isLoading: boolean;
  error: string | null;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface TableColumn {
  key: string;
  title: string;
  dataIndex: string;
  render?: (value: unknown, record: unknown) => React.ReactNode;
  sorter?: boolean;
  filterable?: boolean;
  width?: number;
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area" | "scatter";
  xAxis?: string;
  yAxis?: string;
  series?: string[];
  colors?: string[];
  title?: string;
  subtitle?: string;
  legend?: boolean;
  grid?: boolean;
  responsive?: boolean;
}

// Visualization widget definition used by WidgetRenderer
export interface VisualizationWidget {
  id: string;
  type: 'metric' | 'progress' | 'table' | 'list' | 'text' | 'chart';
  title: string;
  // Data payload varies by widget type; keep flexible with typed common fields
  data: {
    value?: number;
    percent?: number;
    status?: string;
    description?: string;
    rows?: JsonValue[];  // table rows
    items?: JsonValue[]; // list items
    html?: string;       // rich text / markdown rendered as HTML
    [key: string]: JsonValue | undefined;
  };
  // Configuration block controlling display and formatting
  config: {
    format?: 'percentage' | 'number' | string;
    color?: string;
    pagination?: JsonValue;   // Ant Design table pagination settings or false
    columns?: TableColumn[];  // Table column definitions
    height?: number;          // Chart / container height
    chartType?: string;       // For chart placeholder (line, bar, etc.)
    [key: string]: JsonValue | TableColumn[] | undefined;
  };
}
