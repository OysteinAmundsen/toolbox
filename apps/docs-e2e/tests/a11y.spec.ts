import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openDemo } from './utils';

/**
 * Automated WCAG 2.2 AA gate for the docs demo surface.
 *
 * `e2e/tests/accessibility.spec.ts` already scans the vanilla demo, but it
 * scopes to `tbw-grid` **and** disables `aria-required-children` /
 * `scrollable-region-focusable` wholesale — which is precisely how the grouping
 * header row, the responsive card rows and every unlabelled `DemoControls`
 * widget shipped unnoticed. This suite scans the whole demo document with those
 * rules live, so the same class of defect fails CI next time.
 *
 * Kept to a representative route set rather than all ~200 demos: the panel and
 * the plugin DOM are shared, so one route per structural pattern is enough to
 * pin the contract without turning the suite into a multi-minute scan.
 */

/**
 * axe's WCAG 2.2 tags are additive — `wcag22aa` alone covers only the criteria
 * 2.2 introduced, so the 2.0/2.1 tags have to ride along.
 */
const WCAG22AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

/**
 * Rules suppressed for the *grid internals*, matching the exclusions the
 * vanilla suite documents:
 *  - `color-contrast` on virtualized rows samples recycled off-screen nodes and
 *    themes are supplied externally; contrast is asserted per theme in
 *    `theme-contrast.spec.ts`.
 *  - `target-size` treats the overflow clipping at the bottom of a scroll
 *    viewport as "partially obscured", so the half-visible last virtualized row
 *    fails even though the cell is 80x33 and scrolls fully into view. SC 2.5.8
 *    is instead enforced directly by the `interactive controls meet the 24x24
 *    minimum target size` test below, which measures real controls.
 */
const DISABLED_RULES = ['color-contrast', 'target-size'];

/** One route per structural pattern we care about. */
const ROUTES: ReadonlyArray<readonly [name: string, slug: string]> = [
  // DemoControls panel: range, toggle, select, radio group, check group.
  ['controls panel', 'InteractivePlaygroundDemo'],
  // Selection checkbox column (header "select all" + per-row checkboxes) and
  // the dimmed `[data-selectable="false"]` rows.
  ['selection checkboxes', 'SelectionPlaygroundDemo'],
  // Column group header row — `role="row"` owning group cells.
  ['column group header', 'grouping-columns/GroupingColumnsDefaultDemo'],
  // Same row, but with a consumer-supplied `groupHeaderRenderer`.
  ['column group renderer', 'grouping-columns/GroupingColumnsCustomRendererDemo'],
  // Card layout — rows whose only child is a custom-rendered card.
  ['responsive cards', 'responsive/ResponsiveCustomCardRendererDemo'],
  // Shell chrome: header content, toolbar, tool panels.
  ['shell chrome', 'ShellMultiPanelsDemo'],
  // Rows carrying an in-cell disclosure control — the one structural shape the
  // target-size measurement below could not see while `.rows-viewport` was
  // excluded wholesale.
  ['tree disclosure rows', 'tree/TreeDefaultDemo'],
  ['master-detail toggles', 'master-detail/MasterDetailDefaultDemo'],
  // Synthetic aggregate rows and a generated column axis.
  ['pivot aggregates', 'pivot/PivotDefaultDemo'],
  // Grid-wide edit mode: every cell hosts a live editor control at rest.
  ['inline editors', 'editing/EditingGridModeDemo'],
];

/**
 * Surfaces that only exist after an interaction. Each entry opens the surface,
 * waits for it, and returns; the scan then runs against the resulting document.
 *
 * These are the routes that previously had no coverage at all: the filter panel
 * and context menu are appended to `document.body` (so a `tbw-grid`-scoped scan
 * could never have reached them), and the overlay editor replaces a gridcell's
 * subtree while it is open.
 */
