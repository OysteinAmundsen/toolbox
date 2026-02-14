import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Shared utilities for Storybook smoke tests.
 *
 * Each spec file in this folder tests a subset of stories (core, per-plugin,
 * etc.). This module provides the shared infrastructure:
 *   - Story index reading (cached by globalSetup)
 *   - Story classification sets (slow, non-grid, known errors)
 *   - Test generator that creates one Playwright test per story
 *   - Type definitions
 */

export const STORYBOOK_URL = 'http://localhost:4400';

// #region Types

export interface StoryIndexEntry {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
}

/** Async assertion function that receives the page after baseline checks pass. */
export type StoryExpectation = (page: Page) => Promise<void>;

// #endregion

// #region Story Classification

/** Stories that don't contain a `<tbw-grid>` element (theming tools, etc.) */
export const NON_GRID_STORIES = new Set([
  'grid-theming-variable-reference--reference',
  'grid-theming-theme-builder--builder',
]);

/** Stories with known JS errors (story bugs, not grid bugs) */
export const KNOWN_ERROR_STORIES = new Set([
  // Missing EditingPlugin — clipboard story uses editable columns without it
  'grid-plugins-clipboard--copy-paste',
]);

/** Stories that need extra time to render (async data, large datasets) */
export const SLOW_STORIES = new Set([
  'grid-benchmarks--performance-stress-test',
  'grid-plugins-server-side--default',
  'grid-plugins-server-side--paging-mode',
  'grid-plugins-server-side--server-side-sorting',
  'demos-employee-management--all-features',
  'demos-employee-management--grouped-by-department',
]);

// #endregion

// #region Story Index

/**
 * Read the story index that was cached by globalSetup.
 * Returns an empty array if the file doesn't exist (Storybook not running).
 */
export function readCachedStoryIndex(): StoryIndexEntry[] {
  const indexPath = resolve(__dirname, '..', '..', 'test-results', 'story-index.json');
  if (!existsSync(indexPath)) return [];
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8')) as StoryIndexEntry[];
  } catch {
    return [];
  }
}

/**
 * Filter stories by prefix(es). Each prefix is matched against the story ID
 * before the `--` separator (e.g. `"grid-plugins-editing"` matches
 * `"grid-plugins-editing--basic-editing"`).
 */
export function filterStories(stories: StoryIndexEntry[], prefixes: string[]): StoryIndexEntry[] {
  return stories.filter((s) => prefixes.some((p) => s.id.startsWith(p + '--') || s.id.startsWith(p + '-')));
}

// #endregion

// #region Test Generator

/**
 * Generate one Playwright test per story inside a `test.describe()` block.
 *
 * Each test:
 *   1. Navigates to the story's iframe URL
 *   2. Waits for Storybook to mount
 *   3. Asserts no JS errors (unless in KNOWN_ERROR_STORIES)
 *   4. Asserts `<tbw-grid>` is present (unless in NON_GRID_STORIES)
 *   5. Runs story-specific expectations from the provided map
 *
 * @param describeName  Name for the `test.describe()` block
 * @param stories       Stories to generate tests for
 * @param expectations  Optional map of story ID → assertion function
 */
export function generateSmokeTests(
  describeName: string,
  stories: StoryIndexEntry[],
  expectations: Record<string, StoryExpectation> = {},
) {
  test.describe(describeName, () => {
    test.describe.configure({ retries: 0 });

    // Storybook smoke tests are too slow on CI runners (~3-4s per story × 111 stories).
    // The build-storybook CI job already validates compilation; these catch runtime
    // errors which is valuable locally but not worth the CI cost.
    test.skip(!!process.env.CI, 'Storybook smoke tests skipped on CI (too slow)');

    for (const story of stories) {
      const skipErrors = KNOWN_ERROR_STORIES.has(story.id);
      const skipGrid = NON_GRID_STORIES.has(story.id);
      const isSlow = SLOW_STORIES.has(story.id);

      test(`story: ${story.id}`, async ({ page }) => {
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
        const expectation = expectations[story.id];
        if (expectation) {
          await expectation(page);
        }
      });
    }
  });
}

// #endregion
