/**
 * Clipboard Copy / Paste Benchmarks
 *
 * `ClipboardPlugin.getSelectionAsText` is the live copy path (the same
 * `#buildDisplayGrid` + `#joinDisplayGrid` that `copy()` writes to the
 * clipboard); `parseClipboardText` runs on every paste. Big-paste from
 * spreadsheets (10K rows × 10 cols) is a known stress case — the parser is a
 * char-by-char state machine whose cost scales with input size and quote
 * density.
 */

import { bench, describe } from 'vitest';
import type { GridElement } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { ClipboardPlugin } from './clipboard-plugin';
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

/** Attach a plugin to a bare grid stand-in holding `rows` — no DOM, so the display path hits `formatValueAsText`. */
function attachedPlugin(rows: Row[]): ClipboardPlugin {
  const plugin = new ClipboardPlugin(CONFIG);
  const grid: Partial<GridElement> = {
    rows,
    sourceRows: rows,
    columns: COLUMNS,
    _columns: COLUMNS,
    _visibleColumns: COLUMNS,
    gridConfig: {},
    effectiveConfig: {},
    getPlugin: () => undefined,
    query: () => [],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
    requestRender: () => undefined,
  };
  plugin.attach(grid as GridElement);
  return plugin;
}

describe('getSelectionAsText (live copy path)', () => {
  const plugin1k = attachedPlugin(generateRows(1_000));
  const plugin10k = attachedPlugin(generateRows(10_000));

  bench('1K rows × 4 cols (all rows)', () => {
    plugin1k.getSelectionAsText();
  });

  bench('10K rows × 4 cols (all rows)', () => {
    plugin10k.getSelectionAsText();
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
