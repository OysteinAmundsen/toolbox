import { bench, describe } from 'vitest';
import type { ColumnConfig, GridHost } from '../types';
import { renderVisibleRows } from './rows';

type Row = Record<string, string>;

const columns: ColumnConfig<Row>[] = Array.from({ length: 200 }, (_, i) => ({ field: `c${i}`, width: 100 }));
const rows: Row[] = Array.from({ length: 1_000 }, (_, row) =>
  Object.fromEntries(columns.map((col) => [col.field, `${row}:${col.field}`])),
);

function scrollingWindow(shift: number, retain: boolean) {
  const windows = [columns.slice(20, 36), columns.slice(20 + shift, 36 + shift)];
  const host = Object.assign(document.createElement('div'), {
    _rows: rows,
    _columns: columns,
    _visibleColumns: windows[0],
    _bodyEl: document.createElement('div'),
    _rowPool: [],
    _activeEditRows: -1,
    _focusRow: -1,
    _focusCol: -1,
    effectiveConfig: {},
  });
  const grid = host as GridHost<Row>;
  let epoch = 1;
  renderVisibleRows(grid, 0, 30, epoch);
  return () => {
    // Alternate real windows on every invocation; never benchmark a warmed no-op.
    host._visibleColumns = windows[(++epoch - 1) % 2];
    grid.__windowEpoch = retain ? epoch : undefined;
    renderVisibleRows(grid, 0, 30, epoch);
  };
}

describe('column window: 200 columns × 1k rows, 30 visible rows × 16 cells', () => {
  for (const shift of [1, 3, 16]) {
    bench(`shift ${shift}: rebuild control`, scrollingWindow(shift, false));
    bench(`shift ${shift}: retain overlapping cells`, scrollingWindow(shift, true));
  }
});
