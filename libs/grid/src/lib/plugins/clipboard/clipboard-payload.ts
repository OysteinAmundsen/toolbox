/**
 * Structured clipboard payload codec.
 *
 * Copy writes both `text/plain` (WYSIWYG for external targets) and `text/html`.
 * The HTML is a real `<table>` of the display text whose root element also
 * carries a base64-encoded structured payload in a `data-tbw-clip` attribute.
 * A same-app paste — even **cross-grid or cross-window** — can then recover the
 * raw cell values losslessly, while external targets just see the table/text.
 *
 * Kept in its own module so `copy.ts` and `paste.ts` share the format without
 * importing each other.
 */

/**
 * Structured clipboard payload carried in `text/html`. `rows` are the RAW cell
 * values (data rows only), `fields` the source column fields in the same order.
 * @internal
 */
export interface ClipboardPayload {
  /** Payload schema version. */
  v: 1;
  /** Source column fields, in column order. */
  fields: string[];
  /** Raw cell values, one inner array per data row (no header). */
  rows: unknown[][];
}

/** Attribute (on the payload table) that marks our structured HTML clipboard. */
export const CLIPBOARD_PAYLOAD_ATTR = 'data-tbw-clip';

/** Unicode-safe base64 encode of a JSON payload for an HTML attribute. */
function encodePayload(payload: ClipboardPayload): string {
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Build the `text/html` clipboard representation: a real `<table>` of the
 * DISPLAY text (so external targets like Excel get a proper table) whose root
 * element carries the base64-encoded structured {@link ClipboardPayload} in a
 * `data-tbw-clip` attribute for lossless same-app paste.
 */
export function buildClipboardHtml(
  header: string[] | null,
  displayRows: string[][],
  payload: ClipboardPayload,
): string {
  const thead = header ? `<thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>` : '';
  const tbody = `<tbody>${displayRows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table ${CLIPBOARD_PAYLOAD_ATTR}="${encodePayload(payload)}">${thead}${tbody}</table>`;
}

/**
 * Extract the structured {@link ClipboardPayload} embedded in a `text/html`
 * clipboard representation written by {@link buildClipboardHtml}. Enables a
 * lossless **cross-grid / cross-window** paste of object-valued cells (the
 * in-memory buffer only covers the same grid instance).
 *
 * Returns `null` when the HTML has no `data-tbw-clip` marker (e.g. an external
 * paste from Excel) or the payload can't be decoded. Parsing is defensive —
 * malformed input never throws.
 *
 * @param html - Raw `text/html` from `clipboardData.getData('text/html')`
 */
export function parseClipboardHtmlPayload(html: string | undefined | null): ClipboardPayload | null {
  if (!html || html.indexOf(CLIPBOARD_PAYLOAD_ATTR) === -1) return null;
  try {
    // Extract only our own base64 payload attribute with a targeted match rather
    // than parsing the whole (untrusted) clipboard HTML through a DOM sink
    // (DOMParser) — the latter feeds attacker-controlled markup to the parser and
    // trips CodeQL js/xss. The attribute value is base64 (btoa output), whose
    // alphabet excludes quotes and tag characters, so a simple attribute match is
    // both safe and sufficient.
    const match = html.match(new RegExp(`${CLIPBOARD_PAYLOAD_ATTR}="([A-Za-z0-9+/=]*)"`));
    const encoded = match?.[1];
    if (!encoded) return null;
    const payload = JSON.parse(decodeURIComponent(atob(encoded))) as ClipboardPayload;
    if (payload && Array.isArray(payload.rows) && Array.isArray(payload.fields)) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}
