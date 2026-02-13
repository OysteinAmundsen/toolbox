import { expect, test } from '@playwright/test';

/**
 * Storybook Smoke Tests
 *
 * Automatically discovers all stories from Storybook's index endpoint and
 * generates one test per story. Each test verifies the story loads without
 * JavaScript errors and renders a functioning grid component.
 *
 * This replaces manual testing of stories before releases.
 *
 * **Skipped on CI**: Iterating ~110 stories sequentially takes too long on
 * shared CI runners. The Storybook build step already catches compilation
 * errors. Run locally to validate story rendering before merging.
 *
 * Prerequisites:
 *   bun nx serve docs    # Storybook on port 4400
 *
 * Run with:
 *   npx playwright test storybook-smoke.spec.ts
 */

// Skip on CI — iterating ~110 stories is too slow for shared runners.
// The Storybook BUILD step already validates compilation.
test.skip(!!process.env.CI, 'Storybook smoke tests are skipped on CI (too slow for shared runners)');

const STORYBOOK_URL = 'http://localhost:4400';

// Stories that are known to not contain a <tbw-grid> element
// (e.g., theming tools, docs-only, benchmark harnesses)
const NON_GRID_STORIES = new Set(['grid-theming-variable-reference--reference', 'grid-theming-theme-builder--builder']);

// Stories with known JS errors (story bugs, not grid bugs).
// These are excluded from the JS error test but still checked for grid rendering.
// TODO: Fix these stories and remove from this list.
const KNOWN_ERROR_STORIES = new Set([
  // Missing EditingPlugin — clipboard story uses editable columns without it
  'grid-plugins-clipboard--copy-paste',
]);

// Stories that need extra time to render (async data, large datasets, etc.)
const SLOW_STORIES = new Set([
  'grid-benchmarks--performance-stress-test',
  'grid-plugins-server-side--default',
  'grid-plugins-server-side--paging-mode',
  'grid-plugins-server-side--server-side-sorting',
  'demos-employee-management--all-features',
  'demos-employee-management--grouped-by-department',
]);

interface StoryIndexEntry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
}

interface StoryIndex {
  v: number;
  entries: Record<string, StoryIndexEntry>;
}

/**
 * Fetch all story IDs from Storybook's index endpoint.
 * Filters to only 'story' type entries (excludes MDX docs pages).
 */
async function fetchStoryIds(): Promise<StoryIndexEntry[]> {
  const res = await fetch(`${STORYBOOK_URL}/index.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Storybook index: ${res.status} ${res.statusText}`);
  }
  const index = (await res.json()) as StoryIndex;
  return Object.values(index.entries).filter((entry) => entry.type === 'story');
}

/**
 * Load a story in Storybook's iframe mode and return diagnostics.
 *
 * Optimization: Uses 'domcontentloaded' instead of 'networkidle' and waits
 * for a rendered element rather than a fixed timeout. This cuts per-story
 * time from ~1.7s to ~0.4s, saving ~2 minutes across 110 stories.
 */
