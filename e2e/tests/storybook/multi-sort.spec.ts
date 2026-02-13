import { expect } from '@playwright/test';
import { filterStories, generateSmokeTests, readCachedStoryIndex, type StoryExpectation } from './smoke-utils';

/**
 * Multi-Sort plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-multi-sort']);

const expectations: Record<string, StoryExpectation> = {
  'grid-plugins-multi-sort--default': async (page) => {
    const sortableHeaders = page.locator('.header-row .cell.sortable');
    await expect(sortableHeaders.first()).toBeVisible();

    // Clicking a sortable header should apply a data-sort attribute
    await sortableHeaders.first().click();
    await expect(page.locator('.header-row .cell[data-sort]').first()).toBeVisible();
    await expect(page.locator('.sort-indicator').first()).toBeVisible();
  },

  'grid-plugins-multi-sort--with-initial-sort': async (page) => {
    // Pre-sorted columns should have data-sort set on load
    const sorted = page.locator('.header-row .cell[data-sort]');
    await expect(sorted.first()).toBeVisible();
    await expect(page.locator('.sort-index').first()).toBeVisible();
  },

  'grid-plugins-multi-sort--no-badges': async (page) => {
    const sortable = page.locator('.header-row .cell.sortable').first();
    await sortable.click();
    await expect(page.locator('.header-row .cell[data-sort]').first()).toBeVisible();
    await expect(page.locator('.sort-index')).toHaveCount(0);
  },
};

generateSmokeTests('Multi-Sort Plugin', stories, expectations);
