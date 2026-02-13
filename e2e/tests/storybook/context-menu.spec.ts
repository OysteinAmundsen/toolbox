import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Context Menu plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-context-menu']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-context-menu--default': async (page) => {
    const row = page.locator('[role="row"]:has([role="gridcell"])').first();
    await row.click({ button: 'right' });
    const menu = page.locator('.tbw-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');
    await expect(page.locator('.tbw-context-menu-item')).not.toHaveCount(0);
  },
};

generateSmokeTests('Context Menu Plugin', stories, expectations);
