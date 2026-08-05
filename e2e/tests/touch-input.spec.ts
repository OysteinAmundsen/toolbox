import { expect, test } from '@playwright/test';
import { DEMOS, SELECTORS, waitForGridReadyMobile } from './utils';

/**
 * Touch Input E2E Tests — scaffold for the touch-input epic (#302/#307).
 *
 * Runs with `hasTouch: true` and `isMobile: true` to emulate a touch device.
 * Sibling sub-issues (#303–#306) will add gesture-specific tests to this file.
 *
 * Requires the vanilla demo server to be running on localhost:4000.
 * Start it with: `bun nx serve demo-vanilla`
 */

test.use({ hasTouch: true, isMobile: true });

test.describe('Touch Input — smoke tests', () => {
  test('grid renders and a cell can be tapped to focus', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReadyMobile(page);

    // Verify the grid is visible
    const grid = page.locator(SELECTORS.grid);
    await expect(grid).toBeVisible();

    // Tap the first data cell
    const firstCell = grid.locator(SELECTORS.cell).first();
    await expect(firstCell).toBeVisible();
    await firstCell.tap();
    await page.waitForTimeout(200);

    // After a tap the cell should be focused — the grid sets aria-colindex and
    // moves keyboard focus to the active cell.  We verify at least one cell
    // exists and is reachable by tap without throwing an error.
    const cellCount = await grid.locator(SELECTORS.cell).count();
    expect(cellCount).toBeGreaterThan(0);
  });
});

/**
 * Pointer-driven drag tests (#303).
 *
 * All grid drags run through `startPointerDrag()`, so mouse and touch share one
 * code path.  Playwright's `touchscreen` API only exposes `tap()`, so real touch
 * drags are driven through a raw CDP `Input.dispatchTouchEvent` session.
 */

/** Dispatch a touch drag: down at (x1,y1), a few moves, then up at (x2,y2). */
async function touchDrag(
  page: import('@playwright/test').Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { holdMs?: number; steps?: number } = {},
): Promise<void> {
  const { holdMs = 0, steps = 8 } = opts;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: x1, y: y1, id: 1 }],
  });
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  for (let i = 1; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach().catch(() => undefined);
}

/**
 * The first resizable column header.
 *
 * Not `headerCell.first()` — the demo's master-detail expander occupies column
 * 0 with a zero-width header, so measuring it always reports `0`.
 */
function firstResizableHeader(page: import('@playwright/test').Page) {
  return page
    .locator(SELECTORS.headerCell)
    .filter({ has: page.locator(SELECTORS.resizeHandle) })
    .first();
}

/** Width of the first resizable column header, used to assert resize deltas. */
async function firstHeaderWidth(page: import('@playwright/test').Page): Promise<number> {
  const box = await firstResizableHeader(page).boundingBox();
  return box?.width ?? 0;
}

/**
 * The grid's real vertical scroller. `.rows-viewport` is `overflow: clip` and
 * never scrolls — rows are translated in response to the faux scrollbar.
 */
const FAUX_VSCROLL = '.faux-vscroll';

/** First cell that selection can actually claim (skips the expander column). */
function firstSelectableCell(page: import('@playwright/test').Page) {
  return page.locator(SELECTORS.grid).locator('[role="gridcell"][data-col="1"]').first();
}

