/**
 * Deterministic booking-logs generator.
 *
 * `generateRow(i)` is a pure function of `i`: it always returns the exact
 * same {@link BookingLogEntry} for the same row index. No row is ever
 * stored — the dataset is virtual, materialized on demand for the requested
 * slice. This is what makes a 10-million-row demo feasible without a
 * gigabyte of RAM (and what makes parity e2e tests possible).
 *
 * Row 0 is the **newest** entry; row `DATASET_SIZE - 1` is the oldest.
 */

import { mulberry32, pick, pickWeighted, randInt } from './prng';
import type { BookingLogEntry, HttpMethod } from './types';
import {
  ENDPOINTS,
  ERROR_MESSAGES,
  LEVELS,
  LEVEL_WEIGHTS,
  METHODS,
  METHOD_WEIGHTS,
  REGIONS,
  SERVICES,
  SERVICE_BASE_LATENCY,
  STATUS_CODES,
  STATUS_WEIGHTS,
  USER_AGENTS,
} from './vocab';

/** Master seed. Change this and the entire dataset shifts. */
export const SEED = 0xb007_104a;

/** Total rows in the virtual dataset. */
export const DATASET_SIZE = 10_000_000;

/**
 * Spacing between adjacent rows on the timeline (newer → older).
 */
export const ROW_INTERVAL_MS = 80;

/**
 * Rows per interleave block. Variable-length traces are packed into blocks
 * of this size; the per-block trace plan ({@link getBlockPlan}) is
 * cached so per-row lookup stays O(1).
 *
 * 1024 rows ≈ 82 s of activity at 80 ms/row — large enough that even the
 * longest traces (30 spans) fit comfortably without crossing a block
 * boundary, while keeping the linear permutation modulus a power of two.
 */
export const TRACE_BLOCK_SIZE = 1024;

/**
 * Encoding base for `traceKey = block * MAX_TRACES_PER_BLOCK + traceIdxInBlock`.
 * Must be ≥ maximum traces a block could ever contain (which is
 * `TRACE_BLOCK_SIZE` if every trace was length 1). Realistic average is
 * ~110 traces/block at avg span length ~9.
 */
export const MAX_TRACES_PER_BLOCK = TRACE_BLOCK_SIZE;

/** Hard cap on per-trace span count. Matches the upper end of the length distribution. */
export const MAX_SPANS_PER_TRACE = 30;

/**
 * Multiplier used by the linear permutation that scatters spans within a
 * block: `σ(x) = (a·x + blockShift) mod TRACE_BLOCK_SIZE`. `a` must be
 * coprime to TRACE_BLOCK_SIZE (1024 = 2¹⁰), so any odd value works. 37
 * spaces a trace's spans 37 physical rows apart in the worst case (when
 * blockShift = 0), so even a 30-span trace fans out across the whole
 * block without piling up.
 */
const TRACE_PERMUTE_A = 37;
/** Modular inverse of {@link TRACE_PERMUTE_A} mod {@link TRACE_BLOCK_SIZE}. 37 × 941 = 34_817 ≡ 1 (mod 1024). */
const TRACE_PERMUTE_A_INV = 941;
/** `& PERM_MASK` is the same as `mod TRACE_BLOCK_SIZE` because TRACE_BLOCK_SIZE is a power of two. */
const PERM_MASK = TRACE_BLOCK_SIZE - 1;

/**
 * Anchor timestamp for row 0. Pinned to a fixed instant so every framework
 * sees the same string for the same row, regardless of when the demo runs.
 */
export const NEWEST_TIMESTAMP_MS = Date.UTC(2026, 4, 1, 12, 0, 0); // 2026-05-01T12:00:00Z

