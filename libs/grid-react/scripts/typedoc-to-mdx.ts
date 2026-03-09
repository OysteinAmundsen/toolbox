/**
 * Generate MDX files from TypeDoc JSON for grid-react.
 * Run: `bun nx typedoc grid-react`
 */

import { join } from 'node:path';

import { generateAdapterDocs, KIND, type TypeDocNode } from '../../../tools/typedoc-mdx-shared';

const COMPONENT_NAMES = [
  'DataGrid',
  'GridColumn',
  'GridDetailPanel',
  'GridToolPanel',
  'GridToolButtons',
  'GridResponsiveCard',
];

generateAdapterDocs({
  name: 'grid-react',
  urlBase: '/grid/react/api',
  jsonPath: join(import.meta.dirname, '../docs/api-generated/api.json'),
  outputDir: join(import.meta.dirname, '../../../apps/docs/src/content/docs/grid/react/api'),
  regenerateCommand: 'bun nx typedoc grid-react',
  categories: [
    {
      name: 'Components',
      folder: 'components',
      match: (n: TypeDocNode) => COMPONENT_NAMES.includes(n.name),
    },
    {
      name: 'Hooks',
      folder: 'hooks',
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
