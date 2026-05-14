/**
 * Vite middleware plugin: exposes the deterministic booking-logs dataset at
 * `GET /api/logs`. Plugged into each framework demo's `vite.config.ts`.
 *
 * Query string (all parameters optional except `start`/`end`):
 * - `start` / `end`            — node range (start inclusive, end exclusive)
 * - `level`                    — comma-sep list of LogLevel
 * - `service` / `region` / `method` — comma-sep allow-list
 * - `statusCodeMin` / `statusCodeMax` — numeric range
 * - `tsFrom` / `tsTo`            — inclusive timestamp range (ms since epoch)
 * - `endpoint`                 — case-insensitive substring match
 * - `traceId`                  — exact match
 * - `latency`                  — override artificial response delay (ms);
 *                                defaults to `DEFAULT_LATENCY_MS`
 *
 * The plugin always wraps the response in artificial latency so the
 * infinite-scroll loading state is observable.
 */

import type { Plugin } from 'vite';
import { queryLogs, resetQueryCache } from './query';
import type { BookingLogsQuery, HttpMethod, LogLevel } from './types';

const DEFAULT_LATENCY_MS = 250;
const VALID_LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR']);
const VALID_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function parseList(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function parseInt32(raw: string | null): number | undefined {
  if (raw === null || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Like {@link parseInt32} but for ms-epoch timestamps that exceed 2^31. We
 * still want a finite integer; `Number.parseInt` is fine since JS numbers
 * cover ms-epoch values for the next ~285k years.
 */
function parseEpochMs(raw: string | null): number | undefined {
  if (raw === null || raw === '') return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseQuery(url: URL): { query: BookingLogsQuery; latencyMs: number } {
  const sp = url.searchParams;
  const start = parseInt32(sp.get('start')) ?? 0;
  const end = parseInt32(sp.get('end')) ?? start + 100;
  const latencyMs = parseInt32(sp.get('latency')) ?? DEFAULT_LATENCY_MS;

  const levelRaw = parseList(sp.get('level'));
  const level = levelRaw?.filter((v): v is LogLevel => VALID_LEVELS.has(v as LogLevel));
  const methodRaw = parseList(sp.get('method'));
  const method = methodRaw?.filter((v): v is HttpMethod => VALID_METHODS.has(v as HttpMethod));

  const query: BookingLogsQuery = {
    start,
    end,
    level: level && level.length ? level : undefined,
    service: parseList(sp.get('service')),
    region: parseList(sp.get('region')),
    method: method && method.length ? method : undefined,
    statusCodeMin: parseInt32(sp.get('statusCodeMin')),
    statusCodeMax: parseInt32(sp.get('statusCodeMax')),
    tsFrom: parseEpochMs(sp.get('tsFrom')),
    tsTo: parseEpochMs(sp.get('tsTo')),
    endpointContains: sp.get('endpoint') || undefined,
    traceId: sp.get('traceId') || undefined,
  };
  return { query, latencyMs: Math.max(0, latencyMs) };
}

/** Vite plugin factory. */
export function bookingLogsApiPlugin(): Plugin {
  return {
    name: 'booking-logs-api',
    configureServer(server) {
      server.middlewares.use('/api/logs', (req, res) => {
        // Resolve URL relative to a stable base — the request URL coming through
        // Vite middleware is path+query only.
        const url = new URL(req.url ?? '/', 'http://localhost');
        const { query, latencyMs } = parseQuery(url);

        const respond = () => {
          try {
            const body = queryLogs(query);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(body));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String((err as Error).message ?? err) }));
          }
        };

        if (latencyMs > 0) setTimeout(respond, latencyMs);
        else respond();
      });
    },
    handleHotUpdate(ctx) {
      // If the generator/query/vocab modules change, drop the match cache so
      // the next request reflects the new code.
      if (/booking-logs[\\/](generator|query|vocab|types)\.ts$/.test(ctx.file)) {
        resetQueryCache();
      }
      return undefined;
    },
  };
}