const TRANSIENT: ReadonlyArray<readonly [name: string, slug: string, open: (page: Page) => Promise<void>]> = [
  [
    'filter panel',
    'filtering/FilteringDefaultDemo',
    async (page) => {
      await page.locator('tbw-grid [role="columnheader"][data-field] .tbw-filter-btn').first().click();
      await page.locator('.tbw-filter-panel').waitFor({ state: 'visible' });
    },
  ],
  [
    'type-specific filter panel',
    'filtering/FilteringTypeSpecificFiltersDemo',
    async (page) => {
      await page.locator('tbw-grid [role="columnheader"][data-field] .tbw-filter-btn').first().click();
      await page.locator('.tbw-filter-panel').waitFor({ state: 'visible' });
    },
  ],
  [
    'context menu',
    'context-menu/ContextMenuDefaultDemo',
    async (page) => {
      await page.locator('tbw-grid [role="gridcell"]').first().click({ button: 'right' });
      await page.locator('.tbw-context-menu, [role="menu"]').first().waitFor({ state: 'visible' });
    },
  ],
  [
    'context submenu',
    'context-menu/ContextMenuWithSubmenusDemo',
    async (page) => {
      await page.locator('tbw-grid [role="gridcell"]').first().click({ button: 'right' });
      const menu = page.locator('.tbw-context-menu, [role="menu"]').first();
      await menu.waitFor({ state: 'visible' });
      const submenu = menu.locator('[aria-haspopup], .tbw-context-menu-item.has-submenu').first();
      if (await submenu.count()) await submenu.hover();
      await page.waitForTimeout(300);
    },
  ],
  [
    'overlay editor',
    'editing/EditingAllColumnTypesDemo',
    async (page) => {
      await page.locator('tbw-grid [role="gridcell"][data-col="0"]').first().dblclick();
      await page.locator('tbw-grid [role="gridcell"] input, tbw-grid [role="gridcell"] select').first().waitFor();
    },
  ],
  [
    'expanded detail row',
    'master-detail/MasterDetailDefaultDemo',
    async (page) => {
      await page.locator('tbw-grid .master-detail-toggle[role="button"]').first().click();
      await page.locator('tbw-grid .master-detail-row').first().waitFor({ state: 'visible' });
    },
  ],
  [
    'expanded tree node',
    'tree/TreeDefaultDemo',
    async (page) => {
      await page.locator('tbw-grid .tree-toggle').first().click();
      await page.waitForTimeout(300);
    },
  ],
  [
    'export dialog',
    'export/ExportDefaultDemo',
    async (page) => {
      const trigger = page.locator('button', { hasText: /export|download/i }).first();
      if (await trigger.count()) await trigger.click();
      await page.waitForTimeout(300);
    },
  ],
  [
    // Closed, the accordion contributes nothing but section buttons — every
    // control inside a panel body is invisible to a scan of the resting page.
    'open shell tool panel',
    'ShellMultiPanelsDemo',
    async (page) => {
      await page.locator('tbw-grid [data-panel-toggle]').first().click();
      await page.locator('tbw-grid .tbw-tool-panel.open').waitFor({ state: 'visible' });
    },
  ],
];

function formatViolations(violations: { id: string; help: string; impact?: unknown; nodes: { html: string }[] }[]) {
  return violations
    .map((v) => `[${v.id}] ${v.help} (${String(v.impact)})\n${v.nodes.map((n) => `  - ${n.html}`).join('\n')}`)
    .join('\n\n');
}

/**
 * Wait for finite CSS animations and transitions to finish.
 *
 * Everything below reads geometry or computed colour, and both are wrong while
 * an element is still animating: the filter panel enters with
 * `scaleY(0.3) -> scaleY(1)` over 150ms, so a 28px-tall control measures 12px
 * when it is sampled two frames after Playwright reports it `visible`. That is
 * a false failure, and — worse — the same sampling window can shrink a
 * genuinely undersized control's neighbours far enough apart to produce a false
 * *pass*.
 *
 * Infinite animations (loading spinners) are skipped; they never settle.
 */
async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
}

/** Scan the whole document against the published conformance target. */
async function scan(page: Page) {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG22AA_TAGS).disableRules(DISABLED_RULES).analyze();
  return results.violations;
}

/**
 * Every control whose pointer target is smaller than 24x24 and which no SC
 * 2.5.8 exception rescues. Returns a printable description per offender.
 *
 * WCAG 2.2 SC 2.5.8. Two of the SC's exceptions are honoured explicitly,
 * because both apply to real controls on these routes:
 *  - **Effective target** — a native checkbox/radio is 13x13, but clicking its
 *    `<label>` activates it, so the label's box is the pointer target.
 *  - **Spacing** — an undersized target passes when a 24px-diameter circle
 *    centred on it does not intersect any other target's box. Ancestors and
 *    descendants are excluded from that check: a control nested inside another
 *    target (a resize handle inside its `columnheader`, anything inside the
 *    focusable grid host) is always at distance 0, which would make the
 *    exception unreachable for every composite widget. Targets covered by an
 *    overlay are dropped before the check runs, so an open dropdown does not
 *    make the controls underneath it fail on spacing.
 */
