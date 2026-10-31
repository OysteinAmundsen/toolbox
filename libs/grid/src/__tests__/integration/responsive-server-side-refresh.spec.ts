import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { ResponsivePlugin } from '../../lib/plugins/responsive';
import { ServerSidePlugin, type GetRowsParams, type GetRowsResult } from '../../lib/plugins/server-side';

describe('Responsive measurement refresh with ServerSide placeholders', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks newly created plugin-handled rows while the next block is pending', async () => {
    type Row = { name: string };
    const pending: Array<{ params: GetRowsParams; resolve: (result: GetRowsResult<Row>) => void }> = [];
    const getRows = vi.fn(
      (params: GetRowsParams) =>
        new Promise<GetRowsResult<Row>>((resolve) => {
          pending.push({ params, resolve });
        }),
    );
    const responsive = new ResponsivePlugin<Row>({
      breakpoint: 500,
      animation: false,
      hideHeader: true,
      cardRowHeight: 'auto',
      cardRenderer: (row) => {
        const content = document.createElement('div');
        content.textContent = row.name;
        return content;
      },
    });
    const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
    grid.gridConfig = {
      columns: [{ field: 'name' }],
      rowHeight: 120,
      plugins: [
        new ServerSidePlugin<Row>({ pageSize: 2, maxConcurrentRequests: 1, dataSource: { getRows } }),
        responsive,
      ],
    };
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending.shift()!.resolve({ rows: [{ name: 'First' }, { name: 'Second' }], totalNodeCount: 100 });
    await vi.waitFor(() => expect(grid.rows).toHaveLength(100));
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));

    // happy-dom has no layout; provide the same viewport and initial estimate
    // as the browser fixture before reducing the measured card height.
    for (const el of new Set([grid._virtualization.viewportEl!, grid._virtualization.container!])) {
      Object.defineProperty(el, 'clientHeight', { configurable: true, value: 220 });
    }
    grid.refreshVirtualWindow(true);
    responsive.setResponsive(true);
    grid.refreshVirtualWindow(true, true);
    const body = grid._bodyEl!;
    const before = new Set(body.querySelectorAll<HTMLElement>(':scope > .data-grid-row'));
    expect(before.size).toBeGreaterThan(0);
    const card = body.querySelector<HTMLElement>('.responsive-card')!;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ height: 40 } as DOMRect);
    const afterRender = vi.spyOn(responsive, 'afterRender');
    const refresh = vi.spyOn(grid, 'refreshVirtualWindow');

    responsive.afterRender();
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledWith(true, true);
    expect(afterRender).toHaveBeenCalledTimes(1);
    const added = Array.from(body.querySelectorAll<HTMLElement>(':scope > .data-grid-row')).filter(
      (row) => !before.has(row),
    );
    expect(added.length).toBeGreaterThan(0);
    expect(pending.length).toBeGreaterThan(0);
    for (const row of added) {
      expect(row.classList.contains('placeholder-row')).toBe(true);
      expect(row.getAttribute('aria-busy')).toBe('true');
      expect(row.hasAttribute('data-responsive-card')).toBe(true);
      expect(row.hasAttribute('data-responsive-card-hide-header')).toBe(true);
      expect(row.querySelector('.tbw-row-loading-overlay')).not.toBeNull();
    }
  });
});