// #region PRNG slots
// One PRNG per "slot" within a row. Picking a different slot per attribute
// avoids correlation artifacts (e.g. same-row method and status both peaking
// together because they share the same random draw).
//
// PRNGs prefixed with `trace*` are keyed by the *trace number* (not the row
// index), so every span of a trace draws the same value. This models real
// load-balancer / session affinity: all four spans of one user's flow share
// the same client IP, user-agent, customer ID, region, and (when applicable)
// booking reference. Without this, a 4-span trace would visibly hop across
// 4 regions / 4 IPs / 4 user-agents — nothing like a real production trace.
const r = {
  level: mulberry32(SEED ^ 0x1111_1111),
  method: mulberry32(SEED ^ 0x2222_2222),
  service: mulberry32(SEED ^ 0x3333_3333),
  endpoint: mulberry32(SEED ^ 0x4444_4444),
  status: mulberry32(SEED ^ 0x6666_6666),
  duration: mulberry32(SEED ^ 0x7777_7777),
  span: mulberry32(SEED ^ 0xcccc_eeee),
  errMsg: mulberry32(SEED ^ 0xdddd_dddd),
  jitter: mulberry32(SEED ^ 0xeeee_eeee),
  trace: mulberry32(SEED ^ 0xcccc_cccc),
  traceLength: mulberry32(SEED ^ 0x7e57_1e76),
  // Trace-scoped (keyed by trace key, not row index).
  traceRegion: mulberry32(SEED ^ 0xfeed_face),
  traceRegionAlt: mulberry32(SEED ^ 0xbeef_cafe),
  traceFailover: mulberry32(SEED ^ 0xface_feed),
  traceCustomerPresence: mulberry32(SEED ^ 0x8888_8888),
  traceCustomerId: mulberry32(SEED ^ 0xc0de_d00d),
  traceIp: mulberry32(SEED ^ 0xaaaa_aaaa),
  traceUa: mulberry32(SEED ^ 0xbbbb_bbbb),
  traceBookingPresence: mulberry32(SEED ^ 0x9999_9999),
  traceBookingRef: mulberry32(SEED ^ 0xb00b_fade),
} as const;

/** ~5% of traces fail over to an alternate region partway through. */
const TRACE_FAILOVER_RATE = 0.05;
// #endregion

// #region Helpers
/** Hex chars used for trace-ID generation. */
const HEX = '0123456789abcdef';

function makeTraceId(traceKey: number): string {
  // Two PRNG draws → 16 hex chars. Plenty of variety for 10M rows.
  const a = Math.floor(r.trace(traceKey) * 0xffff_ffff) >>> 0;
  const b = Math.floor(r.trace(traceKey + DATASET_SIZE) * 0xffff_ffff) >>> 0;
  let out = '';
  for (let k = 0; k < 8; k++) out += HEX[(a >>> (k * 4)) & 0xf];
  for (let k = 0; k < 8; k++) out += HEX[(b >>> (k * 4)) & 0xf];
  return out;
}

/** Per-row span ID, distinct from `traceId`. Same hex shape (16 chars). */
function makeSpanId(i: number): string {
  const a = Math.floor(r.span(i) * 0xffff_ffff) >>> 0;
  const b = Math.floor(r.span(i + DATASET_SIZE) * 0xffff_ffff) >>> 0;
  let out = '';
  for (let k = 0; k < 8; k++) out += HEX[(a >>> (k * 4)) & 0xf];
  for (let k = 0; k < 8; k++) out += HEX[(b >>> (k * 4)) & 0xf];
  return out;
}

/**
 * Sample a trace length (in spans) from a four-bucket distribution that
 * mirrors real web-app session shapes:
 *
 * | bucket    | weight | range  | mean   |
 * | --------- | -----: | -----: | -----: |
 * | quick     |   30 % |   3-4  |   3.5  |
 * | typical   |   40 % |   5-9  |   7    |
 * | deep      |   20 % | 10-19  |  14.5  |
 * | extended  |   10 % | 20-30  |  25    |
 *
 * Overall mean ≈ 9.25 spans/trace, so a 1024-row block contains ~110
 * traces on average. Distribution boundaries align with the input domain
 * `[0, 1)`; `Math.floor` of `(u - bucketStart) / bucketWidth * range`
 * cannot exceed `range - 1` for `u < bucketEnd`.
 */
