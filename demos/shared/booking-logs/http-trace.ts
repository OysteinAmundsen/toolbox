/**
 * Booking-Logs Demo — synthetic HTTP request/response trace.
 *
 * Pure function from a {@link BookingLogEntry} to a pair of plain-text
 * blobs that look like the kind of request/response capture a service
 * mesh sidecar would emit. The output is **deterministic** — same row
 * always yields the same trace — so screenshots in the docs and parity
 * e2e tests stay stable.
 *
 * Shape comes entirely from fields we already have on the entry; nothing
 * here hits the wire. Bodies are inferred from the endpoint pattern (a
 * `POST /bookings` gets a booking payload, `POST /payments/.../charge`
 * gets a charge payload, etc.).
 */

import { mulberry32 } from './prng';
import type { BookingLogEntry } from './types';

/**
 * Render a request-line + headers + body block (HTTP/1.1 wire format).
 * Always ends with a single trailing newline so the response can sit
 * directly below it in a `<pre>` block without merging visually.
 */
export interface HttpTrace {
  request: string;
  response: string;
}

const STATUS_REASON: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** Service → public API hostname. Stable so the request line reads naturally. */
const SERVICE_HOST: Record<string, string> = {
  'booking-api': 'api.bookings.example.com',
  payments: 'api.payments.example.com',
  inventory: 'api.inventory.example.com',
  search: 'api.search.example.com',
  pricing: 'api.pricing.example.com',
  notifications: 'api.notify.example.com',
  loyalty: 'api.loyalty.example.com',
  auth: 'auth.example.com',
};

const ACCEPT_LANGS = [
  'en-US,en;q=0.9',
  'nb-NO,nb;q=0.9,en;q=0.8',
  'de-DE,de;q=0.9,en;q=0.8',
  'ja-JP,ja;q=0.9,en;q=0.8',
];
const CURRENCIES = ['USD', 'EUR', 'NOK', 'GBP', 'JPY'] as const;
const PAYMENT_METHODS = ['card_visa', 'card_mc', 'card_amex', 'paypal', 'apple_pay'] as const;
const SEARCH_TERMS = ['lisbon', 'tokyo', 'oslo', 'rome', 'barcelona', 'reykjavik', 'bangkok', 'cape town'];
const TEMPLATES = ['booking_confirmed', 'payment_received', 'flight_change', 'reminder_24h', 'cancellation_refund'];

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function host(service: string): string {
  return SERVICE_HOST[service] ?? `api.${service}.example.com`;
}

/**
 * Build a deterministic JSON request body for methods that carry one.
 *
 * Returns `null` for methods (GET/DELETE) and endpoints that conventionally
 * don't have a request body. The shape is keyed off the endpoint prefix:
 * the demo's vocab is small enough that a few `startsWith` checks cover
 * everything cleanly.
 */
function buildRequestBody(entry: BookingLogEntry, rng: () => number): unknown {
  const m = entry.method;
  if (m === 'GET' || m === 'DELETE') return null;

  const ep = entry.endpoint;

  if (ep.startsWith('/auth/token')) {
    return {
      grant_type: 'client_credentials',
      client_id: `tba_${entry.traceId.slice(0, 12)}`,
      scope: 'bookings.read bookings.write payments.write',
    };
  }
  if (ep.startsWith('/payments') && (ep.endsWith('/capture') || ep.endsWith('/refund') || ep.includes('/charge'))) {
    return {
      bookingRef: entry.bookingRef,
      amount: Math.round((50 + rng() * 4000) * 100) / 100,
      currency: pickFrom(rng, CURRENCIES),
      paymentMethod: pickFrom(rng, PAYMENT_METHODS),
      idempotencyKey: entry.traceId,
    };
  }
  if (ep.startsWith('/payments')) {
    return {
      customerId: entry.customerId,
      paymentMethod: pickFrom(rng, PAYMENT_METHODS),
      currency: pickFrom(rng, CURRENCIES),
    };
  }
  if (ep.startsWith('/bookings')) {
    return {
      customerId: entry.customerId,
      origin: pickFrom(rng, SEARCH_TERMS).toUpperCase().slice(0, 3),
      destination: pickFrom(rng, SEARCH_TERMS).toUpperCase().slice(0, 3),
      passengers: 1 + Math.floor(rng() * 4),
      cabinClass: pickFrom(rng, ['economy', 'premium', 'business']),
    };
  }
  if (ep.startsWith('/notifications')) {
    return {
      to: entry.customerId ?? 'anon',
      template: pickFrom(rng, TEMPLATES),
      channel: ep.endsWith('/sms') ? 'sms' : ep.endsWith('/email') ? 'email' : 'push',
      bookingRef: entry.bookingRef,
    };
  }
  if (ep.startsWith('/search')) {
    return {
      query: pickFrom(rng, SEARCH_TERMS),
      from: '2026-06-15',
      to: '2026-06-22',
      maxPrice: Math.round((200 + rng() * 1800) * 100) / 100,
    };
  }
  if (ep.startsWith('/pricing')) {
    return {
      bookingRef: entry.bookingRef,
      currency: pickFrom(rng, CURRENCIES),
      promoCode: rng() < 0.4 ? `PROMO${Math.floor(rng() * 9000 + 1000)}` : null,
    };
  }
  if (ep.startsWith('/loyalty')) {
    return {
      customerId: entry.customerId,
      points: Math.floor(rng() * 5000),
    };
  }
  // Fallback: a single-field generic payload so the section isn't empty.
  return { traceId: entry.traceId };
}

