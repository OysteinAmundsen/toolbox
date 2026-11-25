/**
 * Regression test for #687 — the documented no-argument
 * `invalidateAccessorCache()` must clear the entire accessor cache so the
 * reactive-accessor recipes (external state changes → invalidate → render)
 * actually refresh the displayed computed values.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { invalidateAccessorCache } from '../../lib/core/internal/value-accessor';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

describe('reactive accessor invalidation (#687)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('re-renders accessor values after a global invalidateAccessorCache()', async () => {
    let rate = 1;
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      getRowId: (row: any) => row.id,
      columns: [
        { field: 'id', width: 80 },
        {
          field: 'derived',
          width: 120,
          valueAccessor: ({ row }: { row: any }) => row.amount * rate,
        },
      ],
    };
    grid.rows = [{ id: 'one', amount: 10 }];

    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    const getDerivedCell = (): HTMLElement => {
      const row = grid.querySelector('.data-grid-row');
      const colIdx = grid._visibleColumns.findIndex((c: any) => c.field === 'derived');
      return row?.children[colIdx] as HTMLElement;
    };

    expect(getDerivedCell()?.textContent).toBe('10');

    // External state the accessor closes over changes — the documented recipe:
    // invalidate globally, request a render.
    rate = 2;
    invalidateAccessorCache();
    grid.requestRender();
    await grid.forceLayout();
    await nextFrame();

    expect(getDerivedCell()?.textContent).toBe('20');
  });
});
