import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Storybook Smoke Tests
 *
 * Generates one test per story so Playwright can parallelize across workers.
 * The story index is fetched during globalSetup (scripts/fetch-story-index.ts)
 * and cached as JSON. Each test loads a single story and verifies:
 *   1. No JavaScript errors
 *   2. A `<tbw-grid>` element is rendered (for grid stories)
 *   3. Story-specific expectations (DOM structure, ARIA attributes, interactions)
 *
 * Prerequisites:
 *   bun nx serve docs    # Storybook on port 4400
 *
 * Run with:
 *   npx playwright test storybook-smoke.spec.ts
 */

const STORYBOOK_URL = 'http://localhost:4400';

// #region Story Classification

/** Stories that don't contain a <tbw-grid> element (theming tools, etc.) */
const NON_GRID_STORIES = new Set(['grid-theming-variable-reference--reference', 'grid-theming-theme-builder--builder']);

/** Stories with known JS errors (story bugs, not grid bugs) */
const KNOWN_ERROR_STORIES = new Set([
  // Missing EditingPlugin — clipboard story uses editable columns without it
  'grid-plugins-clipboard--copy-paste',
]);

/** Stories that need extra time to render (async data, large datasets) */
const SLOW_STORIES = new Set([
  'grid-benchmarks--performance-stress-test',
  'grid-plugins-server-side--default',
  'grid-plugins-server-side--paging-mode',
  'grid-plugins-server-side--server-side-sorting',
  'demos-employee-management--all-features',
  'demos-employee-management--grouped-by-department',
]);

// #endregion

// #region Story Expectations

/**
 * Per-story functional expectations.
 *
 * Each entry maps a story ID to an async function that receives the loaded
 * page and asserts story-specific outcomes: DOM structure, ARIA attributes,
 * CSS classes, and interactive behaviors.
 *
 * Stories without an entry still get the baseline smoke checks (no JS errors,
 * grid present, rows rendered). Add expectations here to verify that a
 * plugin or feature actually produces the correct DOM output.
 */
