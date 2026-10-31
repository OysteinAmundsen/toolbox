import { afterEach, describe, expect, it } from 'vitest';
import { nextFrame } from '../../../test/helpers';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { ResponsivePlugin } from '../../lib/plugins/responsive';

/**
 * Responsive morph names across a real layout switch (PR #590 review).
 *
 * The header leaves the row count when the grid enters card mode, so every
 * row's `aria-rowindex` shifts between the pre-snapshot and the post-render
 * naming passes. Names must be keyed on the DATA index so each outgoing row
 * pairs with its own card — including custom cards that carry no `data-row`.
 */
describe('ResponsivePlugin morph names across a view transition (integration)', () => {
  type Row = { a: number; b: string };
  const rows: Row[] = [
    { a: 1, b: 'x' },
    { a: 2, b: 'y' },
    { a: 3, b: 'z' },
  ];

  /** Stand in for `Element.startViewTransition()`, which happy-dom does not implement. */
  function stubViewTransition(host: HTMLElement) {
    const state = { update: undefined as (() => Promise<void>) | undefined };
    let resolveFinished = (): void => undefined;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    Object.assign(host, {
      startViewTransition: (update: () => Promise<void>) => {
        state.update = update;
        return { finished, ready: Promise.resolve() };
      },
    });
    return { state, finish: () => resolveFinished() };
  }

  async function mount(plugin: ResponsivePlugin<Row>): Promise<DataGridElement<Row>> {
    const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
    grid.gridConfig = {
      columns: [{ field: 'a' }, { field: 'b' }],
      plugins: [plugin],
      animation: { mode: 'on' },
    };
    grid.rows = rows;
    document.body.appendChild(grid);
    await grid.ready();
    await nextFrame();
    return grid;
  }

  function ownRows(grid: HTMLElement): HTMLElement[] {
    return Array.from(grid.querySelectorAll<HTMLElement>('.rows > .data-grid-row'));
  }
  function morphNames(grid: HTMLElement): string[] {
    return ownRows(grid).map((r) => r.style.getPropertyValue('view-transition-name'));
  }
  function ariaIndices(grid: HTMLElement): (string | null)[] {
    return ownRows(grid).map((r) => r.getAttribute('aria-rowindex'));
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps each row name stable while the header offset changes (default stacked cards)', async () => {
    const plugin = new ResponsivePlugin<Row>({ breakpoint: 500, animation: 'morph-rows', debounceMs: 0 });
    const grid = await mount(plugin);
    const vt = stubViewTransition(grid);

    plugin.setResponsive(true);
    // Pre-snapshot pass: table mode, header counted, indices 2..4.
    expect(ariaIndices(grid)).toEqual(['2', '3', '4']);
    const before = morphNames(grid);
    expect(before).toHaveLength(3);
    expect(before.every((n) => /^tbw-responsive-row-\d+-\d+$/.test(n))).toBe(true);
    expect(new Set(before).size).toBe(3);

    // Update callback: card mode applied + re-rendered, header dropped, indices 1..3.
    expect(vt.state.update).toBeTypeOf('function');
    await vt.state.update?.();
    expect(grid.hasAttribute('data-responsive')).toBe(true);
    expect(ariaIndices(grid)).toEqual(['1', '2', '3']);
    // Same element, same name: the compositor pairs each row with its own card.
    expect(morphNames(grid)).toEqual(before);

    vt.finish();
    await nextFrame();
    expect(morphNames(grid)).toEqual(['', '', '']);
  });

  it('keeps the names stable with a custom cardRenderer whose root is a .cell[data-row="0"]', async () => {
    const plugin = new ResponsivePlugin<Row>({
      breakpoint: 500,
      animation: 'morph-rows',
      debounceMs: 0,
      // The renderer's own `data-row` says 0 on EVERY card; it must not drive the name.
      cardRenderer: (row) => {
        const card = document.createElement('div');
        card.className = 'cell my-card';
        card.setAttribute('data-row', '0');
        card.textContent = `${row.a}:${row.b}`;
        return card;
      },
    });
    const grid = await mount(plugin);
    const vt = stubViewTransition(grid);

    plugin.setResponsive(true);
    const before = morphNames(grid);
    expect(new Set(before).size).toBe(3);

    await vt.state.update?.();
    // The cards replaced the cells; the name comes from the grid-stamped
    // aria-rowindex decoded with the (now zero) header offset, not from content.
    const cards = ownRows(grid);
    expect(cards.every((r) => r.classList.contains('responsive-card'))).toBe(true);
    expect(cards.every((r) => r.querySelector(':scope > .cell[data-row="0"]') !== null)).toBe(true);
    expect(ariaIndices(grid)).toEqual(['1', '2', '3']);
    const after = morphNames(grid);
    expect(new Set(after).size).toBe(3);
    expect(after).toEqual(before);

    vt.finish();
    await nextFrame();
  });
});
