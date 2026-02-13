import { filterStories, generateSmokeTests, readCachedStoryIndex } from './smoke-utils';

/**
 * Server-Side plugin stories.
 */

const stories = filterStories(readCachedStoryIndex(), ['grid-plugins-server-side']);

generateSmokeTests('Server-Side Plugin', stories);