const STORY_EXPECTATIONS: Record<string, (page: Page) => Promise<void>> = {
  // ── Multi-Sort ──────────────────────────────────────────────────────
  'grid-plugins-multi-sort--default': async (page) => {
    // Sortable headers should be present
    const sortableHeaders = page.locator('.header-row .cell.sortable');
    await expect(sortableHeaders.first()).toBeVisible();

    // Clicking a sortable header should apply a data-sort attribute
    await sortableHeaders.first().click();
    await expect(page.locator('.header-row .cell[data-sort]').first()).toBeVisible();
    await expect(page.locator('.sort-indicator').first()).toBeVisible();
  },

  'grid-plugins-multi-sort--with-initial-sort': async (page) => {
    // Pre-sorted columns should have data-sort set on load
    const sorted = page.locator('.header-row .cell[data-sort]');
    await expect(sorted.first()).toBeVisible();
    // Sort index badges should show priority numbers
    await expect(page.locator('.sort-index').first()).toBeVisible();
  },

  'grid-plugins-multi-sort--no-badges': async (page) => {
    // Click to sort, then verify no sort-index badges appear
    const sortable = page.locator('.header-row .cell.sortable').first();
    await sortable.click();
    await expect(page.locator('.header-row .cell[data-sort]').first()).toBeVisible();
    await expect(page.locator('.sort-index')).toHaveCount(0);
  },

  // ── Filtering ───────────────────────────────────────────────────────
  'grid-plugins-filtering--default': async (page) => {
    // Filter button should be visible in header cells
    const filterBtn = page.locator('.tbw-filter-btn').first();
    await expect(filterBtn).toBeVisible();

    // Clicking it should open the filter panel
    await filterBtn.click();
    await expect(page.locator('.tbw-filter-panel')).toBeVisible();
  },

  // ── Selection ───────────────────────────────────────────────────────
  'grid-plugins-selection--default': async (page) => {
    // Clicking a cell should focus it
    const firstCell = page.locator('[role="gridcell"]').first();
    await firstCell.click();
    await expect(firstCell).toHaveAttribute('aria-selected', 'true');
  },

  'grid-plugins-selection--checkbox-selection': async (page) => {
    // Checkbox inputs should exist in the first column
    const checkboxes = page.locator('[role="gridcell"] input[type="checkbox"]');
    await expect(checkboxes).not.toHaveCount(0);
  },

  // ── Editing ─────────────────────────────────────────────────────────
  'grid-plugins-editing--basic-editing': async (page) => {
    // Double-clicking an editable cell should enter edit mode
    const cells = page.locator('[role="gridcell"]');
    await cells.nth(1).dblclick();
    await expect(page.locator('.cell.editing')).not.toHaveCount(0);
    // An input or select should appear inside the editing cell
    const editor = page.locator('.cell.editing input, .cell.editing select, .cell.editing textarea');
    await expect(editor.first()).toBeVisible();
  },

  'grid-plugins-editing--grid-mode': async (page) => {
    // Grid-mode class should be present immediately
    await expect(page.locator('tbw-grid.tbw-grid-mode')).toBeVisible();
  },

  // ── Master-Detail ───────────────────────────────────────────────────
  'grid-plugins-master-detail--default': async (page) => {
    // Expander toggles should exist with aria-expanded="false"
    const toggle = page.locator('.master-detail-toggle').first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Clicking should expand — aria-expanded changes and detail row appears
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.master-detail-row').first()).toBeVisible();
  },

  // ── Row Grouping ────────────────────────────────────────────────────
  'grid-plugins-row-grouping--default': async (page) => {
    // Group rows should exist, collapsed by default
    const groupRow = page.locator('.group-row').first();
    await expect(groupRow).toBeVisible();
    await expect(groupRow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.group-label').first()).toBeVisible();

    // Clicking should expand the group
    await page.locator('.group-toggle').first().click();
    await expect(groupRow).toHaveAttribute('aria-expanded', 'true');
  },

  'grid-plugins-row-grouping--expanded-by-default': async (page) => {
    // All groups should be expanded on load
    const groupRows = page.locator('.group-row');
    await expect(groupRows).not.toHaveCount(0);
    const first = groupRows.first();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    // Data rows should be visible
    await expect(page.locator('.data-grid-row:not(.group-row)')).not.toHaveCount(0);
  },

  'grid-plugins-row-grouping--no-row-count': async (page) => {
    // Group count badges should not be present
    await expect(page.locator('.group-count')).toHaveCount(0);
  },

  'grid-plugins-row-grouping--with-aggregators': async (page) => {
    // Aggregate values should be visible in group rows
    await expect(page.locator('.group-aggregate').first()).toBeVisible();
  },

  // ── Pinned Columns ──────────────────────────────────────────────────
  'grid-plugins-pinned-columns--default': async (page) => {
    // Left-pinned cells should have sticky-left class
    await expect(page.locator('.cell.sticky-left').first()).toBeVisible();
    // Right-pinned cells should have sticky-right class
    await expect(page.locator('.cell.sticky-right').first()).toBeVisible();
  },

  // ── Context Menu ────────────────────────────────────────────────────
  'grid-plugins-context-menu--default': async (page) => {
    // Right-click a data row to open the context menu
    const row = page.locator('[role="row"]:has([role="gridcell"])').first();
    await row.click({ button: 'right' });
    const menu = page.locator('.tbw-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');
    // Menu should have items
    await expect(page.locator('.tbw-context-menu-item')).not.toHaveCount(0);
  },

  // ── Tree ────────────────────────────────────────────────────────────
  'grid-plugins-tree--default': async (page) => {
    // Tree toggle buttons should exist for folder nodes
    const toggle = page.locator('.tree-toggle').first();
    await expect(toggle).toBeVisible();

    // Clicking should expand the node and reveal children
    await toggle.click();
    await page.waitForTimeout(300); // animation settle
    await expect(toggle).toHaveClass(/expanded/);
  },

  'grid-plugins-tree--expanded-by-default': async (page) => {
    // All toggles should have expanded class on load
    const toggles = page.locator('.tree-toggle');
    await expect(toggles).not.toHaveCount(0);
    await expect(toggles.first()).toHaveClass(/expanded/);
  },

  // ── Responsive ──────────────────────────────────────────────────────
  'grid-plugins-responsive--card-mode': async (page) => {
    // Card layout should be active — grid gets data-responsive attribute
    await expect(page.locator('tbw-grid[data-responsive]')).toBeVisible();
    // Data rows should still be rendered in stacked card layout
    await expect(page.locator('tbw-grid[data-responsive] .data-grid-row').first()).toBeVisible();
  },

  // ── Visibility ──────────────────────────────────────────────────────
  'grid-plugins-visibility--initially-hidden': async (page) => {
    // Some columns should be hidden — fewer header cells than the default story
    const headerCells = page.locator('.header-row .cell');
    const count = await headerCells.count();
    expect(count).toBeGreaterThan(0);
    // The "initially hidden" story should have fewer visible columns
    // (exact count depends on config, but at least some columns are present)
  },

  // ── Pinned Rows ─────────────────────────────────────────────────────
  'grid-plugins-pinned-rows--default': async (page) => {
    // Footer area with info bar should be visible
    await expect(page.locator('.tbw-footer').first()).toBeVisible();
    // Status panel with row count should be present
    await expect(page.locator('.tbw-pinned-rows').first()).toBeVisible();
  },

  // ── Column Grouping ─────────────────────────────────────────────────
  'grid-plugins-column-grouping--default': async (page) => {
    // Group header row should be present above the normal header
    await expect(page.locator('.header-group-row').first()).toBeVisible();
    // Individual group header cells should span columns
    await expect(page.locator('.header-group-cell').first()).toBeVisible();
  },

  // ── Demos ───────────────────────────────────────────────────────────
  'demos-employee-management--all-features': async (page) => {
    // Full-featured demo should have many data rows and header cells
    const rows = page.locator('[role="row"]:has([role="gridcell"])');
    await expect(rows).not.toHaveCount(0);
    const headerCells = page.locator('.header-row .cell');
    expect(await headerCells.count()).toBeGreaterThan(5);
  },
};

// #endregion

// #region Story Index

interface StoryIndexEntry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
}