function sampleTraceLength(u: number): number {
  if (u < 0.3) return 3 + Math.floor((u / 0.3) * 2); // 3..4
  if (u < 0.7) return 5 + Math.floor(((u - 0.3) / 0.4) * 5); // 5..9
  if (u < 0.9) return 10 + Math.floor(((u - 0.7) / 0.2) * 10); // 10..19
  return 20 + Math.floor(((u - 0.9) / 0.1) * 11); // 20..30
}

/**
 * Per-block trace layout. Built once per block on first access (see
 * {@link getBlockPlan}) and cached forever. ~3 kB per block; a hot
 * working set of 2000 blocks would consume ~6 MB.
 */
interface BlockPlan {
  /** For each *logical* slot in the block, which trace index it belongs to. */
  readonly logicalTraceIdx: Uint16Array;
  /** For each *logical* slot in the block, which span index within that trace. */
  readonly logicalSpanIdx: Uint8Array;
  /** For each trace (indexed by `traceIdxInBlock`), the logical position of its first span. */
  readonly traceStartLogical: Uint16Array;
  /** For each trace, total number of spans (3..MAX_SPANS_PER_TRACE; possibly truncated to fit the block). */
  readonly traceLength: Uint8Array;
  /** Number of distinct traces packed into this block. */
  readonly traceCount: number;
}

/** Cache of computed block plans. Unbounded — see size note on {@link BlockPlan}. */
const blockPlanCache = new Map<number, BlockPlan>();

/**
 * Build (or fetch) the trace plan for a given block. Pure function of `block`:
 * the same input always yields byte-identical output, so all clients see the
 * same trace structure regardless of access order.
 *
 * Algorithm: sample trace lengths greedily until the block is full. The
 * final trace is truncated to fit (“the time-window edge cut off the user’s
 * session”). Every span gets a unique `(traceIdxInBlock, spanIndex)`.
 */
function getBlockPlan(block: number): BlockPlan {
  const cached = blockPlanCache.get(block);
  if (cached) return cached;
  const logicalTraceIdx = new Uint16Array(TRACE_BLOCK_SIZE);
  const logicalSpanIdx = new Uint8Array(TRACE_BLOCK_SIZE);
  const starts: number[] = [];
  const lengths: number[] = [];
  let cursor = 0;
  let traceIdx = 0;
  while (cursor < TRACE_BLOCK_SIZE) {
    const seed = block * MAX_TRACES_PER_BLOCK + traceIdx;
    let len = sampleTraceLength(r.traceLength(seed));
    if (cursor + len > TRACE_BLOCK_SIZE) len = TRACE_BLOCK_SIZE - cursor;
    starts.push(cursor);
    lengths.push(len);
    for (let s = 0; s < len; s++) {
      logicalTraceIdx[cursor + s] = traceIdx;
      logicalSpanIdx[cursor + s] = s;
    }
    cursor += len;
    traceIdx++;
  }
  const plan: BlockPlan = {
    logicalTraceIdx,
    logicalSpanIdx,
    traceStartLogical: new Uint16Array(starts),
    traceLength: new Uint8Array(lengths),
    traceCount: traceIdx,
  };
  blockPlanCache.set(block, plan);
  return plan;
}

/**
 * Per-row trace assignment.
 *
 * Each row belongs to exactly one trace. Within a {@link TRACE_BLOCK_SIZE}-row
 * block, spans are scattered by a linear permutation `σ(x) = (a·x + b) mod N`,
 * which is invertible — so we can recover the *root row* of any trace in O(1)
 * for `parentSpanId` derivation. The block's *trace plan* (a deterministic
 * slicing of the block's logical 0..1023 axis into variable-length traces)
 * is computed lazily and cached in {@link blockPlanCache}.
 *
 * Lookup chain:
 *   posInBlock = i mod TRACE_BLOCK_SIZE
 *   logical    = σ⁻¹(posInBlock)             // physical → logical
 *   plan       = getBlockPlan(block)
 *   traceIdx   = plan.logicalTraceIdx[logical]
 *   spanIndex  = plan.logicalSpanIdx[logical]
 *   rootRow    = block * TRACE_BLOCK_SIZE + σ(plan.traceStartLogical[traceIdx])
 */
