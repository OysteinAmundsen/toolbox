/**
 * Integration test for issue #326 — verify the default `scrollMapping` is
 * identity for sub-cap datasets so wired-up code paths (scroll listener,
 * `refreshVirtualWindow`, `scrollToRow`) stay byte-identical to pre-#326
 * behavior. The above-cap math is exercised exhaustively at the unit level in
 * `virtualization.spec.ts > computeScrollMapping` /
 * `> toVirtualScrollTop / fromVirtualScrollTop` /
 * `> computeVirtualWindow above MAX_ELEMENT_HEIGHT_PX` — mocking a capped
 * mapping on top of a small live grid would put the renderer in an internally
 * inconsistent state (`start ≫ totalRows`) and not validate anything new.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';

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
    expect(grid._virtualization.scrollMapping.rawContentHeight).toBe(grid._virtualization.scrollMapping.spacerHeight);
  });
});
