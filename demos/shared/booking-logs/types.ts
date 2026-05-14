/**
 * Booking-Logs Demo — shared types.
 *
 * Represents a single API access-log entry for a fictional travel-agency
 * booking platform. The schema is shaped to look like a record you'd see
 * in Kibana / Datadog / Splunk — timestamp, trace ID, level, HTTP details,
 * service & region, and an optional error message.
 */

/** Severity level. Distribution skews heavily toward INFO/DEBUG. */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** HTTP method. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A single log entry as returned by the dev API. */
export interface BookingLogEntry {
  /** Stable row index in the deterministic dataset (NOT visible in UI; useful for parity tests). */
  id: number;
  /** ISO-8601 timestamp string. Newest entries have row index 0. */
  timestamp: string;
  /** Hex trace ID (16 chars), looks like an OpenTelemetry trace ID. */
  traceId: string;
  /**
   * Hex span ID (16 chars). Unique per row. Spans that share a `traceId`
   * model the cascade of internal service calls that handled one external
   * request — e.g. `booking-api → payments → notifications` — and form
   * the tree shown by the demo's “View trace” action.
   */
  spanId: string;
  /**
   * Span ID of the parent span, or `null` for the root span of a trace.
   * Used to render the trace as a tree / waterfall.
   */
  parentSpanId: string | null;
  /** Severity level. */
  level: LogLevel;
  /** HTTP method. */
  method: HttpMethod;
  /** Request path with parameters substituted (e.g. `/bookings/BK-12345`). */
  endpoint: string;
  /** HTTP response status code. */
  statusCode: number;
  /** Response duration in milliseconds. */
  durationMs: number;
  /** Logical service that handled the request. */
  service: string;
  /** Cloud region. */
  region: string;
  /** Customer ID associated with the request, or `null` for unauthenticated calls. */
  customerId: string | null;
  /** Booking reference if relevant to the endpoint, otherwise `null`. */
  bookingRef: string | null;
  /** Originating client IP (IPv4 string). */
  clientIp: string;
  /** Truncated user-agent string. */
  userAgent: string;
  /** Human-readable error message — populated only when `level === 'ERROR'`. */
  errorMessage: string | null;
}

// #region Query model (server-side plugin → /api/logs query string)

/** Sort directions supported by the dev API. Only the `timestamp` field is sortable. */
export type SortDirection = 'asc' | 'desc';

/**
 * Query parameters accepted by `GET /api/logs`. All filters are AND-combined.
 *
 * - Multi-value filters (level / service / region / method) accept
 *   comma-separated values and match if the row matches any of them.
 * - `endpointContains` does a case-insensitive substring match on the path.
 * - `statusCodeMin` / `statusCodeMax` form an inclusive numeric range.
 * - `tsFrom` / `tsTo` form an inclusive timestamp range (ms since epoch).
 * - `traceId` does an exact match.
 */
export interface BookingLogsQuery {
  start: number;
  end: number;
  sort?: SortDirection;
  level?: LogLevel[];
  service?: string[];
  region?: string[];
  method?: HttpMethod[];
  statusCodeMin?: number;
  statusCodeMax?: number;
  /** Inclusive lower bound on `timestamp` (ms since epoch). */
  tsFrom?: number;
  /** Inclusive upper bound on `timestamp` (ms since epoch). */
  tsTo?: number;
  endpointContains?: string;
  traceId?: string;
}

/**
 * Server response. `totalNodeCount` reflects three states:
 *
 * - **Unfiltered query:** `DATASET_SIZE` (the grid renders a finite scrollbar).
 * - **Filtered, scan in flight:** `-1` (“unknown”) — the server-side plugin
 *   treats this as infinite scroll and keeps requesting more blocks. The
 *   honest progress is reported via {@link scanProgress}.
 * - **Filtered, scan complete:** the exact match count. `lastNode` is also
 *   set to `count - 1` so the grid stops requesting further blocks. (The
 *   plugin is fine with `totalNodeCount` switching from `-1` to a concrete
 *   number on the final response.)
 *
 * `scanProgress` is supplied for filtered queries so consumers can render an
 * honest progress indicator while the lazy scan is still in flight (the
 * exact filtered total isn't known until `scannedRows === DATASET_SIZE`).
 * Omitted for unfiltered queries because `totalNodeCount` already gives the
 * full answer.
 */
export interface BookingLogsResponse {
  rows: BookingLogEntry[];
  totalNodeCount: number;
  lastNode?: number;
  scanProgress?: BookingLogsScanProgress;
}

/**
 * Progress of the server-side filter scan over the 10M-row dataset.
 *
 * - `matchedSoFar` — number of rows that have matched the predicate up to
 *   this point. A lower bound on the eventual filtered total.
 * - `scannedRows` — how far through the dataset the scan has walked.
 * - `datasetSize` — total dataset size (echoed for convenience so consumers
 *   don't have to import the constant).
 */
export interface BookingLogsScanProgress {
  matchedSoFar: number;
  scannedRows: number;
  datasetSize: number;
}

// #endregion