function traceLayoutForRow(i: number): {
  traceKey: number;
  spanIndex: number;
  traceLength: number;
  rootRow: number;
} {
  const block = Math.floor(i / TRACE_BLOCK_SIZE);
  const posInBlock = i - block * TRACE_BLOCK_SIZE;
  // Per-block offset folded into the permutation so adjacent blocks don't
  // share an obvious phase. 91 is odd → the shift cycles through every
  // residue class as `block` increments.
  const blockShift = (block * 91) & PERM_MASK;
  // σ⁻¹(y) = a⁻¹ · (y − b) (mod TRACE_BLOCK_SIZE).
  const logical = (TRACE_PERMUTE_A_INV * (posInBlock - blockShift + TRACE_BLOCK_SIZE)) & PERM_MASK;
  const plan = getBlockPlan(block);
  const traceIdxInBlock = plan.logicalTraceIdx[logical];
  const spanIndex = plan.logicalSpanIdx[logical];
  const traceLength = plan.traceLength[traceIdxInBlock];
  const rootLogical = plan.traceStartLogical[traceIdxInBlock];
  const rootPosInBlock = (TRACE_PERMUTE_A * rootLogical + blockShift) & PERM_MASK;
  const rootRow = block * TRACE_BLOCK_SIZE + rootPosInBlock;
  const traceKey = block * MAX_TRACES_PER_BLOCK + traceIdxInBlock;
  return { traceKey, spanIndex, traceLength, rootRow };
}

