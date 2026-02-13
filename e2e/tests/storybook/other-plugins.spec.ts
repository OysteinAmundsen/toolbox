import { filterStories, generateSmokeTests, readCachedStoryIndex } from './smoke-utils';

/**
 * Remaining plugin stories — smaller plugins grouped together:
 * column-reorder, column-virtualization, export, pivot, print,
 * row-reorder, undo-redo.
 */

const stories = filterStories(readCachedStoryIndex(), [
  'grid-plugins-column-reorder',
  'grid-plugins-column-virtualization',
  'grid-plugins-export',
  'grid-plugins-pivot',
  'grid-plugins-print',
  'grid-plugins-row-reorder',
  'grid-plugins-undo-redo',
]);

generateSmokeTests('Other Plugins', stories);
