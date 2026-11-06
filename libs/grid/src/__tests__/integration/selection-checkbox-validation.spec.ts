/**
 * Selection's checkbox column declares `pinned: 'left'`. Without PinnedColumns,
 * later COLUMNS passes must not trip plugin-property validation (#626).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { validatePluginProperties } from '../../lib/core/internal/validate-config';
import { SelectionPlugin } from '../../lib/plugins/selection/selection-plugin';

const fields = (grid: DataGridElement) => grid.columns.map((c) => c.field);
const headerFields = (grid: DataGridElement) =>
  [...grid.querySelectorAll('.header-row [data-field]')].map((el) => el.getAttribute('data-field'));

async function setup() {
  const grid = createGrid();
  grid.gridConfig = {
    columns: ['c0', 'c1', 'c2'].map((field) => ({ field, header: field.toUpperCase() })),
    plugins: [new SelectionPlugin({ mode: 'row', checkbox: true })],
  };
  grid.rows = [{ c0: 'a', c1: 1, c2: 'x' }];
  await waitUpgrade(grid);
  return grid;
}

describe('Selection checkbox column without PinnedColumns (#626)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('later COLUMNS passes run (setColumnVisible)', async () => {
    const grid = await setup();
    expect(fields(grid)).toEqual(['__tbw_checkbox', 'c0', 'c1', 'c2']);

    grid.setColumnVisible('c1', false);
    await waitUpgrade(grid);
    expect(headerFields(grid)).toEqual(['__tbw_checkbox', 'c0', 'c2']);

    grid.setColumnVisible('c1', true);
    await waitUpgrade(grid);
    expect(headerFields(grid)).toEqual(['__tbw_checkbox', 'c0', 'c1', 'c2']);
  });

  it('the merged config with the generated column validates cleanly', async () => {
    const grid = await setup();
    expect(() => validatePluginProperties(grid.gridConfig, [], grid.id)).not.toThrow();
  });

  it('a gridConfig round-trip carrying the checkbox column re-renders', async () => {
    const grid = await setup();
    const config = grid.gridConfig;
    expect(config.columns?.[0].field).toBe('__tbw_checkbox');

    grid.gridConfig = {
      ...config,
      columns: config.columns?.map((c) => (c.field === 'c0' ? { ...c, header: 'Renamed' } : c)),
    };
    await waitUpgrade(grid);

    expect(headerFields(grid)).toEqual(['__tbw_checkbox', 'c0', 'c1', 'c2']);
    expect(grid.querySelector('.header-row [data-field="c0"]')?.textContent).toContain('Renamed');
  });
});
