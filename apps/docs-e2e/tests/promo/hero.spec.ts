import {
  aim,
  beat,
  captureGridEvent,
  card,
  cellByField,
  clip,
  dataRows,
  dragBetween,
  glideClick,
  grid,
  headerCell,
  hush,
  numericColumn,
  openDemo,
  rowCount,
  say,
  toggleControl,
  typeAndCommit,
  wheelScroll,
} from '../utils';
import { expect, test } from './fixture';

/**
 * Hero promo scene — one analyst, one dataset, one continuous session.
 *
 * This is deliberately *not* a tour of isolated demo pages. Every step runs
 * against the same grid instance, so it exercises the thing that actually
 * breaks in a grid: plugins interacting (sort under a filter, aggregation
 * reacting to a filter, undo across an edit, master-detail inside grouping).
 *
 * It is a real CI test: `beat()` / `say()` / `clip()` are no-ops outside promo
 * mode, and every step asserts the consequence of its own interaction.
 *
 * Reel budget: this scene owns the **bookends** (intro/outro cards) plus the two
 * shots no single-feature scene can produce — the dataset at scale, and two
 * plugins composing. Per-feature money shots belong in `scenes.spec.ts`;
 * duplicating one here would spend the 30-second budget twice on the same idea.
 */
test.describe('Promo — hero scenario', () => {
  test('Analyst workflow: sort, filter, select, drill in, edit, undo, group @promo', async ({ page }) => {
    test.setTimeout(240_000);

    const INTRO = { main: 'Every feature. One component.', sub: 'Framework-agnostic. Under 50 kB gzipped.' };
    await openDemo(
      page,
      'EmployeeManagementAllFeaturesDemo',
      'Toolbox Grid',
      'One grid. Every feature. No framework.',
      INTRO,
    );

    const rows = page.locator('tbw-grid .data-grid-row');
    await expect(rows.first()).toBeVisible();
    const totalRows = await rowCount(page);
    expect(totalRows).toBeGreaterThan(10);

    await card(page, 'intro', INTRO.main, INTRO.sub);

    // ── Establishing shot: the dataset at scale ─────────────────────────────
    // Row virtualization is the one thing a still frame cannot show, so the
    // opening beat is motion: 200 records streaming past a fixed DOM budget.
    await clip(page, { label: '200 records. Virtualized, not paginated.', weight: 1.5, holdMs: 500 }, async () => {
      const firstBefore = ((await dataRows(page).first().textContent()) ?? '').trim();
      const domRowsBefore = await rowCount(page);
      await wheelScroll(page, grid(page), 0, 2600, 34);
      await expect.poll(async () => ((await dataRows(page).first().textContent()) ?? '').trim()).not.toBe(firstBefore);
      // Scrolling recycles rows; it must never grow the DOM.
      expect(await rowCount(page)).toBeLessThanOrEqual(domRowsBefore + 2);
      await wheelScroll(page, grid(page), 0, -2600, 20);
    });

    // ── Sort ────────────────────────────────────────────────────────────────
    const salary = headerCell(page, 'Salary');
    await say(page, 'Click a header to sort.');
    await aim(page, salary, async () => {
      await salary.click();
      await expect(salary).toHaveAttribute('aria-sort', 'ascending');
      await salary.click();
      await expect(salary).toHaveAttribute('aria-sort', 'descending');
    });

    const sorted = await numericColumn(page, 'salary');
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));

    // ── Multi-sort ──────────────────────────────────────────────────────────
    const dept = headerCell(page, 'Dept');
    await say(page, 'Shift+click stacks a second sort key.');
    await aim(page, dept, async () => {
      await dept.click({ modifiers: ['Shift'] });
      await expect(page.locator('tbw-grid .sort-index')).toHaveCount(2);
    });
    await hush(page);

    // ── Filter, on top of the sort that is already applied ─────────────────
    // The composition shot: filtering and sorting are separate plugins that
    // never talk to each other, and the beat is that applying one does not
    // silently drop the other.
    const targetDept = ((await cellByField(page, 0, 'department').textContent()) ?? '').trim();
    expect(targetDept).not.toBe('');

    await dept.hover();
    await glideClick(page, dept.locator('.tbw-filter-btn'));

    const panel = page.locator('.tbw-filter-panel');
    await expect(panel).toBeVisible();

    // First checkbox is "select all" — clearing it, then picking one value.
    // Toggling "select all" re-creates every value checkbox (the list is
    // virtualized and re-rendered wholesale), so the next click must wait for
    // the rebuild — otherwise it lands on a detached node, nothing is excluded
    // and Apply silently filters nothing.
    const targetValue = panel.locator(`.tbw-filter-checkbox[data-value="${targetDept}"]`);
    await glideClick(page, panel.locator('.tbw-filter-checkbox').first());
    await expect(targetValue).not.toBeChecked();
    await glideClick(page, targetValue);
    await expect(targetValue).toBeChecked();

    await clip(page, { label: 'Filter — without losing the sort', weight: 1.5 }, async () => {
      await glideClick(page, panel.locator('button', { hasText: /apply/i }));
      await expect(panel).toBeHidden();

      // Applying the filter re-renders the rows asynchronously, so poll rather
      // than reading the cells once.
      const departmentCells = page.locator('tbw-grid [role="gridcell"][data-field="department"]');
      await expect
        .poll(async () => [...new Set((await departmentCells.allTextContents()).map((d) => d.trim()))], {
          message: 'only the chosen department survives the filter',
        })
        .toEqual([targetDept]);
      expect(await rowCount(page)).toBeLessThan(totalRows);
      // Sort survives the filter: the rows left are still salary-descending.
      const remaining = await numericColumn(page, 'salary');
      expect(remaining).toEqual([...remaining].sort((a, b) => b - a));
      await expect(salary).toHaveAttribute('aria-sort', 'descending');
    });

    // ── Range selection ─────────────────────────────────────────────────────
    const selection = await captureGridEvent<{ ranges: unknown[] }>(page, 'selection-change');
    await say(page, 'Drag across cells to select a range.');
    await dragBetween(page, cellByField(page, 0, 'salary'), cellByField(page, 4, 'bonus'));

    await expect
      .poll(async () => (await selection.last())?.ranges?.length ?? 0, { message: 'range selection emitted' })
      .toBeGreaterThan(0);

    // ── Master-detail ───────────────────────────────────────────────────────
    await say(page, 'Expand a row to drill into the full record.');
    const expander = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();
    const detail = page.locator('tbw-grid .master-detail-row').first();
    await aim(page, expander, async () => {
      await expander.click();
      await expect(detail).toBeVisible();
    });
    expect(((await detail.textContent()) ?? '').trim().length).toBeGreaterThan(0);

    // ── Edit + undo ─────────────────────────────────────────────────────────
    const titleCell = cellByField(page, 0, 'title');
    const originalTitle = ((await titleCell.textContent()) ?? '').trim();
    expect(originalTitle).not.toBe('');

    await say(page, 'Double-click to edit in place.');
    await aim(page, titleCell, async () => {
      await titleCell.dblclick();
      await expect(page.locator('tbw-grid .cell.editing, tbw-grid input, tbw-grid select').first()).toBeVisible();
      await typeAndCommit(page, 'Principal Engineer');
      await expect(titleCell).toHaveText(/Principal Engineer/);
    });

    await say(page, 'Ctrl+Z — full undo history, out of the box.');
    await aim(page, titleCell, async () => {
      await titleCell.click();
      await page.keyboard.press('Control+z');
      await expect(titleCell).toHaveText(originalTitle);
    });
    await hush(page);

    // ── Row grouping (rebuilds the grid with the same data) ─────────────────
    await say(page, 'Row grouping — aggregation per department.');
    await toggleControl(page, 'enableRowGrouping', true);

    const groupRows = page.locator('tbw-grid .group-row');
    await expect(groupRows.first()).toBeVisible();
    const groupCountBefore = await groupRows.count();
    expect(groupCountBefore).toBeGreaterThan(1);

    const firstGroupToggle = page.locator('tbw-grid .group-toggle').first();
    const rowsBeforeExpand = await rowCount(page);
    await aim(page, firstGroupToggle, async () => {
      await firstGroupToggle.click();
      await expect.poll(() => rowCount(page)).toBeGreaterThan(rowsBeforeExpand);
      await firstGroupToggle.click();
      await expect.poll(() => rowCount(page)).toBe(rowsBeforeExpand);
    });

    await hush(page);
    await beat(page, 300);
    await card(page, 'outro', 'toolboxjs.com', 'npm i @toolbox-web/grid');
  });
});
