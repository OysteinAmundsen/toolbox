import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Row Grouping plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-row-grouping']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-row-grouping--default': async (page) => {
    const groupRow = page.locator('.group-row').first();
    await expect(groupRow).toBeVisible();
    await expect(groupRow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.group-label').first()).toBeVisible();

    // Clicking should expand the group
    await page.locator('.group-toggle').first().click();
    await expect(groupRow).toHaveAttribute('aria-expanded', 'true');
  },

  'grid-plugins-row-grouping--expanded-by-default': async (page) => {
    const groupRows = page.locator('.group-row');
    await expect(groupRows).not.toHaveCount(0);
    await expect(groupRows.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.data-grid-row:not(.group-row)')).not.toHaveCount(0);
  },

  'grid-plugins-row-grouping--no-row-count': async (page) => {
    await expect(page.locator('.group-count')).toHaveCount(0);
  },

  'grid-plugins-row-grouping--with-aggregators': async (page) => {
    await expect(page.locator('.group-aggregate').first()).toBeVisible();
  },
};

generateSmokeTests('Row Grouping Plugin', stories, expectations);
