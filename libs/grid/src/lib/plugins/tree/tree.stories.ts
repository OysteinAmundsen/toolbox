import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { TreePlugin } from './TreePlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    childrenField: {
      control: { type: 'text' },
      description: 'Field name containing child rows',
      table: { category: 'Tree' },
    },
    defaultExpanded: {
      control: { type: 'boolean' },
      description: 'Whether nodes are expanded by default',
      table: { category: 'Tree' },
    },
    indentWidth: {
      control: { type: 'range', min: 10, max: 40, step: 5 },
      description: 'Indentation width per level in pixels',
      table: { category: 'Tree' },
    },
    showExpandIcons: {
      control: { type: 'boolean' },
      description: 'Show expand/collapse icons',
      table: { category: 'Tree' },
    },
  },
  args: {
    childrenField: 'children',
    defaultExpanded: false,
    indentWidth: 20,
    showExpandIcons: true,
  },
};
export default meta;

interface TreeArgs {
  childrenField: string;
  defaultExpanded: boolean;
  indentWidth: number;
  showExpandIcons: boolean;
}
type Story = StoryObj<TreeArgs>;

/**
 * ## Tree Data
 *
 * Display hierarchical data with expand/collapse functionality.
 * Nested rows are defined using a children field (configurable).
 */
export const Tree: Story = {
  render: (args: TreeArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (
      __$childrenField$: string,
      __$defaultExpanded$: boolean,
      __$indentWidth$: number,
      __$showExpandIcons$: boolean
    ) => {
      grid.gridConfig = {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'type', header: 'Type' },
          { field: 'size', header: 'Size' },
        ],
        plugins: [
          new TreePlugin({
            childrenField: __$childrenField$,
            defaultExpanded: __$defaultExpanded$,
            indentWidth: __$indentWidth$,
            showExpandIcons: __$showExpandIcons$,
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

      grid.addEventListener('tree-expand', (e: CustomEvent) => {
        console.log('tree-expand', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.childrenField, args.defaultExpanded, args.indentWidth, args.showExpandIcons);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-tree',
      plugins: [{ className: 'TreePlugin', path: 'plugins/tree' }],
      description: `
        <p>The <strong>Tree</strong> plugin displays hierarchical data with expand/collapse functionality.</p>
        <p><strong>Try it:</strong> Click the <code>▶</code> icon next to a folder to expand it and see its children. 
        Click <code>▼</code> to collapse.</p>
        <ul>
          <li>Child rows are defined using the <code>${args.childrenField}</code> field</li>
          <li>Indentation: ${args.indentWidth}px per level</li>
          <li>The tree structure is auto-detected from your data</li>
        </ul>
      `,
    });
  },
};
