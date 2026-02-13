import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Master-Detail plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-master-detail']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-master-detail--default': async (page) => {
    const toggle = page.locator('.master-detail-toggle').first();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Clicking should expand
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.master-detail-row').first()).toBeVisible();
  },
};

generateSmokeTests('Master-Detail Plugin', stories, expectations);
