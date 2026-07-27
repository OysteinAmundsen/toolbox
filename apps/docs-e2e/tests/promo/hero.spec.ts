import { expect, test } from '@playwright/test';
import {
  beat,
  captureGridEvent,
  cellByField,
  dragBetween,
  glideClick,
  headerCell,
  hush,
  numericColumn,
  openDemo,
  rowCount,
  say,
  spotlight,
  toggleControl,
  typeAndCommit,
} from '../utils';

/**
 * Hero promo scene — one analyst, one dataset, one continuous session.
 *
 * This is deliberately *not* a tour of isolated demo pages. Every step runs
 * against the same grid instance, so it exercises the thing that actually
 * breaks in a grid: plugins interacting (sort under a filter, aggregation
 * reacting to a filter, undo across an edit, master-detail inside grouping).
 *
 * It is a real CI test: `beat()` / `say()` / `spotlight()` are no-ops outside
 * promo mode, and every step asserts the consequence of its own interaction.
 */
test.describe('Promo — hero scenario', () => {
  test('Analyst workflow: sort, filter, select, drill in, edit, undo, group @promo', async ({ page }) => {
    test.setTimeout(240_000);

    await openDemo(page, 'EmployeeManagementAllFeaturesDemo', 'Toolbox Grid', 'One grid. Every feature. No framework.');

    const rows = page.locator('tbw-grid .data-grid-row');
    await expect(rows.first()).toBeVisible();
    const totalRows = await rowCount(page);
    expect(totalRows).toBeGreaterThan(10);

    await say(page, 'A real dataset: 200 employees, grouped headers, pinned columns, live totals.');
    await beat(page, 1200);
    await hush(page);

    // ── Sort ────────────────────────────────────────────────────────────────
    const salary = headerCell(page, 'Salary');
    await spotlight(page, salary);
    await say(page, 'Click a header to sort.');
    await salary.click();
    await expect(salary).toHaveAttribute('aria-sort', 'ascending');

    await say(page, 'Click again for descending — highest earners first.');
    await salary.click();
    await expect(salary).toHaveAttribute('aria-sort', 'descending');

    const sorted = await numericColumn(page, 'salary');
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));

    // ── Multi-sort ──────────────────────────────────────────────────────────
    const dept = headerCell(page, 'Dept');
    await spotlight(page, dept);
    await say(page, 'Shift+click stacks a second sort key.');
    await dept.click({ modifiers: ['Shift'] });
    await expect(page.locator('tbw-grid .sort-index')).toHaveCount(2);
    await hush(page);

    // ── Filter (and watch the row set shrink) ────────────────────────────────
    const targetDept = ((await cellByField(page, 0, 'department').textContent()) ?? '').trim();
    expect(targetDept).not.toBe('');

    await say(page, `Narrow the list down to ${targetDept}.`);
    await dept.hover();
    await glideClick(page, dept.locator('.tbw-filter-btn'));

    const panel = page.locator('.tbw-filter-panel');
    await expect(panel).toBeVisible();
    await spotlight(page, panel);

    // First checkbox is "select all" — clearing it, then picking one value.
    await glideClick(page, panel.locator('.tbw-filter-checkbox').first());
    await glideClick(page, panel.locator(`.tbw-filter-checkbox[data-value="${targetDept}"]`));
    await glideClick(page, panel.locator('button', { hasText: /apply/i }));
    await expect(panel).toBeHidden();

    const visibleDepts = await page.locator('tbw-grid [role="gridcell"][data-field="department"]').allTextContents();
    expect(visibleDepts.length).toBeGreaterThan(0);
    expect([...new Set(visibleDepts.map((d) => d.trim()))]).toEqual([targetDept]);
    expect(await rowCount(page)).toBeLessThan(totalRows);

    await say(page, 'Every row left is a match — aggregates recompute against the filtered set.');
    await beat(page, 900);
    await hush(page);

    // ── Range selection ─────────────────────────────────────────────────────
    const selection = await captureGridEvent<{ ranges: unknown[] }>(page, 'selection-change');
    await spotlight(page, null);
    await say(page, 'Drag across cells to select a range.');
    await dragBetween(page, cellByField(page, 0, 'salary'), cellByField(page, 4, 'bonus'));

    await expect
      .poll(async () => (await selection.last())?.ranges?.length ?? 0, { message: 'range selection emitted' })
      .toBeGreaterThan(0);

    // ── Master-detail ───────────────────────────────────────────────────────
    await say(page, 'Expand a row to drill into the full record.');
    const expander = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();
    await spotlight(page, expander);
    await expander.click();

    const detail = page.locator('tbw-grid .master-detail-row').first();
    await expect(detail).toBeVisible();
    expect(((await detail.textContent()) ?? '').trim().length).toBeGreaterThan(0);
    await beat(page, 900);
    await spotlight(page, null);

    // ── Edit + undo ─────────────────────────────────────────────────────────
    const titleCell = cellByField(page, 0, 'title');
    const originalTitle = ((await titleCell.textContent()) ?? '').trim();
    expect(originalTitle).not.toBe('');

    await say(page, 'Double-click to edit in place.');
    await spotlight(page, titleCell);
    await titleCell.dblclick();
    await expect(page.locator('tbw-grid .cell.editing, tbw-grid input, tbw-grid select').first()).toBeVisible();
    await typeAndCommit(page, 'Principal Engineer');
    await expect(titleCell).toHaveText(/Principal Engineer/);

    await say(page, 'Ctrl+Z — full undo history, out of the box.');
    await titleCell.click();
    await page.keyboard.press('Control+z');
    await expect(titleCell).toHaveText(originalTitle);
    await spotlight(page, null);
    await hush(page);

    // ── Row grouping (rebuilds the grid with the same data) ─────────────────
    await say(page, 'Turn on row grouping — aggregation per department.');
    await toggleControl(page, 'enableRowGrouping', true);

    const groupRows = page.locator('tbw-grid .group-row');
    await expect(groupRows.first()).toBeVisible();
    const groupCountBefore = await groupRows.count();
    expect(groupCountBefore).toBeGreaterThan(1);

    await say(page, 'Expand a group to see its members and its aggregates.');
    const firstGroupToggle = page.locator('tbw-grid .group-toggle').first();
    await spotlight(page, firstGroupToggle);
    const rowsBeforeExpand = await rowCount(page);
    await firstGroupToggle.click();
    await expect.poll(() => rowCount(page)).toBeGreaterThan(rowsBeforeExpand);

    await say(page, 'Collapse it again — state is preserved, not rebuilt.');
    await firstGroupToggle.click();
    await expect.poll(() => rowCount(page)).toBe(rowsBeforeExpand);

    await spotlight(page, null);
    await say(page, 'One web component. Framework-agnostic. Under 50 kB gzipped.');
    await beat(page, 2000);
    await hush(page);
  });
});
