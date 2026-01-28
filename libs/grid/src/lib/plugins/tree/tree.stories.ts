import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { TreePlugin } from './TreePlugin';

// Import grid component
import '../../../index';

// Sample hierarchical data
const fileSystemData = [
  {
    name: 'Documents',
    type: 'folder',
    size: '-',
    children: [
      { name: 'Resume.pdf', type: 'file', size: '2.4 MB' },
      { name: 'Cover Letter.docx', type: 'file', size: '156 KB' },
      {
        name: 'Projects',
        type: 'folder',
        size: '-',
        children: [
          {
            name: 'Project A',
            type: 'folder',
            size: '-',
            children: [{ name: 'notes.txt', type: 'file', size: '12 KB' }],
          },
          { name: 'Project B', type: 'folder', size: '-' },
        ],
      },
    ],
  },
  {
    name: 'Pictures',
    type: 'folder',
    size: '-',
    children: [
      { name: 'vacation.jpg', type: 'file', size: '4.2 MB' },
      { name: 'family.png', type: 'file', size: '3.1 MB' },
    ],
  },
  { name: 'readme.md', type: 'file', size: '1 KB' },
];

const columns = [
  { field: 'name', header: 'Name' },
  { field: 'type', header: 'Type' },
  { field: 'size', header: 'Size' },
];

const meta: Meta = {
  title: 'Grid/Plugins/Tree',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    animation: {
      control: { type: 'select' },
      options: [false, 'slide', 'fade'],
      description: 'Animation style for expand/collapse',
      table: { category: 'Tree', defaultValue: { summary: "'slide'" } },
    },
    defaultExpanded: {
      control: { type: 'boolean' },
      description: 'Whether nodes are expanded by default',
      table: { category: 'Tree', defaultValue: { summary: 'false' } },
    },
    indentWidth: {
      control: { type: 'range', min: 0, max: 40, step: 5 },
      description: 'Indentation width per level in pixels',
      table: { category: 'Tree', defaultValue: { summary: '20' } },
    },
  },
  args: {
    animation: 'slide' as const,
    defaultExpanded: false,
    indentWidth: 20,
  },
};
export default meta;

interface TreeArgs {
  animation: false | 'slide' | 'fade';
  defaultExpanded: boolean;
  indentWidth: number;
}
type Story = StoryObj<TreeArgs>;

/**
 * Display hierarchical data with expand/collapse functionality.
 * Click the ▶ icon to expand a folder and see its children.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';

const grid = queryGrid('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'type', header: 'Type' },
    { field: 'size', header: 'Size' },
  ],
  plugins: [
    new TreePlugin({
      childrenField: 'children',
      defaultExpanded: false,
      indentWidth: 20,
      showExpandIcons: true,
    }),
  ],
};

grid.rows = [
  {
    name: 'Documents',
    type: 'folder',
    size: '-',
    children: [
      { name: 'Resume.pdf', type: 'file', size: '2.4 MB' },
      { name: 'Cover Letter.docx', type: 'file', size: '156 KB' },
      {
        name: 'Projects',
        type: 'folder',
        size: '-',
        children: [
          { name: 'Project A', type: 'folder', size: '-', children: [{ name: 'notes.txt', type: 'file', size: '12 KB' }] },
          { name: 'Project B', type: 'folder', size: '-' },
        ],
      },
    ],
  },
  {
    name: 'Pictures',
    type: 'folder',
    size: '-',
    children: [
      { name: 'vacation.jpg', type: 'file', size: '4.2 MB' },
      { name: 'family.png', type: 'file', size: '3.1 MB' },
    ],
  },
  { name: 'readme.md', type: 'file', size: '1 KB' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: TreeArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new TreePlugin({
          animation: args.animation,
          childrenField: 'children',
          defaultExpanded: args.defaultExpanded,
          indentWidth: args.indentWidth,
          showExpandIcons: true,
        }),
      ],
    };
    grid.rows = fileSystemData;

    return grid;
  },
};

/**
 * All nodes expanded by default.
 */
export const ExpandedByDefault: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';

const grid = queryGrid('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'type', header: 'Type' },
    { field: 'size', header: 'Size' },
  ],
  plugins: [
    new TreePlugin({
      childrenField: 'children',
      defaultExpanded: true, // All nodes expanded
    }),
  ],
};

grid.rows = [
  { name: 'Documents', type: 'folder', size: '-', children: [
    { name: 'Resume.pdf', type: 'file', size: '2.4 MB' },
    // ... nested children
  ]},
  { name: 'Pictures', type: 'folder', size: '-', children: [
    { name: 'vacation.jpg', type: 'file', size: '4.2 MB' },
  ]},
  { name: 'readme.md', type: 'file', size: '1 KB' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    defaultExpanded: true,
    indentWidth: 20,
  },
  render: (args: TreeArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new TreePlugin({
          childrenField: 'children',
          defaultExpanded: args.defaultExpanded,
          indentWidth: args.indentWidth,
          showExpandIcons: true,
        }),
      ],
    };
    grid.rows = fileSystemData;

    return grid;
  },
};

/**
 * Wider indentation for deeper nesting visibility.
 */
export const WideIndentation: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';

const grid = queryGrid('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [
    new TreePlugin({
      childrenField: 'children',
      indentWidth: 40, // Wider indentation
    }),
  ],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    defaultExpanded: true,
    indentWidth: 40,
  },
  render: (args: TreeArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new TreePlugin({
          childrenField: 'children',
          defaultExpanded: args.defaultExpanded,
          indentWidth: args.indentWidth,
          showExpandIcons: true,
        }),
      ],
    };
    grid.rows = fileSystemData;

    return grid;
  },
};
