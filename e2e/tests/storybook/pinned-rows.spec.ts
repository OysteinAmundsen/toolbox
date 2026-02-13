import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Pinned Rows plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-pinned-rows']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-pinned-rows--default': async (page) => {
    await expect(page.locator('.tbw-footer').first()).toBeVisible();
    await expect(page.locator('.tbw-pinned-rows').first()).toBeVisible();
  },
};

generateSmokeTests('Pinned Rows Plugin', stories, expectations);
