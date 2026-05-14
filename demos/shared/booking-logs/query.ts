/**
 * Query engine for the deterministic booking-logs dataset.
 *
 * The dataset is virtual — rows are produced by {@link generateRow} on demand.
 * For an unfiltered query we answer in O(limit): the row at filtered position
 * `i` is just `generateRow(i)`. For a filtered query we have to scan and skip
 * non-matching rows; we cache the discovered match indices per filter key so
 * repeated paged requests during a scroll don't re-scan from zero.
 *
 * Sort order is fixed to **newest-first** (descending timestamp). Real log
 * viewers (Kibana, Datadog, Splunk) all default to this and rarely offer
 * ascending across multi-million-row datasets — so the timestamp column in
 * the demo grid is rendered as non-sortable. Keeping the contract one-way
 * also keeps this file boring and predictable.
 */

import { DATASET_SIZE, generateRow, NEWEST_TIMESTAMP_MS, ROW_INTERVAL_MS } from './generator';
import type { BookingLogEntry, BookingLogsQuery, BookingLogsResponse } from './types';

/** Hard cap on rows scanned per request — bounds worst-case latency. */
const MAX_SCAN_PER_REQUEST = 500_000;

/**
 * Per-row timestamp jitter is ±20 ms (see {@link generateRow}). When deriving
 * row-index bounds from a `tsFrom`/`tsTo` filter we widen the window by this
 * margin so we don't accidentally skip a matching row that fell on the
 * “wrong” side of its nominal bucket.
 */
const TIMESTAMP_JITTER_MARGIN_MS = 32;

interface FilterPredicate {
  (entry: BookingLogEntry): boolean;
}

/** Cache of `filterKey → array of underlying row indices that match`. */
const matchCache = new Map<string, number[]>();
/** For each filter key: how far we've already scanned in the underlying dataset. */
const scanCursor = new Map<string, number>();

function buildPredicate(q: BookingLogsQuery): FilterPredicate | null {
  const checks: FilterPredicate[] = [];

  // For the four allow-list fields below, an explicit empty array means
  // “match no rows” (the user excluded every value of a set filter). Building
  // a `Set` from `[]` and calling `.has(...)` returns `false` for every row,
  // so we don't need a special case — just drop the `length > 0` guard so
  // the empty-array predicate is registered.
  if (q.level !== undefined) {
    const set = new Set(q.level);
    checks.push((e) => set.has(e.level));
  }
  if (q.service !== undefined) {
    const set = new Set(q.service);
    checks.push((e) => set.has(e.service));
  }
  if (q.region !== undefined) {
    const set = new Set(q.region);
    checks.push((e) => set.has(e.region));
  }
  if (q.method !== undefined) {
    const set = new Set(q.method);
    checks.push((e) => set.has(e.method));
  }
  if (typeof q.statusCodeMin === 'number') {
    const min = q.statusCodeMin;
    checks.push((e) => e.statusCode >= min);
  }
  if (typeof q.statusCodeMax === 'number') {
    const max = q.statusCodeMax;
    checks.push((e) => e.statusCode <= max);
  }
  if (typeof q.tsFrom === 'number') {
    const from = q.tsFrom;
    checks.push((e) => Date.parse(e.timestamp) >= from);
  }
  if (typeof q.tsTo === 'number') {
    const to = q.tsTo;
    checks.push((e) => Date.parse(e.timestamp) <= to);
  }
  if (q.endpointContains) {
    const needle = q.endpointContains.toLowerCase();
    checks.push((e) => e.endpoint.toLowerCase().includes(needle));
  }
  if (q.traceId) {
    const id = q.traceId.toLowerCase();
    checks.push((e) => e.traceId === id);
  }

  if (checks.length === 0) return null;
  if (checks.length === 1) return checks[0];
  return (e) => {
    for (const c of checks) if (!c(e)) return false;
    return true;
  };
}

/** Stable cache key across query objects with equivalent filters. */
function cacheKey(q: BookingLogsQuery): string {
  const parts: string[] = [];
  const arr = (key: string, v?: readonly string[]) => {
    if (v && v.length) parts.push(`${key}:${[...v].sort().join(',')}`);
  };
  arr('level', q.level);
  arr('service', q.service);
  arr('region', q.region);
  arr('method', q.method);
  if (typeof q.statusCodeMin === 'number') parts.push(`smin:${q.statusCodeMin}`);
  if (typeof q.statusCodeMax === 'number') parts.push(`smax:${q.statusCodeMax}`);
  if (typeof q.tsFrom === 'number') parts.push(`tsf:${q.tsFrom}`);
  if (typeof q.tsTo === 'number') parts.push(`tst:${q.tsTo}`);
  if (q.endpointContains) parts.push(`ep:${q.endpointContains.toLowerCase()}`);
  if (q.traceId) parts.push(`tid:${q.traceId.toLowerCase()}`);
  return parts.join('|');
}

/**
 * Translate a filtered position → underlying row index, scanning lazily.
 * Returns the underlying index, or `-1` once the dataset is exhausted.
 *
 * `scanStart` and `scanLimit` are optional inclusive/exclusive bounds on the
 * underlying row index range that needs to be scanned. They let callers
 * skip large prefixes of the dataset when a filter constrains the matching
 * rows to a known sub-range — e.g. a `tsFrom`/`tsTo` filter combined with
 * the dataset's monotone-descending timestamps.
 */
