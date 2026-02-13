import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Visibility plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-visibility']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-visibility--initially-hidden': async (page) => {
    const headerCells = page.locator('.header-row .cell');
    const count = await headerCells.count();
    expect(count).toBeGreaterThan(0);
  },
};

generateSmokeTests('Visibility Plugin', stories, expectations);
