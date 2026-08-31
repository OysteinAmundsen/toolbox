import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEMOS, waitForGridReady, waitForGridReadyMobile } from './utils';

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
 * The tag set axe-core uses for "WCAG 2.2 Level AA". The 2.2 tags are additive —
 * `wcag22aa` alone covers only the criteria 2.2 introduced, so the 2.0 and 2.1
 * tags have to ride along or the scan quietly checks a handful of rules.
 */
const WCAG22AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Run axe-core scan scoped to the grid element with sensible rule config.
 * Returns the violations array for assertion.
 *
 * Runs every rule axe knows by default. Pass `tags` to narrow the scan to a
 * published conformance target instead.
 */
async function scanGrid(page: Page, disableRules: string[] = [], tags?: string[]) {
  // Scope scan to the grid element to avoid flagging the demo page chrome
  let builder = new AxeBuilder({ page }).include('tbw-grid').disableRules([
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
  ]);

  if (tags) builder = builder.withTags(tags);

  const results = await builder.analyze();

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
  // Click the header label, not the cell centre. A header hosts a trailing
  // cluster of controls (filter button, move button, resize handle) that is
  // pushed to the inline end, so on a narrow column the geometric centre can
  // land on one of those buttons instead of the sort target.
  await header.locator('span').first().click();
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

  // #region Published Conformance Ruleset

  /**
   * The scan the conformance report cites. Narrowed to the published target so
   * an axe best-practice rule can never be mistaken for a conformance failure,
   * and widened to every framework adapter because the report claims the whole
   * matrix — an adapter that renders its own cell content could regress alone.
   *
   * Asserts zero violations at ANY impact, not just critical/serious: a
   * conformance claim has no "minor" tier.
   */
  for (const [demoName, url] of Object.entries(DEMOS)) {
    test(`${demoName}: no WCAG 2.2 AA violations axe can detect`, async ({ page }) => {
      await page.goto(url);
      await waitForGridReady(page);

      const violations = await scanGrid(page, [], WCAG22AA_TAGS);

      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  }

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

// #region Target Size (SC 2.5.8)

/**
 * WCAG 2.2 SC 2.5.8 Target Size (Minimum) — every pointer target must offer at
 * least 24×24 CSS pixels, on a mouse just as much as on a finger.
 *
 * A data grid earns its keep on density, so most of these controls keep their
 * small box and grow only their hit area (a transparent `::after` overlay, or
 * an absolutely positioned handle). `getBoundingClientRect()` would report the
 * box and miss the overlay, so the target is measured the way a pointer sees
 * it: probe the four corners of a 24px square centred on the control and check
 * that each one still resolves to that control.
 */
const TARGET_SIZE_MIN = 24;

/** Controls that must answer a pointer anywhere in a 24px square. */
const TARGET_SELECTORS = [
  '.resize-handle',
  '.tbw-filter-btn',
  '.tbw-checkbox-header',
  '.tree-toggle',
  '.group-toggle',
  '.master-detail-toggle',
  '.dg-row-drag-handle',
  '.pivot-toggle',
  '.tbw-col-move-btn',
];

/**
 * Probe the corners of the minimum target square around the first visible match
 * for each selector. Returns one result per selector actually present.
 */
async function probeTargets(page: Page, selectors: string[], min: number) {
  return page.evaluate(
    ({ selectors, min }) => {
      const results: { selector: string; misses: string[] }[] = [];

      for (const selector of selectors) {
        const el = [...document.querySelectorAll<HTMLElement>(`tbw-grid ${selector}`)].find((candidate) => {
          const box = candidate.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && getComputedStyle(candidate).pointerEvents !== 'none';
        });
        if (!el) continue;

        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        // Stay a pixel inside the square so sub-pixel rounding cannot flip it.
        const reach = min / 2 - 1;
        const corners: [string, number, number][] = [
          ['top-left', cx - reach, cy - reach],
          ['top-right', cx + reach, cy - reach],
          ['bottom-left', cx - reach, cy + reach],
          ['bottom-right', cx + reach, cy + reach],
        ];

        const misses = corners
          .filter(([, x, y]) => {
            // Only the control itself (or its own children, or its `::after`
            // overlay, which resolves to it) counts. Landing on the ancestor
            // cell means the target ends there.
            const hit = document.elementFromPoint(x, y);
            return !hit || !(hit === el || el.contains(hit));
          })
          .map(([name]) => name);

        results.push({ selector, misses });
      }

      return results;
    },
    { selectors, min },
  );
}

test.describe('Accessibility: target size (WCAG 2.2 SC 2.5.8)', () => {
  test('small grid controls answer a pointer across a 24px square', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Several controls only materialise while their cell is hovered. Hovering a
    // header cell reveals the filter and move buttons alongside the handle.
    await page.locator('[role="columnheader"]:not([data-field^="__tbw_"])').first().hover();
    await page.waitForTimeout(200);

    const results = await probeTargets(page, TARGET_SELECTORS, TARGET_SIZE_MIN);

    expect(results.length, 'no target-size candidates were found on the page').toBeGreaterThan(0);

    const failures = results.filter((r) => r.misses.length > 0);
    const report = failures.map((r) => `${r.selector} misses: ${r.misses.join(', ')}`).join('\n');
    expect(failures, report).toHaveLength(0);
  });

  test('the tool panel splitter answers a pointer across a 24px square', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const toggle = page.locator('tbw-grid [data-panel-toggle]');
    if ((await toggle.count()) === 0) test.skip(true, 'shell plugin not enabled in this demo');

    // The splitter is clipped to zero width until the panel is docked open.
    await toggle.first().click();
    await expect(page.locator('tbw-grid .tbw-tool-panel.open')).toBeVisible();
    await page.waitForTimeout(300);

    const [result] = await probeTargets(page, ['.tbw-tool-panel-resize'], TARGET_SIZE_MIN);
    expect(result?.misses ?? ['not found'], `splitter misses: ${result?.misses.join(', ')}`).toHaveLength(0);
  });
});

// #endregion

// #region Reflow & Text Spacing (SC 1.4.10 / SC 1.4.12)

/**
 * A grid is a data table, which SC 1.4.10 exempts from reflowing away its own
 * two-dimensional layout — the table may keep scrolling horizontally. Nothing
 * *around* the table is exempt, so what these tests police is the chrome: the
 * page must not gain a horizontal scrollbar at 320px, and no panel or popover
 * may be cut off by a container it has outgrown.
 */
const REFLOW_VIEWPORT = { width: 320, height: 640 };

/** The four properties SC 1.4.12 lets a user impose, exactly as the SC states them. */
const TEXT_SPACING_CSS = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-block-end: 2em !important; }`;

test.describe('Accessibility: reflow (WCAG 2.2 SC 1.4.10)', () => {
  test('the page does not scroll horizontally at 320px', async ({ page }) => {
    await page.setViewportSize(REFLOW_VIEWPORT);
    await page.goto(DEMOS.vanilla);
    // Below the responsive breakpoint the grid swaps rows for cards, so the
    // desktop "a row is visible" wait never settles.
    await waitForGridReadyMobile(page);

    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(doc.scrollWidth, 'the document itself must not scroll sideways').toBeLessThanOrEqual(doc.clientWidth + 1);
  });

  test('the tool panel stays inside the grid it docks into', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    const toggle = page.locator('tbw-grid [data-panel-toggle]');
    if ((await toggle.count()) === 0) test.skip(true, 'shell plugin not enabled in this demo');

    await toggle.first().click();
    await expect(page.locator('tbw-grid .tbw-tool-panel.open')).toBeVisible();

    // Squeeze the grid narrower than the panel's natural width, so the clamp has
    // to do the work. A dragged width lands inline, which only a max-width can
    // rein back in — set one explicitly to prove that path is covered too.
    const overflow = await page.evaluate(async () => {
      const grid = document.querySelector('tbw-grid') as HTMLElement;
      const panel = document.querySelector('tbw-grid .tbw-tool-panel.open') as HTMLElement;
      grid.style.width = '220px';
      panel.style.width = '400px';
      await new Promise((r) => setTimeout(r, 400));
      const g = grid.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      return { leadingOverhang: Math.round(g.left - p.left), trailingOverhang: Math.round(p.right - g.right) };
    });

    expect(overflow.leadingOverhang, 'panel overflows the grid on the leading edge').toBeLessThanOrEqual(1);
    expect(overflow.trailingOverhang, 'panel overflows the grid on the trailing edge').toBeLessThanOrEqual(1);
  });
});

test.describe('Accessibility: text spacing (WCAG 2.2 SC 1.4.12)', () => {
  test('user text spacing neither clips nor overlaps grid content', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    await page.addStyleTag({ content: TEXT_SPACING_CSS });
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const grid = document.querySelector('tbw-grid') as HTMLElement;
      const rows = [...grid.querySelectorAll<HTMLElement>('.data-grid-row')].slice(0, 12);

      // Vertical clipping: a cell whose content is taller than the box it is
      // allowed to occupy. This is the failure the SC illustrates with figure 1.
      const clipped = rows
        .flatMap((row) => [...row.querySelectorAll<HTMLElement>('.cell')])
        .filter((cell) => cell.scrollHeight > cell.clientHeight + 1)
        .map((cell) => cell.getAttribute('data-field') ?? '(unnamed)');

      // Overlap: figure 3's failure. Virtualized rows are positioned from a
      // measured row height, so a taller line box would run into its neighbour.
      const boxes = rows.map((row) => row.getBoundingClientRect());
      const overlaps: string[] = [];
      for (let i = 1; i < boxes.length; i++) {
        if (boxes[i].top < boxes[i - 1].bottom - 1) overlaps.push(`row ${i - 1} → ${i}`);
      }

      return { clipped: [...new Set(clipped)], overlaps };
    });

    expect(result.clipped, `cells clipped vertically: ${result.clipped.join(', ')}`).toHaveLength(0);
    expect(result.overlaps, `rows overlapping: ${result.overlaps.join(', ')}`).toHaveLength(0);
  });

  test('text the spacing pushes out of view is still readable in full', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    await page.addStyleTag({ content: TEXT_SPACING_CSS });
    await page.waitForTimeout(500);

    // The SC permits an ellipsis only while a mechanism reveals the rest. Core
    // resolves a native `title` on hover; the Tooltip plugin supersedes it with
    // a styled popover, so either one satisfies the requirement.
    const result = await page.evaluate(() => {
      const grid = document.querySelector('tbw-grid') as HTMLElement & {
        getPluginByName?: (name: string) => unknown;
      };
      if (grid.getPluginByName?.('tooltip')) return { pluginProvidesReveal: true, truncated: 0, revealed: 0 };

      const truncated = [...grid.querySelectorAll<HTMLElement>('.data-grid-row .cell')].filter(
        (cell) => cell.scrollWidth > cell.clientWidth + 1,
      );
      for (const cell of truncated) cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      return {
        pluginProvidesReveal: false,
        truncated: truncated.length,
        revealed: truncated.filter((cell) => cell.title.length > 0).length,
      };
    });

    if (result.pluginProvidesReveal) return;
    expect(result.truncated, 'no truncated cells to check — the assertion would be vacuous').toBeGreaterThan(0);
    expect(result.revealed, 'truncated cells left with no way to read the rest').toBe(result.truncated);
  });
});

// #endregion