function makeIp(seed: number): string {
  const x = Math.floor(r.traceIp(seed) * 0xffff_ffff) >>> 0;
  // Force first octet into a non-reserved range so the strings look realistic.
  const a = 16 + ((x >>> 24) & 0xdf); // 16-239
  const b = (x >>> 16) & 0xff;
  const c = (x >>> 8) & 0xff;
  const d = x & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

function substituteEndpoint(template: string, i: number): string {
  if (template.indexOf('{') === -1) return template;
  return template
    .replace('{id}', String(10_000 + (Math.floor(r.endpoint(i + 1) * 90_000) % 90_000)))
    .replace('{ref}', `BK-${String(100_000 + (Math.floor(r.endpoint(i + 2) * 900_000) % 900_000))}`);
}
// #endregion

// #region Public API
/**
 * Pure: row index → log entry.
 */
export function generateRow(i: number): BookingLogEntry {
  const level = LEVELS[pickWeighted(r.level(i), LEVEL_WEIGHTS)];
  const method = METHODS[pickWeighted(r.method(i), METHOD_WEIGHTS)] as HttpMethod;
  const service = pick(r.service(i), SERVICES);
  const endpointTemplate = pick(r.endpoint(i), ENDPOINTS[service]);
  const endpoint = substituteEndpoint(endpointTemplate, i);

  // Trace assignment first — several attributes below are derived from the
  // trace key rather than the row index so every span of a trace shares
  // them. See PRNG block at the top of this file.
  //
  // Consecutive rows almost always belong to *different* traces, modeling
  // many concurrent users. A trace's spans (variable: 3..30) are scattered
  // across a 1024-row block (~82 s of activity at 80 ms/row) by a linear
  // permutation. The "root" span is the one with `spanIndex === 0`; siblings
  // parent to it. Because row 0 is the *newest* entry, the root may appear
  // either earlier or later than its children in the grid — exactly like
  // real log viewers, where a trace's root is wherever it happens to land
  // in the time stream.
  const layout = traceLayoutForRow(i);
  const traceKey = layout.traceKey;
  const traceId = makeTraceId(traceKey);
  const spanId = makeSpanId(i);
  const parentSpanId = layout.spanIndex === 0 ? null : makeSpanId(layout.rootRow);

  // Region: sticky to the trace (load-balancer affinity). ~5% of traces
  // fail over to an alternate region at a deterministic span boundary,
  // simulating regional degradation / canary rollback. We pick the
  // alternate by index rotation so it's always *different* from the primary.
  const primaryRegionIdx = Math.floor(r.traceRegion(traceKey) * REGIONS.length) % REGIONS.length;
  const primaryRegion = REGIONS[primaryRegionIdx];
  // Failover requires at least 2 spans (one before, one after the boundary).
  const hasFailover = layout.traceLength >= 2 && r.traceFailover(traceKey) < TRACE_FAILOVER_RATE;
  let region = primaryRegion;
  if (hasFailover) {
    // failoverAt ∈ [1, traceLength - 1]: at least one primary span, at
    // least one post-failover span.
    const failoverAt =
      1 + (Math.floor(r.traceFailover(traceKey + DATASET_SIZE) * (layout.traceLength - 1)) % (layout.traceLength - 1));
    if (layout.spanIndex >= failoverAt) {
      const offset = 1 + (Math.floor(r.traceRegionAlt(traceKey) * (REGIONS.length - 1)) % (REGIONS.length - 1));
      region = REGIONS[(primaryRegionIdx + offset) % REGIONS.length];
    }
  }

  // Status: errors lean toward 4xx/5xx, info/debug toward 2xx/3xx.
  let statusCode: number;
  if (level === 'ERROR') {
    // Pick from 5xx and 4xx only.
    const errCodes = STATUS_CODES.filter((c) => c >= 400);
    const errWeights = STATUS_WEIGHTS.slice(STATUS_CODES.length - errCodes.length);
    statusCode = errCodes[pickWeighted(r.status(i), errWeights)];
  } else if (level === 'WARN') {
    // 4xx-heavy.
    const warnCodes = STATUS_CODES.filter((c) => c >= 400 && c < 500);
    const warnWeights = warnCodes.map(() => 1);
    statusCode = warnCodes[pickWeighted(r.status(i), warnWeights)];
  } else {
    // 2xx/3xx.
    const okCodes = STATUS_CODES.filter((c) => c < 400);
    const okWeights = STATUS_WEIGHTS.slice(0, okCodes.length);
    statusCode = okCodes[pickWeighted(r.status(i), okWeights)];
  }

  // Duration: base latency per service + log-normal-ish jitter, fatter tail for errors.
  const base = SERVICE_BASE_LATENCY[service];
  const jitter = r.duration(i);
  const tail = level === 'ERROR' ? 6 : level === 'WARN' ? 3 : 1.6;
  const durationMs = Math.max(1, Math.round(base * (0.4 + jitter * jitter * tail)));

  // Customer ID: sticky per trace (one user = one customer for the whole
  // session). ~12% of traces are anonymous traffic.
  const customerId =
    r.traceCustomerPresence(traceKey) < 0.12
      ? null
      : `CUS-${String(100_000 + randInt(r.traceCustomerId(traceKey), 900_000))}`;

  // Booking ref: also trace-scoped — a user's session usually concerns one
  // booking. Only present on booking/payments spans, and only if the trace
  // has a booking ref to begin with (~75% of traces with booking flow do).
  const traceHasBookingRef = r.traceBookingPresence(traceKey) < 0.75;
  const hasBookingRef = (service === 'booking-api' || service === 'payments') && traceHasBookingRef;
  const bookingRef = hasBookingRef ? `BK-${String(100_000 + randInt(r.traceBookingRef(traceKey), 900_000))}` : null;

  // Timestamp: row 0 newest, monotone descending in row index. Tiny per-row
  // jitter (±20 ms) keeps consecutive timestamps from looking like a clock tick.
  const jitterMs = Math.round((r.jitter(i) - 0.5) * 40);
  const timestampMs = NEWEST_TIMESTAMP_MS - i * ROW_INTERVAL_MS + jitterMs;

  let errorMessage: string | null = null;
  if (level === 'ERROR') {
    const messages = ERROR_MESSAGES[statusCode] ?? ERROR_MESSAGES[500];
    errorMessage = pick(r.errMsg(i), messages);
  }

  return {
    id: i,
    timestamp: new Date(timestampMs).toISOString(),
    traceId,
    spanId,
    parentSpanId,
    level,
    method,
    endpoint,
    statusCode,
    durationMs,
    service,
    region,
    customerId,
    bookingRef,
    clientIp: makeIp(traceKey),
    userAgent: pick(r.traceUa(traceKey), USER_AGENTS),
    errorMessage,
  };
}
// #endregion
