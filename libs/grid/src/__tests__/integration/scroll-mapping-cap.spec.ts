/**
 * Integration tests for issue #326 — fractional scroll mapping above the
 * browser's max-element-height cap. We simulate the cap with a tiny
 * `maxSpacerHeight` by mutating `_virtualization.scrollMapping` directly so
 * the test does not need to allocate 10M rows.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { computeScrollMapping } from '../../lib/core/internal/virtualization';

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

describe('issue #326 — scroll mapping above max element-height cap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('default scroll mapping is identity for sub-cap datasets', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80 }],
      fitMode: 'fixed',
      virtualization: { enabled: true },
    };
    grid.rows = makeRows(500);
    await waitUpgrade(grid);

    // Sub-cap dataset → identity mapping (capped: false, no transform applied).
    expect(grid._virtualization.scrollMapping.capped).toBe(false);
  });

  it('refreshVirtualWindow translates spacer-space scrollTop into virtual rows', async () => {
    const grid: any = document.createElement('tbw-grid');
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'id', header: 'ID', width: 80 }],
      fitMode: 'fixed',
      virtualization: { enabled: true },
      rowHeight: 34,
    };
    grid.rows = makeRows(1000);
    await waitUpgrade(grid);

    const fauxScrollbar = grid._virtualization.container as HTMLElement;
    expect(fauxScrollbar).toBeTruthy();

    // Simulate a 10M-row dataset on top of a tiny spacer cap. Setting the
    // mapping directly (instead of allocating 10M rows) keeps the test fast
    // while still exercising the real refreshVirtualWindow → toVirtualScrollTop
    // → getRowIndexAtOffset code path.
    const totalRows = 1000;
    const rowHeight = 34;
    const viewportHeight = 600;
    const rawContentHeight = 10_000_000 * rowHeight; // simulate 10M virtual rows
    const tinySpacerCap = totalRows * rowHeight; // pretend the spacer caps at this height
    grid._virtualization.scrollMapping = computeScrollMapping(rawContentHeight, viewportHeight, tinySpacerCap);
    grid._virtualization.cachedViewportHeight = viewportHeight;

    expect(grid._virtualization.scrollMapping.capped).toBe(true);

    // Scrolling near the spacer max maps to row indices well above the cap row
    // (without fractional mapping, start would clamp at ~tinySpacerCap / rowHeight).
    fauxScrollbar.scrollTop = tinySpacerCap - viewportHeight;
    grid.refreshVirtualWindow(true);
    expect(grid._virtualization.start).toBeGreaterThan(9_000_000);
  });
});
