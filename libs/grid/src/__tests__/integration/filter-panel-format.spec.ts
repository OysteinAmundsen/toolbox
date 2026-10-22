/**
 * Integration tests: the set filter panel labels values with `column.format(value, row)` (#548).
 *
 * `format` is typed with a required row. Local values are labelled with the first row that holds
 * them; `valuesHandler` values have no row, so the handler can supply `{ value, label }` options,
 * and a `format` that needs the missing row falls back to the raw value instead of breaking the panel.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/filtering';
import { waitUpgrade } from '../../../test/helpers';

interface Row {
  id: number;
  name: string | null;
  prefix: string;
}

const rows: Row[] = [
  { id: 1, name: 'Oslo', prefix: 'NO-' },
  { id: 2, name: 'Bergen', prefix: 'NO-' },
  { id: 3, name: 'Malmö', prefix: 'SE-' },
];

const rowReadingFormat = (value: unknown, row: Row) => `${row.prefix}${value}`;

async function createGrid(filtering: Record<string, unknown> | true, data: Row[] = rows) {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    columns: [
      { field: 'id', header: 'Id', filterable: false },
      { field: 'name', header: 'Name', format: rowReadingFormat },
    ],
    features: { filtering },
  };
  grid.rows = data;
  document.body.appendChild(grid);
  await waitUpgrade(grid);
  return grid;
}

function openNamePanel(grid: HTMLElement) {
  const button = grid.querySelector('[part~="header-cell"][data-col="1"] .tbw-filter-btn') as HTMLElement;
  expect(button).not.toBeNull();
  button.click();
}

function panelItems(): HTMLLabelElement[] {
  return [
    ...document.body.querySelectorAll<HTMLLabelElement>('.tbw-filter-panel .tbw-filter-values .tbw-filter-value-item'),
  ];
}

function panelLabels(): string[] {
  return panelItems().map((item) => item.querySelector('span')?.textContent ?? '');
}

/** Checkbox of the panel entry whose label text is `label`. */
function checkboxFor(label: string): HTMLInputElement {
  const item = panelItems().find((el) => el.querySelector('span')?.textContent === label);
  const checkbox = item?.querySelector<HTMLInputElement>('.tbw-filter-checkbox');
  if (!checkbox) throw new Error(`No filter entry labelled "${label}"`);
  return checkbox;
}

describe('Set filter panel labels (#548)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('calls a row-reading format with the row each value came from', async () => {
    const grid = await createGrid(true);
    openNamePanel(grid);
    await vi.waitFor(() => expect(panelLabels()).toEqual(['NO-Bergen', 'NO-Oslo', 'SE-Malmö']));
  });

  it('uses { value, label } options returned by valuesHandler', async () => {
    const grid = await createGrid({
      valuesHandler: async () => [
        { value: 'Oslo', label: 'Oslo (capital)' },
        { value: 'Bergen', label: 'Bergen' },
      ],
    });
    openNamePanel(grid);
    await vi.waitFor(() => expect(panelLabels()).toEqual(['Bergen', 'Oslo (capital)']));

    const values = [...document.body.querySelectorAll('.tbw-filter-panel .tbw-filter-checkbox[data-value]')].map((cb) =>
      cb.getAttribute('data-value'),
    );
    expect(values).toEqual(['Bergen', 'Oslo']);
  });

  it('falls back to raw values with one TBW062 warning when format needs a row valuesHandler cannot give', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await createGrid({ valuesHandler: async () => ['Oslo', 'Bergen'] });
    openNamePanel(grid);
    await vi.waitFor(() => expect(panelLabels()).toEqual(['Bergen', 'Oslo']));

    const formatWarnings = warn.mock.calls.filter((args) => String(args[0]).includes('TBW062'));
    expect(formatWarnings).toHaveLength(1);
  });

  // PR #553: a server-supplied blank must filter blank rows like the local "(Blank)" entry.
  it('hides blank rows when a labelled blank option from valuesHandler is unchecked, and keeps it unchecked on reopen', async () => {
    const data: Row[] = [...rows, { id: 4, name: null, prefix: '' }];
    const grid = await createGrid(
      {
        valuesHandler: async () => [
          { value: 'Oslo', label: 'Oslo' },
          { value: 'Bergen', label: 'Bergen' },
          { value: 'Malmö', label: 'Malmö' },
          { value: null, label: 'Unassigned' },
        ],
      },
      data,
    );
    const visibleIds = () => (grid._rows as Row[]).map((r) => r.id);
    expect(visibleIds()).toEqual([1, 2, 3, 4]);

    openNamePanel(grid);
    await vi.waitFor(() => expect(panelLabels()).toContain('Unassigned'));
    checkboxFor('Unassigned').click();
    (document.body.querySelector('.tbw-filter-panel .tbw-filter-apply-btn') as HTMLElement).click();

    await vi.waitFor(() => expect(visibleIds()).toEqual([1, 2, 3]));

    openNamePanel(grid);
    await vi.waitFor(() => expect(panelLabels()).toContain('Unassigned'));
    expect(checkboxFor('Unassigned').checked).toBe(false);
    expect(['Oslo', 'Bergen', 'Malmö'].map((label) => checkboxFor(label).checked)).toEqual([true, true, true]);
  });
});
