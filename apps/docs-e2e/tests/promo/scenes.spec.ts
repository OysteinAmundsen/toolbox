import { type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  aim,
  beat,
  captureGridEvent,
  cell,
  cellByField,
  clickCell,
  clip,
  control,
  controlOption,
  dataRows,
  dblClickCell,
  dragBetween,
  glideClick,
  grid,
  headerCell,
  headerCells,
  hush,
  moveTo,
  openDemo,
  rightClickCell,
  rowCount,
  say,
  toggleControl,
  typeAndCommit,
  wheelScroll,
} from '../utils';
import { expect, test } from './fixture';

/**
 * Promo capability reel — one scene per capability.
 *
 * Playwright records one video per test, so each scene produces its own clip
 * that can be re-shot and stitched independently. Scenes run in declaration
 * order (`workers: 1`, `fullyParallel: false` in the promo config).
 *
 * Rules for every scene:
 * 1. Act, then assert the *consequence* of that act. Never `expect(grid).toBeVisible()`
 *    as the sole assertion — that only proves the page rendered.
 * 2. No `if (await x.isVisible())` guards. A missing control must fail the test,
 *    otherwise a broken demo passes silently and the video shows nothing.
 * 3. No `waitForTimeout` for correctness — use web-first assertions. `beat()` and
 *    `say()` are camera pacing only and are no-ops in CI.
 * 4. Exactly **one** `clip()` per scene, wrapping the single most persuasive
 *    moment. Everything outside a clip still runs (and still asserts) but never
 *    reaches the 30-second reel — the stitcher only cuts marked windows, and a
 *    second clip halves what the first one gets.
 * 5. `reel: false` keeps a scene out of the short reel while leaving it in the
 *    long cut. Thirty seconds only holds a dozen features at a watchable pace,
 *    so a scene has to displace another one to earn a place.
 */

/**
 * Animate an element's *content* width so the transition reads as a drag, not a jump.
 *
 * Two things are deliberate here:
 *
 * - `from` is measured rather than passed in. Promo mode restyles the page, so
 *   a hard-coded start width would either leave a void beside the element or
 *   not narrow it at all.
 * - `to` is a content width, not a border-box width. The promo stage pads the
 *   demo root by the width of the control rail, and under `box-sizing:
 *   border-box` that padding would silently eat most of a small target — the
 *   grid ends up a sliver instead of the intended frame.
 *
 * Returns the measured starting content width so a caller can restore it.
 */
async function animateWidth(page: Page, selector: string, to: number, steps = 24) {
  const el = page.locator(selector);
  const extra = await el.evaluate((node) => {
    const cs = getComputedStyle(node as HTMLElement);
    if (cs.boxSizing !== 'border-box') return 0;
    return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  });
  const from = Math.round(((await el.boundingBox())?.width ?? to + extra) - extra);
  for (let i = 1; i <= steps; i++) {
    const width = Math.round(from + ((to - from) * i) / steps) + extra;
    await el.evaluate((node, w) => {
      const style = (node as HTMLElement).style;
      style.width = `${w}px`;
      // Centre while narrowed, so the freed space reads as letterboxing rather
      // than a void hanging off one side of the frame.
      style.marginInline = 'auto';
    }, width);
    await page.waitForTimeout(16);
  }
  return from;
}

