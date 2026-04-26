import axios from "axios";
import {
  DashboardStats,
  ExecutionData,
  ExecutionEvent,
  ExecutionStatus,
  JsonValue,
  PlaybookData,
  ServerStatus,
  CredentialData,
} from "../types";
import { CreatePlaybookResponse } from "./api.types";
import { resolveGatewayBaseUrl } from "./gatewayBaseUrl";
import { isSkipAuthAllowed } from "./gatewayAuth";
import { readAppEnv } from "./runtimeEnv";

const SESSION_TOKEN_KEY = "session_token";
const DEV_SKIP_AUTH_TOKEN = "dev-skip-auth";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

function compactJsonForService(value: unknown, maxLength = 1000): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength - 3)}...` : serialized;
  } catch {
    return String(value);
  }
}

const getApiBaseUrl = () => {
  if (readAppEnv("VITE_API_MODE") === "direct") {
    return `${trimTrailingSlash(resolveGatewayBaseUrl())}/api`;
  }
  return `${resolveGatewayBaseUrl()}/noetl`;
};

const API_BASE_URL = getApiBaseUrl();

export interface ApiRuntimeContext {
  mode: "direct" | "gateway";
  apiBaseUrl: string;
  displayName: string;
  allowSkipAuth: boolean;
}

export interface McpRuntimeContext {
  name: string;
  url: string;
  configured: boolean;
}

export interface McpToolInfo {
  name: string;
  title?: string;
  description?: string;
}

export interface McpToolCallResult {
  text: string;
  raw: unknown;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120 * 1000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  // In dev skip auth mode: bypass the Gateway and call NoETL server directly
  if (isSkipAuthAllowed() && token === DEV_SKIP_AUTH_TOKEN) {
    const directApiBase = trimTrailingSlash(readAppEnv("VITE_API_BASE_URL", "http://localhost:8082"));
    config.baseURL = `${directApiBase}/api`;
    return config;
  }
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    config.headers["X-Session-Token"] = token;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem("user_info");
    }
    console.error("API Error:", error);
    return Promise.reject(error);
  },
);

// export interface ServerStatus {
//   status: string;
//   message: string;
//   timestamp: string;
// }
//
//  export interface EventData {
//    event_id: string;
//    event_type: string;
//    node_id: string;
//    node_name: string;
//    node_type: string;
//    status: string;
//    duration: number;
//    timestamp: string;
//    input_context?: any;
//    output_result?: any;
//    metadata?: any;
//    error?: string;
//  }
//
// export interface PlaybookData {
//   id: string;
//   name: string;
//   description?: string;
//   created_at: string;
//   updated_at: string;
//   status: 'active' | 'inactive' | 'draft';
//   tasks_count: number;
//   events?: EventData[];
// }
//
// export interface ExecutionData {
//   id: string;
//   playbook_id: string;
//   playbook_name: string;
//   status: 'running' | 'completed' | 'failed' | 'pending';
//   start_time: string;
//   end_time?: string;
//   duration?: number;
//   progress: number;
//   result?: any;
//   error?: string;
//   events?: Array<{
//   event_id: string;
//   event_type: string;
//   node_name: string;
//   status: string;
//   timestamp: string;
//   duration: number;
//   }>;
// }
//
// export interface DashboardStats {
//   total_playbooks: number;
//   total_executions: number;
//   active_executions: number;
//   success_rate: number;
//   recent_executions: ExecutionData[];
// }
//
// export interface VisualizationWidget {
//   id: string;
//   type: 'chart' | 'table' | 'metric' | 'text';
//   title: string;
//   data: any;
//   config: any;
// }

class APIService {
  private mcpRequestId = 1;

  getRuntimeContext(): ApiRuntimeContext {
    const mode = readAppEnv("VITE_API_MODE") === "direct" ? "direct" : "gateway";
    const allowSkipAuth = isSkipAuthAllowed();
    const base = mode === "direct"
      ? trimTrailingSlash(readAppEnv("VITE_API_BASE_URL", "http://localhost:8082"))
      : trimTrailingSlash(resolveGatewayBaseUrl());
    const apiBaseUrl = mode === "direct" ? `${base}/api` : `${base}/noetl`;

    let displayName = mode === "direct" ? "local" : "gateway";
    try {
      const hostname = new URL(base).hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        displayName = mode === "direct" ? "kind" : "local";
      } else if (hostname) {
        displayName = hostname.split(".")[0] || displayName;
      }
    } catch {
      displayName = mode;
    }

    return {
      mode,
      apiBaseUrl,
      displayName,
      allowSkipAuth,
    };
  }

  getKubernetesMcpContext(): McpRuntimeContext {
    const url = readAppEnv("VITE_MCP_KUBERNETES_URL");
    return {
      name: "kubernetes",
      url,
      configured: url.trim().length > 0,
    };
  }

  private asObject(raw: unknown): Record<string, unknown> {
    return raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
  }

  private asString(value: unknown, fallback = ""): string {
    return value == null ? fallback : String(value);
  }

  private normalizeExecutionStatus(value: unknown): ExecutionStatus {
    const status = typeof value === "string" ? value.toLowerCase() : "";
    if (status === "completed" || status === "failed" || status === "pending" || status === "cancelled") {
      return status;
    }
    return "running";
  }

  private normalizeJsonValue(value: unknown): JsonValue | undefined {
    if (value === undefined) return undefined;
    return value as JsonValue;
  }

  private normalizeExecutionEvent(raw: unknown): ExecutionEvent {
    const event = this.asObject(raw);
    return {
      execution_id: this.asString(event.execution_id),
      event_id: Number(event.event_id || 0),
      event_type: this.asString(event.event_type),
      node_id: event.node_id == null ? undefined : String(event.node_id),
      node_name: event.node_name == null ? undefined : String(event.node_name),
      status: event.status == null ? undefined : String(event.status),
      created_at: event.created_at == null ? undefined : String(event.created_at),
      timestamp: event.timestamp == null ? undefined : String(event.timestamp),
      duration: event.duration == null ? undefined : Number(event.duration),
      context: this.normalizeJsonValue(event.context),
      result: this.normalizeJsonValue(event.result),
      error: event.error == null ? undefined : String(event.error),
      catalog_id: event.catalog_id == null ? undefined : String(event.catalog_id),
      parent_execution_id: event.parent_execution_id == null ? undefined : String(event.parent_execution_id),
      parent_event_id: event.parent_event_id == null ? undefined : String(event.parent_event_id),
    };
  }

  private normalizeExecution(raw: unknown): ExecutionData {
    const item = this.asObject(raw);
    const events = Array.isArray(item.events)
      ? item.events.map((event) => this.normalizeExecutionEvent(event))
      : undefined;
    const normalizedStatus =
      this.normalizeExecutionStatus(item.status);
    return {
      execution_id: this.asString(item.execution_id),
      path: this.asString(item.path, "unknown"),
      version: this.asString(item.version, "0"),
      status: normalizedStatus,
      start_time: this.asString(item.start_time),
      end_time: item.end_time == null ? undefined : String(item.end_time),
      duration_seconds: item.duration_seconds == null ? undefined : Number(item.duration_seconds),
      duration_human: item.duration_human == null ? undefined : String(item.duration_human),
      progress: Number(item.progress || (["completed", "failed", "cancelled"].includes(normalizedStatus) ? 100 : 0)),
      result: this.normalizeJsonValue(item.result),
      error: item.error == null ? undefined : String(item.error),
      parent_execution_id: item.parent_execution_id == null ? undefined : String(item.parent_execution_id),
      events,
      pagination: item.pagination as ExecutionData["pagination"],
    };
  }

  private normalizeExecutionList(rawList: unknown): ExecutionData[] {
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item) => this.normalizeExecution(item));
  }

  private normalizeExecuteRequest(requestBody: any): any {
    const body = { ...(requestBody || {}) };
    if (body.workload === undefined) {
      if (body.payload !== undefined) {
        body.workload = body.payload;
      } else if (body.args !== undefined) {
        body.workload = body.args;
      }
    }
    delete body.payload;
    delete body.args;
    if (body.resource_kind === undefined && body.resource_type === undefined) {
      body.resource_kind = "playbook";
    }
    return body;
  }

  private normalizeMcpEndpoint(url: string): string {
    return trimTrailingSlash(url);
  }

  private parseMcpEnvelope(raw: unknown): any {
    if (typeof raw !== "string") return raw;
    const dataLines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, ""));
    const payload = dataLines.length > 0 ? dataLines.join("\n") : raw;
    return JSON.parse(payload);
  }

  private nextMcpRequestId(): number {
    this.mcpRequestId += 1;
    return this.mcpRequestId;
  }

  private extractMcpText(result: any): string {
    const content = Array.isArray(result?.content) ? result.content : [];
    const textParts = content
      .map((item: any) => item?.type === "text" ? String(item.text || "") : "")
      .filter((value: string) => value.length > 0);
    if (textParts.length > 0) return textParts.join("\n");
    return compactJsonForService(result, 4000);
  }

  private async createMcpSession(endpoint: string): Promise<string> {
    const response = await axios.post(
      endpoint,
      {
        jsonrpc: "2.0",
        id: this.nextMcpRequestId(),
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "noetl-gui",
            version: "0.0.0",
          },
        },
      },
      {
        timeout: 20 * 1000,
        responseType: "text",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
        },
      },
    );
    const envelope = this.parseMcpEnvelope(response.data);
    if (envelope?.error) throw new Error(envelope.error.message || "MCP initialize failed");
    const sessionId = response.headers["mcp-session-id"];
    if (!sessionId) throw new Error("MCP server did not return a session id");
    return String(sessionId);
  }

  private async sendMcpRequest(endpoint: string, method: string, params: Record<string, unknown> = {}): Promise<any> {
    const sessionId = await this.createMcpSession(endpoint);
    const response = await axios.post(
      endpoint,
      {
        jsonrpc: "2.0",
        id: this.nextMcpRequestId(),
        method,
        params,
      },
      {
        timeout: 60 * 1000,
        responseType: "text",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Mcp-Session-Id": sessionId,
        },
      },
    );
    const envelope = this.parseMcpEnvelope(response.data);
    if (envelope?.error) throw new Error(envelope.error.message || `MCP request failed: ${method}`);
    return envelope?.result;
  }

  async getKubernetesMcpHealth(): Promise<{ ok: boolean; url: string; message: string }> {
    const context = this.getKubernetesMcpContext();
    if (!context.configured) {
      return { ok: false, url: "", message: "kubernetes MCP endpoint is not configured" };
    }
    const endpoint = this.normalizeMcpEndpoint(context.url);
    const healthUrl = `${endpoint}/healthz`;
    try {
      await axios.get(healthUrl, { timeout: 10 * 1000 });
      return { ok: true, url: endpoint, message: "healthy" };
    } catch {
      try {
        await this.listKubernetesMcpTools();
        return { ok: true, url: endpoint, message: "responding" };
      } catch (error: any) {
        return { ok: false, url: endpoint, message: error?.message || "unavailable" };
      }
    }
  }

  async listKubernetesMcpTools(): Promise<McpToolInfo[]> {
    const context = this.getKubernetesMcpContext();
    if (!context.configured) throw new Error("kubernetes MCP endpoint is not configured");
    const endpoint = this.normalizeMcpEndpoint(context.url);
    const result = await this.sendMcpRequest(endpoint, "tools/list");
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    return tools.map((tool: any) => ({
      name: this.asString(tool.name),
      title: tool.title == null ? undefined : String(tool.title),
      description: tool.description == null ? undefined : String(tool.description),
    }));
  }

  async callKubernetesMcpTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolCallResult> {
    const context = this.getKubernetesMcpContext();
    if (!context.configured) throw new Error("kubernetes MCP endpoint is not configured");
    const endpoint = this.normalizeMcpEndpoint(context.url);
    const result = await this.sendMcpRequest(endpoint, "tools/call", {
      name,
      arguments: args,
    });
    return {
      text: this.extractMcpText(result),
      raw: result,
    };
  }

  async getHealth(): Promise<ServerStatus> {
    const response = await apiClient.get("/health");
    return response.data;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.get("/dashboard/stats");
    return response.data;
  }

  async getPlaybooks(): Promise<PlaybookData[]> {
    const response = await apiClient.post("/catalog/list", {
      "resource_type": "Playbook",
    });
    // todo: remove once backend is fixed
    if (response.data.entries) {
      for (let entry of response.data.entries) {
        entry.status = entry.status || "active";
      }
    }
    return response.data.entries;
  }

  async getPlaybook(path: string): Promise<PlaybookData> {
    const response = await apiClient.post(`/catalog/resource`, {
      "path": path,
      "version": "latest"
    });
    return response.data;
  }

  async createPlaybook(yaml: string): Promise<CreatePlaybookResponse> {
    // const base64Content = btoa(unescape(encodeURIComponent(yaml)));
    const response = await apiClient.post("/catalog/register", { content: yaml, resource_type: "Playbook" });
    return response.data;
  }

  async registerPlaybook(playbookData: any): Promise<CreatePlaybookResponse> {
    // If it's already a string (YAML or JSON text), use it directly
    const content = typeof playbookData === 'string' ? playbookData : JSON.stringify(playbookData);
    const response = await apiClient.post("/catalog/register", { content, resource_type: "Playbook" });
    return response.data;
  }

  async updatePlaybook(
    id: string,
    data: Partial<PlaybookData>,
  ): Promise<PlaybookData> {
    const response = await apiClient.put(`/catalog/playbook`, data, {
      params: { playbook_id: id },
    });
    return response.data;
  }

  async deletePlaybook(id: string): Promise<void> {
    await apiClient.delete(`/catalog/playbooks/${id}`);
  }

  async getExecutions(): Promise<ExecutionData[]> {
    const response = await apiClient.get("/executions");
    return this.normalizeExecutionList(response.data);
  }

  async getExecution(id: string, params?: {
    page?: number;
    page_size?: number;
    since_event_id?: number;
    event_type?: string;
  }): Promise<ExecutionData> {
    // Use primary execution detail endpoint under /api/executions with pagination support
    const response = await apiClient.get(`/executions/${id}`, { params });
    return this.normalizeExecution(response.data);
  }

  async getExecutionStatus(id: string): Promise<any> {
    const response = await apiClient.get(`/executions/${id}/status`);
    return response.data;
  }

  async getExecutionEvents(id: string, params?: {
    page?: number;
    page_size?: number;
    since_event_id?: number;
    event_type?: string;
  }): Promise<{
    events: any[];
    pagination: {
      page: number;
      page_size: number;
      total_events: number;
      total_pages: number;
      has_next: boolean;
      has_prev: boolean;
    };
  }> {
    // Get paginated events for incremental loading
    const response = await apiClient.get(`/executions/${id}`, { params });
    return {
      events: response.data.events || [],
      pagination: response.data.pagination || {
        page: 1,
        page_size: params?.page_size || 100,
        total_events: response.data.events?.length || 0,
        total_pages: 1,
        has_next: false,
        has_prev: false
      }
    };
  }

  async analyzeExecution(
    id: string,
    payload?: {
      max_events?: number;
      event_sample_size?: number;
      include_playbook_content?: boolean;
    },
  ): Promise<any> {
    const response = await apiClient.post(`/executions/${id}/analyze`, payload || {});
    return response.data;
  }

  async analyzeExecutionWithAI(
    id: string,
    payload?: {
      max_events?: number;
      event_sample_size?: number;
      include_playbook_content?: boolean;
      include_event_rows?: boolean;
      event_rows_limit?: number;
      include_event_log_rows?: boolean;
      event_log_rows_limit?: number;
      analysis_playbook_path?: string;
      gcp_auth_credential?: string;
      openai_secret_path?: string;
      model?: string;
      include_patch_diff?: boolean;
      auto_fix_mode?: "report" | "dry_run" | "apply";
      approval_required?: boolean;
      approved?: boolean;
      timeout_seconds?: number;
      poll_interval_ms?: number;
    },
  ): Promise<any> {
    const response = await apiClient.post(`/executions/${id}/analyze/ai`, payload || {});
    return response.data;
  }

  async explainPlaybookWithAI(
    payload: {
      catalog_id?: string;
      path?: string;
      version?: string | number;
      explanation_playbook_path?: string;
      gcp_auth_credential?: string;
      openai_secret_path?: string;
      model?: string;
      timeout_seconds?: number;
      poll_interval_ms?: number;
    },
  ): Promise<any> {
    const response = await apiClient.post("/catalog/playbooks/explain/ai", payload || {});
    return response.data;
  }

  async generatePlaybookWithAI(
    payload: {
      prompt: string;
      generator_playbook_path?: string;
      gcp_auth_credential?: string;
      openai_secret_path?: string;
      model?: string;
      timeout_seconds?: number;
      poll_interval_ms?: number;
    },
  ): Promise<any> {
    const response = await apiClient.post("/catalog/playbooks/generate/ai", payload);
    return response.data;
  }

  async executePlaybook(
    catalog_id: string,
    params?: any,
  ): Promise<ExecutionData> {
    // v2 engine now served under /api; keep path relative to API base
    const response = await apiClient.post(`/execute`, this.normalizeExecuteRequest({
      catalog_id,
      workload: params || {},
    }));
    return response.data;
  }

  async executePlaybookWithPayload(
    requestBody: any,
  ): Promise<{ execution_id: string }> {
    const response = await apiClient.post("/execute", this.normalizeExecuteRequest(requestBody));
    return response.data;
  }

  async rerunExecution(
    executionId: string,
    workload?: Record<string, any>,
  ): Promise<{ execution_id: string }> {
    const response = await apiClient.post(
      `/executions/${executionId}/rerun`,
      this.normalizeExecuteRequest({ workload: workload || {} }),
    );
    return response.data;
  }

  async stopExecution(id: string): Promise<void> {
    await apiClient.post(`/executions/${id}/stop`);
  }

  async cancelExecution(id: string, reason?: string, cascade: boolean = true): Promise<any> {
    const response = await apiClient.post(`/executions/${id}/cancel`, {
      reason,
      cascade
    });
    return response.data;
  }

  async getPlaybookContent(id: string): Promise<string | undefined> {
    try {
      const response = await apiClient.get(`/catalog/playbook/content`, {
        params: { playbook_id: id },
      });
      return response.data.content as string;
    } catch (e) {
      console.warn("API call failed for playbook content:", e);
    }
  }

  async savePlaybookContent(id: string, content: string): Promise<void> {
    await apiClient.put(`/catalog/playbook/content`, { content }, {
      params: { playbook_id: id },
    });
  }

  async validatePlaybook(
    content: string,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await apiClient.post("/catalog/playbooks/validate", {
      content,
    });
    return response.data;
  }

  async getPlaybookTestSuite(suiteId: string): Promise<{
    suite_id: string;
    file_path: string;
    playbook_path: string;
    tests: any[];
    metadata: Record<string, any>;
    updated_at: string;
  }> {
    const encoded = suiteId.split("/").map(encodeURIComponent).join("/");
    const response = await apiClient.get(`/playbook-tests/suites/${encoded}`);
    return response.data;
  }

  async savePlaybookTestSuite(
    suiteId: string,
    payload: {
      playbook_path: string;
      tests: any[];
      metadata?: Record<string, any>;
    },
  ): Promise<{
    suite_id: string;
    file_path: string;
    playbook_path: string;
    tests: any[];
    metadata: Record<string, any>;
    updated_at: string;
  }> {
    const encoded = suiteId.split("/").map(encodeURIComponent).join("/");
    const response = await apiClient.put(`/playbook-tests/suites/${encoded}`, {
      playbook_path: payload.playbook_path,
      tests: payload.tests || [],
      metadata: payload.metadata || {},
    });
    return response.data;
  }

  async deletePlaybookTestSuite(suiteId: string): Promise<{ status: string; suite_id: string; file_path: string }> {
    const encoded = suiteId.split("/").map(encodeURIComponent).join("/");
    const response = await apiClient.delete(`/playbook-tests/suites/${encoded}`);
    return response.data;
  }

  async searchPlaybooks(query: string): Promise<PlaybookData[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.getPlaybooks();
    }

    // Backend does not expose /catalog/playbooks/search in gateway mode.
    // Use catalog/list and filter client-side to avoid noisy 404s.
    const response = await apiClient.post("/catalog/list", {
      resource_type: "Playbook",
    });
    const entries: PlaybookData[] = response.data.entries || [];

    for (const entry of entries) {
      entry.status = entry.status || "active";
    }

    return entries.filter((playbook) => {
      const path = (playbook.path || "").toLowerCase();
      const description = (playbook.payload?.metadata?.description || "").toLowerCase();
      const name = (playbook.payload?.metadata?.name || "").toLowerCase();
      return path.includes(q) || description.includes(q) || name.includes(q);
    });
  }

  async getCredentials(type?: string): Promise<CredentialData[]> {
    const params: any = {};
    if (type) {
      params.type = type;
    }
    const response = await apiClient.get("/credentials", { params });
    return response.data.items || [];
  }

  async getCredential(identifier: string, includeData: boolean = false): Promise<CredentialData> {
    const response = await apiClient.get(`/credentials/${identifier}`, {
      params: { include_data: includeData }
    });
    return response.data;
  }

  async searchCredentials(query: string): Promise<CredentialData[]> {
    const response = await apiClient.get("/credentials", {
      params: { q: query }
    });
    return response.data.items || [];
  }

  async createOrUpdateCredential(data: any): Promise<CredentialData> {
    const response = await apiClient.post("/credentials", data);
    return response.data;
  }

  async deleteCredential(identifier: string): Promise<void> {
    await apiClient.delete(`/credentials/${identifier}`);
  }
}

export const apiService = new APIService();
export default apiService;