async function findUndersizedTargets(page: Page): Promise<string[]> {
  await settleAnimations(page);
  return page.evaluate(() => {
    const selector =
      'button, a[href], input, select, textarea, [role="tab"], [role="button"], [role="checkbox"], summary';

    /** The box a pointer actually has to hit to operate `el`. */
    const targetRect = (el: Element): DOMRect => {
      const label = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      return (label ?? el).getBoundingClientRect();
    };

    /**
     * True when a scroll container is cutting the box.
     *
     * axe's own `target-size` cannot tell scroll clipping from occlusion, which
     * is why it is disabled above — the half-visible last virtualized row makes
     * an 80x33 cell measure 80x13. Testing the clip explicitly lets in-cell
     * controls that ARE fully visible (tree disclosures, master-detail toggles,
     * row checkboxes, inline editors) be measured normally instead of the whole
     * `.rows-viewport` being waved through.
     */
    const clippedByScroller = (el: Element, rect: DOMRect): boolean => {
      const scroller = el.closest('.rows-viewport, .tbw-scroll-area');
      if (!scroller) return false;
      const clip = scroller.getBoundingClientRect();
      return rect.top < clip.top - 0.5 || rect.bottom > clip.bottom + 0.5;
    };

    /**
     * True when something is painted on top of `el`'s centre.
     *
     * An overlay tool panel or dropdown sits *over* the grid, so the controls
     * beneath it are neither operable nor spaced against — but they still have
     * boxes, and those boxes fall within 12px of the overlay's own controls,
     * which breaks the spacing exception for targets nobody can hit. Testing
     * the hit target directly keeps the spacing check honest.
     */
    const occluded = (el: Element, rect: DOMRect): boolean => {
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (!top) return true;
      return !(top === el || el.contains(top) || top.contains(el));
    };

    const candidates = Array.from(document.querySelectorAll(selector)).filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = targetRect(el);
      if (rect.width === 0 || rect.height === 0) return false;
      if (clippedByScroller(el, rect)) return false;
      if (occluded(el, rect)) return false;
      // Inline links in prose are exempt (SC 2.5.8 "Inline" exception).
      if (el.tagName === 'A' && style.display.startsWith('inline')) return false;
      return true;
    });

    const boxes = candidates.map(targetRect);

    return candidates
      .filter((el, i) => {
        const rect = boxes[i];
        if (rect.width >= 24 && rect.height >= 24) return false;
        // Spacing exception: no other target may fall inside the 24px circle.
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        return boxes.some((other, j) => {
          if (i === j) return false;
          const neighbour = candidates[j];
          if (neighbour.contains(el) || el.contains(neighbour)) return false;
          const dx = Math.max(other.x - cx, 0, cx - (other.x + other.width));
          const dy = Math.max(other.y - cy, 0, cy - (other.y + other.height));
          return Math.hypot(dx, dy) < 12;
        });
      })
      .map((el) => {
        const rect = targetRect(el);
        return `${Math.round(rect.width)}x${Math.round(rect.height)} ${el.outerHTML.slice(0, 120)}`;
      });
  });
}

for (const [name, slug] of ROUTES) {
  test(`${name} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await openDemo(page, slug);

    const violations = await scan(page);

    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test(`${name} interactive controls meet the 24x24 minimum target size`, async ({ page }) => {
    await openDemo(page, slug);

    const undersized = await findUndersizedTargets(page);

    expect(undersized, undersized.join('\n')).toEqual([]);
  });
}

/**
 * The transient surfaces. Scanned *after* the interaction that creates them, so
 * the body-appended filter panel and context menu — invisible to any
 * `tbw-grid`-scoped scan — are held to the same contract as the static DOM.
 */
for (const [name, slug, open] of TRANSIENT) {
  test(`${name} has no WCAG 2.2 AA violations while open`, async ({ page }) => {
    await openDemo(page, slug);
    await open(page);

    const violations = await scan(page);

    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test(`${name} controls meet the 24x24 minimum target size while open`, async ({ page }) => {
    await openDemo(page, slug);
    await open(page);

    const undersized = await findUndersizedTargets(page);

    expect(undersized, undersized.join('\n')).toEqual([]);
  });
}
