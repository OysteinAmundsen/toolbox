import { expect, test } from '@playwright/test';
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
    });
  }
});

// #endregion