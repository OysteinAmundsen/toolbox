import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Editing plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-editing']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-editing--basic-editing': async (page) => {
    const cells = page.locator('[role="gridcell"]');
    await cells.nth(1).dblclick();
    await expect(page.locator('.cell.editing')).not.toHaveCount(0);
    const editor = page.locator('.cell.editing input, .cell.editing select, .cell.editing textarea');
    await expect(editor.first()).toBeVisible();
  },

  'grid-plugins-editing--grid-mode': async (page) => {
    await expect(page.locator('tbw-grid.tbw-grid-mode')).toBeVisible();
  },
};

generateSmokeTests('Editing Plugin', stories, expectations);
