#!/usr/bin/env bun
/**
 * Generate Plugin Sort Order for Storybook
 *
 * This script scans the plugins directory and generates the storySort array
 * that should be pasted into preview.ts.
 *
 * Storybook requires the storySort config to be defined inline (no imports),
 * so this script generates the array that you copy/paste when adding new plugins.
 *
 * Usage: bun apps/docs/.storybook/scripts/generate-plugin-sort.ts
 */

import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * Mapping from folder name to Storybook display title.
 * Only include non-obvious mappings (where Title Case isn't sufficient).
 */
const FOLDER_TO_TITLE: Record<string, string> = {
  'column-virtualization': 'Column-Virtualization',
  'context-menu': 'Context Menu',
  'grouping-columns': 'Column Grouping',
  'grouping-rows': 'Row Grouping',
  'master-detail': 'Master-Detail',
  'multi-sort': 'Multi-Sort',
  'pinned-columns': 'Pinned Columns',
  'pinned-rows': 'Pinned Rows',
  reorder: 'Column Reorder',
  'row-reorder': 'Row Reorder',
  'server-side': 'Server-Side',
  'undo-redo': 'Undo-Redo',
};

function getFolderTitle(folderName: string): string {
  return FOLDER_TO_TITLE[folderName] ?? folderName.charAt(0).toUpperCase() + folderName.slice(1);
}

// Find all plugin directories
const pluginsDir = join(import.meta.dir, '../../../../libs/grid/src/lib/plugins');
const pluginFolders = readdirSync(pluginsDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort((a, b) => getFolderTitle(a).localeCompare(getFolderTitle(b)));

// Generate the array content
const apiDocOrder = "['*', 'Classes', 'Interfaces', 'Types', 'Functions', 'Enums']";

console.log(`
// ============================================================
// GENERATED PLUGIN SORT ORDER
// Copy this array into preview.ts under 'Plugins'
// Run: bun apps/docs/.storybook/scripts/generate-plugin-sort.ts
// ============================================================
[
  'Overview',
  'Custom Plugins',`);

for (const folder of pluginFolders) {
  const title = getFolderTitle(folder);
  console.log(`  '${title}',`);
  console.log(`  ${apiDocOrder},`);
}

console.log(`  '*', // Any other plugins
]
// ============================================================
`);

// Also output just the list of plugins for verification
console.log('\nDiscovered plugins:');
for (const folder of pluginFolders) {
  console.log(`  - ${folder} -> ${getFolderTitle(folder)}`);
}
