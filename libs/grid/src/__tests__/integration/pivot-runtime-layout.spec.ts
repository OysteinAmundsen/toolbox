/**
 * PivotPlugin runtime layout changes rebuild the grid columns (#605).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, stickySides, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { RenderPhase } from '../../lib/core/internal/render-scheduler';
import type { BaseGridPlugin } from '../../lib/core/plugin/base-plugin';
import { ExportPlugin } from '../../lib/plugins/export/export-plugin';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail/master-detail-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import type { PinnedPosition } from '../../lib/plugins/pinned-columns/types';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';
import { RowDragDropPlugin } from '../../lib/plugins/row-drag-drop/row-drag-drop-plugin';
import { SelectionPlugin } from '../../lib/plugins/selection/selection-plugin';

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
  return { grid, pivot, exporter, rows };
}

const fields = (grid: { columns: { field: string }[] }) => grid.columns.map((c) => c.field);

async function expectSourceRestoredOnDisable(grid: DataGridElement, pivot: PivotPlugin) {
  pivot.disablePivot();
  await waitUpgrade(grid);
  expect(fields(grid)[0]).toBe('c0');
  expect(fields(grid).some((f) => f.includes('|'))).toBe(false);
}

async function expectHiddenSourceRestored(grid: DataGridElement, pivot: PivotPlugin) {
  pivot.disablePivot();
  await waitUpgrade(grid);
  expect(fields(grid).slice(0, 4)).toEqual(['c0', 'c1', 'c2', 'c3']);
  expect(grid.columns[2].hidden).toBe(true);
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

  it('the grand-total footer keeps its sticky footer class across re-renders (#634)', async () => {
    const { grid, pivot } = await setup();
    const footer = () => grid.querySelector('.tbw-scroll-area > .pivot-grand-total-row');

    expect(footer()?.classList.contains('pivot-grand-total-footer')).toBe(true);

    pivot.setRowGroupFields(['c3']);
    await waitUpgrade(grid);

    expect(footer()?.className).toBe('data-grid-row pivot-grand-total-row pivot-grand-total-footer');
    expect(grid.querySelectorAll('.pivot-grand-total-footer')).toHaveLength(1);
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
    await expectHiddenSourceRestored(grid, pivot);
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

  describe('hidden pivot columns (#609)', () => {
    const pivotCol = (grid: DataGridElement, field: string) => grid.columns.find((c) => c.field === field);

    async function hide(grid: DataGridElement, field: string) {
      grid.setColumnVisible(field, false);
      await waitUpgrade(grid);
    }

    it('setColumnVisible hides a pivot column', async () => {
      const { grid } = await setup();
      await hide(grid, 'k0|c1');

      expect(pivotCol(grid, 'k0|c1')?.hidden).toBe(true);
      expect(grid.querySelector('.header-row [data-field="k0|c1"]')).toBeNull();
    });

    it('a hidden pivot column stays hidden and in place across COLUMNS passes', async () => {
      const { grid, pivot } = await setup();
      const before = fields(grid);
      await hide(grid, 'k0|c1');

      grid.requestColumnsRender();
      await waitUpgrade(grid);
      pivot.setRowGroupFields(['c3']);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(before);
      expect(pivotCol(grid, 'k0|c1')?.hidden).toBe(true);
    });

    it('a hidden pivot column can be shown again', async () => {
      const { grid } = await setup();
      await hide(grid, 'k0|c1');

      grid.setColumnVisible('k0|c1', true);
      await waitUpgrade(grid);

      expect(pivotCol(grid, 'k0|c1')?.hidden).toBeFalsy();
      expect(grid.querySelector('.header-row [data-field="k0|c1"]')).not.toBeNull();
    });

    it('a hidden pivot column keeps its resized width', async () => {
      const { grid, pivot } = await setup();
      await setWidth(grid, 'k0|c1', 320);
      await hide(grid, 'k0|c1');

      pivot.setRowGroupFields(['c3']);
      await waitUpgrade(grid);

      expect(pivotCol(grid, 'k0|c1')?.width).toBe(320);
    });

    it('a hidden pivot column whose key no longer exists is dropped', async () => {
      const { grid, pivot } = await setup();
      await hide(grid, 'k0|c1');

      pivot.setColumnGroupFields(['c3']);
      await waitUpgrade(grid);

      expect(fields(grid)).not.toContain('k0|c1');
      expect(fields(grid)).toEqual(['__pivotLabel', 'even|c1', 'odd|c1', '__pivotTotal']);
    });

    it('a hidden source column survives while a pivot column is hidden', async () => {
      const { grid, pivot } = await setup('c2');
      await hide(grid, 'k0|c1');
      await expectHiddenSourceRestored(grid, pivot);
    });
  });

  describe('pinned pivot columns (#613)', () => {
    async function setupPinned(before: BaseGridPlugin[] = [], dir: 'ltr' | 'rtl' = 'ltr', keys = ['k0', 'k1']) {
      const columns = ['c0', 'c1', 'c2', 'c3'].map((field) => ({ field, header: field.toUpperCase(), width: 100 }));
      const rows = Array.from({ length: 4 }, (_, i) => ({
        c0: 'A',
        c1: i,
        c2: keys[i % keys.length],
        c3: i % 2 ? 'odd' : 'even',
      }));
      const pivot = new PivotPlugin({
        rowGroupFields: ['c0'],
        columnGroupFields: ['c2'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showToolPanel: false,
        showGrandTotal: true,
      });
      const pinned = new PinnedColumnsPlugin();
      const grid = createGrid();
      if (dir === 'rtl') grid.setAttribute('dir', 'rtl');
      grid.gridConfig = { columns, plugins: [...before, pivot, pinned] };
      grid.rows = rows;
      await waitUpgrade(grid);
      return { grid, pivot, pinned };
    }

    const pinOf = (grid: DataGridElement, field: string) => grid.columns.find((c) => c.field === field)?.pinned;
    /** Body cells of `field`: data rows + grand-total footer. */
    const stickyCells = (grid: DataGridElement, field: string) => stickySides(grid, '.data-grid-row .cell', field);
    const rerenderRows = (grid: DataGridElement) =>
      grid._renderVisibleRows(0, grid.querySelectorAll('.rows .data-grid-row').length);

    it('pins pivot columns whose grouping values hold quotes and backslashes', async () => {
      const { grid, pinned } = await setupPinned([], 'ltr', ['24" monitor', 'a\\b']);
      pinned.setPinPosition('24" monitor|c1', 'left');
      await waitUpgrade(grid);
      pinned.setPinPosition('a\\b|c1', 'right');
      await waitUpgrade(grid);

      expect(stickyCells(grid, '24" monitor|c1')).toEqual(['L0px', 'L0px']);
      expect(stickyCells(grid, 'a\\b|c1')).toEqual(['R0px', 'R0px']);
    });

    it('shares one pin plan across pivot rows and skips it when nothing is pinned', async () => {
      const { grid, pivot, pinned } = await setupPinned();
      pivot.setRowGroupFields(['c3']);
      await waitUpgrade(grid);
      const query = vi.spyOn(grid, 'query');
      const offsetQueries = () => query.mock.calls.filter(([type]) => type === 'getStickyOffsets').length;

      rerenderRows(grid);
      expect(offsetQueries()).toBe(0);

      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);
      query.mockClear();
      rerenderRows(grid);
      rerenderRows(grid);

      expect(grid.querySelectorAll('.rows .pivot-leaf-row')).toHaveLength(2);
      expect(offsetQueries()).toBe(1);
    });

    it('rebuilds the pin plan when PinnedColumns re-measures without a render', async () => {
      const { grid, pinned } = await setupPinned();
      pinned.setPinPosition('k0|c1', 'left');
      await waitUpgrade(grid);
      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);
      const firstHeader = grid.querySelector<HTMLElement>('.header-row [data-field="k0|c1"]');
      const measure = (width: number) => {
        if (firstHeader) Object.defineProperty(firstHeader, 'offsetWidth', { value: width, configurable: true });
        pinned.refreshStickyOffsets();
        rerenderRows(grid);
      };

      measure(80);
      measure(120);

      expect(stickyCells(grid, 'k1|c1')).toEqual(['L120px', 'L120px']);
    });

    it('setPinPosition pins a pivot column and moves it to the edge', async () => {
      const { grid, pinned } = await setupPinned();
      expect(fields(grid)).toEqual(['__pivotLabel', 'k0|c1', 'k1|c1', '__pivotTotal']);

      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['k1|c1', '__pivotLabel', 'k0|c1', '__pivotTotal']);
      expect(pinOf(grid, 'k1|c1')).toBe('left');
      expect(grid.querySelector('.header-row [data-field="k1|c1"]')?.classList.contains('sticky-left')).toBe(true);
      // Body row + grand-total footer stick with the header (custom pivot rows, PR #617 review).
      expect(stickyCells(grid, 'k1|c1')).toEqual(['L0px', 'L0px']);
    });

    it('pinned pivot body cells stay sticky when rows re-render outside afterRender', async () => {
      const { grid, pinned } = await setupPinned();
      pinned.setPinPosition('__pivotTotal', 'right');
      await waitUpgrade(grid);

      rerenderRows(grid);

      expect(stickyCells(grid, '__pivotTotal')).toEqual(['R0px', 'R0px']);
    });

    // The offset cache still holds the old side while the pivot rows re-render (PR #617 review).
    it.each<[PinnedPosition, PinnedPosition, 'ltr' | 'rtl', string]>([
      ['left', 'right', 'ltr', 'R0px'],
      ['right', 'left', 'ltr', 'L0px'],
      ['start', 'end', 'rtl', 'L0px'],
    ])('switching a pinned pivot column %s → %s (%s) leaves one sticky side', async (from, to, dir, expected) => {
      const { grid, pinned } = await setupPinned([], dir);
      pinned.setPinPosition('k1|c1', from);
      await waitUpgrade(grid);

      pinned.setPinPosition('k1|c1', to);
      await waitUpgrade(grid);

      expect(stickyCells(grid, 'k1|c1')).toEqual([expected, expected]);
    });

    // Plan warmed in LTR keeps its column-array key across a direction change (PR #617 review).
    it('a warmed pin plan follows a direction switch to one sticky side', async () => {
      const { grid, pinned } = await setupPinned();
      pinned.setPinPosition('k1|c1', 'start');
      await waitUpgrade(grid);
      rerenderRows(grid);
      expect(stickyCells(grid, 'k1|c1')).toEqual(['L0px', 'L0px']);

      // `render` fires after afterRender hooks but before PinnedColumns' re-measure microtask, so
      // it shows what the rows rendered with: never the stale LTR side.
      let rowsRendered: string[] = [];
      grid.addEventListener(
        'render',
        () =>
          (rowsRendered = [...grid.querySelectorAll<HTMLElement>('.rows .cell[data-field]')]
            .filter((c) => c.getAttribute('data-field') === 'k1|c1')
            .map((c) => c.className)),
        { once: true },
      );
      grid.setAttribute('dir', 'rtl');
      grid.requestRender();
      await waitUpgrade(grid);

      expect(rowsRendered).toEqual(['cell']);
      expect(stickyCells(grid, 'k1|c1')).toEqual(['R0px', 'R0px']);
    });

    it('a pinned pivot column stays pinned across COLUMNS passes', async () => {
      const { grid, pivot, pinned } = await setupPinned();
      pinned.setPinPosition('k0|c1', 'right');
      await waitUpgrade(grid);

      grid.requestColumnsRender();
      await waitUpgrade(grid);
      pivot.setRowGroupFields(['c3']);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['__pivotLabel', 'k1|c1', '__pivotTotal', 'k0|c1']);
      expect(pinOf(grid, 'k0|c1')).toBe('right');
    });

    it('unpinning restores the pivot column to its pivot position', async () => {
      const { grid, pinned } = await setupPinned();
      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);

      pinned.setPinPosition('k1|c1', undefined);
      await waitUpgrade(grid);
      grid.requestColumnsRender();
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['__pivotLabel', 'k0|c1', 'k1|c1', '__pivotTotal']);
      expect(pinOf(grid, 'k1|c1')).toBeUndefined();
      // PinnedColumns keeps its offset cache after the last unpin; recreated cells must ignore it.
      rerenderRows(grid);
      expect(stickyCells(grid, 'k1|c1')).toEqual(['-', '-']);
    });

    it('a pinned pivot column whose key no longer exists is dropped', async () => {
      const { grid, pivot, pinned } = await setupPinned();
      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);

      pivot.setColumnGroupFields(['c3']);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['__pivotLabel', 'even|c1', 'odd|c1', '__pivotTotal']);
    });

    it('unpinning a source column after disablePivot restores its position (#615)', async () => {
      const { grid, pivot, pinned } = await setupPinned();
      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);
      pivot.disablePivot();
      await waitUpgrade(grid);

      pinned.setPinPosition('c3', 'left');
      await waitUpgrade(grid);
      pinned.setPinPosition('c3', undefined);
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['c0', 'c1', 'c2', 'c3']);
    });

    // Core keeps a hidden source column in the pivot layout, so the pin stays present (PR #625 review).
    it.each([false, true])(
      'a source column pinned before a pivot round-trip unpins to its source position (hidden: %s)',
      async (hidden) => {
        const { grid, pivot, pinned } = await setupPinned();
        const step = async (action: () => void) => {
          action();
          await waitUpgrade(grid);
        };
        await step(() => pivot.disablePivot());
        await step(() => pinned.setPinPosition('c3', 'left'));
        if (hidden) await step(() => grid.setColumnVisible('c3', false));
        await step(() => pivot.enablePivot());
        await step(() => pinned.setPinPosition('k1|c1', 'left'));
        await step(() => pivot.disablePivot());
        expect(pinOf(grid, 'c3')).toBe('left');

        await step(() => pinned.setPinPosition('c3', undefined));
        if (hidden) await step(() => grid.setColumnVisible('c3', true));

        expect(fields(grid)).toEqual(['c0', 'c1', 'c2', 'c3']);
      },
    );

    it('pinning keeps the processColumns order of plugins registered before Pivot', async () => {
      const { grid, pinned } = await setupPinned([new RowDragDropPlugin()]);
      pinned.setPinPosition('k1|c1', 'left');
      await waitUpgrade(grid);

      // Pivot regenerates over the drag-handle column, as it does without a pin.
      expect(fields(grid)).toEqual(['k1|c1', '__pivotLabel', 'k0|c1', '__pivotTotal']);
    });
  });

  it('an invalid config while active shows the source columns the raw rows need', async () => {
    const { grid, pivot } = await setup();
    pivot.setValueFields([]);
    await waitUpgrade(grid);

    expect(fields(grid)[0]).toBe('c0');
  });

  describe('utility columns (#616)', () => {
    const utilityPlugins: Array<[string, string, () => BaseGridPlugin]> = [
      [
        'MasterDetail',
        '__tbw_expander',
        () => new MasterDetailPlugin({ showExpandColumn: true, detailRenderer: () => 'detail' }),
      ],
      ['RowDragDrop', '__tbw_row_drag', () => new RowDragDropPlugin()],
      // Checkbox column carries `pinned: 'left'` with no PinnedColumns loaded (#626).
      ['Selection(checkbox)', '__tbw_checkbox', () => new SelectionPlugin({ mode: 'row', checkbox: true })],
    ];
    const pivotLayout = ['__pivotLabel', 'k0|c1', 'k1|c1', '__pivotTotal'];

    async function setupUtility(utility: BaseGridPlugin, pivotFirst: boolean, active = true) {
      const columns = ['c0', 'c1', 'c2', 'c3'].map((field) => ({ field, header: field.toUpperCase(), width: 100 }));
      const rows = Array.from({ length: 4 }, (_, i) => ({ c0: 'A', c1: i, c2: `k${i % 2}`, c3: i }));
      const pivot = new PivotPlugin({
        active,
        rowGroupFields: ['c0'],
        columnGroupFields: ['c2'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showToolPanel: false,
      });
      const grid = createGrid();
      grid.gridConfig = { columns, plugins: pivotFirst ? [pivot, utility] : [utility, pivot] };
      grid.rows = rows;
      await waitUpgrade(grid);
      return { grid, pivot };
    }

    describe.each(utilityPlugins)('%s', (_name, utilityField, create) => {
      it.each([true, false])('is left out of the pivot layout (pivot registered first: %s)', async (pivotFirst) => {
        const { grid } = await setupUtility(create(), pivotFirst);

        expect(fields(grid)).toEqual(pivotLayout);
        const firstRow = grid.querySelector('.rows .data-grid-row')!;
        expect(firstRow.querySelectorAll('.cell')).toHaveLength(pivotLayout.length);
        expect(firstRow.querySelector('.cell')!.textContent).toContain('A');
      });

      it('comes back when pivot is disabled and leaves again when re-enabled', async () => {
        const { grid, pivot } = await setupUtility(create(), true);

        pivot.disablePivot();
        await waitUpgrade(grid);
        expect(fields(grid)).toEqual([utilityField, 'c0', 'c1', 'c2', 'c3']);

        pivot.enablePivot();
        await waitUpgrade(grid);
        expect(fields(grid)).toEqual(pivotLayout);
      });

      it('first enablePivot() on an inactive pivot pivots', async () => {
        const { grid, pivot } = await setupUtility(create(), true, false);
        expect(fields(grid)).toEqual([utilityField, 'c0', 'c1', 'c2', 'c3']);

        pivot.enablePivot();
        await waitUpgrade(grid);
        expect(fields(grid)).toEqual(pivotLayout);
      });
    });
  });

  describe('row data changes (#608)', () => {
    it('a new column key adds its pivot column in the same render', async () => {
      const { grid, rows } = await setup();
      const phases: number[] = [];
      grid.addEventListener('render', (e) => phases.push((e as CustomEvent<{ phase: number }>).detail.phase));

      grid.rows = [...rows, { c0: 'A', c1: 9, c2: 'NEW', c3: 'odd' }];
      await waitUpgrade(grid);

      expect(fields(grid)).toContain('NEW|c1');
      expect(grid.querySelector('.header-row [data-field="NEW|c1"]')).not.toBeNull();
      expect(phases).toEqual([RenderPhase.COLUMNS]);
    });

    it('a vanished column key drops its pivot column', async () => {
      const { grid, rows } = await setup();
      grid.rows = rows.filter((r) => r.c2 !== 'k0');
      await waitUpgrade(grid);

      expect(fields(grid)).not.toContain('k0|c1');
      expect(fields(grid)[1]).toBe('k1|c1');
    });

    it('a row update with the same column keys stays a ROWS pass', async () => {
      const { grid, pivot, rows } = await setup();
      const processColumns = vi.spyOn(pivot, 'processColumns');

      grid.rows = rows.map((r) => ({ ...r, c1: r.c1 + 1 }));
      await waitUpgrade(grid);

      expect(processColumns).not.toHaveBeenCalled();
    });

    it('surviving pivot columns keep their width when a key is added', async () => {
      const { grid, rows } = await setup();
      await setWidth(grid, 'k0|c1', 320);

      grid.rows = [...rows, { c0: 'A', c1: 9, c2: 'NEW', c3: 'odd' }];
      await waitUpgrade(grid);

      expect(grid.columns.find((c) => c.field === 'k0|c1')?.width).toBe(320);
    });

    it('empty rows drop every value column', async () => {
      const { grid } = await setup();
      grid.rows = [];
      await waitUpgrade(grid);

      expect(fields(grid)).toEqual(['__pivotLabel', '__pivotTotal']);
    });

    it('a collapsed group stays collapsed when a key is added', async () => {
      const pivot = new PivotPlugin({
        rowGroupFields: ['c0', 'c3'],
        columnGroupFields: ['c2'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showToolPanel: false,
      });
      const grid = createGrid();
      const rows = [{ c0: 'A', c1: 1, c2: 'k0', c3: 'odd' }];
      grid.gridConfig = {
        columns: [{ field: 'c0' }, { field: 'c1' }, { field: 'c2' }, { field: 'c3' }],
        plugins: [pivot],
      };
      grid.rows = rows;
      await waitUpgrade(grid);
      const groupKey = pivot.getPivotResult()?.rows[0].rowKey ?? '';
      pivot.collapse(groupKey);
      await waitUpgrade(grid);
      expect(groupKey).not.toBe('');

      grid.rows = [...rows, { c0: 'A', c1: 9, c2: 'NEW', c3: 'odd' }];
      await waitUpgrade(grid);

      expect(fields(grid)).toContain('NEW|c1');
      expect(pivot.isExpanded(groupKey)).toBe(false);
    });

    it('a ROWS request from a data-change listener still re-runs processRows', async () => {
      const { grid, pivot, rows } = await setup();
      const processRows = vi.spyOn(pivot, 'processRows');
      grid.addEventListener('data-change', () => grid.requestRender(), { once: true });

      grid.rows = [...rows, { c0: 'A', c1: 9, c2: 'NEW', c3: 'odd' }];
      await waitUpgrade(grid);
      await waitUpgrade(grid);

      expect(processRows).toHaveBeenCalledTimes(2);
    });
  });
});
