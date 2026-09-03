/**
 * ARIA snapshots — the accessibility tree a screen reader actually consumes.
 *
 * axe checks *rules*; it does not check that the tree still says what we mean.
 * A `role="presentation"` promotion, a lost `aria-label`, a disclosure button
 * that stops exposing `aria-expanded`, or a header cell that quietly drops
 * `aria-sort` are all silent under axe but change every announcement. These
 * snapshots pin the tree so that drift fails CI instead of shipping.
 *
 * The templates are matched *structurally*: a line like `- gridcell` matches a
 * cell with any accessible name, while `- checkbox "Select all rows"` pins the
 * name too. Volatile demo data is therefore left unnamed on purpose — only the
 * roles, states, and the names we author ourselves are asserted.
 *
 * Regenerate after an intentional change with:
 *   bun nx e2e docs-e2e -- aria-snapshot.spec.ts --update-snapshots
 * then read the diff: every changed line is a changed announcement.
 */
import { expect, test } from '@playwright/test';
import { openDemo } from './utils';

test.describe('ARIA tree — grid skeleton', () => {
  test('grid exposes a grid > rowgroup > row > cell tree', async ({ page }) => {
    await openDemo(page, 'SelectionPlaygroundDemo');

    // The header rowgroup only: data rows carry demo values that churn.
    await expect(page.locator('tbw-grid [role="rowgroup"]').first()).toMatchAriaSnapshot({
      name: 'grid-header-rowgroup.aria.yml',
    });
  });

  test('column headers expose sort state', async ({ page }) => {
    await openDemo(page, 'SelectionPlaygroundDemo');

    const header = page.locator('tbw-grid [role="columnheader"][data-field]').nth(1);
    await header.click();

    await expect(header).toMatchAriaSnapshot({ name: 'grid-columnheader-sorted.aria.yml' });
  });

  test('selection column exposes named checkboxes', async ({ page }) => {
    // SelectionPlaygroundDemo starts in row-click mode with no checkbox column,
    // so the select-all control only exists in the checkbox demo.
    await openDemo(page, 'SelectionCheckboxDemo');

    // The "select all" control is the one name we author, so it is pinned by
    // name — a regression here is the difference between "checkbox" and
    // "select all rows, checkbox" in every screen reader.
    const selectAll = page.locator('tbw-grid [role="columnheader"] input[type="checkbox"]').first();
    await expect(selectAll).toBeVisible();
    await expect(selectAll).toMatchAriaSnapshot({ name: 'grid-select-all.aria.yml' });
  });
});

test.describe('ARIA tree — disclosure controls', () => {
  test('tree rows expose expanded state on the row, not the button', async ({ page }) => {
    await openDemo(page, 'tree/TreeDefaultDemo');

    await expect(page.locator('tbw-grid [role="rowgroup"]:last-of-type [role="row"]').first()).toMatchAriaSnapshot({
      name: 'tree-row-collapsed.aria.yml',
    });

    await page.locator('tbw-grid .tree-toggle').first().click();
    await page.waitForTimeout(300);

    await expect(page.locator('tbw-grid [role="rowgroup"]:last-of-type [role="row"]').first()).toMatchAriaSnapshot({
      name: 'tree-row-expanded.aria.yml',
    });
  });

  test('master-detail toggle exposes expanded state', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailDefaultDemo');

    const toggle = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();
    await expect(toggle).toMatchAriaSnapshot({ name: 'master-detail-toggle-collapsed.aria.yml' });

    await toggle.click();
    await page.locator('tbw-grid .master-detail-row').first().waitFor({ state: 'visible' });

    await expect(toggle).toMatchAriaSnapshot({ name: 'master-detail-toggle-expanded.aria.yml' });
  });
});

test.describe('ARIA tree — transient surfaces', () => {
  test('filter panel exposes a labelled, dismissible surface', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringDefaultDemo');

    await page.locator('tbw-grid [role="columnheader"][data-field] .tbw-filter-btn').first().click();
    const panel = page.locator('.tbw-filter-panel');
    await panel.waitFor({ state: 'visible' });

    await expect(panel).toMatchAriaSnapshot({ name: 'filter-panel.aria.yml' });
  });

  test('context menu exposes a menu of menuitems', async ({ page }) => {
    await openDemo(page, 'context-menu/ContextMenuDefaultDemo');

    await page.locator('tbw-grid [role="gridcell"]').first().click({ button: 'right' });
    const menu = page.locator('.tbw-context-menu, [role="menu"]').first();
    await menu.waitFor({ state: 'visible' });

    await expect(menu).toMatchAriaSnapshot({ name: 'context-menu.aria.yml' });
  });

  test('shell chrome exposes named tool panels', async ({ page }) => {
    await openDemo(page, 'ShellMultiPanelsDemo');

    await page.locator('tbw-grid [data-panel-toggle]').first().click();

    // The tool-panel aside only. Snapshotting the whole `tbw-grid` drags 20 rows
    // of volatile demo data into the baseline, so the assertion would fail on
    // data churn rather than on an accessibility regression.
    await expect(page.locator('tbw-grid .tbw-tool-panel')).toMatchAriaSnapshot({ name: 'shell-chrome.aria.yml' });
  });
});