async function loadStory(
  page: import('@playwright/test').Page,
  storyId: string,
): Promise<{ errors: string[]; hasGrid: boolean; rowCount: number }> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const isSlow = SLOW_STORIES.has(storyId);

  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`, {
    timeout: isSlow ? 15000 : 8000,
    waitUntil: 'domcontentloaded',
  });

  // Wait for Storybook to mount the story (root gets children)
  try {
    await page.waitForFunction(
      () => {
        const root = document.querySelector('#storybook-root');
        return root && root.children.length > 0;
      },
      { timeout: isSlow ? 8000 : 3000 },
    );
  } catch {
    // Some stories may render empty — that's fine, we check below
  }

  // Minimal settle time for async renders (only slow stories need more)
  if (isSlow) {
    await page.waitForTimeout(1000);
  }

  const diagnostics = await page.evaluate(() => {
    const root = document.querySelector('#storybook-root');
    const grid = root?.querySelector('tbw-grid');
    const rows = root?.querySelectorAll('tbw-grid [role="row"]:has([role="gridcell"])');
    return {
      hasGrid: !!grid,
      rowCount: rows?.length ?? 0,
    };
  });

  page.removeAllListeners('pageerror');

  return { errors, ...diagnostics };
}

// ─── Test Generation ───────────────────────────────────────────────────
// All stories are loaded in a single pass to avoid repeating ~110 page
// navigations. Results are collected and assertions run at the end.

test.describe('Storybook Smoke Tests', () => {
  // Disable retries — retrying all 110 stories because one failed is wasteful.
  // Storybook smoke tests are informational; flakes should be investigated, not retried.
  test.describe.configure({ retries: 0 });

  let stories: StoryIndexEntry[] = [];
  let storybookAvailable = false;

  test.beforeAll(async () => {
    try {
      stories = await fetchStoryIds();
      storybookAvailable = stories.length > 0;
    } catch {
      console.warn('⚠️  Could not connect to Storybook at', STORYBOOK_URL);
      console.warn('   Start it with: bun nx serve docs');
    }
  });

  test('storybook index is accessible and has stories', async () => {
    test.skip(!storybookAvailable, 'Storybook not running at ' + STORYBOOK_URL);
    // We should have at least 50 stories in the project
    expect(stories.length).toBeGreaterThan(50);
  });

  test('all stories render correctly', async ({ page }) => {
    test.skip(!storybookAvailable, 'Storybook not running');
    // Budget ~3s per story for CI (locally ~0.3s). Cap at 5 minutes to prevent runaway.
    test.setTimeout(Math.min(stories.length * 3000, 5 * 60 * 1000));

    // Collect results in a single pass
    const jsErrors: { id: string; errors: string[] }[] = [];
    const missingGrid: string[] = [];
    const noRows: string[] = [];

    for (const story of stories) {
      const skipErrors = KNOWN_ERROR_STORIES.has(story.id);
      const skipGrid = NON_GRID_STORIES.has(story.id);

      try {
        const result = await loadStory(page, story.id);

        // Check 1: JS errors
        if (!skipErrors && result.errors.length > 0) {
          jsErrors.push({ id: story.id, errors: result.errors });
        }

        // Check 2: Grid element present
        if (!skipGrid && !result.hasGrid) {
          missingGrid.push(story.id);
        }

        // Check 3: Data rows rendered (soft — some stories are intentionally empty)
        if (!skipGrid && result.hasGrid && result.rowCount === 0) {
          noRows.push(story.id);
        }
      } catch (e) {
        if (!skipErrors) {
          jsErrors.push({ id: story.id, errors: [(e as Error).message] });
        }
        if (!skipGrid) {
          missingGrid.push(`${story.id} (load failed)`);
        }
      }
    }

    // Report stories with 0 rows (informational, not a failure)
    if (noRows.length > 0) {
      console.warn(
        `⚠️  ${noRows.length} stories have a grid but 0 visible data rows:\n` +
          noRows.map((s) => `  - ${s}`).join('\n'),
      );
    }

    // Assert: no JS errors
    if (jsErrors.length > 0) {
      const report = jsErrors.map((f) => `  ❌ ${f.id}:\n${f.errors.map((e) => `     ${e}`).join('\n')}`).join('\n');
      expect.soft(jsErrors, `${jsErrors.length}/${stories.length} stories had JS errors:\n${report}`).toHaveLength(0);
    }

    // Assert: all grid stories have a <tbw-grid>
    if (missingGrid.length > 0) {
      expect
        .soft(
          missingGrid,
          `${missingGrid.length} stories missing <tbw-grid>:\n${missingGrid.map((m) => `  ❌ ${m}`).join('\n')}`,
        )
        .toHaveLength(0);
    }
  });
});
