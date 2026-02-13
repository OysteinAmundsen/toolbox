import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Column Grouping plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-column-grouping']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-column-grouping--default': async (page) => {
    await expect(page.locator('.header-group-row').first()).toBeVisible();
    await expect(page.locator('.header-group-cell').first()).toBeVisible();
  },
};

generateSmokeTests('Column Grouping Plugin', stories, expectations);
