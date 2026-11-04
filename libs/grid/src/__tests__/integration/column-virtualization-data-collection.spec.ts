/**
 * ColumnVirtualization × Export / Clipboard integration (#598).
 *
 * ColumnVirtualizationPlugin windows `grid.columns` down to the rendered slice.
 * Data operations (export, copy) must still see every column, so they resolve
 * their source columns through the `'getFullColumns'` query.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { BaseGridPlugin } from '../../lib/core/plugin/base-plugin';
import type { HeaderRowContribution } from '../../lib/core/plugin/types';
import type { ColumnConfig } from '../../lib/core/types';
import { ClipboardPlugin } from '../../lib/plugins/clipboard/clipboard-plugin';
import { ColumnVirtualizationPlugin } from '../../lib/plugins/column-virtualization/column-virtualization-plugin';
import { ExportPlugin } from '../../lib/plugins/export/export-plugin';
import { GroupingColumnsPlugin } from '../../lib/plugins/grouping-columns/grouping-columns-plugin';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail/master-detail-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';
import { ROW_DRAG_HANDLE_FIELD, RowDragDropPlugin } from '../../lib/plugins/row-drag-drop/row-drag-drop-plugin';
import { TreePlugin } from '../../lib/plugins/tree/tree-plugin';

vi.mock('../../lib/plugins/export/csv', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadCsv: vi.fn(), downloadBlob: vi.fn() };
});
vi.mock('../../lib/plugins/export/excel', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, downloadExcel: vi.fn() };
});

const COLUMN_COUNT = 180;

function makeColumns(): ColumnConfig[] {
  return Array.from({ length: COLUMN_COUNT }, (_, i) => ({ field: `c${i}`, header: `C${i}`, width: 100 }));
}

/**
 * @param columns - Column config
 * @param others - Extra plugins; `virtualizationFirst` registers ColumnVirtualization before them
 * @param rows - Row data (defaults to one row of `<field>-v` values)
 */
async function setup(
  columns = makeColumns(),
  others: BaseGridPlugin[] = [],
  virtualizationFirst = true,
  rows: Record<string, unknown>[] = [Object.fromEntries(columns.map((c) => [c.field, `${c.field}-v`]))],
) {
  const grid = createGrid();
  grid.style.width = '800px';
  Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
  const virtualization = new ColumnVirtualizationPlugin();
  const exporter = new ExportPlugin();
  const clipboard = new ClipboardPlugin();
  const ordered = virtualizationFirst ? [virtualization, ...others] : [...others, virtualization];
  grid.gridConfig = { columns, fitMode: 'fixed', plugins: [...ordered, exporter, clipboard] };
  grid.rows = rows;
  await waitUpgrade(grid);
  return { grid, virtualization, exporter, clipboard };
}

function scrollTo(virtualization: ColumnVirtualizationPlugin, scrollLeft: number) {
  virtualization.onScroll({
    scrollTop: 0,
    scrollLeft,
    scrollHeight: 0,
    scrollWidth: COLUMN_COUNT * 100,
    clientHeight: 0,
    clientWidth: 800,
  });
}

