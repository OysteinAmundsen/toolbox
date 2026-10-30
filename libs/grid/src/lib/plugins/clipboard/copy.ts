/**
 * Clipboard Copy Logic
 *
 * Writing to the system clipboard. Text building lives in `ClipboardPlugin`
 * (`#buildDisplayGrid` / `#joinDisplayGrid`) because it needs the rendered
 * grid for "copy what you see".
 */

import { CLIPBOARD_FAILED, warnDiagnostic } from '../../core/internal/diagnostics';

/**
 * Copy text to the system clipboard.
 *
 * Uses the modern Clipboard API when available, with fallback
 * to execCommand for older browsers.
 *
 * When `html` is supplied, writes BOTH `text/plain` and `text/html` via
 * `ClipboardItem` so a same-app paste (even cross-grid or cross-window) can
 * recover a structured payload embedded in the HTML, while external targets
 * (Excel, editors) still get the plain text. Silently falls back to text-only
 * when `ClipboardItem` / `clipboard.write` is unavailable or rejects.
 *
 * @param text - The text to copy (`text/plain`)
 * @param html - Optional rich `text/html` representation (may embed a payload)
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function copyToClipboard(text: string, html?: string): Promise<boolean> {
  if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      return true;
    } catch {
      // Fall through to text-only write below.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    warnDiagnostic(CLIPBOARD_FAILED, `Clipboard API failed: ${err}`);
    // Fallback for older browsers or when Clipboard API is not available
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
