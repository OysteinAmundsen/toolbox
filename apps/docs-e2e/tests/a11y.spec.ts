import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
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
];

function formatViolations(violations: { id: string; help: string; impact?: unknown; nodes: { html: string }[] }[]) {
  return violations
    .map((v) => `[${v.id}] ${v.help} (${String(v.impact)})\n${v.nodes.map((n) => `  - ${n.html}`).join('\n')}`)
    .join('\n\n');
}

for (const [name, slug] of ROUTES) {
  test(`${name} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await openDemo(page, slug);

    const results = await new AxeBuilder({ page }).withTags(WCAG22AA_TAGS).disableRules(DISABLED_RULES).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test(`${name} interactive controls meet the 24x24 minimum target size`, async ({ page }) => {
    await openDemo(page, slug);

    // WCAG 2.2 SC 2.5.8. Scoped to real controls: grid cells are excluded
    // because axe's own `target-size` implementation cannot distinguish scroll
    // clipping from occlusion (see DISABLED_RULES above).
    //
    // Two of the SC's exceptions are honoured explicitly, because both apply to
    // real controls on these routes:
    //  - **Effective target** — a native checkbox/radio is 13x13, but clicking
    //    its `<label>` activates it, so the label's box is the pointer target.
    //  - **Spacing** — an undersized target passes when a 24px-diameter circle
    //    centred on it does not intersect any other target's box. Ancestors and
    //    descendants are excluded from that check: a control nested inside
    //    another target (a resize handle inside its `columnheader`, anything
    //    inside the focusable grid host) is always at distance 0, which would
    //    make the exception unreachable for every composite widget.
    const undersized = await page.evaluate(() => {
      const selector =
        'button, a[href], input, select, textarea, [role="tab"], [role="button"], [role="checkbox"], summary';

      /** The box a pointer actually has to hit to operate `el`. */
      const targetRect = (el: Element): DOMRect => {
        const label =
          el.closest('label') ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
        return (label ?? el).getBoundingClientRect();
      };

      const candidates = Array.from(document.querySelectorAll(selector)).filter((el) => {
        if (el.closest('.rows-viewport')) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = targetRect(el);
        if (rect.width === 0 || rect.height === 0) return false;
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
        .map((el, _i) => {
          const rect = targetRect(el);
          return `${Math.round(rect.width)}x${Math.round(rect.height)} ${el.outerHTML.slice(0, 120)}`;
        });
    });

    expect(undersized, undersized.join('\n')).toEqual([]);
  });
}
