/**
 * Requests made while plugin processRows hooks run (#608, PR #623 review).
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import { GroupingRowsPlugin } from '../../lib/plugins/grouping-rows/grouping-rows-plugin';

type Row = { name: string; region: string };

describe('render scheduler: requests from inside row hooks', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('a group-toggle listener restoring a core sort still re-sorts the rows', async () => {
    const byRegion = (row: Row) => [row.region];
    const grouping = new GroupingRowsPlugin({ groupOn: byRegion });
    const grid = createGrid();
    grid.gridConfig = { columns: [{ field: 'name', sortable: true }, { field: 'region' }], plugins: [grouping] };
    grid.rows = [
      { name: 'c', region: 'N' },
      { name: 'a', region: 'N' },
      { name: 'b', region: 'N' },
    ];
    await waitUpgrade(grid);

    // GroupingRows broadcasts group-toggle from processRows when it applies a deferred expansion;
    // applyColumnState with a sort requests FULL, which must not be folded into that flush.
    grid.addEventListener(
      'group-toggle',
      () => {
        const { columns } = grid.getColumnState();
        grid.applyColumnState({
          columns: columns.map((c) => (c.field === 'name' ? { ...c, sort: { direction: 'asc', priority: 0 } } : c)),
        });
      },
      { once: true },
    );
    grouping.setGroupOn(byRegion, true);
    await waitUpgrade(grid);
    await waitUpgrade(grid);

    const names = grid._rows.flatMap((r: Partial<Row>) => (typeof r.name === 'string' ? [r.name] : []));
    expect(names).toEqual(['a', 'b', 'c']);
  });
});
