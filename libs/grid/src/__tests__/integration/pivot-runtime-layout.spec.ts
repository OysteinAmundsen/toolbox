/**
 * PivotPlugin runtime layout changes rebuild the grid columns (#605).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { ExportPlugin } from '../../lib/plugins/export/export-plugin';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';

async function setup(hiddenField?: string) {
  const columns = Array.from({ length: 40 }, (_, i) => ({
    field: `c${i}`,
    header: `C${i}`,
    width: 100,
    hidden: `c${i}` === hiddenField,
  }));
  const rows = Array.from({ length: 40 }, (_, i) => ({ c0: 'A', c1: i, c2: `k${i}`, c3: i % 2 ? 'odd' : 'even' }));
  const pivot = new PivotPlugin({
    rowGroupFields: ['c0'],
    columnGroupFields: ['c2'],
    valueFields: [{ field: 'c1', aggFunc: 'sum' }],
    showToolPanel: false,
  });
  const exporter = new ExportPlugin();
  const grid = createGrid();
  grid.gridConfig = { columns, plugins: [pivot, exporter] };
  grid.rows = rows;
  await waitUpgrade(grid);
  return { grid, pivot, exporter };
}

const fields = (grid: { columns: { field: string }[] }) => grid.columns.map((c) => c.field);

async function expectSourceRestoredOnDisable(grid: DataGridElement, pivot: PivotPlugin) {
  pivot.disablePivot();
  await waitUpgrade(grid);
  expect(fields(grid)[0]).toBe('c0');
  expect(fields(grid).some((f) => f.includes('|'))).toBe(false);
}

async function setWidth(grid: DataGridElement, field: string, width: number) {
  const state = grid.getColumnState();
  grid.applyColumnState({ columns: state.columns.map((c) => (c.field === field ? { ...c, width } : c)) });
  await waitUpgrade(grid);
}

describe('PivotPlugin runtime layout changes (#605)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setColumnGroupFields rebuilds the pivot columns', async () => {
    const { grid, pivot, exporter } = await setup();
    expect(fields(grid)).toContain('k0|c1');

    pivot.setColumnGroupFields([]);
    await waitUpgrade(grid);

    expect(fields(grid)).toEqual(['__pivotLabel', 'value|c1', '__pivotTotal']);
    expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(['value|c1']);
    expect(grid.querySelector('.header-row [data-field="k0|c1"]')).toBeNull();
  });

  it('setRowGroupFields updates the row label header', async () => {
    const { grid, pivot } = await setup();
    pivot.setRowGroupFields(['c3']);
    await waitUpgrade(grid);

    expect(grid.columns[0].header).toBe('C3');
  });

  it('setValueFields rebuilds the value columns', async () => {
    const { grid, pivot } = await setup();
    pivot.setColumnGroupFields(['c3']);
    pivot.setValueFields([{ field: 'c1', aggFunc: 'max' }]);
    await waitUpgrade(grid);

    expect(fields(grid)).toEqual(['__pivotLabel', 'even|c1', 'odd|c1', '__pivotTotal']);
    expect(grid.columns[1].header).toContain('(max)');
  });

  it('disablePivot restores the source columns and enablePivot re-pivots them', async () => {
    const { grid, pivot } = await setup();

    pivot.disablePivot();
    await waitUpgrade(grid);
    expect(fields(grid)[0]).toBe('c0');

    pivot.enablePivot();
    await waitUpgrade(grid);
    expect(fields(grid)[0]).toBe('__pivotLabel');
    expect(fields(grid)).toContain('k0|c1');
  });

  it('a pivot round-trip keeps a hidden source column in place', async () => {
    const { grid, pivot } = await setup('c2');

    pivot.disablePivot();
    await waitUpgrade(grid);

    expect(fields(grid).slice(0, 4)).toEqual(['c0', 'c1', 'c2', 'c3']);
    expect(grid.columns[2].hidden).toBe(true);
  });

  it('a pass with the label column hidden does not poison the cached source columns', async () => {
    const { grid, pivot } = await setup();
    grid.setColumnVisible('__pivotLabel', false);
    await waitUpgrade(grid);

    await expectSourceRestoredOnDisable(grid, pivot);
  });

  it('disablePivot restores the source columns while the label column is hidden', async () => {
    const { grid, pivot } = await setup();
    grid.setColumnVisible('__pivotLabel', false);
    expect(grid.columns.find((c) => c.field === '__pivotLabel')?.hidden).toBe(true);

    await expectSourceRestoredOnDisable(grid, pivot);
  });

  it('refresh keeps the width of a resized pivot column that stays in the layout', async () => {
    const { grid, pivot } = await setup();
    await setWidth(grid, 'k0|c1', 320);

    pivot.setRowGroupFields(['c3']);
    await waitUpgrade(grid);

    expect(grid.columns.find((c) => c.field === 'k0|c1')?.width).toBe(320);
    expect(grid.columns.find((c) => c.field === 'k1|c1')?.width).toBe(120);
  });

  it('resetting a resized pivot column restores its default width', async () => {
    const { grid } = await setup();
    await setWidth(grid, 'k0|c1', 320);

    const handle = grid.querySelector('.header-row [data-field="k0|c1"] .resize-handle');
    handle?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(handle).not.toBeNull();
    expect(grid.columns.find((c) => c.field === 'k0|c1')?.width).toBe(120);
  });

  it('disablePivot keeps column state applied to a hidden source column while pivoted', async () => {
    const { grid, pivot } = await setup('c5');
    await setWidth(grid, 'c5', 300);

    pivot.disablePivot();
    await waitUpgrade(grid);

    expect(grid.columns.find((c) => c.field === 'c5')?.width).toBe(300);
  });

  it('an invalid config while active shows the source columns the raw rows need', async () => {
    const { grid, pivot } = await setup();
    pivot.setValueFields([]);
    await waitUpgrade(grid);

    expect(fields(grid)[0]).toBe('c0');
  });
});
