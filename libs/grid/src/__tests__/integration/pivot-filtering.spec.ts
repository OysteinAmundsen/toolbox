/**
 * Filters on pivot-generated fields apply to the pivot rows, not the source rows (#622).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { GridConfig } from '../../lib/core/types';
import { EditingPlugin } from '../../lib/plugins/editing/editing-plugin';
import { FilteringPlugin } from '../../lib/plugins/filtering/filtering-plugin';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';
import type { PivotConfig } from '../../lib/plugins/pivot/types';

const rows = [
  { c0: 'A', c3: 'x', c1: 1, c2: 'k0' },
  { c0: 'A', c3: 'y', c1: 5, c2: 'k1' },
  { c0: 'B', c3: 'x', c1: 4, c2: 'k0' },
  { c0: 'B', c3: 'y', c1: 3, c2: 'k2' },
];

function mount(
  config: Partial<PivotConfig> = {},
  filteringFirst = true,
  sourceRows: object[] = rows,
  gridConfig: Partial<GridConfig> = {},
) {
  const filtering = new FilteringPlugin();
  const pivot = new PivotPlugin({
    rowGroupFields: ['c0'],
    columnGroupFields: ['c2'],
    valueFields: [{ field: 'c1', aggFunc: 'sum' }],
    showToolPanel: false,
    ...config,
  });
  const grid = createGrid();
  grid.gridConfig = {
    columns: [{ field: 'c0' }, { field: 'c1', type: 'number' }, { field: 'c2' }, { field: 'c3' }],
    ...gridConfig,
    plugins: [...(filteringFirst ? [filtering, pivot] : [pivot, filtering]), ...(gridConfig.plugins ?? [])],
  };
  grid.rows = sourceRows;
  return { grid, filtering, pivot };
}

async function setup(...args: Parameters<typeof mount>) {
  const mounted = mount(...args);
  await waitUpgrade(mounted.grid);
  return mounted;
}

type Mounted = ReturnType<typeof mount>;

const fields = (grid: { columns: { field: string }[] }) => grid.columns.map((c) => c.field);
const labels = (grid: { rows: unknown[] }) => grid.rows.map((r) => (r as { __pivotLabel: string }).__pivotLabel);

/** Every `[pivotActive, filteringFirst]` combination. */
const ACTIVE_BY_ORDER = [
  [true, true],
  [true, false],
  [false, true],
  [false, false],
] as const;

/** A source-field `keep` filter leaves pivot group `A`, or the matching source rows while pivot is off. */
function expectSourceFiltered(
  grid: Mounted['grid'],
  pivotActive: boolean,
  read: (row: Record<string, unknown>) => unknown,
  expected: unknown[],
) {
  if (pivotActive) expect(labels(grid)).toEqual(['A']);
  else expect(grid.rows.map(read)).toEqual(expected);
}