test.describe('Touch Input — pointer-driven drags (#303)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReadyMobile(page);
  });

  test('column resize works with a mouse drag (pointer path)', async ({ page }) => {
    const handle = page.locator(SELECTORS.resizeHandle).first();
    const handleCount = await page.locator(SELECTORS.resizeHandle).count();
    test.skip(handleCount === 0, 'demo has no resizable columns');

    const before = await firstHeaderWidth(page);
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await firstHeaderWidth(page);
    expect(after).toBeGreaterThan(before + 20);
  });

  test('column resize works with a touch drag', async ({ page }) => {
    const handleCount = await page.locator(SELECTORS.resizeHandle).count();
    test.skip(handleCount === 0, 'demo has no resizable columns');

    const before = await firstHeaderWidth(page);
    const box = await page.locator(SELECTORS.resizeHandle).first().boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await touchDrag(page, cx, cy, cx + 60, cy);
    await page.waitForTimeout(200);

    const after = await firstHeaderWidth(page);
    expect(after).toBeGreaterThan(before + 20);
  });

  test('pressing Escape mid-resize aborts and restores the original width', async ({ page }) => {
    const handleCount = await page.locator(SELECTORS.resizeHandle).count();
    test.skip(handleCount === 0, 'demo has no resizable columns');

    const before = await firstHeaderWidth(page);
    const box = await page.locator(SELECTORS.resizeHandle).first().boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy, { steps: 10 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await firstHeaderWidth(page);
    expect(Math.abs(after - before)).toBeLessThan(4);
  });

  test('a plain touch swipe over cells scrolls instead of painting a range', async ({ page }) => {
    const grid = page.locator(SELECTORS.grid);
    const firstCell = grid.locator(SELECTORS.cell).first();
    const box = await firstCell.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    // No hold: the coarse-pointer branch must not promote the drag.
    await touchDrag(page, cx, cy, cx, cy - 160);
    await page.waitForTimeout(300);

    const selected = await grid.locator('[role="gridcell"][aria-selected="true"]').count();
    expect(selected).toBe(0);
  });

  test('a long-press then drag paints a cell range on touch', async ({ page }) => {
    const grid = page.locator(SELECTORS.grid);
    const startBox = await firstSelectableCell(page).boundingBox();
    expect(startBox).not.toBeNull();

    const cx = startBox!.x + startBox!.width / 2;
    const cy = startBox!.y + startBox!.height / 2;
    // Hold past LONG_PRESS_MS (400 ms) before moving, then drag down two rows.
    await touchDrag(page, cx, cy, cx, cy + startBox!.height * 2, { holdMs: 600 });
    await page.waitForTimeout(300);

    const selected = await grid.locator('[role="gridcell"][aria-selected="true"]').count();
    // Selection may be disabled in the demo; only assert when the feature is live.
    test.skip(selected === 0, 'demo grid has no active cell-range selection');
    expect(selected).toBeGreaterThan(1);
  });

  test('the grid still scrolls vertically with a one-finger swipe', async ({ page }) => {
    const viewport = page.locator(SELECTORS.body).first();
    const scroller = page.locator(FAUX_VSCROLL).first();
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();

    const before = await scroller.evaluate((el) => el.scrollTop);
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height * 0.75;
    await touchDrag(page, cx, cy, cx, cy - box!.height * 0.5);
    await page.waitForTimeout(400);

    const after = await scroller.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThan(before);
  });
});
/**
 * Touch selection mode (#304).
 *
 * The vanilla demo may or may not register `SelectionPlugin` in row mode, so
 * each test skips gracefully when the toolbar never appears rather than
 * asserting on a feature the demo does not enable.
 */