test.describe('Promo — capability reel', () => {
  test('Multi-column sort @promo', async ({ page }) => {
    await openDemo(page, 'multi-sort/MultiSortDefaultDemo', 'Multi-column sort', 'Stack sort keys with Shift+click');

    const first = headerCells(page).nth(0);
    const second = headerCells(page).nth(1);

    await say(page, 'Click a header to sort.');
    await aim(page, first, async () => {
      await first.click();
      await expect(first).toHaveAttribute('aria-sort', 'ascending');
    });

    await clip(page, { label: 'Sort by many columns at once', reel: false }, async () => {
      await aim(page, second, async () => {
        await second.click({ modifiers: ['Shift'] });
        // Priority badges prove the second key stacked instead of replacing.
        await expect(page.locator('tbw-grid .sort-index')).toHaveCount(2);
        await expect(first).toHaveAttribute('aria-sort', 'ascending');
      });
    });

    await hush(page);
  });

  test('Column filtering @promo', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringDefaultDemo', 'Filtering', 'Excel-style value filters per column');

    const before = await rowCount(page);
    const nameHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Name' });

    await say(page, 'Every column carries its own filter.');
    await nameHeader.hover();
    await glideClick(page, nameHeader.locator('.tbw-filter-btn'));

    const panel = page.locator('.tbw-filter-panel');
    await expect(panel).toBeVisible();

    await say(page, 'Clear everything, then pick a single value.');
    // Toggling "select all" re-creates every value checkbox, so wait for the
    // rebuild before clicking one — a click on the detached node applies an
    // empty filter and the scene proves nothing.
    const alice = panel.locator('.tbw-filter-checkbox[data-value="Alice Johnson"]');
    await glideClick(page, panel.locator('.tbw-filter-checkbox').first());
    await expect(alice).not.toBeChecked();
    await glideClick(page, alice);
    await expect(alice).toBeChecked();

    await clip(page, { label: 'Excel-style column filters', reel: false }, async () => {
      await glideClick(page, panel.locator('button', { hasText: /apply/i }));
      await expect(panel).toBeHidden();

      await expect.poll(() => rowCount(page)).toBeLessThan(before);
      // Address the column by field — the first `[role="gridcell"]` is the id column.
      const names = page.locator('tbw-grid [role="gridcell"][data-field="name"]');
      await expect
        .poll(async () => [...new Set((await names.allTextContents()).map((n) => n.trim()))])
        .toEqual(['Alice Johnson']);
    });

    await hush(page);
  });

  test('Selection modes @promo', async ({ page }) => {
    await openDemo(page, 'SelectionPlaygroundDemo', 'Selection', 'Cell, row and range — same API');

    const selection = await captureGridEvent<{ ranges?: unknown[] }>(page, 'selection-change');
    const output = page.locator('[data-output-id="selection-demo"]');

    await say(page, 'Cell mode: the active cell moves with each click.');
    await clickCell(page, 0, 1);
    await clickCell(page, 2, 3);
    await expect(output).toContainText(/row|cell|range/i);

    await say(page, 'Row mode: Shift+click selects a contiguous run.');
    await page.locator('input[type="radio"][value="row"]').check();
    await clickCell(page, 1, 0);
    await clickCell(page, 4, 0, { modifiers: ['Shift'] });
    await expect(page.locator('tbw-grid .data-grid-row.selected')).toHaveCount(4);

    await say(page, 'Ctrl+click extends the selection anywhere else.');
    await clickCell(page, 7, 0, { modifiers: ['Control'] });
    await expect(page.locator('tbw-grid .data-grid-row.selected')).toHaveCount(5);

    await page.locator('input[type="radio"][value="range"]').check();
    await clip(page, { label: 'Range selection — usually a paid add-on', weight: 1.2 }, async () => {
      await dragBetween(page, cell(page, 1, 1), cell(page, 4, 4));
      await expect.poll(async () => (await selection.last())?.ranges?.length ?? 0).toBeGreaterThan(0);
    });

    await hush(page);
  });

  test('Copy straight into a spreadsheet @promo', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardDefaultDemo', 'Clipboard', 'TSV out, TSV in — Excel compatible');

    await say(page, 'Select a block of cells and copy.');
    await clickCell(page, 0, 1);
    await clickCell(page, 2, 3, { modifiers: ['Shift'] });
    await page.keyboard.press('Control+c');

    const target = page.locator('#clipboard-external-target');
    await expect(target).toBeVisible();

    await clip(page, { label: 'Range copy to Excel — usually paid', weight: 1.2 }, async () => {
      await target.click();
      await page.keyboard.press('Control+v');

      await expect(target).toHaveValue(/alice@example\.com/);
      await expect(target).toHaveValue(/Engineering/);
      const pasted = await target.inputValue();
      expect(pasted.split('\n').length).toBeGreaterThanOrEqual(3);
    });
    await hush(page);
  });

  test('Inline editing with undo history @promo', async ({ page }) => {
    await openDemo(page, 'undo-redo/UndoRedoDefaultDemo', 'Editing & undo', 'Ctrl+Z / Ctrl+Y across every mutation');

    const target = cell(page, 0, 1);
    const original = ((await target.textContent()) ?? '').trim();
    expect(original).not.toBe('');

    await say(page, 'Double-click to edit in place.');
    await dblClickCell(page, 0, 1);
    await expect(page.locator('tbw-grid input, tbw-grid [contenteditable]').first()).toBeVisible();
    await typeAndCommit(page, 'Renamed by promo');
    await expect(target).toHaveText('Renamed by promo');

    await target.click();
    await clip(page, { label: 'Inline edit with real undo history', weight: 1.2 }, async () => {
      await page.keyboard.press('Control+z');
      await expect(target).toHaveText(original);
      await beat(page, 500);
      await page.keyboard.press('Control+y');
      await expect(target).toHaveText('Renamed by promo');
    });

    await hush(page);
  });

  test('Row grouping with aggregates @promo', async ({ page }) => {
    await openDemo(
      page,
      'grouping-rows/GroupingRowsWithAggregatorsDemo',
      'Row grouping',
      'Collapsible groups with live aggregation',
    );

    const toggle = page.locator('tbw-grid .group-toggle').first();
    await expect(toggle).toBeVisible();
    const collapsed = await rowCount(page);

    await clip(page, 'Grouping + totals — usually a paid add-on', async () => {
      await aim(page, toggle, async () => {
        await toggle.click();
        await expect.poll(() => rowCount(page)).toBeGreaterThan(collapsed);
      });
    });

    await say(page, 'Collapse it again — group state survives re-render.');
    await aim(page, toggle, async () => {
      await toggle.click();
      await expect.poll(() => rowCount(page)).toBe(collapsed);
    });

    await hush(page);
  });

  test('Hierarchical tree data @promo', async ({ page }) => {
    await openDemo(page, 'tree/TreeDefaultDemo', 'Tree data', 'Parent/child hierarchies with lazy expansion');

    const toggle = page.locator('tbw-grid .tree-toggle').first();
    await expect(toggle).toBeVisible();
    const collapsed = await rowCount(page);

    await clip(page, 'Tree data — usually a paid add-on', async () => {
      await aim(page, toggle, async () => {
        await toggle.click();
        await expect.poll(() => rowCount(page)).toBeGreaterThan(collapsed);
      });
    });

    await say(page, 'Collapse to fold the whole subtree away.');
    await aim(page, toggle, async () => {
      await toggle.click();
      await expect.poll(() => rowCount(page)).toBe(collapsed);
    });

    await hush(page);
  });

  test('Master-detail drill-down @promo', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailDefaultDemo', 'Master / detail', 'Render anything inside a row');

    const expander = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();
    await expect(expander).toBeVisible();

    const detail = page.locator('tbw-grid .master-detail-row').first();
    await clip(page, { label: 'Master-detail — usually a paid add-on', weight: 1.1 }, async () => {
      await aim(page, expander, async () => {
        await expander.click();
        await expect(detail).toBeVisible();
      });
      expect(((await detail.textContent()) ?? '').trim().length).toBeGreaterThan(0);
    });

    await say(page, 'Collapse it and the row height snaps back.');
    await aim(page, expander, async () => {
      await expander.click();
      await expect(detail).toBeHidden();
    });

    await hush(page);
  });

  test('Drag to reorder columns @promo', async ({ page }) => {
    await openDemo(page, 'reorder/ReorderDefaultDemo', 'Column reorder', 'Drag headers to rearrange');

    const before = await headerCells(page).allTextContents();
    expect(before.length).toBeGreaterThan(2);

    await clip(page, { label: 'Drag columns into place', reel: false }, async () => {
      await dragBetween(page, headerCells(page).nth(0), headerCells(page).nth(2));
      await expect.poll(async () => (await headerCells(page).allTextContents()).join('|')).not.toBe(before.join('|'));
    });

    // Reordering must move a column, never lose or duplicate one.
    const after = await headerCells(page).allTextContents();
    expect([...after].sort()).toEqual([...before].sort());

    await hush(page);
  });

  test('Drag to reorder rows @promo', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropDefaultDemo', 'Row drag & drop', 'Reorder rows by handle');

    const handles = page.locator('tbw-grid .dg-row-drag-handle');
    await expect(handles.first()).toBeVisible();
    const firstBefore = ((await dataRows(page).first().textContent()) ?? '').trim();

    await clip(page, { label: 'Drag rows into place', reel: false }, async () => {
      await dragBetween(page, handles.nth(0), handles.nth(3));
      await expect.poll(async () => ((await dataRows(page).first().textContent()) ?? '').trim()).not.toBe(firstBefore);
    });
    await hush(page);
  });

  test('Pinned columns while scrolling @promo', async ({ page }) => {
    await openDemo(
      page,
      'pinned-columns/PinnedColumnsDefaultDemo',
      'Pinned columns',
      'Frozen columns + virtualization',
    );

    const pinned = page.locator('tbw-grid [role="columnheader"].sticky-left').first();
    await expect(pinned).toBeVisible();

    /*
     * The demo's columns total ~1320px. Whether that overflows depends on the
     * stage width, so narrow to a fraction of whatever the panel currently is —
     * a hard-coded target would either not overflow, or shrink the grid into a
     * sliver beside a void.
     */
    await animateWidth(page, '#pinned-columns-default-demo', 720, 16);
    const scroller = page.locator('tbw-grid .tbw-scroll-area, tbw-grid .scroll-viewport').first();
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeGreaterThan(0);

    const pinnedBefore = await pinned.boundingBox();
    // The *last* header is the right-pinned "Actions" column, so it never moves —
    // measure a genuinely scrollable column instead.
    const freeHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Address' }).first();
    const pinnedRight = page.locator('tbw-grid [role="columnheader"].sticky-right').first();
    const freeBefore = await freeHeader.boundingBox();
    const pinnedRightBefore = await pinnedRight.boundingBox();

    await clip(page, { label: 'Pinned columns stay put', weight: 1.2, reel: false }, async () => {
      await wheelScroll(page, grid(page), 1200, 0, 30);
      await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

      const pinnedAfter = await pinned.boundingBox();
      const freeAfter = await freeHeader.boundingBox();
      const pinnedRightAfter = await pinnedRight.boundingBox();
      expect(pinnedAfter?.x).toBeCloseTo(pinnedBefore?.x ?? 0, 0);
      expect(pinnedRightAfter?.x).toBeCloseTo(pinnedRightBefore?.x ?? 0, 0);
      expect(freeAfter?.x ?? 0).toBeLessThan(freeBefore?.x ?? 0);
    });

    await wheelScroll(page, grid(page), -1200, 0, 30);
    await hush(page);
  });

  test('Context menu with submenus @promo', async ({ page }) => {
    await openDemo(
      page,
      'context-menu/ContextMenuWithSubmenusDemo',
      'Context menu',
      'Nested, extensible, keyboard-safe',
    );

    const menu = page.locator('.tbw-context-menu, [role="menu"]').first();
    const items = page.locator('[role="menuitem"]');

    await clip(page, { label: 'Nested context menus', reel: false }, async () => {
      await rightClickCell(page, 1, 1);
      await expect(menu).toBeVisible();
      await expect(items.first()).toBeVisible();
      expect(await items.count()).toBeGreaterThan(0);

      const parent = items.filter({ hasText: /export|share|more/i }).first();
      await parent.hover();
      await expect.poll(() => items.count()).toBeGreaterThan(1);
    });

    await say(page, 'Escape closes it.');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await hush(page);
  });

  test('Responsive card mode @promo', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveDefaultDemo', 'Responsive', 'Table on desktop, cards on mobile');

    const wrap = page.locator('.responsive-resize-wrap');
    await expect(wrap).toBeVisible();

    // The single most persuasive shot in the reel: a layout change nobody wrote
    // a media query for. Weighted up so the morph is legible at 30 fps.
    let startWidth = 0;
    await clip(page, { label: 'Table → cards. No rewrite.', weight: 1.6, align: 'end' }, async () => {
      startWidth = await animateWidth(page, '.responsive-resize-wrap', 380);
      // Card layout is driven by the `data-responsive` attribute the plugin sets.
      await expect(grid(page)).toHaveAttribute('data-responsive', /.*/);
    });

    await say(page, 'Widen it again and the table comes back. No media queries.');
    await animateWidth(page, '.responsive-resize-wrap', startWidth);
    await expect(grid(page)).not.toHaveAttribute('data-responsive', /.*/);
    await expect(dataRows(page).first()).toBeVisible();

    await hush(page);
  });

  test('Export to CSV @promo', async ({ page }) => {
    await openDemo(page, 'export/ExportEventsDemo', 'Export', 'CSV and styled Excel, client-side');

    const csvBtn = page
      .locator('#export-csv-btn, .export-csv, button')
      .filter({ hasText: /csv|export/i })
      .first();
    await expect(csvBtn).toBeVisible();

    await say(page, 'One click exports the current view — sorting and filters included.');
    const [download] = await aim(page, csvBtn, () => Promise.all([page.waitForEvent('download'), csvBtn.click()]));

    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = readFileSync(path as string, 'utf8');
    const lines = csv.trim().split(/\r?\n/);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].split(',').length).toBeGreaterThan(1);

    // A download is invisible on camera, so the clip is the payload readout.
    await clip(page, { label: 'Export CSV & Excel', weight: 0.8, holdMs: 1200, reel: false }, async () => {
      await say(page, `${download.suggestedFilename()} — ${lines[0]}`, 900);
      await say(page, lines[1], 900);
    });
    await hush(page);
  });

  test('Server-side paging @promo', async ({ page }) => {
    await openDemo(page, 'server-side/ServerSideDemo', 'Server-side data', 'Paging, infinite scroll, remote sort');

    await say(page, 'Switch the data source to server-side paging.');
    await page.locator('label', { hasText: 'paging' }).first().click();
    await expect(dataRows(page).first()).toBeVisible();

    const firstBefore = ((await dataRows(page).first().textContent()) ?? '').trim();

    await clip(page, { label: 'Server-side paging', weight: 0.8, reel: false }, async () => {
      await page
        .locator('button')
        .filter({ hasText: /next|→|›/i })
        .first()
        .click();
      await expect.poll(async () => ((await dataRows(page).first().textContent()) ?? '').trim()).not.toBe(firstBefore);
    });

    await hush(page);
  });

  test('Print-ready output @promo', async ({ page }) => {
    await openDemo(page, 'print/PrintBasicDemo', 'Printing', 'Full dataset, print stylesheet included');

    await clip(page, { label: 'Print the whole dataset', weight: 0.8, holdMs: 700, reel: false }, async () => {
      await page.emulateMedia({ media: 'print' });
      await expect(dataRows(page).first()).toBeVisible();
      expect(await rowCount(page)).toBeGreaterThan(0);
    });

    await page.emulateMedia({ media: 'screen' });
    await expect(dataRows(page).first()).toBeVisible();
    await hush(page);
  });

  test('Grouped column headers @promo', async ({ page }) => {
    await openDemo(
      page,
      'grouping-columns/GroupingColumnsDefaultDemo',
      'Column groups',
      'Multi-level headers that span their members',
    );

    const groupRow = page.locator('tbw-grid .header-group-row');
    const personal = page.locator('tbw-grid .header-group-cell[data-group="personal"]');
    await expect(groupRow).toBeVisible();

    await clip(page, { label: 'Multi-level column headers', weight: 0.9, holdMs: 700, reel: false }, async () => {
      await aim(page, personal, async () => {
        // Prove the span is computed rather than decorative: the group cell must
        // start where its first member starts and be as wide as all three together.
        const groupBox = await personal.boundingBox();
        let membersWidth = 0;
        let membersLeft = Number.POSITIVE_INFINITY;
        for (const field of ['firstName', 'lastName', 'email']) {
          const box = await page.locator(`tbw-grid [role="columnheader"][data-field="${field}"]`).boundingBox();
          if (!box) throw new Error(`no header for ${field}`);
          membersWidth += box.width;
          membersLeft = Math.min(membersLeft, box.x);
        }
        expect(Math.abs((groupBox?.width ?? 0) - membersWidth)).toBeLessThan(2);
        expect(Math.abs((groupBox?.x ?? 0) - membersLeft)).toBeLessThan(2);
      });
    });

    await say(page, 'Group borders are a single config flag.');
    await toggleControl(page, 'showGroupBorders', false);
    await expect(groupRow).toHaveClass(/no-borders/);
    await expect(page.locator('tbw-grid .header-row')).toHaveClass(/no-group-borders/);

    await toggleControl(page, 'showGroupBorders', true);
    await expect(groupRow).not.toHaveClass(/no-borders/);
    // A `.group-end` marker closes every group, including the implicit one
    // around the ungrouped `id` column.
    expect(
      await page
        .locator('tbw-grid .header-row .cell.group-end')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-field'))),
    ).toEqual(['id', 'email', 'salary']);

    await hush(page);
  });

  test('Column visibility panel @promo', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityDefaultDemo', 'Column visibility', 'Show, hide and lock columns');

    // `email` ships hidden, so five configured columns render as four.
    await expect(headerCells(page)).toHaveCount(4);

    await say(page, 'The tool panel lists every column the grid knows about.');
    await glideClick(page, page.locator('tbw-grid .tbw-toolbar-btn[data-panel-toggle]'));
    const panel = page.locator('tbw-grid .tbw-tool-panel');
    await expect(panel).toHaveClass(/open/);

    await say(page, 'Tick a column back on — headers and cells both return.');
    await clip(page, { label: 'Show, hide and lock columns', weight: 0.9, reel: false }, async () => {
      await glideClick(page, panel.locator('.tbw-visibility-row[data-field="email"] label'));
      await expect(headerCells(page)).toHaveCount(5);
      await expect(page.locator('tbw-grid [role="gridcell"][data-field="email"]').first()).toBeVisible();

      await glideClick(page, panel.locator('.tbw-visibility-row[data-field="salary"] label'));
      await expect(headerCells(page)).toHaveCount(4);
      await expect(page.locator('tbw-grid [role="gridcell"][data-field="salary"]')).toHaveCount(0);
    });

    await say(page, 'Columns can be locked so users cannot hide them.');
    const locked = panel.locator('.tbw-visibility-row[data-field="id"]');
    await aim(page, locked, async () => {
      await expect(locked).toHaveClass(/locked/);
      await expect(locked.locator('input')).toBeDisabled();
    });

    await hush(page);
  });

  test('Shell with stacked tool panels @promo', async ({ page }) => {
    await openDemo(page, 'ShellMultiPanelsDemo', 'Shell', 'Header, toolbar and pluggable tool panels');

    await expect(page.locator('tbw-grid .tbw-shell-title')).toHaveText('Multi-Panel Demo');

    await say(page, 'Plugins contribute their own panels to one shared shell.');
    await glideClick(page, page.locator('tbw-grid .tbw-toolbar-btn[data-panel-toggle]'));
    await expect(page.locator('tbw-grid .tbw-tool-panel')).toHaveClass(/open/);
    await expect(page.locator('tbw-grid .tbw-accordion-section')).toHaveCount(3);
    await expect(page.locator('tbw-grid [data-section="filter"]')).toHaveClass(/expanded/);

    await say(page, 'The accordion is exclusive — one section at a time.');
    await glideClick(page, page.locator('tbw-grid [data-section="columns"] .tbw-accordion-header'));
    await expect(page.locator('tbw-grid [data-section="columns"]')).toHaveClass(/expanded/);
    await expect(page.locator('tbw-grid [data-section="filter"]')).not.toHaveClass(/expanded/);

    await say(page, 'Panels drive the grid, not just themselves.');
    await clip(page, { label: 'Tool panels — usually a paid add-on', weight: 1.1 }, async () => {
      await glideClick(
        page,
        page.locator('tbw-grid #tbw-section-columns .tbw-visibility-row[data-field="salary"] label'),
      );
      await expect(page.locator('tbw-grid [role="gridcell"][data-field="salary"]')).toHaveCount(0);
    });

    await hush(page);
  });

  test('Tooltips @promo', async ({ page }) => {
    await openDemo(page, 'tooltip/TooltipDefaultDemo', 'Tooltips', 'Per-column, value-aware, anchored');

    // The popover is appended to document.body, not inside the grid.
    const tip = page.locator('.tbw-tooltip-popover');

    await say(page, 'Headers can carry their own explanatory text.');
    await moveTo(page, headerCell(page, 'Job Title & Responsibilities'));
    await headerCell(page, 'Job Title & Responsibilities').hover();
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText('The official job title and primary area of responsibility');
    await beat(page);

    // The popover is hoverable (WCAG 2.2 SC 1.4.13), so it takes pointer events
    // and would intercept a hover on whatever it currently covers. Escape — the
    // documented dismissal — clears it before each new target.
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();

    await say(page, 'Cell tooltips are functions of the row, not fixed strings.');
    const roleCell = cellByField(page, 0, 'role');
    await moveTo(page, roleCell);
    await clip(page, { label: 'Tooltips that know the row', weight: 0.9, reel: false }, async () => {
      await roleCell.hover();
      await expect(tip).toHaveText('Alice Johnson — Senior Software Engineer');
    });

    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();

    await say(page, 'Turn the feature off and they stop entirely.');
    await toggleControl(page, 'cell', false);
    const nextCell = cellByField(page, 1, 'role');
    await moveTo(page, nextCell);
    await nextCell.hover();
    await expect(tip).toBeHidden();

    await hush(page);
  });

  test('Sticky section rows @promo', async ({ page }) => {
    await openDemo(page, 'sticky-rows/StickyRowsDemo', 'Sticky rows', 'iOS-style section headers');

    const stickyHost = page.locator('tbw-grid .tbw-sticky-rows');
    const stuck = stickyHost.locator('.tbw-sticky-row');
    await expect(stickyHost).toHaveAttribute('data-mode', 'push');
    await expect(stuck).toHaveCount(0);

    await clip(page, { label: 'Sticky section headers', weight: 1.1, reel: false }, async () => {
      await wheelScroll(page, grid(page), 0, 900, 24);
      await expect(stuck).toHaveCount(1);
      await expect(stuck.first()).toHaveClass(/row-section/);
      // The clone is presentational — screen readers still read the real row.
      await expect(stuck.first()).toHaveAttribute('aria-hidden', 'true');
    });

    const firstLabel = ((await stuck.first().textContent()) ?? '').trim();
    await say(page, 'The next section pushes the previous one out of the way.');
    await wheelScroll(page, grid(page), 0, 1400, 24);
    await expect.poll(async () => ((await stuck.first().textContent()) ?? '').trim()).not.toBe(firstLabel);

    await say(page, 'Or stack them, up to a limit you choose.');
    await controlOption(page, 'mode', 'stack').check();
    await expect(stickyHost).toHaveAttribute('data-mode', 'stack');
    // Switching the mode rebuilds the config but PRESERVES the scroll
    // position, so the stack fills immediately from where we already are —
    // capped by `maxStacked` (3). Before #1370 the rebuild wiped the clone
    // cache and the stack was stuck at one row here.
    await expect
      .poll(() => stuck.count(), { message: 'stack mode accumulates more than one pinned section' })
      .toBeGreaterThan(1);
    expect(await stuck.count()).toBeLessThanOrEqual(3);
    await wheelScroll(page, grid(page), 0, 400, 16);
    await expect.poll(() => stuck.count()).toBeLessThanOrEqual(3);

    await hush(page);
  });

  test('Column virtualization @promo', async ({ page }) => {
    await openDemo(
      page,
      'column-virtualization/ColumnVirtualizationDefaultDemo',
      'Column virtualization',
      '50 columns configured, a handful in the DOM',
    );

    const scroller = page.locator('tbw-grid .tbw-scroll-area, tbw-grid .scroll-viewport').first();
    const fields = () => headerCells(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-field') ?? ''));

    const rendered = await headerCells(page).count();
    await say(page, `50 columns configured — ${rendered} actually in the DOM.`);
    expect(rendered).toBeGreaterThan(3);
    expect(rendered).toBeLessThan(50);

    const before = await fields();
    await clip(page, { label: 'Columns are virtualized too', weight: 1.1, reel: false }, async () => {
      await wheelScroll(page, grid(page), 2500, 0, 30);
      await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

      const after = await fields();
      expect(after).not.toEqual(before);
      // The DOM budget stays bounded no matter how far you scroll.
      expect(after.length).toBeLessThan(50);
    });

    // A left pad stands in for everything scrolled out of the window.
    await expect
      .poll(async () =>
        parseFloat(
          await page.locator('tbw-grid .header-row').evaluate((el) => (el as HTMLElement).style.paddingLeft || '0'),
        ),
      )
      .toBeGreaterThan(0);

    await say(page, 'Switch it off and all 50 render at once.');
    await toggleControl(page, 'autoEnable', false);
    await expect(headerCells(page)).toHaveCount(50);

    await hush(page);
  });

  test('Pivot tables @promo', async ({ page }) => {
    await openDemo(page, 'pivot/PivotDefaultDemo', 'Pivot', 'Cross-tabulate rows against columns');

    const groupRows = page.locator('tbw-grid .pivot-group-row');
    const leafRows = page.locator('tbw-grid .pivot-leaf-row');
    await expect(groupRows.first()).toBeVisible();
    await expect(page.locator('tbw-grid .pivot-grand-total-row')).toHaveCount(1);

    await say(page, 'Regions down the side, quarters across the top.');
    await beat(page);

    const leavesBefore = await leafRows.count();
    await say(page, 'Groups collapse to the level you want to read.');
    const firstToggle = groupRows.first().locator('.pivot-toggle');
    await glideClick(page, firstToggle);
    await expect(firstToggle).toHaveAttribute('aria-label', 'Expand group');
    await expect.poll(() => leafRows.count()).toBeLessThan(leavesBefore);

    await glideClick(page, firstToggle);
    await expect(firstToggle).toHaveAttribute('aria-label', 'Collapse group');
    await expect.poll(() => leafRows.count()).toBe(leavesBefore);

    await say(page, 'Change the aggregation and every column relabels and recomputes.');
    await clip(page, { label: 'Pivot — usually a paid add-on', weight: 1.3 }, async () => {
      await control(page, 'aggFunc').selectOption('avg');
      await expect(headerCells(page).filter({ hasText: 'Q1 - Avg Sales (avg)' })).toHaveCount(1);
      await expect(headerCells(page).filter({ hasText: /Total Sales \(sum\)/ })).toHaveCount(0);
    });

    await say(page, 'Turn pivoting off and the raw table is still there.');
    await toggleControl(page, 'active', false);
    await expect(groupRows).toHaveCount(0);
    await expect(headerCells(page)).toHaveCount(4);

    await hush(page);
  });

  test('Pinned summary rows @promo', async ({ page }) => {
    await openDemo(
      page,
      'pinned-rows/PinnedRowsDefaultDemo',
      'Pinned rows',
      'Totals and status panels that never scroll',
    );

    const totals = page.locator('tbw-grid .tbw-aggregation-row[data-aggregation-id="totals"]');
    await expect(totals).toBeVisible();

    await say(page, 'A footer row aggregates the whole dataset, not the page.');
    await aim(page, totals, async () => {
      // The demo generates 100 rows across 5 distinct names.
      await expect(page.locator('tbw-grid .tbw-aggregation-cell[data-field="name"]')).toHaveText('5 unique');
      await expect(page.locator('tbw-grid .tbw-aggregation-cell[data-field="price"]')).toHaveText(/^\$[\d,]+\.\d{2}$/);
    });

    await say(page, 'Status panels live in three zones and update themselves.');
    await expect(page.locator('tbw-grid [data-pinned-row-id="count"] .tbw-status-panel-row-count')).toHaveText(
      'Total: 100 rows',
    );
    await expect(page.locator('tbw-grid [data-pinned-row-id="custom"] .tbw-status-panel')).toHaveText(
      /Inventory value: \$[\d.]+/,
    );
    await say(page, 'Drop a panel from the config and it disappears.');
    await toggleControl(page, 'showCustom', false);
    await expect(page.locator('tbw-grid [data-pinned-row-id="custom"]')).toHaveCount(0);

    await say(page, 'Stack several summaries — sum, average, min and max.');
    await clip(page, { label: 'Totals that never scroll away', weight: 0.9, reel: false }, async () => {
      await toggleControl(page, 'multipleRows', true);
      await expect(page.locator('tbw-grid .tbw-aggregation-row')).toHaveCount(3);
    });

    await say(page, 'Pin the summaries above the data instead.');
    await controlOption(page, 'aggPosition', 'top').check();
    await expect(page.locator('tbw-grid .tbw-header-pinned .tbw-aggregation-rows-top')).toHaveCount(3);
    await expect(page.locator('tbw-grid .tbw-footer .tbw-aggregation-rows-bottom')).toHaveCount(0);

    await say(page, 'Or collapse each one into a full-width band.');
    await toggleControl(page, 'fullWidth', true);
    // One band per aggregation row, and no per-column cells left.
    await expect(page.locator('tbw-grid .tbw-aggregation-cell-full')).toHaveCount(3);
    await expect(page.locator('tbw-grid .tbw-aggregation-cell[data-field]')).toHaveCount(0);

    await hush(page);
  });
});
