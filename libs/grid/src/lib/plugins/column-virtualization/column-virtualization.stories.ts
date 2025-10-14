import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { ColumnVirtualizationPlugin } from './ColumnVirtualizationPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    autoEnable: {
      control: { type: 'boolean' },
      description: 'Auto-enable when column count exceeds threshold',
      table: { category: 'Column Virtualization' },
    },
    threshold: {
      control: { type: 'range', min: 10, max: 100, step: 5 },
      description: 'Column count threshold for auto-enabling',
      table: { category: 'Column Virtualization' },
    },
    overscan: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Extra columns to render on each side',
      table: { category: 'Column Virtualization' },
    },
  },
  args: {
    autoEnable: true,
    threshold: 30,
    overscan: 3,
  },
};
export default meta;

interface ColumnVirtualizationArgs {
  autoEnable: boolean;
  threshold: number;
  overscan: number;
}
type Story = StoryObj<ColumnVirtualizationArgs>;

/**
 * ## Column Virtualization
 *
 * For grids with many columns, only render visible columns for better performance.
 * This example generates 50 columns to demonstrate horizontal virtualization.
 */
export const ColumnVirtualization: Story = {
  render: (args: ColumnVirtualizationArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$autoEnable$: boolean, __$threshold$: number, __$overscan$: number) => {
      // Generate 50 columns
      const columns = [{ field: 'id', header: 'ID', type: 'number' as const, width: 60 }];
      for (let i = 1; i <= 49; i++) {
        columns.push({
          field: `col${i}`,
          header: `Column ${i}`,
          type: 'number' as const,
          width: 100,
        });
      }

      // Generate 100 rows of data
      const rows = [];
      for (let r = 0; r < 100; r++) {
        const row: Record<string, number> = { id: r + 1 };
        for (let c = 1; c <= 49; c++) {
          row[`col${c}`] = Math.floor(Math.random() * 1000);
        }
        rows.push(row);
      }

      grid.gridConfig = {
        columns,
        fitMode: 'fixed',
        plugins: [
          new ColumnVirtualizationPlugin({
            autoEnable: __$autoEnable$,
            threshold: __$threshold$,
            overscan: __$overscan$,
          }),
        ],
      };

      grid.rows = rows;
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.autoEnable, args.threshold, args.overscan);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-column-virtualization',
      plugins: [{ className: 'ColumnVirtualizationPlugin', path: 'plugins/column-virtualization' }],
      description: `
        <p>The <strong>Column Virtualization</strong> plugin improves performance for grids with many columns.</p>
        <p><strong>Try it:</strong> Scroll horizontally — notice only visible columns are rendered.</p>
        <ul>
          <li>This demo has <strong>50 columns</strong> and <strong>100 rows</strong></li>
          <li>Auto-enable threshold: ${args.threshold} columns</li>
          <li>Overscan (extra columns rendered): ${args.overscan}</li>
          <li>Ideal for wide datasets like financial or scientific data</li>
        </ul>
      `,
    });
  },
};
