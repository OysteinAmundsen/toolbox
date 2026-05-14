/**
 * Cell-renderer utilities: HTML escaping, placeholder, and the small bits
 * of presentation logic shared across the booking-logs column renderers.
 *
 * Pure functions, no DOM mutation. Safe to import from any renderer.
 */

/** Placeholder cell HTML while a row is still loading from the server. */
export const PLACEHOLDER = '<span class="bl-placeholder">…</span>';

export function isEmpty(value: unknown): boolean {
  return value === undefined || value === null;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Format an ISO timestamp as `HH:mm:ss.SSS` (UTC) for compact log display. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** Format an ISO timestamp as `YYYY-MM-DD` (UTC). Paired with {@link formatTimestamp}
 *  so a wide Time column can show both date and time without re-parsing. */
export function formatTimestampDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function statusClass(code: number): string {
  if (code < 300) return 's-2xx';
  if (code < 400) return 's-3xx';
  if (code < 500) return 's-4xx';
  return 's-5xx';
}

export function durationClass(ms: number): string {
  if (ms >= 1000) return 'very-slow';
  if (ms >= 400) return 'slow';
  return '';
}
