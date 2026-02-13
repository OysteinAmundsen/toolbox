import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Selection plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-selection']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-selection--default': async (page) => {
    const firstCell = page.locator('[role="gridcell"]').first();
    await firstCell.click();
    await expect(firstCell).toHaveAttribute('aria-selected', 'true');
  },

  'grid-plugins-selection--checkbox-selection': async (page) => {
    const checkboxes = page.locator('[role="gridcell"] input[type="checkbox"]');
    await expect(checkboxes).not.toHaveCount(0);
  },
};

generateSmokeTests('Selection Plugin', stories, expectations);
