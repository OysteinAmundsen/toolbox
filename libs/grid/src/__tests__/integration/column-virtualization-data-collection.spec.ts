/**
 * ColumnVirtualization × Export / Clipboard / column APIs (#598, #603).
 *
 * ColumnVirtualizationPlugin windows only the RENDERED columns (`_visibleColumns`).
 * `grid.columns` and every column API keep operating on the full post-plugin list,
 * and core never feeds the window back into the next `processColumns` pass.
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
import type { ColumnVirtualizationConfig } from '../../lib/plugins/column-virtualization/types';
import { ExportPlugin } from '../../lib/plugins/export/export-plugin';
import { GroupingColumnsPlugin } from '../../lib/plugins/grouping-columns/grouping-columns-plugin';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail/master-detail-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';
import { ReorderPlugin } from '../../lib/plugins/reorder-columns/reorder-plugin';
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
  virtualizationConfig: ColumnVirtualizationConfig = {},
) {
  const grid = createGrid();
  grid.style.width = '800px';
  Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
  const virtualization = new ColumnVirtualizationPlugin(virtualizationConfig);
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

  it('renders only a window of columns while grid.columns keeps the full set', async () => {
    const { grid, virtualization } = await setup();
    expect(virtualization.getIsVirtualized()).toBe(true);
    expect(grid._visibleColumns.length).toBeLessThan(COLUMN_COUNT);
    expect(grid.columns.map((c) => c.field)).toEqual(makeColumns().map((c) => c.field));
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
    expect(grid._visibleColumns[0].field).not.toBe('c0');
    expect(grid.columns).toHaveLength(COLUMN_COUNT);
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

  it('renders every column when virtualization is not active', async () => {
    const columns = makeColumns().slice(0, 5);
    const { grid, exporter, virtualization } = await setup(columns);
    expect(virtualization.getIsVirtualized()).toBe(false);
    expect(grid._visibleColumns.map((c) => c.field)).toEqual(grid.columns.map((c) => c.field));
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

      const rendered = grid._visibleColumns.map((c) => c.field);
      expect(rendered.filter((f) => f === field)).toHaveLength(1);
      expect(rendered[0]).toBe(field);
      expect(rendered).not.toContain('c0');

      const utilityWidth = width ?? Number(grid._visibleColumns[0].width);
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

    const rendered = grid._visibleColumns.map((c) => c.field);
    expect(rendered[0]).toBe('c0');
    expect(rendered[rendered.length - 1]).toBe('c179');
    expect(rendered).not.toContain('c1');
    const { start } = virtualization.getVisibleColumnRange();
    expect(headerPadding(grid)).toBe(virtualization.getColumnOffset(start) - 100);
  });
});

describe('core never feeds the rendered column window back into processColumns (#603)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const renderedFields = (grid: { _visibleColumns: ColumnConfig[] }) => grid._visibleColumns.map((c) => c.field);

  describe.each([
    ['first', true],
    ['last', false],
  ])('ColumnVirtualization registered %s', (_label, virtualizationFirst) => {
    it('A: adds the MasterDetail expander when a renderer arrives after the first render', async () => {
      const masterDetail = new MasterDetailPlugin();
      const { grid } = await setup(makeColumns(), [masterDetail], virtualizationFirst);
      expect(grid.columns.some((c) => c.field === '__tbw_expander')).toBe(false);

      const detail = document.createElement('tbw-grid-detail');
      detail.innerHTML = '<div>{{ row.c0 }}</div>';
      grid.appendChild(detail);
      masterDetail.refreshDetailRenderer();
      await waitUpgrade(grid);

      expect(renderedFields(grid)[0]).toBe('__tbw_expander');
      expect(grid.columns.filter((c) => c.field === '__tbw_expander')).toHaveLength(1);
    });

    it('B: does not re-wrap tree columns across scroll + refreshColumns cycles', async () => {
      const rows = [
        { id: 1, c0: 'parent', children: [{ id: 2, c0: 'child' }] },
        { id: 3, c0: 'leaf' },
      ];
      const { grid, virtualization } = await setup(makeColumns(), [new TreePlugin()], virtualizationFirst, rows);
      for (let i = 0; i < 3; i++) {
        scrollTo(virtualization, 5_000);
        await waitUpgrade(grid);
        grid.refreshColumns();
        await waitUpgrade(grid);
        scrollTo(virtualization, 0);
        await waitUpgrade(grid);
        grid.refreshColumns();
        await waitUpgrade(grid);
      }

      expect(grid.querySelectorAll('.tree-toggle')).toHaveLength(1);
      expect(grid.querySelectorAll('.tree-cell-wrapper .tree-cell-wrapper')).toHaveLength(0);
    });

    it('C: hides an off-window column', async () => {
      const { grid, exporter } = await setup(makeColumns(), [], virtualizationFirst);
      expect(renderedFields(grid)).not.toContain('c150');

      expect(grid.setColumnVisible('c150', false)).toBe(true);
      await waitUpgrade(grid);

      expect(grid.isColumnVisible('c150')).toBe(false);
      expect(exporter.getResolvedColumns().map((c) => c.field)).not.toContain('c150');
      expect(exporter.getResolvedColumns()).toHaveLength(COLUMN_COUNT - 1);
    });

    it('D: shows a configured-hidden column at its source position', async () => {
      const columns = makeColumns();
      columns[2] = { ...columns[2], hidden: true };
      const { grid } = await setup(columns, [], virtualizationFirst);
      expect(renderedFields(grid)).not.toContain('c2');

      expect(grid.setColumnVisible('c2', true)).toBe(true);
      await waitUpgrade(grid);

      const rendered = renderedFields(grid);
      expect(rendered.slice(rendered.indexOf('c1'), rendered.indexOf('c1') + 3)).toEqual(['c1', 'c2', 'c3']);
    });

    it('E: adopts a new config that equals exactly the rendered window', async () => {
      const { grid, exporter } = await setup(makeColumns(), [], virtualizationFirst);
      const window = renderedFields(grid);
      grid.gridConfig = { ...grid.gridConfig, columns: makeColumns().filter((c) => window.includes(c.field)) };
      await waitUpgrade(grid);

      expect(grid.columns.map((c) => c.field)).toEqual(window);
      expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(window);
    });

    it('F: adopts a pivot narrowed to exactly the rendered keys', async () => {
      const columns = makeColumns().slice(0, 3);
      const rows = Array.from({ length: 40 }, (_, i) => ({ c0: 'A', c1: i, c2: `k${i}` }));
      const pivot = new PivotPlugin({
        rowGroupFields: ['c0'],
        columnGroupFields: ['c2'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showTotals: false,
        showToolPanel: false,
      });
      const { grid, virtualization, exporter } = await setup(columns, [pivot], virtualizationFirst, rows);
      expect(virtualization.getIsVirtualized()).toBe(true);

      const renderedKeys = renderedFields(grid).filter((f) => f.includes('|'));
      const keep = new Set(renderedKeys.map((f) => f.split('|')[0]));
      grid.rows = rows.filter((r) => keep.has(r.c2));
      await waitUpgrade(grid);
      // Pivot only rebuilds its columns on the next COLUMNS pass (#605) — the scroll provides it.
      scrollTo(virtualization, 1);
      await waitUpgrade(grid);

      expect(exporter.getResolvedColumns().map((c) => c.field)).toEqual(renderedKeys);
    });

    it('G: pins an in-window column without collapsing the config to the window (#606)', async () => {
      const pinned = new PinnedColumnsPlugin();
      const { grid } = await setup(makeColumns(), [pinned], virtualizationFirst);

      pinned.setPinPosition('c3', 'left');
      await waitUpgrade(grid);

      expect(renderedFields(grid)[0]).toBe('c3');
      expect(grid.columns).toHaveLength(COLUMN_COUNT);
    });
  });
});

describe('rendered-window index space vs full column list (#603 QA)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const altRight = () => new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true });

  const headerFields = (grid: HTMLElement) =>
    [...grid.querySelectorAll<HTMLElement>('.header-row .cell[data-field]')].map((c) => c.dataset.field);

  it.each([
    ['virtualized and scrolled', makeColumns(), 10_000, 'c101'],
    [
      'with a hidden column before the focus',
      makeColumns().map((c, i) => (i === 1 ? { ...c, hidden: true } : c)),
      0,
      'c3',
    ],
    // Swapping the 100px c49 with the 400px c50 moves the window start (PR #607 review).
    [
      'when unequal widths shift the window',
      makeColumns().map((c, i) => (i === 50 ? { ...c, width: 400 } : c)),
      5_050,
      'c49',
    ],
    // Without overscan, swapping c0 behind the 1000px c1 leaves c0 outside the window (PR #607 review).
    [
      'when the move pushes it out of the window',
      makeColumns().map((c, i) => (i === 1 ? { ...c, width: 1000 } : c)),
      0,
      'c0',
      { overscan: 0 },
    ],
  ])(
    'Alt+ArrowRight keeps focus on the moved column (%s)',
    async (_label, columns, scrollLeft, field, config: ColumnVirtualizationConfig = {}) => {
      const reorder = new ReorderPlugin();
      const { grid, virtualization } = await setup(columns, [reorder], true, undefined, config);
      scrollTo(virtualization, scrollLeft);
      await waitUpgrade(grid);
      grid._focusCol = grid._visibleColumns.findIndex((c) => c.field === field);

      reorder.onKeyDown(altRight());
      await waitUpgrade(grid);

      expect(grid._visibleColumns[grid._focusCol]?.field).toBe(field);
    },
  );

  it.each([
    [0, true],
    [3_000, true],
    [0, false],
    [3_000, false],
  ])(
    'renders pivot rows with exactly the rendered columns at scrollLeft %i (virtualization first: %s, PR #607 review)',
    async (scrollLeft, virtualizationFirst) => {
      const rows = Array.from({ length: 40 }, (_, i) => ({ c0: 'A', c1: i, c2: `k${i}` }));
      const pivot = new PivotPlugin({
        rowGroupFields: ['c0'],
        columnGroupFields: ['c2'],
        valueFields: [{ field: 'c1', aggFunc: 'sum' }],
        showToolPanel: false,
      });
      const { grid, virtualization } = await setup(makeColumns().slice(0, 3), [pivot], virtualizationFirst, rows);
      scrollTo(virtualization, scrollLeft);
      await waitUpgrade(grid);

      const rendered = grid._visibleColumns.map((c) => c.field);
      const labelIndex = rendered.indexOf('__pivotLabel');
      expect(labelIndex >= 0).toBe(scrollLeft === 0);
      const pivotRows = [
        ...grid.querySelectorAll<HTMLElement>('.pivot-leaf-row, .pivot-group-row, .pivot-grand-total-row'),
      ];
      expect(pivotRows.length).toBeGreaterThan(0);
      for (const rowEl of pivotRows) {
        const cells = [...rowEl.querySelectorAll<HTMLElement>(':scope > .cell')];
        expect(cells).toHaveLength(rendered.length);
        expect(cells.findIndex((cell) => cell.querySelector('.pivot-label'))).toBe(labelIndex);
      }
    },
  );

  it.each([
    ['shrinks', 0, ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'], 300],
    ['shifts at the same size', 5_000, ['c0'], 500],
  ])(
    'rebuilds header cells when a width-only column state %s the window (PR #607 review)',
    async (_label, scrollLeft, fields, width) => {
      const { grid, virtualization } = await setup();
      scrollTo(virtualization, scrollLeft);
      await waitUpgrade(grid);
      const before = headerFields(grid);
      const state = grid.getColumnState();
      for (const c of state.columns) if (fields.includes(c.field)) c.width = width;

      grid.applyColumnState(state);
      await waitUpgrade(grid);

      expect(headerFields(grid)).not.toEqual(before);
      expect(headerFields(grid)).toEqual(grid._visibleColumns.map((c) => c.field));
    },
  );

  it('keeps a meta.pinned column rendered after a horizontal scroll (PR #607 review)', async () => {
    const columns = makeColumns();
    columns[0] = { ...columns[0], meta: { pinned: 'left' } };
    const { grid, virtualization } = await setup(columns, [new PinnedColumnsPlugin()]);
    scrollTo(virtualization, 10_000);
    await waitUpgrade(grid);

    expect(grid._visibleColumns[0].field).toBe('c0');
  });

  it('keeps a runtime-pinned row-drag handle pinned across refresh and scroll (PR #607 review)', async () => {
    const pinned = new PinnedColumnsPlugin();
    const { grid, virtualization } = await setup(makeColumns(), [new RowDragDropPlugin(), pinned]);
    const handles = () =>
      grid.columns.filter((c) => c.field === ROW_DRAG_HANDLE_FIELD) as (ColumnConfig & { pinned?: string })[];

    pinned.setPinPosition(ROW_DRAG_HANDLE_FIELD, 'left');
    await waitUpgrade(grid);
    grid.refreshColumns();
    await waitUpgrade(grid);
    scrollTo(virtualization, 3_000);
    await waitUpgrade(grid);

    expect(handles().map((c) => c.pinned)).toEqual(['left']);
    expect(grid._visibleColumns[0].field).toBe(ROW_DRAG_HANDLE_FIELD);
  });

  it('clears window padding and keeps tracking scroll when virtualization switches off', async () => {
    const { grid, virtualization } = await setup(makeColumns().slice(0, 35));
    const headerPadding = () => grid.querySelector<HTMLElement>('.header-row')?.style.paddingLeft;
    scrollTo(virtualization, 2_000);
    await waitUpgrade(grid);
    expect(headerPadding()).not.toBe('0px');

    for (const field of ['c29', 'c30', 'c31', 'c32', 'c33', 'c34']) grid.setColumnVisible(field, false);
    await waitUpgrade(grid);
    expect(virtualization.getIsVirtualized()).toBe(false);
    expect(headerPadding()).toBe('');

    scrollTo(virtualization, 0);
    await waitUpgrade(grid);
    grid.showAllColumns();
    await waitUpgrade(grid);
    expect(virtualization.getIsVirtualized()).toBe(true);
    expect(virtualization.getVisibleColumnRange().start).toBe(0);
  });
});
