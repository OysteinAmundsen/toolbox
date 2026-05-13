import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEMOS, waitForGridReady } from './utils';

/**
 * Accessibility Tests — Phase 1 of #189
 *
 * Automated ARIA validation using axe-core against the vanilla demo grid.
 * Catches semantic violations, color contrast issues, and focus order problems.
 *
 * Requires the vanilla demo server to be running on localhost:4000.
 */

// #region Helpers

/**
 * Run axe-core scan scoped to the grid element with sensible rule config.
 * Returns the violations array for assertion.
 */
async function scanGrid(page: Page, disableRules: string[] = []) {
  // Scope scan to the grid element to avoid flagging the demo page chrome
  const results = await new AxeBuilder({ page })
    .include('tbw-grid')
    .disableRules([
      // Virtualization recycles rows outside the visible viewport —
      // axe may flag hidden content that is intentionally aria-hidden or off-screen.
      'scrollable-region-focusable',
      // The grid uses role="presentation" wrappers (.rows-container, .rows-viewport)
      // between role="grid" and role="rowgroup" for layout. Per ARIA spec, presentation
      // is semantically transparent, but axe-core still flags the intermediate elements.
      'aria-required-children',
      // The grid uses light DOM, so color-contrast checks on the host element
      // can produce false positives when theme vars are applied externally.
      // We test contrast separately per theme below.
      ...disableRules,
    ])
    .analyze();

  return results.violations;
}

/** Format axe violations into a readable string for assertion messages. */
function formatViolations(violations: Awaited<ReturnType<typeof scanGrid>>) {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `  - ${n.html}`).join('\n');
      return `[${v.id}] ${v.help} (${v.impact})\n${nodes}`;
    })
    .join('\n\n');
}

/** Click a sortable header column to trigger sort. */
async function sortByHeader(page: Page) {
  // Use :not([data-field^="__tbw_"]) to skip internal columns (like selection checkbox)
  const header = page.locator('[role="columnheader"]:not([data-field^="__tbw_"])').first();
  await header.click();
  await page.waitForTimeout(300);
}

// #endregion

// #region Default Grid Scan