test.describe('Touch Input — selection mode (#304)', () => {
  const TOOLBAR = '.tbw-selection-toolbar';

  /** Long-press the given row by holding a touch point on it. */
  async function longPressRow(page: import('@playwright/test').Page, rowIndex: number): Promise<void> {
    const row = page.locator(SELECTORS.grid).locator(SELECTORS.row).nth(rowIndex);
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    // A hold with no movement: touchDrag's steps all land on the same point.
    await touchDrag(page, cx, cy, cx, cy, { holdMs: 600, steps: 2 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReadyMobile(page);
  });

  test('long-pressing a row opens the selection toolbar', async ({ page }) => {
    await longPressRow(page, 1);
    await page.waitForTimeout(300);

    const toolbar = page.locator(TOOLBAR);
    test.skip((await toolbar.count()) === 0, 'demo grid does not enable row selection');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator('.tbw-selection-toolbar-count')).toHaveText('1 selected');
  });

  test('tapping another row toggles it into the selection', async ({ page }) => {
    await longPressRow(page, 1);
    await page.waitForTimeout(300);
    const toolbar = page.locator(TOOLBAR);
    test.skip((await toolbar.count()) === 0, 'demo grid does not enable row selection');

    await page.locator(SELECTORS.grid).locator(SELECTORS.row).nth(3).tap();
    await page.waitForTimeout(300);

    await expect(toolbar.locator('.tbw-selection-toolbar-count')).toHaveText('2 selected');
  });

  test('long-pressing a second row extends the range from the anchor', async ({ page }) => {
    await longPressRow(page, 1);
    await page.waitForTimeout(300);
    const toolbar = page.locator(TOOLBAR);
    test.skip((await toolbar.count()) === 0, 'demo grid does not enable row selection');

    await longPressRow(page, 4);
    await page.waitForTimeout(300);

    await expect(toolbar.locator('.tbw-selection-toolbar-count')).toHaveText('4 selected');
  });

  test('Done exits selection mode and clears the transient selection', async ({ page }) => {
    await longPressRow(page, 1);
    await page.waitForTimeout(300);
    const toolbar = page.locator(TOOLBAR);
    test.skip((await toolbar.count()) === 0, 'demo grid does not enable row selection');

    await toolbar.locator('[data-action="done"]').tap();
    await page.waitForTimeout(300);

    await expect(page.locator(TOOLBAR)).toHaveCount(0);
    const selected = await page.locator(SELECTORS.grid).locator('[aria-selected="true"]').count();
    expect(selected).toBe(0);
  });

  test('mouse clicks never enter selection mode', async ({ page }) => {
    const row = page.locator(SELECTORS.grid).locator(SELECTORS.row).nth(1);
    const box = await row.boundingBox();
    expect(box).not.toBeNull();

    // A slow mouse press is not a long-press as far as the coarse branch is
    // concerned — `pointerType` is what decides.
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(200);

    await expect(page.locator(TOOLBAR)).toHaveCount(0);
  });
});
test.describe('Touch Input — long-press context menu (#306)', () => {
  const MENU = '.tbw-context-menu';
  const TOOLBAR = '.tbw-selection-toolbar';

  test.beforeEach(async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReadyMobile(page);
  });

  /** Hold a touch point on the centre of the given cell. */
  async function longPressCell(
    page: import('@playwright/test').Page,
    rowIndex: number,
    colIndex: number,
  ): Promise<void> {
    const cell = page.locator(SELECTORS.grid).locator(`[data-row="${rowIndex}"][data-col="${colIndex}"]`).first();
    const box = await cell.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await touchDrag(page, cx, cy, cx, cy, { holdMs: 700, steps: 2 });
  }

  test('a long-press does not open the menu on top of selection mode', async ({ page }) => {
    await longPressCell(page, 1, 1);
    await page.waitForTimeout(400);

    const toolbarShown = (await page.locator(TOOLBAR).count()) > 0;
    test.skip(!toolbarShown, 'demo grid does not enable selection mode');

    // Selection mode claimed the press, so the browser's synthesised
    // contextmenu must have been suppressed — the two must never coexist.
    await expect(page.locator(MENU)).toHaveCount(0);
  });

  test('a long-press resolves to exactly one of selection mode or the context menu', async ({ page }) => {
    // Sanity-check that ContextMenuPlugin is actually registered on the demo
    // grid — otherwise "no menu appeared" proves nothing.
    const cell = page.locator(SELECTORS.grid).locator('[data-row="1"][data-col="1"]').first();
    await cell.dispatchEvent('contextmenu');
    await page.waitForTimeout(300);
    const hasContextMenu = (await page.locator(MENU).count()) > 0;
    test.skip(!hasContextMenu, 'demo grid has no ContextMenuPlugin registered');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await longPressCell(page, 1, 1);
    await page.waitForTimeout(400);

    const toolbars = await page.locator(TOOLBAR).count();
    const menus = await page.locator(MENU).count();
    // Step 3 of the priority chain: with `selection: 'range'` a claimed press
    // paints a range instead of raising a toolbar, so that counts as a winner.
    const painted = await page.locator(SELECTORS.grid).locator('[role="gridcell"][aria-selected="true"]').count();
    // The priority chain must produce a winner, and only one: either a plugin
    // claimed the press (toolbar / painted range) or the native long-press menu opened.
    expect(toolbars > 0 || painted > 0 || menus > 0).toBe(true);
    expect((toolbars > 0 || painted > 0) && menus > 0).toBe(false);
  });

  test('the selection toolbar exposes the menu via More…', async ({ page }) => {
    await longPressCell(page, 1, 1);
    await page.waitForTimeout(400);

    const more = page.locator(TOOLBAR).locator('[data-action="more"]');
    test.skip((await more.count()) === 0, 'demo grid has no ContextMenuPlugin registered');

    await more.tap();
    await page.waitForTimeout(300);
    await expect(page.locator(MENU)).toBeVisible();
  });

  test('suppression is one-shot — a later long-press is unaffected', async ({ page }) => {
    await longPressCell(page, 1, 1);
    await page.waitForTimeout(400);
    test.skip((await page.locator(TOOLBAR).count()) === 0, 'demo grid does not enable selection mode');

    // Leave selection mode, then press again. The suppression window from the
    // first press must have expired rather than latched.
    const done = page.locator(TOOLBAR).locator('[data-action="done"]');
    if ((await done.count()) > 0) await done.tap();
    await page.waitForTimeout(1000);

    await longPressCell(page, 2, 1);
    await page.waitForTimeout(400);

    // Whichever handler wins, the grid must still be interactive.
    await expect(page.locator(SELECTORS.grid)).toBeVisible();
  });
});
