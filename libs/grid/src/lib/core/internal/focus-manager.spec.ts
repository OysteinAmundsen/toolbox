/**
 * FocusManager — scroll-to-row offset tests.
 *
 * Covers WCAG 2.2 SC 2.4.11 Focus Not Obscured: a plugin that paints over the
 * rows viewport (sticky-row clones) reports the space it obscures, and
 * `scrollToRow` must land the target row inside the remaining usable band
 * rather than underneath the overlay.
 *
 * These assertions cannot live in the integration suite — happy-dom reports
 * `clientHeight: 0` for every element, so the real grid bails out of
 * `scrollToRow` before the offset math runs.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GridHost } from '../types';
import { FocusManager } from './focus-manager';

const ROW_H = 30;
const VIEWPORT_H = 300; // 10 rows

interface ScrollStub {
  scrollTop: number;
  scrollTo: ReturnType<typeof vi.fn>;
}

function createManager(
  offsets?: { top: number; bottom: number; skipScroll?: boolean },
  initialScrollTop = 0,
) {
  const scrollEl: ScrollStub = { scrollTop: initialScrollTop, scrollTo: vi.fn() };

  const grid = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    _rows: Array.from({ length: 100 }, (_, i) => ({ id: i })),
    _columns: [{ field: 'c0' }],
    _visibleColumns: [{ field: 'c0' }],
    _virtualization: {
      enabled: true,
      rowHeight: ROW_H,
      container: scrollEl,
      viewportEl: { clientHeight: VIEWPORT_H },
      positionCache: null,
      variableHeights: false,
      // Non-capped mapping — `fromVirtualScrollTop` is the identity, so the
      // assertions below read as plain pixel offsets.
      scrollMapping: {
        capped: false,
        spacerHeight: 100 * ROW_H,
        rawContentHeight: 100 * ROW_H,
        viewportHeight: VIEWPORT_H,
      },
    },
    _getVerticalScrollOffsets: offsets ? () => offsets : undefined,
  } as unknown as GridHost;

  return { manager: new FocusManager(grid), scrollEl };
}

describe('FocusManager.scrollToRow — vertical offsets (#449)', () => {
  it('aligns "start" below an overlay covering the top of the viewport', () => {
    const { manager, scrollEl } = createManager({ top: 60, bottom: 0 });

    manager.scrollToRow(20, { align: 'start' });

    // Row 20 sits at y=600. Without the offset it would land at 600 and be
    // hidden under the 60px sticky-rows overlay.
    expect(scrollEl.scrollTop).toBe(540);
  });

  it('aligns "end" above an overlay covering the bottom of the viewport', () => {
    const { manager, scrollEl } = createManager({ top: 0, bottom: 45 });

    manager.scrollToRow(20, { align: 'end' });

    // usableH = 300 - 45 = 255; target = rowBottom(630) - 255 = 375
    expect(scrollEl.scrollTop).toBe(375);
  });

  it('centres within the usable band, not the full viewport', () => {
    const { manager, scrollEl } = createManager({ top: 60, bottom: 0 });

    manager.scrollToRow(20, { align: 'center' });

    // usableH = 240; target = 600 - 60 - 120 + 15 = 435
    expect(scrollEl.scrollTop).toBe(435);
  });

  it('treats a row hidden under the overlay as not visible for "nearest"', () => {
    // Viewport shows y 600..900 natively, but the top 60px are obscured, so the
    // real band is 660..900. Row 20 (600..630) is fully inside the native
    // viewport yet completely hidden — it must still be scrolled clear.
    const { manager, scrollEl } = createManager({ top: 60, bottom: 0 }, 600);

    manager.scrollToRow(20);

    expect(scrollEl.scrollTop).toBe(540);
  });

  it('leaves scroll untouched when the row is already inside the usable band', () => {
    const { manager, scrollEl } = createManager({ top: 60, bottom: 0 }, 540);

    manager.scrollToRow(20);

    expect(scrollEl.scrollTop).toBe(540);
  });

  it('does not scroll at all when a plugin reports skipScroll', () => {
    const { manager, scrollEl } = createManager({ top: 60, bottom: 0, skipScroll: true }, 999);

    manager.scrollToRow(20, { align: 'start' });

    expect(scrollEl.scrollTop).toBe(999);
  });

  it('ignores offsets that would leave no usable viewport', () => {
    const { manager, scrollEl } = createManager({ top: 400, bottom: 0 }, 111);

    manager.scrollToRow(20, { align: 'start' });

    expect(scrollEl.scrollTop).toBe(111);
  });

  it('never writes a negative scrollTop near the top of the dataset', () => {
    const { manager, scrollEl } = createManager({ top: 60, bottom: 0 }, 200);

    manager.scrollToRow(1, { align: 'start' });

    // Row 1 is at y=30; 30 - 60 would be negative.
    expect(scrollEl.scrollTop).toBe(0);
  });

  it('behaves exactly as before when no plugin reports an offset', () => {
    const { manager, scrollEl } = createManager();

    manager.scrollToRow(20, { align: 'start' });

    expect(scrollEl.scrollTop).toBe(600);
  });
});
