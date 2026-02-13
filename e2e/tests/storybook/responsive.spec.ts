import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Responsive plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-responsive']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-responsive--card-mode': async (page) => {
    await expect(page.locator('tbw-grid[data-responsive]')).toBeVisible();
    await expect(page.locator('tbw-grid[data-responsive] .data-grid-row').first()).toBeVisible();
  },
};

generateSmokeTests('Responsive Plugin', stories, expectations);
