/**
 * Benchmarks for the row render/patch hot path (`renderVisibleRows`,
 * `renderInlineRow`, `fastPatchRow`).
 *
 * These cover the three shapes the render loop actually takes at runtime:
 *  - **full rebuild** — epoch changed (column change / first paint), every cell
 *    is recreated from the template.
 *  - **recycle patch** — scrolling: same structure, different row data ref.
 *  - **in-place patch** — same row data ref, values may have mutated.
 *
 * Each shape is measured with a "plain" column set (no formatters, renderers or
 * cell classes → ultra-fast `textContent` path) and a "rich" column set
 * (`format`, `cellClass`, `date`, `boolean` → standard path).
 */
import { bench, describe } from 'vitest';
import type { ColumnConfig, GridHost } from '../types';
import { renderVisibleRows } from './rows';

interface BenchRow {
  id: number;
  name: string;
  email: string;
  amount: number;
  active: boolean;
  created: Date;
  city: string;
  country: string;
  score: number;
  note: string;
}

const VISIBLE_ROWS = 50;
const TOTAL_ROWS = 5000;

function makeRows(count: number): BenchRow[] {
  const rows: BenchRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Person ${i}`,
      email: `person${i}@example.com`,
      amount: i * 13.5,
      active: i % 2 === 0,
      created: new Date(2024, i % 12, (i % 27) + 1),
      city: `City ${i % 100}`,
      country: `Country ${i % 20}`,
      score: (i * 7) % 100,
      note: `Note for row ${i}`,
    });
  }
  return rows;
}

const PLAIN_COLUMNS: ColumnConfig<BenchRow>[] = [
  { field: 'id' },
  { field: 'name' },
  { field: 'email' },
  { field: 'amount' },
  { field: 'city' },
  { field: 'country' },
  { field: 'score' },
  { field: 'note' },
];

const RICH_COLUMNS: ColumnConfig<BenchRow>[] = [
  { field: 'id' },
  { field: 'name', cellClass: (v) => (String(v).length > 8 ? 'long' : 'short') },
  { field: 'email' },
  { field: 'amount', format: (v) => `$${Number(v).toFixed(2)}` },
  { field: 'active', type: 'boolean' },
  { field: 'created', type: 'date' },
  { field: 'city' },
  { field: 'country' },
  { field: 'score', format: (v) => `${v}%` },
  { field: 'note' },
];

/** Minimal `GridHost` stand-in — only the members `rows.ts` actually reads. */
function makeGrid(rows: BenchRow[], columns: ColumnConfig<BenchRow>[]): GridHost<BenchRow> {
  const gridEl = document.createElement('div') as unknown as Record<string, unknown>;
  const bodyEl = document.createElement('div');
  gridEl['_rows'] = rows;
  gridEl['_columns'] = columns;
  gridEl['_visibleColumns'] = columns;
  gridEl['_bodyEl'] = bodyEl;
  gridEl['_rowPool'] = [];
  gridEl['_activeEditRows'] = -1;
  gridEl['_focusRow'] = -1;
  gridEl['_focusCol'] = -1;
  gridEl['effectiveConfig'] = {};
  gridEl['getRowId'] = (row: BenchRow) => String(row.id);
  return gridEl as unknown as GridHost<BenchRow>;
}

describe('rows: full rebuild (epoch change)', () => {
  const rows = makeRows(TOTAL_ROWS);

  const plain = makeGrid(rows, PLAIN_COLUMNS);
  let plainEpoch = 0;
  bench('plain columns — 50 rows × 8 cols', () => {
    renderVisibleRows(plain, 0, VISIBLE_ROWS, ++plainEpoch);
  });

  const rich = makeGrid(rows, RICH_COLUMNS);
  let richEpoch = 0;
  bench('rich columns — 50 rows × 10 cols', () => {
    renderVisibleRows(rich, 0, VISIBLE_ROWS, ++richEpoch);
  });
});

describe('rows: recycle patch (scroll)', () => {
  const rows = makeRows(TOTAL_ROWS);

  const plain = makeGrid(rows, PLAIN_COLUMNS);
  renderVisibleRows(plain, 0, VISIBLE_ROWS, 1);
  let plainStart = 0;
  bench('plain columns — 50 rows × 8 cols', () => {
    plainStart = (plainStart + VISIBLE_ROWS) % (TOTAL_ROWS - VISIBLE_ROWS);
    renderVisibleRows(plain, plainStart, plainStart + VISIBLE_ROWS, 1);
  });

  const rich = makeGrid(rows, RICH_COLUMNS);
  renderVisibleRows(rich, 0, VISIBLE_ROWS, 1);
  let richStart = 0;
  bench('rich columns — 50 rows × 10 cols', () => {
    richStart = (richStart + VISIBLE_ROWS) % (TOTAL_ROWS - VISIBLE_ROWS);
    renderVisibleRows(rich, richStart, richStart + VISIBLE_ROWS, 1);
  });
});

describe('rows: in-place patch (same row refs)', () => {
  const rows = makeRows(TOTAL_ROWS);

  const plain = makeGrid(rows, PLAIN_COLUMNS);
  renderVisibleRows(plain, 0, VISIBLE_ROWS, 1);
  bench('plain columns — 50 rows × 8 cols', () => {
    renderVisibleRows(plain, 0, VISIBLE_ROWS, 1);
  });

  const rich = makeGrid(rows, RICH_COLUMNS);
  renderVisibleRows(rich, 0, VISIBLE_ROWS, 1);
  bench('rich columns — 50 rows × 10 cols', () => {
    renderVisibleRows(rich, 0, VISIBLE_ROWS, 1);
  });
});