function indexOfFilteredPosition(
  pos: number,
  predicate: FilterPredicate,
  key: string,
  scanStart: number,
  scanLimit: number,
): number {
  let matches = matchCache.get(key);
  if (!matches) {
    matches = [];
    matchCache.set(key, matches);
    scanCursor.set(key, scanStart);
  }
  if (pos < matches.length) return matches[pos];

  let cursor = Math.max(scanCursor.get(key) ?? scanStart, scanStart);
  let scanned = 0;
  while (matches.length <= pos && cursor < scanLimit && scanned < MAX_SCAN_PER_REQUEST) {
    const row = generateRow(cursor);
    if (predicate(row)) matches.push(cursor);
    cursor++;
    scanned++;
  }
  scanCursor.set(key, cursor);
  return pos < matches.length ? matches[pos] : -1;
}

/**
 * Compute `[scanStart, scanLimit)` underlying-row bounds implied by `tsFrom`
 * / `tsTo`. Exploits the dataset's monotone-descending timestamps:
 * `timestamp(i) ≈ NEWEST_TIMESTAMP_MS - i * ROW_INTERVAL_MS`. The bounds are
 * widened by {@link TIMESTAMP_JITTER_MARGIN_MS} so the per-row jitter
 * doesn't push a matching row out of the window.
 */
function scanBoundsFromTimeRange(q: BookingLogsQuery): { start: number; limit: number } {
  let start = 0;
  let limit = DATASET_SIZE;
  if (typeof q.tsTo === 'number') {
    // Newest matching row: the one whose timestamp is just ≤ tsTo. Lower row
    // indices are *newer* and might still match because of jitter — widen.
    const idx = Math.floor((NEWEST_TIMESTAMP_MS - q.tsTo - TIMESTAMP_JITTER_MARGIN_MS) / ROW_INTERVAL_MS);
    start = Math.max(start, Math.min(DATASET_SIZE, idx));
  }
  if (typeof q.tsFrom === 'number') {
    // Oldest matching row: just ≥ tsFrom. Higher row indices are *older*.
    const idx = Math.ceil((NEWEST_TIMESTAMP_MS - q.tsFrom + TIMESTAMP_JITTER_MARGIN_MS) / ROW_INTERVAL_MS) + 1;
    limit = Math.min(limit, Math.max(0, idx));
  }
  if (start > limit) start = limit;
  return { start, limit };
}

/**
 * Execute a query and return the response payload.
 *
 * - **No filter:** `totalNodeCount = DATASET_SIZE` (finite scrollbar).
 * - **With filter, scan in flight:** `totalNodeCount = -1` (infinite scroll);
 *   the grid keeps requesting blocks until either no more matches are
 *   returned or the scan completes.
 * - **With filter, scan complete:** `totalNodeCount = matchedCount` AND
 *   `lastNode = matchedCount - 1`. The exact total is now known so the
 *   scrollbar can become finite for the final response.
 */
export function queryLogs(q: BookingLogsQuery): BookingLogsResponse {
  const start = Math.max(0, Math.min(DATASET_SIZE, q.start));
  const end = Math.max(start, Math.min(DATASET_SIZE, q.end));
  const predicate = buildPredicate(q);

  // Fast path: no filter → direct index lookup.
  if (!predicate) {
    const rows: BookingLogEntry[] = [];
    for (let pos = start; pos < end; pos++) rows.push(generateRow(pos));
    return { rows, totalNodeCount: DATASET_SIZE };
  }

  // Filtered path: scan + cache.
  const key = cacheKey(q);
  const { start: scanStart, limit: scanLimit } = scanBoundsFromTimeRange(q);
  const rows: BookingLogEntry[] = [];
  let exhausted = false;
  for (let pos = start; pos < end; pos++) {
    const underlying = indexOfFilteredPosition(pos, predicate, key, scanStart, scanLimit);
    if (underlying === -1) {
      exhausted = true;
      break;
    }
    rows.push(generateRow(underlying));
  }

  const cursor = scanCursor.get(key) ?? scanStart;
  const matched = matchCache.get(key)?.length ?? 0;
  const fullyScanned = cursor >= scanLimit;
  const scanProgress = {
    matchedSoFar: matched,
    // Report progress relative to the actual scan window, not the full
    // dataset — otherwise a date filter that already restricts scanning to
    // a 1% slice of the dataset would always look like “1% scanned” at
    // 100% completion. Subtract the prefix we skipped.
    scannedRows: Math.min(cursor, scanLimit) - scanStart,
    datasetSize: scanLimit - scanStart,
  };
  if (exhausted || fullyScanned) {
    return { rows, totalNodeCount: matched, lastNode: matched - 1, scanProgress };
  }
  return { rows, totalNodeCount: -1, scanProgress };
}

/** Drop all cached match-index arrays. Called by the Vite plugin on HMR. */
export function resetQueryCache(): void {
  matchCache.clear();
  scanCursor.clear();
}