describe('ColumnVirtualization × data collection (#598)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders only a window of columns (precondition)', async () => {
    const { grid, virtualization } = await setup();
    expect(virtualization.getIsVirtualized()).toBe(true);
    expect(grid.columns.length).toBeLessThan(COLUMN_COUNT);
  });

  it('export resolves every column, not just the rendered window', async () => {
    const { exporter } = await setup();
    const resolved = exporter.getResolvedColumns();
    expect(resolved.map((c) => c.field)).toEqual(makeColumns().map((c) => c.field));

    const [row] = exporter.export();
    expect(Object.keys(row)).toHaveLength(COLUMN_COUNT);
    expect(row['c179']).toBe('c179-v');

    const xml = exporter.formatExcel(exporter.export());
    expect(xml.match(/<Cell/g)).toHaveLength(COLUMN_COUNT * 2);
    expect(exporter.formatCsv(exporter.export()).split(/\r?\n/)[0].split(',')).toHaveLength(COLUMN_COUNT);
  });

  it('export still honours params.columns against the full set', async () => {
    const { exporter } = await setup();
    expect(exporter.getResolvedColumns({ columns: ['c0', 'c150'] }).map((c) => c.field)).toEqual(['c0', 'c150']);
  });

  it('export with onlyVisible:false keeps hidden columns in source order', async () => {
    const columns = makeColumns();
    columns[120] = { ...columns[120], hidden: true };
    const { grid, virtualization } = await setup(columns);
    const exporter = new ExportPlugin({ onlyVisible: false });
    exporter.attach(grid);
    expect(virtualization.getIsVirtualized()).toBe(true);
    expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(columns.map((c) => c.field));
  });

  it('a rendered column hidden while virtualized is dropped from the full set', async () => {
    const { grid, exporter } = await setup();
    expect(grid.setColumnVisible('c3', false)).toBe(true);
    await waitUpgrade(grid);
    const fields = exporter.getResolvedColumns().map((c) => c.field);
    expect(fields).toHaveLength(COLUMN_COUNT - 1);
    expect(fields).not.toContain('c3');
  });

  it('stays complete after a horizontal scroll moves the window', async () => {
    const { grid, virtualization, exporter } = await setup();
    scrollTo(virtualization, 10_000);
    await waitUpgrade(grid);
    expect(grid.columns[0].field).not.toBe('c0');
    expect(exporter.getResolvedColumns()).toHaveLength(COLUMN_COUNT);
  });

  it('keeps hidden columns in source order after a scroll (onlyVisible:false)', async () => {
    const columns = makeColumns();
    columns[1] = { ...columns[1], hidden: true };
    columns[120] = { ...columns[120], hidden: true };
    const { grid, virtualization } = await setup(columns);
    scrollTo(virtualization, 10_000);
    await waitUpgrade(grid);
    scrollTo(virtualization, 2_000);
    await waitUpgrade(grid);
    const exporter = new ExportPlugin({ onlyVisible: false });
    exporter.attach(grid);
    expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(columns.map((c) => c.field));
  });

  it('clipboard copies every column when no cell range is selected', async () => {
    const { clipboard } = await setup();
    const [line] = clipboard.getSelectionAsText({ includeHeaders: false }).split(/\r?\n/);
    expect(line.split('\t')).toHaveLength(COLUMN_COUNT);
  });

  it('clipboard columns option resolves against the full set', async () => {
    const { clipboard } = await setup();
    const text = clipboard.getSelectionAsText({ columns: ['c0', 'c170'], includeHeaders: false });
    expect(text.split(/\r?\n/)[0]).toBe('c0-v\tc170-v');
  });

  it('falls back to grid.columns when virtualization is not active', async () => {
    const columns = makeColumns().slice(0, 5);
    const { grid, exporter, virtualization } = await setup(columns);
    expect(virtualization.getIsVirtualized()).toBe(false);
    expect(grid.query('getFullColumns', null)).toEqual([]);
    expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(grid.columns.map((c) => c.field));
  });
});