/**
 * Build a deterministic JSON response body matching the status code class.
 *
 * - 204/304 → no body (caller should omit Content-Type/Length too).
 * - 2xx → success payload (typically echoes IDs from the request).
 * - 4xx/5xx → RFC-7807-ish problem object (re-uses `entry.errorMessage`
 *   when the generator already populated one for ERROR rows).
 */
function buildResponseBody(entry: BookingLogEntry, rng: () => number): unknown {
  const code = entry.statusCode;
  if (code === 204 || code === 304) return null;

  if (code >= 400) {
    const reason = STATUS_REASON[code] ?? 'Error';
    const detail = entry.errorMessage ?? `${reason} for ${entry.method} ${entry.endpoint}`;
    return {
      error: {
        code: reason.toLowerCase().replace(/\s+/g, '_'),
        status: code,
        message: detail,
        traceId: entry.traceId,
        ...(code >= 500 && {
          // Synthetic stack frame — the kind of thing a real server might
          // include in non-production environments.
          stack: [
            `at ${entry.service}.handle (${entry.endpoint})`,
            `at middleware.tracing (trace=${entry.traceId})`,
            `at server.dispatch (worker-${1 + Math.floor(rng() * 8)})`,
          ],
        }),
      },
    };
  }

  // 2xx — shape the success response loosely off the endpoint.
  const ep = entry.endpoint;
  const generatedAt = entry.timestamp;
  if (ep.startsWith('/auth/token')) {
    return {
      access_token: `eyJhbGciOi…${entry.traceId.slice(0, 8)}`,
      token_type: 'Bearer',
      expires_in: 3600,
      issuedAt: generatedAt,
    };
  }
  if (ep.startsWith('/bookings') && entry.method === 'POST') {
    return {
      bookingRef: entry.bookingRef ?? `BK-${100_000 + Math.floor(rng() * 900_000)}`,
      status: 'confirmed',
      customerId: entry.customerId,
      createdAt: generatedAt,
    };
  }
  if (ep.startsWith('/bookings')) {
    return {
      bookingRef: entry.bookingRef ?? `BK-${100_000 + Math.floor(rng() * 900_000)}`,
      status: pickFrom(rng, ['confirmed', 'pending', 'completed']),
      customerId: entry.customerId,
      lastUpdated: generatedAt,
    };
  }
  if (ep.startsWith('/payments')) {
    return {
      transactionId: `txn_${entry.traceId.slice(0, 16)}`,
      status: 'captured',
      amount: Math.round((50 + rng() * 4000) * 100) / 100,
      currency: pickFrom(rng, CURRENCIES),
      bookingRef: entry.bookingRef,
    };
  }
  if (ep.startsWith('/notifications')) {
    return {
      messageId: `msg_${entry.traceId.slice(0, 12)}`,
      queuedAt: generatedAt,
      status: 'queued',
    };
  }
  if (ep.startsWith('/search')) {
    const count = 3 + Math.floor(rng() * 8);
    return {
      query: pickFrom(rng, SEARCH_TERMS),
      results: Array.from({ length: count }, (_, k) => ({
        id: `r_${k}_${entry.traceId.slice(0, 6)}`,
        title: `${pickFrom(rng, SEARCH_TERMS)} → ${pickFrom(rng, SEARCH_TERMS)}`,
        price: Math.round((150 + rng() * 1500) * 100) / 100,
        currency: pickFrom(rng, CURRENCIES),
      })),
    };
  }
  if (ep.startsWith('/pricing')) {
    return {
      bookingRef: entry.bookingRef,
      total: Math.round((200 + rng() * 1800) * 100) / 100,
      currency: pickFrom(rng, CURRENCIES),
      validUntil: new Date(Date.parse(entry.timestamp) + 15 * 60_000).toISOString(),
    };
  }
  if (ep.startsWith('/loyalty')) {
    return {
      customerId: entry.customerId,
      tier: pickFrom(rng, ['bronze', 'silver', 'gold', 'platinum']),
      pointsBalance: Math.floor(rng() * 50_000),
    };
  }
  if (ep.startsWith('/inventory') || ep.startsWith('/flights')) {
    return {
      available: Math.floor(rng() * 240),
      checkedAt: generatedAt,
    };
  }
  return { ok: true, traceId: entry.traceId };
}

