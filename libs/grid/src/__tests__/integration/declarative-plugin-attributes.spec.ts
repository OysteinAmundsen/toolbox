/**
 * Declarative plugin attribute integration tests (issue #272)
 *
 * Core no longer parses plugin-owned attributes on `<tbw-grid-column>`. Each
 * plugin reads its own attribute from `col.__element` inside `processColumns`.
 * These end-to-end tests mount a real `<tbw-grid>` and verify the declarative
 * attributes actually affect the rendered grid (not just the merged config).
 *
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns';
import { ShellPlugin } from '../../lib/plugins/shell';
import { VisibilityPlugin } from '../../lib/plugins/visibility';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

describe('declarative plugin attributes (issue #272)', () => {
  let grid: any;

  beforeEach(() => {
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('PinnedColumnsPlugin reads declarative `pinned`', () => {
    it('pins a column declared with `pinned="left"` through the full pipeline', async () => {
      grid.innerHTML = `
        <tbw-grid-column field="id" header="ID"></tbw-grid-column>
        <tbw-grid-column field="name" header="Name" pinned="left"></tbw-grid-column>
        <tbw-grid-column field="age" header="Age"></tbw-grid-column>
      `;
      grid.gridConfig = { plugins: [new PinnedColumnsPlugin()] };
      grid.rows = [{ id: 1, name: 'Alice', age: 30 }];
      await waitUpgrade(grid);

      // Core no longer parses `pinned`; the plugin read it from `__element`
      // and the merged config reflects the declarative pin.
      const cfg = await grid.getConfig();
      const nameCol = cfg.columns.find((c: any) => c.field === 'name');
      expect(nameCol.pinned).toBe('left');
    });

    it('keeps a declaratively-pinned column unpinned after a runtime unpin', async () => {
      grid.innerHTML = `
        <tbw-grid-column field="id" header="ID"></tbw-grid-column>
        <tbw-grid-column field="name" header="Name" pinned="left"></tbw-grid-column>
      `;
      grid.gridConfig = { plugins: [new PinnedColumnsPlugin()] };
      grid.rows = [{ id: 1, name: 'Alice' }];
      await waitUpgrade(grid);
      expect((await grid.getConfig()).columns.find((c: any) => c.field === 'name').pinned).toBe('left');

      // Runtime unpin must stick — the attribute supplies the INITIAL pin
      // only and must not be re-applied (re-read from `__element`) on the
      // next render (issue #272 seed-once guarantee).
      const plugin = grid.getPluginByName('pinnedColumns');
      plugin.setPinPosition('name', undefined);
      await nextFrame();
      await nextFrame();

      const cfg = await grid.getConfig();
      const nameCol = cfg.columns.find((c: any) => c.field === 'name');
      expect(nameCol.pinned == null).toBe(true);
    });
  });

  describe('VisibilityPlugin reads declarative `hidden`', () => {
    it('excludes a column declared with `hidden` from the rendered grid', async () => {
      grid.innerHTML = `
        <tbw-grid-column field="id" header="ID"></tbw-grid-column>
        <tbw-grid-column field="secret" header="Secret" hidden></tbw-grid-column>
        <tbw-grid-column field="name" header="Name"></tbw-grid-column>
      `;
      // VisibilityPlugin renders its column list in a shell tool panel, so the
      // shell must be registered first (#370 — opt-in shell, TBW020 otherwise).
      grid.gridConfig = { plugins: [new ShellPlugin(), new VisibilityPlugin()] };
      grid.rows = [{ id: 1, secret: 'x', name: 'Alice' }];
      await waitUpgrade(grid);

      // Only the two visible columns render header cells.
      const headerCells = grid.querySelectorAll('.header-row .cell');
      expect(headerCells.length).toBe(2);
      const headerText = Array.from(headerCells)
        .map((c: any) => c.textContent)
        .join(' ');
      expect(headerText).toContain('ID');
      expect(headerText).toContain('Name');
      expect(headerText).not.toContain('Secret');

      // The hidden column survives in config with `hidden: true`.
      const cfg = await grid.getConfig();
      const secretCol = cfg.columns.find((c: any) => c.field === 'secret');
      expect(secretCol.hidden).toBe(true);
    });

    it('keeps a column visible when declared with `hidden="false"`', async () => {
      grid.innerHTML = `
        <tbw-grid-column field="id" header="ID"></tbw-grid-column>
        <tbw-grid-column field="name" header="Name" hidden="false"></tbw-grid-column>
      `;
      grid.gridConfig = { plugins: [new ShellPlugin(), new VisibilityPlugin()] };
      grid.rows = [{ id: 1, name: 'Alice' }];
      await waitUpgrade(grid);

      const headerCells = grid.querySelectorAll('.header-row .cell');
      expect(headerCells.length).toBe(2);
    });
  });
});
