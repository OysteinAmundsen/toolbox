import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Tree plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-tree']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-tree--default': async (page) => {
    const toggle = page.locator('.tree-toggle').first();
    await expect(toggle).toBeVisible();

    await toggle.click();
    await page.waitForTimeout(300); // animation settle
    await expect(toggle).toHaveClass(/expanded/);
  },

  'grid-plugins-tree--expanded-by-default': async (page) => {
    const toggles = page.locator('.tree-toggle');
    await expect(toggles).not.toHaveCount(0);
    await expect(toggles.first()).toHaveClass(/expanded/);
  },
};

generateSmokeTests('Tree Plugin', stories, expectations);