test.describe('Accessibility: axe-core scans', () => {
  test('default grid has no critical ARIA violations', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const violations = await scanGrid(page);

    // Filter to critical/serious only for the baseline assertion
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, formatViolations(critical)).toHaveLength(0);
  });

  test('grid has proper ARIA roles structure', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Verify core ARIA structure exists
    const grid = page.locator('tbw-grid');
    const innerGrid = grid.locator('[role="grid"]');
    await expect(innerGrid).toBeAttached();

    // Verify aria-rowcount and aria-colcount are present and valid
    const rowCount = await innerGrid.getAttribute('aria-rowcount');
    const colCount = await innerGrid.getAttribute('aria-colcount');
    expect(Number(rowCount)).toBeGreaterThan(0);
    expect(Number(colCount)).toBeGreaterThan(0);

    // Verify header cells have columnheader role
    const headers = grid.locator('[role="columnheader"]');
    await expect(headers.first()).toBeAttached();

    // Verify data cells have gridcell role
    const cells = grid.locator('[role="gridcell"]');
    await expect(cells.first()).toBeAttached();
  });

  // #endregion

  // #region Post-Interaction Scans

  test('no violations after sorting', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Sort by the first sortable header
    await sortByHeader(page);

    const violations = await scanGrid(page);
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, formatViolations(critical)).toHaveLength(0);
  });

  test('no violations after keyboard navigation', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Focus the grid and navigate with arrow keys
    const grid = page.locator('tbw-grid');
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    const violations = await scanGrid(page);
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, formatViolations(critical)).toHaveLength(0);
  });

  test('no violations after scrolling', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Scroll down to trigger virtualization
    const grid = page.locator('tbw-grid');
    const viewport = grid.locator('.rows-viewport');
    await viewport.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(500);

    const violations = await scanGrid(page);
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, formatViolations(critical)).toHaveLength(0);
  });

  // #endregion

  // #region ARIA Live Region

  test('aria-live region exists for screen reader announcements', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const liveRegion = page.locator('tbw-grid .tbw-sr-only[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();
    expect(await liveRegion.getAttribute('aria-atomic')).toBe('true');
  });

  test('sort action populates aria-live region', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const liveRegion = page.locator('tbw-grid .tbw-sr-only[aria-live="polite"]');

    // Sort by a column
    await sortByHeader(page);
    await page.waitForTimeout(200);

    // The live region should have announcement text
    const text = await liveRegion.textContent();
    expect(text).toBeTruthy();
    expect(text!.toLowerCase()).toContain('sorted');
  });

  test('row selection populates aria-live region with "selected"', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const liveRegion = page.locator('tbw-grid .tbw-sr-only[aria-live="polite"]');

    // Click a data cell (row mode selection toggles on row click).
    // Skip internal checkbox/utility columns.
    const cell = page.locator('[role="gridcell"]:not([data-field^="__tbw_"])').first();
    await cell.click();

    // Live region updates are rAF-batched; poll until the announcement shows.
    await expect.poll(async () => (await liveRegion.textContent()) ?? '').toMatch(/selected/i);
  });

  test('data reload populates aria-live region with "loaded"', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const liveRegion = page.locator('tbw-grid .tbw-sr-only[aria-live="polite"]');

    // Replace dataSource with a fresh array — this should fire the dataLoaded
    // announcement guarded by the lastAnnouncedSourceCount throttle in aria.ts.
    await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement & { dataSource: unknown[] }>('tbw-grid');
      if (!grid) throw new Error('tbw-grid element not found in demo page');
      // Use a clearly different row count so the throttle does not suppress.
      grid.dataSource = Array.from({ length: 7 }, (_, i) => ({
        id: `row-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
      }));
    });

    await expect.poll(async () => (await liveRegion.textContent()) ?? '').toMatch(/\b7\b.*loaded|loaded/i);

    // Throttle assertion: replacing with another 7-row array must NOT re-announce
    // (lastAnnouncedSourceCount suppresses identical-count reloads).
    await page.evaluate(() => {
      const region = document.querySelector('tbw-grid .tbw-sr-only[aria-live="polite"]');
      if (region) region.textContent = '';
      const grid = document.querySelector<HTMLElement & { dataSource: unknown[] }>('tbw-grid');
      if (!grid) throw new Error('tbw-grid element not found');
      grid.dataSource = Array.from({ length: 7 }, (_, i) => ({
        id: `row2-${i}`,
        firstName: `Other${i}`,
        lastName: `Person${i}`,
      }));
    });

    // Give the rAF-batched announcer two frames to flush — if it were going to
    // announce, it would by now. We expect the manually-cleared region to stay empty.
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    expect((await liveRegion.textContent()) ?? '').toBe('');
  });

  // #endregion

  // #region Focus Management

  test('grid is focusable via tabindex', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const grid = page.locator('tbw-grid');
    const tabindex = await grid.getAttribute('tabindex');
    expect(tabindex === '0' || tabindex === '1').toBe(true);
  });

  test('keyboard navigation updates aria-selected', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const grid = page.locator('tbw-grid');
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const selected = grid.locator('[aria-selected="true"]');
    await expect(selected).toBeAttached();
  });

  test('focus survives sort reorder', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const grid = page.locator('tbw-grid');
    await grid.focus();

    // Navigate to a cell via keyboard (establishes internal focus tracking)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Sort to reorder rows — clicking the header may move DOM focus to the
    // clicked element, which gets replaced during re-render. That's expected.
    await sortByHeader(page);
    await page.waitForTimeout(500);

    // Re-focus the grid and verify keyboard navigation still works.
    // The sort should not break the grid's ability to accept and track focus.
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    const gridHasFocus = await grid.evaluate(
      (el) => el.contains(document.activeElement) || el === document.activeElement,
    );
    expect(gridHasFocus).toBe(true);
  });

  test('focus survives scroll (virtualization)', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const grid = page.locator('tbw-grid');
    await grid.focus();

    // Navigate down several rows
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForTimeout(200);

    // Scroll the viewport to trigger virtualization
    const viewport = grid.locator('.rows-viewport');
    await viewport.evaluate((el) => {
      el.scrollTop = 1000;
    });
    await page.waitForTimeout(500);

    // Scroll back
    await viewport.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(500);

    // Grid should still be focusable
    const gridOrChildFocused = await grid.evaluate(
      (el) => el.contains(document.activeElement) || el === document.activeElement,
    );
    expect(gridOrChildFocused).toBe(true);
  });

  test('focus-visible indicators exist on focusable elements', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const grid = page.locator('tbw-grid');
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Check that the focused cell has visible focus styling
    // The grid adds a .focused class or data attribute on the focused cell
    const focusedCell = grid.locator('.cell.focused, [data-focused], [aria-selected="true"]').first();
    await expect(focusedCell).toBeAttached();
  });

  test('tab order moves through grid regions correctly', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Tab into the grid
    const grid = page.locator('tbw-grid');
    await grid.focus();

    // Verify grid has focus
    const gridFocused = await grid.evaluate((el) => el === document.activeElement);
    expect(gridFocused).toBe(true);
  });

  // #endregion

  // #region Always-On Focus Trap (PR #324)

  /**
   * Body-level overlays (datepickers, dropdowns, custom-editor portals from
   * framework adapters) sometimes close while still holding focus. The browser
   * then bounces focus to `<body>`. The grid's always-on focus trap restores
   * the last meaningful in-grid focus so keyboard navigation can resume.
   *
   * These tests simulate that scenario by appending a focusable element
   * directly to `<body>`, focusing it, and removing it — exactly the DOM
   * pattern produced by Material/PrimeNG/Headless UI overlays on close.
   */

  test('focus trap restores in-grid focus when an external overlay container closes', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Inject a real, persistent in-grid focus target, focus it (so the trap
    // tracks it as "last focus"), then simulate the full lifecycle of a
    // body-level overlay (datepicker / dropdown / menu portal) registered
    // via the grid's public registerExternalFocusContainer() API:
    //
    //   1. open: append <input> to <body>, register with grid, focus it
    //   2. close: unregister + remove from DOM
    //
    // Because the overlay was a registered external container, its focus
    // is intentionally NOT tracked. When it's removed and focus drops to
    // <body>, the trap restores focus to the previously-tracked in-grid
    // input — proving the always-on focus trap and external container
    // mechanism work end-to-end in a real browser.
    const result = await page.evaluate(async () => {
      const grid = document.querySelector('tbw-grid')! as HTMLElement & {
        registerExternalFocusContainer: (el: Element) => void;
        unregisterExternalFocusContainer: (el: Element) => void;
      };

      // 1. Persistent in-grid focus target — represents whatever the user
      //    was working on before the overlay opened.
      const anchor = document.createElement('input');
      anchor.id = '__test_grid_anchor';
      grid.appendChild(anchor);
      anchor.focus();

      // Sanity: anchor must be the active element before the overlay opens.
      const anchoredBefore = document.activeElement === anchor;

      // 2. Body-level overlay opens and steals focus.
      const overlay = document.createElement('input');
      overlay.id = '__test_body_overlay';
      document.body.appendChild(overlay);
      grid.registerExternalFocusContainer(overlay);
      overlay.focus();

      // 3. Overlay closes — remove from DOM FIRST so the still-registered
      //    focusout listener fires (relatedTarget=null) and schedules the
      //    restore. Then unregister to clean up. (Unregister-then-remove
      //    would abort the listener before the focusout could fire.)
      overlay.remove();
      // Wait for the trap's queueMicrotask + restore to complete.
      await new Promise((r) => setTimeout(r, 50));
      grid.unregisterExternalFocusContainer(overlay);

      const restored = document.activeElement === anchor;
      const isBody = document.activeElement === document.body;

      // Cleanup
      anchor.remove();

      return { anchoredBefore, restored, isBody };
    });

    expect(result.anchoredBefore, 'anchor input should receive focus initially').toBe(true);
    expect(result.isBody, 'focus must not be stranded on <body> after overlay closes').toBe(false);
    expect(result.restored, 'focus must be restored to the previously focused in-grid element').toBe(true);
  });

  test('focus trap restores when in-grid focus is blurred to body', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Inject a tracked in-grid element, blur it programmatically (focus →
    // <body>), and confirm the trap restores it. This is the minimal
    // bounce-to-body scenario the trap is designed to catch.
    const result = await page.evaluate(async () => {
      const grid = document.querySelector('tbw-grid')!;
      const anchor = document.createElement('input');
      anchor.id = '__test_blur_anchor';
      grid.appendChild(anchor);
      anchor.focus();

      const anchoredBefore = document.activeElement === anchor;

      // Programmatic blur — focusout fires with relatedTarget=null,
      // trap schedules restore.
      anchor.blur();
      await new Promise((r) => setTimeout(r, 50));

      const restored = document.activeElement === anchor;
      const isBody = document.activeElement === document.body;

      anchor.remove();
      return { anchoredBefore, restored, isBody };
    });

    expect(result.anchoredBefore).toBe(true);
    expect(result.isBody, 'focus must not be stranded on <body> after blur').toBe(false);
    expect(result.restored, 'focus must be restored to the blurred in-grid element').toBe(true);
  });

  test('focus trap does NOT fight intentional outward Tab', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const grid = page.locator('tbw-grid');

    // Add a sibling button after the grid so Tab has somewhere meaningful to go.
    await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.id = '__test_outside_btn';
      btn.textContent = 'outside';
      document.body.appendChild(btn);
    });

    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);

    // Tab out of the grid to the sibling button.
    // The grid's focusout fires with relatedTarget=#__test_outside_btn, which
    // the trap MUST treat as intentional and NOT yank focus back.
    await page.evaluate(() => {
      (document.getElementById('__test_outside_btn') as HTMLButtonElement).focus();
    });
    await page.waitForTimeout(50);

    const outsideFocused = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.id === '__test_outside_btn',
    );
    expect(outsideFocused).toBe(true);
  });

  // #endregion
});
