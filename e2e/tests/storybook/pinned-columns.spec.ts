import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Pinned Columns plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-pinned-columns']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-pinned-columns--default': async (page) => {
    await expect(page.locator('.cell.sticky-left').first()).toBeVisible();
    await expect(page.locator('.cell.sticky-right').first()).toBeVisible();
  },
};

generateSmokeTests('Pinned Columns Plugin', stories, expectations);
