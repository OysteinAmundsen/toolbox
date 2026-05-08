/**
 * Clipboard Copy / Paste Benchmarks
 *
 * `buildClipboardText` runs on every copy; `parseClipboardText` runs on
 * every paste. Big-paste from spreadsheets (10K rows × 10 cols) is a known
 * stress case — the parser is a char-by-char state machine whose cost
 * scales with input size and quote density.
 */

import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { buildClipboardText, formatCellValue } from './copy';
import { parseClipboardText } from './paste';
import type { ClipboardConfig } from './types';

// #region Fixtures

interface Row {
  id: number;
  name: string;
  email: string;
  notes: string;
}

function generateRows(count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Person\t${i}`, // tab → triggers quoting
      email: `p${i}@example.com`,
      notes: i % 7 === 0 ? `Multi\nline\nnote ${i}` : `Note ${i}`,
    });
  }
  return rows;
}

const COLUMNS: ColumnConfig<Row>[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'notes', header: 'Notes' },
];

const CONFIG: ClipboardConfig = { delimiter: '\t', newline: '\n', includeHeaders: true };

function generatePastedText(rowCount: number, withQuotes = true): string {
  const lines: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    if (withQuotes && i % 5 === 0) {
      lines.push(`${i}\t"Quoted, name ${i}"\tp${i}@example.com\t"Note with ""embedded"" quotes"`);
    } else {
      lines.push(`${i}\tPerson ${i}\tp${i}@example.com\tPlain note ${i}`);
    }
  }
  return lines.join('\n');
}

// #endregion

// #region Copy

describe('formatCellValue', () => {
  bench('plain string', () => {
    formatCellValue('hello', 'name', {}, CONFIG);
  });

  bench('string with delimiter (quoted)', () => {
    formatCellValue('hello\tworld', 'name', {}, CONFIG);
  });

  bench('object → JSON', () => {
    formatCellValue({ a: 1, b: 2 }, 'data', {}, CONFIG);
  });
});

describe('buildClipboardText', () => {
  const rows1k = generateRows(1_000);
  const rows10k = generateRows(10_000);
  const all1k = new Set(rows1k.map((_, i) => i));
  const all10k = new Set(rows10k.map((_, i) => i));

  bench('1K rows × 4 cols (all selected)', () => {
    buildClipboardText({ rows: rows1k, columns: COLUMNS, selectedIndices: all1k, config: CONFIG });
  });

  bench('10K rows × 4 cols (all selected)', () => {
    buildClipboardText({ rows: rows10k, columns: COLUMNS, selectedIndices: all10k, config: CONFIG });
  });
});

// #endregion

// #region Paste

describe('parseClipboardText', () => {
  const text1k = generatePastedText(1_000);
  const text10k = generatePastedText(10_000);
  const text10kPlain = generatePastedText(10_000, false);

  bench('1K rows (mixed quoting)', () => {
    parseClipboardText(text1k, CONFIG);
  });

  bench('10K rows (mixed quoting)', () => {
    parseClipboardText(text10k, CONFIG);
  });

  bench('10K rows (no quotes — fast path)', () => {
    parseClipboardText(text10kPlain, CONFIG);
  });
});

// #endregion