describe('ColumnVirtualization runs after semantic column transforms (#604 review)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('adopts a shrunken pivot instead of restoring the old window on scroll', async () => {
    const columns = makeColumns().slice(0, 40);
    const rows = Array.from({ length: 40 }, (_, i) => ({ c0: 'A', c1: i, c2: `k${i}` }));
    const pivot = new PivotPlugin({
      rowGroupFields: ['c0'],
      columnGroupFields: ['c2'],
      valueFields: [{ field: 'c1', aggFunc: 'sum' }],
      showToolPanel: false,
    });
    const { grid, virtualization, exporter } = await setup(columns, [pivot], true, rows);
    expect(virtualization.getIsVirtualized()).toBe(true);

    pivot.setColumnGroupFields([]);
    await waitUpgrade(grid);
    // Pivot only rebuilds its columns on the next COLUMNS pass (#605) — the scroll provides it.
    scrollTo(virtualization, 500);
    await waitUpgrade(grid);

    expect(grid.columns.some((c) => c.field.startsWith('k'))).toBe(false);
    expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(['value|c1']);
  });

  it('adopts a smaller new column config while virtualized', async () => {
    const { grid, exporter } = await setup();
    const fewer = Array.from({ length: 100 }, (_, i) => ({ field: `n${i}`, header: `N${i}`, width: 100 }));
    grid.gridConfig = { ...grid.gridConfig, columns: fewer };
    await waitUpgrade(grid);

    expect(grid.columns[0].field).toBe('n0');
    expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(fewer.map((c) => c.field));
  });

  describe.each([
    ['first', true],
    ['last', false],
  ])('ColumnVirtualization registered %s', (_label, virtualizationFirst) => {
    it('keeps a column change made on a later pass (tree rows loaded after first render)', async () => {
      const { grid } = await setup(makeColumns(), [new TreePlugin()], virtualizationFirst, []);
      grid.rows = [
        { id: 1, c0: 'parent', children: [{ id: 2, c0: 'child' }] },
        { id: 3, c0: 'leaf' },
      ];
      await waitUpgrade(grid);

      expect(grid.querySelectorAll('.tree-toggle')).toHaveLength(1);
      expect(grid.querySelectorAll('.tree-cell-wrapper').length).toBeGreaterThan(0);
    });

    it('keeps a hidden right-pinned column at the right edge (onlyVisible:false)', async () => {
      const columns = makeColumns();
      columns[1] = { ...columns[1], hidden: true, pinned: 'right' } as ColumnConfig;
      const { grid } = await setup(columns, [new PinnedColumnsPlugin()], virtualizationFirst);
      const exporter = new ExportPlugin({ onlyVisible: false });
      exporter.attach(grid);
      const expected = [...columns.filter((c) => c.field !== 'c1'), columns[1]].map((c) => c.field);
      expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(expected);
    });

    it('exports pivot columns, not the pre-pivot source columns', async () => {
      const columns = makeColumns().slice(0, 40);
      const pivot = new PivotPlugin({
        rowGroupFields: ['c0'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showToolPanel: false,
      });
      const { grid, exporter } = await setup(columns, [pivot], virtualizationFirst);
      expect(grid.columns[0].field).toBe('__pivotLabel');
      const fields = exporter.getResolvedColumns().map((c) => c.field);
      expect(fields).not.toContain('c0');
      expect(fields).toEqual(grid.columns.map((c) => c.field).filter((f) => !f.startsWith('__')));
    });

    it('exports grouped columns so group header rows span every column', async () => {
      const columns = makeColumns();
      const grouping = new GroupingColumnsPlugin({
        columnGroups: [
          { id: 'g1', header: 'Group One', children: columns.slice(0, 90).map((c) => c.field) },
          { id: 'g2', header: 'Group Two', children: columns.slice(90).map((c) => c.field) },
        ],
      });
      const { grid, exporter } = await setup(columns, [grouping], virtualizationFirst);
      const resolved = exporter.getResolvedColumns();
      expect(resolved).toHaveLength(COLUMN_COUNT);
      const [contribution] = grid.query<HeaderRowContribution | undefined>('collectHeaderRows', { columns: resolved });
      expect(contribution?.cells.map((c) => [c.label, c.span])).toEqual([
        ['Group One', 90],
        ['Group Two', 90],
      ]);
    });
  });
});

describe('ColumnVirtualization keeps utility and pinned columns rendered (#604 review)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** Header padding the plugin applied, as a number. */
  const headerPadding = (grid: HTMLElement): number =>
    parseFloat(grid.querySelector<HTMLElement>('.header-row')?.style.paddingLeft ?? 'NaN');

  describe.each([
    ['first', true],
    ['last', false],
  ])('ColumnVirtualization registered %s', (_label, virtualizationFirst) => {
    it.each([
      ['RowDragDrop handle', () => new RowDragDropPlugin(), ROW_DRAG_HANDLE_FIELD, 40],
      [
        'MasterDetail expander',
        () => new MasterDetailPlugin({ showExpandColumn: true, detailRenderer: () => document.createElement('div') }),
        '__tbw_expander',
        undefined,
      ],
    ])('keeps the %s rendered after a horizontal scroll', async (_name, create, field, width) => {
      const { grid, virtualization } = await setup(makeColumns(), [create()], virtualizationFirst);
      scrollTo(virtualization, 10_000);
      await waitUpgrade(grid);

      const rendered = grid.columns.map((c) => c.field);
      expect(rendered.filter((f) => f === field)).toHaveLength(1);
      expect(rendered[0]).toBe(field);
      expect(rendered).not.toContain('c0');

      const utilityWidth = width ?? Number(grid.columns[0].width);
      const { start } = virtualization.getVisibleColumnRange();
      expect(headerPadding(grid)).toBe(virtualization.getColumnOffset(start) - utilityWidth);
    });
  });

  it('keeps left- and right-pinned columns rendered at the edges after a horizontal scroll', async () => {
    const columns = makeColumns();
    columns[0] = { ...columns[0], pinned: 'left' } as ColumnConfig;
    columns[179] = { ...columns[179], pinned: 'right' } as ColumnConfig;
    const { grid, virtualization } = await setup(columns, [new PinnedColumnsPlugin()]);
    scrollTo(virtualization, 10_000);
    await waitUpgrade(grid);

    const rendered = grid.columns.map((c) => c.field);
    expect(rendered[0]).toBe('c0');
    expect(rendered[rendered.length - 1]).toBe('c179');
    expect(rendered).not.toContain('c1');
    const { start } = virtualization.getVisibleColumnRange();
    expect(headerPadding(grid)).toBe(virtualization.getColumnOffset(start) - 100);
  });
});
