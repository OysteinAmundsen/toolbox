import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import type { TbwScrollDetail } from '../../lib/core/types';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i, name: `Row ${i}` }));
}

describe('tbw-scroll CustomEvent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dispatches tbw-scroll on vertical scroll with vertical direction and geometry', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name', width: 200 },
      ],
      fitMode: 'fixed',
      virtualization: { enabled: true },
    };
    grid.rows = makeRows(500);
    await waitUpgrade(grid);

    const events: TbwScrollDetail[] = [];
    grid.addEventListener('tbw-scroll', (e: CustomEvent<TbwScrollDetail>) => {
      events.push(e.detail);
    });

    // Trigger a vertical scroll on the faux scrollbar container
    const fauxScrollbar = grid._virtualization.container as HTMLElement | undefined;
    if (!fauxScrollbar) {
      throw new Error('faux scrollbar not present — virtualization not initialized');
    }
    fauxScrollbar.scrollTop = 250;
    fauxScrollbar.dispatchEvent(new Event('scroll'));
    await nextFrame(2);
    await nextFrame(2);

    expect(events.length).toBeGreaterThan(0);
    const detail = events[events.length - 1];
    expect(detail.direction).toBe('vertical');
    expect(detail.scrollTop).toBeGreaterThanOrEqual(0);
    expect(detail.scrollHeight).toBeGreaterThanOrEqual(0);
    expect(detail.clientHeight).toBeGreaterThanOrEqual(0);
  });

  it('dispatches a fresh detail object per tick (not a pooled reference)', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80 }],
      fitMode: 'fixed',
      virtualization: { enabled: true },
    };
    grid.rows = makeRows(500);
    await waitUpgrade(grid);

    const details: TbwScrollDetail[] = [];
    grid.addEventListener('tbw-scroll', (e: CustomEvent<TbwScrollDetail>) => {
      details.push(e.detail);
    });

    const fauxScrollbar = grid._virtualization.container as HTMLElement;
    fauxScrollbar.scrollTop = 100;
    fauxScrollbar.dispatchEvent(new Event('scroll'));
    await nextFrame(2);
    await nextFrame(2);
    fauxScrollbar.scrollTop = 200;
    fauxScrollbar.dispatchEvent(new Event('scroll'));
    await nextFrame(2);
    await nextFrame(2);

    // We need at least two dispatches to verify they're distinct objects
    expect(details.length).toBeGreaterThanOrEqual(2);
    const a = details[0];
    const b = details[details.length - 1];
    // Distinct object identities — not the pooled plugin event
    expect(a).not.toBe(b);
  });

  it('event bubbles and crosses shadow DOM (composed: true)', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80 }],
      fitMode: 'fixed',
      virtualization: { enabled: true },
    };
    grid.rows = makeRows(500);
    await waitUpgrade(grid);

    let received: Event | undefined;
    document.body.addEventListener('tbw-scroll', (e) => {
      received = e;
    });

    const fauxScrollbar = grid._virtualization.container as HTMLElement;
    fauxScrollbar.scrollTop = 150;
    fauxScrollbar.dispatchEvent(new Event('scroll'));
    await nextFrame(2);
    await nextFrame(2);

    expect(received).toBeDefined();
    expect((received as Event).bubbles).toBe(true);
    expect((received as Event).composed).toBe(true);
  });

  it('does not dispatch when the grid is disconnected', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80 }],
      fitMode: 'fixed',
      virtualization: { enabled: true },
    };
    grid.rows = makeRows(500);
    await waitUpgrade(grid);

    let count = 0;
    grid.addEventListener('tbw-scroll', () => count++);

    grid.remove();
    await nextFrame(2);

    // After removal, even if internals fire, #emit guards on #connected
    const fauxScrollbar = grid._virtualization.container as HTMLElement | undefined;
    if (fauxScrollbar) {
      fauxScrollbar.scrollTop = 100;
      fauxScrollbar.dispatchEvent(new Event('scroll'));
    }
    await nextFrame(2);
    await nextFrame(2);

    expect(count).toBe(0);
  });
});
