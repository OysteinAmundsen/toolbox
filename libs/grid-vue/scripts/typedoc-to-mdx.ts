/**
 * Generate MDX files from TypeDoc JSON for grid-vue.
 * Run: `bun nx typedoc grid-vue`
 */

import { join } from 'node:path';

import { generateAdapterDocs, KIND, type TypeDocNode } from '../../../tools/typedoc-mdx-shared';

const COMPONENT_NAMES = [
  'TbwGrid',
  'TbwGridColumn',
  'TbwGridDetailPanel',
  'TbwGridResponsiveCard',
  'TbwGridToolButtons',
  'TbwGridToolPanel',
  'GridTypeProvider',
  'GridIconProvider',
  'GridProvider',
];

generateAdapterDocs({
  name: 'grid-vue',
  urlBase: '/grid/vue/api',
  jsonPath: join(import.meta.dirname, '../docs/api-generated/api.json'),
  outputDir: join(import.meta.dirname, '../../../apps/docs/src/content/docs/grid/vue/api'),
  regenerateCommand: 'bun nx typedoc grid-vue',
  categories: [
    {
      name: 'Components',
      folder: 'components',
      match: (n: TypeDocNode) => COMPONENT_NAMES.includes(n.name),
    },
    {
      name: 'Composables',
      folder: 'composables',
      match: (n: TypeDocNode) => n.name.startsWith('use') && n.kind === KIND.Function,
    },
    {
      name: 'Adapters',
      folder: 'adapters',
      match: (n: TypeDocNode) => n.kind === KIND.Class && n.name.includes('Adapter'),
    },
    {
      name: 'Types',
      folder: 'types',
      match: (n: TypeDocNode) => n.kind === KIND.TypeAlias || n.kind === KIND.Interface,
    },
  ],
});