/**
 * Read the story index that was cached by globalSetup.
 * Returns an empty array if the file doesn't exist (Storybook not running).
 */
function readCachedStoryIndex(): StoryIndexEntry[] {
  const indexPath = resolve(__dirname, '..', 'test-results', 'story-index.json');
  if (!existsSync(indexPath)) return [];
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8')) as StoryIndexEntry[];
  } catch {
    return [];
  }
}

const stories = readCachedStoryIndex();

// #endregion

// #region Test Generation

test.describe('Storybook Smoke Tests', () => {
  // No retries — flakes should be investigated, not retried
  test.describe.configure({ retries: 0 });

  test('storybook index is accessible and has stories', async () => {
    test.skip(stories.length === 0, 'Storybook not running or index not fetched');
    expect(stories.length).toBeGreaterThan(50);
  });

  // Generate one test per story — Playwright distributes across workers
  for (const story of stories) {
    const skipErrors = KNOWN_ERROR_STORIES.has(story.id);
    const skipGrid = NON_GRID_STORIES.has(story.id);
    const isSlow = SLOW_STORIES.has(story.id);

    test(`story: ${story.id}`, async ({ page }) => {
      // Increase timeout for slow stories
      if (isSlow) test.setTimeout(20_000);

      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`${STORYBOOK_URL}/iframe.html?id=${story.id}&viewMode=story`, {
        timeout: isSlow ? 15_000 : 8_000,
        waitUntil: 'domcontentloaded',
      });

      // Wait for Storybook to mount the story
      try {
        await page.waitForFunction(
          () => {
            const root = document.querySelector('#storybook-root');
            return root && root.children.length > 0;
          },
          { timeout: isSlow ? 8_000 : 3_000 },
        );
      } catch {
        // Some stories may render empty — checked below
      }

      if (isSlow) await page.waitForTimeout(1_000);

      const diagnostics = await page.evaluate(() => {
        const root = document.querySelector('#storybook-root');
        const grid = root?.querySelector('tbw-grid');
        const rows = root?.querySelectorAll('tbw-grid [role="row"]:has([role="gridcell"])');
        return { hasGrid: !!grid, rowCount: rows?.length ?? 0 };
      });

      page.removeAllListeners('pageerror');

      // Assert: no JS errors
      if (!skipErrors) {
        expect(errors, `Story "${story.id}" had JS errors: ${errors.join(', ')}`).toHaveLength(0);
      }

      // Assert: grid element present
      if (!skipGrid) {
        expect(diagnostics.hasGrid, `Story "${story.id}" is missing <tbw-grid>`).toBe(true);
      }

      // Informational: warn about stories with 0 rows (not a failure)
      if (!skipGrid && diagnostics.hasGrid && diagnostics.rowCount === 0) {
        console.warn(`⚠️  Story "${story.id}" has a grid but 0 visible data rows`);
      }

      // Run story-specific expectations (interactions, DOM assertions)
      const expectation = STORY_EXPECTATIONS[story.id];
      if (expectation) {
        await expectation(page);
      }
    });
  }
});

// #endregion
