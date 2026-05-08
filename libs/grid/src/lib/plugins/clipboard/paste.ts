/**
 * Clipboard Paste Logic
 *
 * Pure functions for reading and parsing clipboard data.
 */

import type { ClipboardConfig } from './types';

/**
 * Parse clipboard text into a 2D array of cell values.
 *
 * Handles:
 * - Quoted values (with escaped double quotes "")
 * - Multi-line quoted values (newlines within quotes are preserved)
 * - Custom delimiters and newlines
 * - Empty lines (filtered out only if they contain no data)
 *
 * Implementation: char-by-char state machine for delimiter/newline/quote
 * detection, but cell values are extracted via `slice(start, end)` rather
 * than `+= char` accumulation. The vast majority of cells have no quotes,
 * so the hot path is a single substring slice per cell. Cells that did
 * contain quotes fall back to {@link unquoteCell} for the strip + escape
 * pass.
 *
 * @param text - Raw clipboard text
 * @param config - Clipboard configuration
 * @returns 2D array where each sub-array is a row of cell values
 */
export function parseClipboardText(text: string, config: ClipboardConfig): string[][] {
  const delimiter = config.delimiter ?? '\t';
  const newline = config.newline ?? '\n';

  // Normalize Windows / old-Mac line endings.
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const len = normalized.length;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let cellStart = 0;
  let inQuotes = false;
  let cellHasQuotes = false;

  const finalizeCell = (endIdx: number): string => {
    const raw = normalized.slice(cellStart, endIdx);
    return cellHasQuotes ? unquoteCell(raw) : raw;
  };

  const pushRow = () => {
    // Filter purely-empty rows (single empty cell or all-whitespace cells),
    // matching the original char-by-char implementation's contract.
    if (currentRow.length > 1 || currentRow.some((c) => c.trim() !== '')) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let i = 0; i < len; i++) {
    const char = normalized[i];

    if (char === '"') {
      cellHasQuotes = true;
      if (!inQuotes) {
        inQuotes = true;
      } else if (normalized[i + 1] === '"') {
        // Escaped quote ("") — skip the second quote, stay inside the quoted run.
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(finalizeCell(i));
      cellStart = i + 1;
      cellHasQuotes = false;
    } else if (char === newline && !inQuotes) {
      currentRow.push(finalizeCell(i));
      cellStart = i + 1;
      cellHasQuotes = false;
      pushRow();
    }
  }

  // Final cell + row.
  currentRow.push(finalizeCell(len));
  pushRow();

  return rows;
}

/**
 * Strip surrounding quotes and unescape `""` → `"` from a cell value that
 * contained at least one quote character. Only invoked from the slow path
 * of {@link parseClipboardText}.
 */
function unquoteCell(raw: string): string {
  let out = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (raw[i + 1] === '"') {
        out += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else {
      out += c;
    }
  }
  return out;
}

/**
 * Read text from the system clipboard.
 *
 * Uses the modern Clipboard API. Returns empty string if
 * the API is not available or permission is denied.
 *
 * @returns Promise resolving to clipboard text or empty string
 */
export async function readFromClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    // Permission denied or API not available
    return '';
  }
}
