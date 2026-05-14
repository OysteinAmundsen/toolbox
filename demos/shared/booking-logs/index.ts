/**
 * Booking-Logs Demo — shared barrel.
 *
 * Browser-safe re-exports only. The Vite middleware (`vite-plugin.ts`)
 * imports from `./vite-plugin` directly because it needs Node-only APIs.
 */

export { DATASET_SIZE, NEWEST_TIMESTAMP_MS, ROW_INTERVAL_MS, SEED, generateRow } from './generator';
export { buildHttpTrace, type HttpTrace } from './http-trace';
export * from './types';
export { LEVELS, METHODS, REGIONS, SERVICES, STATUS_CODES } from './vocab';