/**
 * Format a JSON value with two-space indentation. Returns an empty string
 * for `null` so callers can branch on whether to emit the body section.
 */
function pretty(body: unknown): string {
  if (body === null || body === undefined) return '';
  return JSON.stringify(body, null, 2);
}

function joinHeaders(headers: Array<[string, string]>): string {
  return headers.map(([k, v]) => `${k}: ${v}`).join('\n');
}

/**
 * Build the synthetic request/response pair.
 *
 * The seed is `entry.id`, so the same row always renders the same trace —
 * critical for screenshots, snapshot tests, and "click the same row in
 * vanilla and angular" parity checks.
 */
export function buildHttpTrace(entry: BookingLogEntry): HttpTrace {
  const rng = mulberry32(entry.id ^ 0xf00d_face);

  // ── Request ────────────────────────────────────────────────────────
  const reqBody = buildRequestBody(entry, rng);
  const reqBodyText = pretty(reqBody);
  const reqHasBody = reqBodyText.length > 0;

  const reqHeaders: Array<[string, string]> = [
    ['Host', host(entry.service)],
    ['User-Agent', entry.userAgent],
    ['Accept', 'application/json'],
    ['Accept-Language', pickFrom(rng, ACCEPT_LANGS)],
    ['X-Forwarded-For', entry.clientIp],
    ['X-Trace-Id', entry.traceId],
    ['X-Region', entry.region],
  ];
  if (entry.customerId) {
    reqHeaders.push(['Authorization', `Bearer eyJhbGciOi…${entry.traceId.slice(0, 8)}`]);
  }
  if (reqHasBody) {
    reqHeaders.push(['Content-Type', 'application/json']);
    reqHeaders.push(['Content-Length', String(new TextEncoder().encode(reqBodyText).length)]);
  }

  const requestLines = [
    `${entry.method} ${entry.endpoint} HTTP/1.1`,
    joinHeaders(reqHeaders),
    '',
    reqHasBody ? reqBodyText : '',
  ];
  const request = requestLines.join('\n').replace(/\n+$/, '\n');

  // ── Response ───────────────────────────────────────────────────────
  const resBody = buildResponseBody(entry, rng);
  const resBodyText = pretty(resBody);
  const resHasBody = resBodyText.length > 0;
  const reason = STATUS_REASON[entry.statusCode] ?? '';

  const resHeaders: Array<[string, string]> = [
    ['Server', `tba-edge/${1 + Math.floor(rng() * 9)}.${Math.floor(rng() * 20)}.${Math.floor(rng() * 30)}`],
    ['Date', new Date(entry.timestamp).toUTCString()],
    ['X-Trace-Id', entry.traceId],
    ['X-Region', entry.region],
    ['X-Response-Time', `${entry.durationMs}ms`],
  ];
  if (resHasBody) {
    resHeaders.push(['Content-Type', 'application/json; charset=utf-8']);
    resHeaders.push(['Content-Length', String(new TextEncoder().encode(resBodyText).length)]);
  }
  if (entry.statusCode >= 200 && entry.statusCode < 300 && entry.method === 'GET') {
    resHeaders.push(['Cache-Control', 'private, max-age=30']);
  } else if (entry.statusCode >= 500) {
    resHeaders.push(['Cache-Control', 'no-store']);
  }

  const responseLines = [
    `HTTP/1.1 ${entry.statusCode} ${reason}`.trimEnd(),
    joinHeaders(resHeaders),
    '',
    resHasBody ? resBodyText : '',
  ];
  const response = responseLines.join('\n').replace(/\n+$/, '\n');

  return { request, response };
}
