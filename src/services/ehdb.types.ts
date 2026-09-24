/**
 * EHDB read-model types.
 *
 * These mirror what `GET /api/ehdb/*` ACTUALLY returns on the running server,
 * captured from prod on 2026-09-24 rather than inferred from handler source.
 * The API is read-only by construction: `/api/ehdb` reports
 * `"read_only": true` and describes itself as a
 * "Read-only query API over NoETL platform read-model data".
 *
 * Two tiers answer these routes, and the distinction matters when a number
 * looks wrong:
 *   - `projection` — derived read-model (executions and their events)
 *   - `eventlog`   — the append-only event log, scanned by global sequence
 */

/** One entry of the self-describing index at `GET /api/ehdb`. */
export interface EhdbEndpointDoc {
  method: string;
  path: string;
  desc: string;
  /** "direct" = served by the server; "relayed" = proxied to the worker data-plane. */
  serves: string;
  tier: string;
}

export interface EhdbIndex {
  action: string;
  service: string;
  description: string;
  read_only: boolean;
  control_plane: boolean;
  endpoints: EhdbEndpointDoc[];
  tiers: Record<string, string>;
}

/** Row from `GET /api/ehdb/executions` (tier: projection). */
export interface EhdbExecution {
  execution_id: string;
  parent_execution_id: string | null;
  catalog_id: string | null;
  path: string | null;
  status: string | null;
  /** Null while the execution is still running. */
  completed_at: string | null;
  started_at: string | null;
  current_node: string | null;
  event_count: number | null;
  /**
   * Server's own verdict on whether this execution has finished. Prefer it
   * over comparing `status` against a hand-maintained list of terminal
   * strings — the server owns that definition.
   */
  terminal: boolean | null;
}

export interface EhdbExecutionsPage {
  action: string;
  tier: string;
  executions: EhdbExecution[];
  limit: number;
  offset: number;
  returned: number;
}

/** Row from `GET /api/ehdb/events` and `/api/ehdb/executions/{id}/events`. */
export interface EhdbEvent {
  event_id: string;
  execution_id: string | null;
  event_type: string | null;
  node_name: string | null;
  status: string | null;
  created_at: string | null;
}

export interface EhdbEventsPage {
  action: string;
  tier: string;
  events: EhdbEvent[];
  limit: number;
  returned: number;
  /**
   * ⚠ Send this back as `after=`, NOT `cursor=`, despite the field name.
   * The handler only accepts `after`; a `cursor` param is silently ignored
   * and you re-read page one forever. Absent/null means end of scan.
   */
  next_cursor?: string | null;
}
