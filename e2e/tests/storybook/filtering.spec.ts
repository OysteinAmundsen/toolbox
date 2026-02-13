import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Filtering plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-filtering']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-filtering--default': async (page) => {
    const filterBtn = page.locator('.tbw-filter-btn').first();
    await expect(filterBtn).toBeVisible();

    // Clicking opens the filter panel
    await filterBtn.click();
    await expect(page.locator('.tbw-filter-panel')).toBeVisible();
  },
};

generateSmokeTests('Filtering Plugin', stories, expectations);
