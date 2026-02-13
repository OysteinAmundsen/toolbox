import { expect, test } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Core grid stories — covers grid-core, loading, header renderers,
 * RTL support, benchmarks, theming, and demo stories.
 */

const CORE_PREFIXES = [
  'grid-core',
  'grid-core-loading',
  'grid-header-renderers',
  'grid-rtl-support',
  'grid-benchmarks',
  'grid-theming-variable-reference',
  'grid-theming-theme-builder',
  'demos-employee-management',
];

const allStories = readCachedStoryIndex();
const stories = filterStories(allStories, CORE_PREFIXES);

const expectations: Record<string, StoryExpectation> = {
  'demos-employee-management--all-features': async (page) => {
    const rows = page.locator('[role="row"]:has([role="gridcell"])');
    await expect(rows).not.toHaveCount(0);
    const headerCells = page.locator('.header-row .cell');
    expect(await headerCells.count()).toBeGreaterThan(5);
  },
};

test('story index contains core stories', () => {
  test.skip(allStories.length === 0, 'Storybook not running or index not fetched');
  expect(stories.length).toBeGreaterThan(10);
});

generateSmokeTests('Core Stories', stories, expectations);
