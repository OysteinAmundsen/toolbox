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
 * @param text - Raw clipboard text
 * @param config - Clipboard configuration
 * @returns 2D array where each sub-array is a row of cell values
 */
export function parseClipboardText(text: string, config: ClipboardConfig): string[][] {
  const delimiter = config.delimiter ?? '\t';
  const newline = config.newline ?? '\n';

  // Handle Windows CRLF line endings
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Parse the entire text handling quoted fields that may span multiple lines
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];

    if (char === '"' && !inQuotes) {
      // Start of quoted field
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      // Check for escaped quote ("")
      if (normalizedText[i + 1] === '"') {
        currentCell += '"';
        i++; // Skip the second quote
      } else {
        // End of quoted field
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      currentRow.push(currentCell);
      currentCell = '';
    } else if (char === newline && !inQuotes) {
      // Row separator (only if not inside quotes)
      currentRow.push(currentCell);
      currentCell = '';
      // Only add non-empty rows (at least one non-empty cell or multiple cells)
      if (currentRow.length > 1 || currentRow.some((c) => c.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Handle the last cell and row
  currentRow.push(currentCell);
  if (currentRow.length > 1 || currentRow.some((c) => c.trim() !== '')) {
    rows.push(currentRow);
  }

  return rows;
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
