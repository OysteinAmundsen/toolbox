/**
 * Generate MDX files from TypeDoc JSON for grid-angular.
 * Run: `bun nx typedoc grid-angular`
 */

import { join } from 'node:path';

import { generateAdapterDocs, KIND, type TypeDocNode } from '../../../tools/typedoc-mdx-shared';

const DIRECTIVE_NAMES = [
  'Grid',
  'GridFormArray',
  'TbwRenderer',
  'TbwEditor',
  'GridColumnView',
  'GridColumnEditor',
  'GridDetailView',
  'GridToolPanel',
  'GridResponsiveCard',
];

generateAdapterDocs({
  name: 'grid-angular',
  urlBase: '/grid/angular/api',
  jsonPath: join(import.meta.dirname, '../docs/api-generated/api.json'),
  outputDir: join(import.meta.dirname, '../../../apps/docs/src/content/docs/grid/angular/api'),
  regenerateCommand: 'bun nx typedoc grid-angular',
  categories: [
    {
      name: 'Directives',
      folder: 'directives',
      match: (n: TypeDocNode) =>
        n.kind === KIND.Class && (DIRECTIVE_NAMES.includes(n.name) || n.name.endsWith('Directive')),
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
