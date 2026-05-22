import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import type { RenderDetail } from '../../lib/core/types';
import { RenderPhase } from '../../lib/core/internal/render-scheduler';

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function waitUpgrade(grid: any) {
  await customElements.whenDefined('tbw-grid');
  const start = Date.now();
  while (!grid.hasAttribute('data-upgraded')) {
    if (Date.now() - start > 3000) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (grid.ready) {
    try {
      await grid.ready();
    } catch {
      /* empty */
    }
  }
  await nextFrame();
}

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i, name: `Row ${i}` }));
}

describe('render CustomEvent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fires at least once during the initial render and reports initial=true', async () => {
    const grid: any = document.createElement('tbw-grid');
    const events: RenderDetail[] = [];
    grid.addEventListener('render', (e: CustomEvent<RenderDetail>) => events.push(e.detail));

    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 200 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = makeRows(10);
    await waitUpgrade(grid);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].initial).toBe(true);
    expect(events[0].rowCount).toBe(10);
    // Subsequent renders (if any) must be initial=false
    for (let i = 1; i < events.length; i++) {
      expect(events[i].initial).toBe(false);
    }
  });

  it('fires again after a programmatic row mutation, so consumers can act on the DOM with { once: true }', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 200 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = makeRows(3);
    await waitUpgrade(grid);

    // Replace rows and listen with { once: true }
    const detail = await new Promise<RenderDetail>((resolve) => {
      grid.addEventListener('render', (e: CustomEvent<RenderDetail>) => resolve(e.detail), { once: true });
      grid.rows = makeRows(5);
    });

    expect(detail.initial).toBe(false);
    expect(detail.rowCount).toBe(5);
    // ROWS phase or higher should have run
    expect(detail.phase).toBeGreaterThanOrEqual(RenderPhase.ROWS);
  });

  it('fires after forceLayout() resolves', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80 }],
      fitMode: 'fixed',
    };
    grid.rows = makeRows(3);
    await waitUpgrade(grid);

    let fired = false;
    grid.addEventListener('render', () => (fired = true), { once: true });
    await grid.forceLayout();

    expect(fired).toBe(true);
  });

  it('the rendered DOM is in place when the render listener runs', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 200 },
      ],
      fitMode: 'fixed',
    };
    grid.rows = makeRows(3);
    await waitUpgrade(grid);

    const cellCountInDom = await new Promise<number>((resolve) => {
      grid.addEventListener(
        'render',
        () => {
          // `<tbw-grid>` is light-DOM; `_bodyEl` is the internal `.rows`
          // container. Cells carry both `data-row` and `data-col`, so this
          // counts rendered cells (8 for a 4-row × 2-col grid).
          const cells = grid._bodyEl?.querySelectorAll?.('[data-row]') ?? [];
          resolve(cells.length);
        },
        { once: true },
      );
      grid.rows = makeRows(4);
    });

    // At minimum the cells should be present (>= 1 — bypass threshold renders all)
    expect(cellCountInDom).toBeGreaterThan(0);
  });
});
