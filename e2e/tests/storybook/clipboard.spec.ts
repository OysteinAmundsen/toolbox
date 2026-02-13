import { filterStories, generateSmokeTests, readCachedStoryIndex } from './smoke-utils';

/**
 * Clipboard plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-clipboard']);

generateSmokeTests('Clipboard Plugin', stories);
