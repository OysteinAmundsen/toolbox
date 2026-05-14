/**
 * Fixed vocabularies the deterministic generator picks from.
 *
 * Anything that ends up as user-visible text (service names, endpoint paths,
 * error messages, user agents, ...) lives here. Changing these arrays will
 * change the generated dataset across every framework demo at once.
 */

import type { HttpMethod, LogLevel } from './types';

export const SERVICES = [
  'booking-api',
  'payments',
  'pricing',
  'inventory',
  'auth',
  'notifications',
  'search',
  'reviews',
  'loyalty',
  'fraud-check',
] as const;

export const REGIONS = [
  'eu-west-1',
  'eu-central-1',
  'eu-north-1',
  'us-east-1',
  'us-west-2',
  'ap-southeast-1',
  'ap-northeast-1',
  'sa-east-1',
] as const;

export const METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
export const METHOD_WEIGHTS = [55, 25, 8, 5, 7]; // GET dominates real traffic

export const LEVELS: readonly LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
/** ~25% DEBUG, ~62% INFO, ~9% WARN, ~4% ERROR — mirrors a healthy production stream. */
export const LEVEL_WEIGHTS = [25, 62, 9, 4];

/**
 * Endpoint templates per service. `{id}` and `{ref}` placeholders are
 * substituted with deterministic values at generation time.
 */
export const ENDPOINTS: Record<(typeof SERVICES)[number], readonly string[]> = {
  'booking-api': [
    '/bookings',
    '/bookings/{ref}',
    '/bookings/{ref}/passengers',
    '/bookings/{ref}/cancel',
    '/bookings/{ref}/itinerary',
  ],
  payments: ['/payments', '/payments/{id}', '/payments/{id}/capture', '/payments/{id}/refund', '/payments/methods'],
  pricing: ['/pricing/quote', '/pricing/rules', '/pricing/promos/{id}'],
  inventory: ['/flights/search', '/flights/{id}/seats', '/hotels/search', '/hotels/{id}/rooms'],
  auth: ['/auth/token', '/auth/refresh', '/auth/logout', '/auth/mfa/verify'],
  notifications: ['/notifications/email', '/notifications/sms', '/notifications/{id}/status'],
  search: ['/search/destinations', '/search/suggest', '/search/recent'],
  reviews: ['/reviews', '/reviews/{id}', '/reviews/property/{id}'],
  loyalty: ['/loyalty/points', '/loyalty/tiers', '/loyalty/members/{id}'],
  'fraud-check': ['/fraud/score', '/fraud/rules', '/fraud/decisions/{id}'],
};

/** Weighted status codes — happy path dominates, with a realistic error tail. */
export const STATUS_CODES = [200, 201, 204, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504];
export const STATUS_WEIGHTS = [62, 8, 5, 5, 4, 2, 2, 4, 2, 2, 1, 1, 1, 0.5, 0.5];

/** Map status code → human-readable error message. */
export const ERROR_MESSAGES: Record<number, readonly string[]> = {
  400: [
    'Invalid request body: missing field "passengers"',
    'Invalid date range: departureDate must precede returnDate',
    'Unsupported currency code',
    'Malformed booking reference',
  ],
  401: ['JWT signature verification failed', 'Token expired', 'Missing Authorization header'],
  403: ['Insufficient scope: payments:write required', 'Customer does not own this booking'],
  404: [
    'Booking not found',
    'Payment intent not found',
    'No flights match the requested itinerary',
    'Hotel property does not exist',
  ],
  409: ['Booking already cancelled', 'Idempotency key conflict', 'Seat already reserved'],
  422: ['Validation failed: 3 errors', 'Card declined by issuer', 'Loyalty tier downgrade not permitted'],
  429: ['Rate limit exceeded: 100 req/min', 'Quota exceeded for tier free'],
  500: [
    'Unhandled exception in BookingProcessor',
    'Database connection pool exhausted',
    'Null pointer in PricingEngine.applyPromo',
  ],
  502: ['Upstream payment gateway returned 502', 'GDS connection reset by peer'],
  503: ['Service unavailable: scheduled maintenance', 'Circuit breaker open for payments'],
  504: ['Upstream timeout calling pricing-svc', 'GDS timeout after 30s'],
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124.0.0.0 Mobile Safari/537.36',
  'TravelAgencyMobileApp/4.12.0 (iOS 17.4; iPhone15,2)',
  'TravelAgencyMobileApp/4.12.0 (Android 14; Pixel 8)',
  'PartnerIntegration/booking-sync 2.3.1',
  'curl/8.6.0',
];

/** Per-service base latency in ms (median). Generator adds jitter on top. */
export const SERVICE_BASE_LATENCY: Record<(typeof SERVICES)[number], number> = {
  'booking-api': 80,
  payments: 220,
  pricing: 110,
  inventory: 180,
  auth: 35,
  notifications: 60,
  search: 90,
  reviews: 70,
  loyalty: 50,
  'fraud-check': 140,
};