describe('Filtering + Pivot (#622)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([true, false])('filters pivot rows by a value column (filtering first: %s)', async (filteringFirst) => {
    const { grid, filtering } = await setup({}, filteringFirst);
    expect(labels(grid)).toEqual(['A', 'B']);

    filtering.setFilter('k0|c1', { type: 'number', operator: 'greaterThan', value: 1 });
    await waitUpgrade(grid);

    expect(labels(grid)).toEqual(['B']);
    expect(fields(grid)).toEqual(['__pivotLabel', 'k0|c1', 'k1|c1', 'k2|c1', '__pivotTotal']);
    // The filter can still be cleared from the column's header button.
    expect(grid.querySelector('.header-row [data-field="k0|c1"] .tbw-filter-btn')).not.toBeNull();
  });

  it('clearing the filter restores every pivot row', async () => {
    const { grid, filtering } = await setup();
    filtering.setFilter('k0|c1', { type: 'number', operator: 'greaterThan', value: 1 });
    await waitUpgrade(grid);

    filtering.clearFieldFilter('k0|c1');
    await waitUpgrade(grid);

    expect(labels(grid)).toEqual(['A', 'B']);
  });

  it('filters by the row label and the total column', async () => {
    const { grid, filtering } = await setup();
    filtering.setFilter('__pivotLabel', { type: 'text', operator: 'equals', value: 'A' });
    await waitUpgrade(grid);
    expect(labels(grid)).toEqual(['A']);

    filtering.setFilter('__pivotLabel', null);
    filtering.setFilter('__pivotTotal', { type: 'number', operator: 'greaterThan', value: 6 });
    await waitUpgrade(grid);
    expect(labels(grid)).toEqual(['B']);
  });

  it('a source-field filter still narrows the rows that are aggregated', async () => {
    const { grid, filtering, pivot } = await setup();
    filtering.setFilter('c3', { type: 'text', operator: 'equals', value: 'x' });
    await waitUpgrade(grid);

    expect(fields(grid)).toEqual(['__pivotLabel', 'k0|c1', '__pivotTotal']);
    expect(pivot.getPivotResult()?.grandTotal).toBe(5);
  });

  it('keeps the parent group of a matching child row', async () => {
    const { grid, filtering } = await setup({ rowGroupFields: ['c0', 'c3'] });
    filtering.setFilter('__pivotLabel', { type: 'text', operator: 'equals', value: 'y' });
    await waitUpgrade(grid);

    // Groups A and B fail the filter themselves but stay as parents of their matching `y` rows.
    expect(labels(grid)).toEqual(['A', 'y', 'B', 'y']);
  });

  it('ignores a filter on a pivot column that no longer exists', async () => {
    const { grid, filtering } = await setup();
    filtering.setFilter('k2|c1', { type: 'number', operator: 'greaterThan', value: 0 });
    await waitUpgrade(grid);
    expect(labels(grid)).toEqual(['B']);

    grid.rows = rows.filter((r) => r.c2 !== 'k2');
    await waitUpgrade(grid);

    expect(fields(grid)).not.toContain('k2|c1');
    expect(labels(grid)).toEqual(['A', 'B']);
  });

  it('keeps a pivot-field filter dormant while pivot is disabled', async () => {
    const { grid, filtering, pivot } = await setup();
    filtering.setFilter('k0|c1', { type: 'number', operator: 'greaterThan', value: 1 });
    await waitUpgrade(grid);

    pivot.disablePivot();
    await waitUpgrade(grid);
    expect(grid.rows).toHaveLength(rows.length);

    pivot.enablePivot();
    await waitUpgrade(grid);
    expect(labels(grid)).toEqual(['B']);
  });

  it('reads filter-panel values for a pivot column from the pivot rows', async () => {
    const { grid, filtering } = await setup();
    filtering.setFilter('k0|c1', { type: 'number', operator: 'greaterThan', value: 1 });
    await waitUpgrade(grid);

    // Both aggregates stay listed, including the one the filter currently hides.
    expect(filtering.getUniqueValues('k0|c1')).toEqual([1, 4]);
    expect(filtering.getUniqueValues('__pivotLabel')).toEqual(['A', 'B']);
  });

  it.each([true, false])(
    'recomputes an in-filter complement from rebuilt pivot rows when opening the panel (filtering first: %s)',
    async (filteringFirst) => {
      const { grid, filtering } = await setup({}, filteringFirst);
      filtering.setFilter('__pivotLabel', { type: 'set', operator: 'in', value: ['A'] });
      await waitUpgrade(grid);

      grid.rows = [...rows, { c0: 'C', c3: 'x', c1: 6, c2: 'k0' }];
      await waitUpgrade(grid);

      grid.querySelector<HTMLButtonElement>('.header-row [data-field="__pivotLabel"] .tbw-filter-btn')?.click();
      const panel = document.querySelector<HTMLElement>('.tbw-filter-panel');
      expect(panel).not.toBeNull();
      const cCheckbox = [...panel!.querySelectorAll<HTMLLabelElement>('.tbw-filter-value-item')]
        .find((item) => item.textContent?.trim() === 'C')
        ?.querySelector<HTMLInputElement>('.tbw-filter-checkbox');
      expect(cCheckbox?.checked).toBe(false);

      panel!.querySelector<HTMLButtonElement>('.tbw-filter-apply-btn')?.click();
      expect(filtering.getFilter('__pivotLabel')?.value).toEqual(['A']);
    },
  );

  it.each(ACTIVE_BY_ORDER)(
    'filters an undisplayed pivot-like source field (pivot active: %s, filtering first: %s)',
    async (pivotActive, filteringFirst) => {
      const sourceRows = rows.map((row, i) => ({
        ...row,
        'tenant|id': i === 0 ? 'keep' : 'skip',
      }));
      const { grid, filtering } = mount({ active: pivotActive }, filteringFirst, sourceRows);
      filtering.setFilter('tenant|id', { type: 'text', operator: 'equals', value: 'keep' }, { silent: true });
      await waitUpgrade(grid);
      expectSourceFiltered(grid, pivotActive, (row) => row['tenant|id'], ['keep']);
    },
  );

  it.each([
    [
      'an in-place row update',
      ({ grid }: Mounted) => {
        grid.updateRow('row-0', { 'tenant|id': 'keep' });
        grid.updateRow('row-1', { 'tenant|id': 'skip' });
      },
    ],
    [
      'a direct mutation and pivot refresh',
      ({ grid, pivot }: Mounted) => {
        Object.assign(grid.sourceRows[0], { 'tenant|id': 'keep' });
        pivot.refresh();
      },
    ],
  ])('invalidates cached source fields after %s', async (_label, mutate) => {
    const sourceRows = rows.map((row, i) => ({ ...row, id: `row-${i}` }));
    const mounted = await setup({}, true, sourceRows, { getRowId: (row) => row.id });
    const { grid, filtering } = mounted;

    expect(grid.query<boolean>('rows:is-generated-field', 'tenant|id')).toEqual([true]);
    mutate(mounted);
    await waitUpgrade(grid);

    filtering.setFilter('tenant|id', { type: 'text', operator: 'equals', value: 'keep' });
    await waitUpgrade(grid);
    expect(labels(grid)).toEqual(['A']);
  });

  it.each([true, false])(
    'recomputes an in-filter complement after regrouping without replacing source rows (filtering first: %s)',
    async (filteringFirst) => {
      const { grid, filtering, pivot } = await setup({}, filteringFirst);
      filtering.setFilter('__pivotLabel', { type: 'set', operator: 'in', value: ['A'] });
      await waitUpgrade(grid);

      const filterButton = grid.querySelector<HTMLButtonElement>(
        '.header-row [data-field="__pivotLabel"] .tbw-filter-btn',
      );
      filterButton?.click();
      expect(document.querySelector('.tbw-filter-panel')).not.toBeNull();
      filterButton?.click();
      expect(document.querySelector('.tbw-filter-panel')).toBeNull();

      pivot.setRowGroupFields(['c3']);
      await waitUpgrade(grid);

      filterButton?.click();
      const panel = document.querySelector<HTMLElement>('.tbw-filter-panel');
      expect(panel).not.toBeNull();
      const items = [...panel!.querySelectorAll<HTMLLabelElement>('.tbw-filter-value-item')].slice(1);
      expect(items.map((item) => item.textContent?.trim())).toEqual(['x', 'y']);
      expect(items.every((item) => !item.querySelector<HTMLInputElement>('.tbw-filter-checkbox')?.checked)).toBe(true);

      panel!.querySelector<HTMLButtonElement>('.tbw-filter-apply-btn')?.click();
      expect(filtering.getFilter('__pivotLabel')?.value).toEqual([]);
      expect(labels(grid)).toEqual([]);
    },
  );

  it('invalidates cached source fields after an editor commit and its rollback', async () => {
    let commit: ((value: unknown) => void) | undefined;
    const editing = new EditingPlugin({ dirtyTracking: true });
    const sourceRows = rows.map((row, i) => ({ ...row, id: `row-${i}`, tenant: null as object | null }));
    const { grid, filtering } = await setup({ active: false }, true, sourceRows, {
      columns: [
        { field: 'c0' },
        { field: 'c1', type: 'number' },
        { field: 'c2' },
        { field: 'c3' },
        {
          field: 'tenant',
          editable: true,
          editor: (ctx) => {
            commit = ctx.commit;
            return document.createElement('span');
          },
        },
      ],
      getRowId: (row) => row.id,
      plugins: [editing],
    });

    // No row has `tenant.id|code` yet, so it reads as a pivot output and the filter stays dormant.
    filtering.setFilter('tenant.id|code', { type: 'text', operator: 'equals', value: 'keep' });
    await waitUpgrade(grid);
    expect(grid.rows).toHaveLength(4);

    editing.beginCellEdit(0, 'tenant');
    commit?.({ 'id|code': 'keep' });
    editing.commitActiveRowEdit();
    // Closing the row edit re-renders the row only; the next ROWS pass must see the new field.
    grid.requestRender();
    await waitUpgrade(grid);
    expect(grid.rows.map((row) => row.id)).toEqual(['row-0']);

    editing.revertRow('row-0');
    await waitUpgrade(grid);
    expect(grid.rows).toHaveLength(4);
  });

  it('caches a generated-field ownership miss until the source rows change', async () => {
    let probes = 0;
    const counted = rows.map(
      (row) =>
        new Proxy(row, {
          has(target, key) {
            if (key === 'k0|c1') probes++;
            return key in target;
          },
        }),
    );
    const { grid, filtering } = await setup({}, true, counted);

    expect(grid.query<boolean>('rows:is-generated-field', 'k0|c1')).toEqual([true]);
    const firstScan = probes;
    expect(firstScan).toBe(counted.length);

    filtering.setFilter('k0|c1', { type: 'number', operator: 'greaterThan', value: 1 });
    await waitUpgrade(grid);
    grid.requestRender();
    await waitUpgrade(grid);
    expect(grid.query<boolean>('rows:is-generated-field', 'k0|c1')).toEqual([true]);
    expect(probes).toBe(firstScan);
    expect(labels(grid)).toEqual(['B']);

    await grid.insertRow(0, { ...rows[0], 'k0|c1': 0 }, false);
    expect(grid.query<boolean>('rows:is-generated-field', 'k0|c1')).toEqual([false]);
  });

  it.each(ACTIVE_BY_ORDER)(
    'filters a nested pivot-like source field (pivot active: %s, filtering first: %s)',
    async (pivotActive, filteringFirst) => {
      const sourceRows = rows.map((row, i) => ({
        ...row,
        tenant: { 'id|code': i === 0 ? 'keep' : 'skip' },
      }));
      const { grid, filtering } = mount({ active: pivotActive }, filteringFirst, sourceRows);
      filtering.setFilter('tenant.id|code', { type: 'text', operator: 'equals', value: 'keep' }, { silent: true });
      await waitUpgrade(grid);
      expectSourceFiltered(grid, pivotActive, (row) => (row.tenant as { 'id|code': string })['id|code'], ['keep']);
    },
  );

  it.each(ACTIVE_BY_ORDER)(
    'filters a runtime computed source column added in the same update (pivot active: %s, filtering first: %s)',
    async (pivotActive, filteringFirst) => {
      const { grid, filtering } = await setup({ active: pivotActive }, filteringFirst);

      grid.columns = [
        { field: 'c0' },
        { field: 'c1', type: 'number' },
        { field: 'c2' },
        { field: 'c3' },
        { field: 'tenant|id', filterValue: (_value: unknown, row: Record<string, unknown>) => row.c0 },
      ];
      filtering.setFilter('tenant|id', { type: 'text', operator: 'equals', value: 'A' });
      await waitUpgrade(grid);
      expectSourceFiltered(grid, pivotActive, (row) => row.c0, ['A', 'A']);
    },
  );

  it.each(['getter', 'non-enumerable'] as const)(
    'filters an undisplayed source field exposed as a %s property while Pivot is disabled',
    async (propertyKind) => {
      class GetterSourceRow {
        c0: string;
        c1: number;
        c2: string;
        c3: string;
        sourceValue: string;

        constructor(row: (typeof rows)[number], sourceValue: string) {
          this.c0 = row.c0;
          this.c1 = row.c1;
          this.c2 = row.c2;
          this.c3 = row.c3;
          this.sourceValue = sourceValue;
        }

        get ['tenant|id'](): string {
          return this.sourceValue;
        }
      }

      const sourceRows = rows.map((row, i) => {
        const sourceValue = i === 0 ? 'keep' : 'skip';
        if (propertyKind === 'getter') return new GetterSourceRow(row, sourceValue);

        const source = { ...row, sourceValue };
        Object.defineProperty(source, 'tenant|id', { value: sourceValue });
        return source;
      });
      const { grid, filtering } = await setup({ active: false }, true, sourceRows);

      filtering.setFilter('tenant|id', { type: 'text', operator: 'equals', value: 'keep' });
      await waitUpgrade(grid);

      expect(grid.rows.map((row) => row.sourceValue)).toEqual(['keep']);
    },
  );

  it.each([true, false])(
    'filters a nested pivot-like source field exposed by an inherited getter (filtering first: %s)',
    async (filteringFirst) => {
      class Tenant {
        constructor(private readonly sourceValue: string) {}

        get ['id|code'](): string {
          return this.sourceValue;
        }
      }

      const { grid, filtering } = await setup({ active: false }, filteringFirst);
      grid.rows = rows.map((row, i) => ({
        ...row,
        tenant: new Tenant(i === 0 ? 'keep' : 'skip'),
      }));
      await waitUpgrade(grid);

      filtering.setFilter('tenant.id|code', { type: 'text', operator: 'equals', value: 'keep' });
      await waitUpgrade(grid);

      expect(grid.rows.map((row) => row.c0)).toEqual(['A']);
    },
  );

  it('keeps filters on a hidden total column dormant', async () => {
    const { grid, filtering } = await setup({ showTotals: false });
    expect(fields(grid)).not.toContain('__pivotTotal');

    filtering.setFilter('__pivotTotal', { type: 'number', operator: 'greaterThan', value: 1000 });
    await waitUpgrade(grid);

    expect(labels(grid)).toEqual(['A', 'B']);
  });
});
