/**
 * RTL (Right-to-Left) Support Stories
 *
 * Demonstrates grid behavior in RTL layout contexts for Hebrew, Arabic, and other RTL languages.
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ColumnConfig, GridConfig } from '../../src/public';

// Import from source for HMR
import '../../src/index';
import { PinnedColumnsPlugin } from '../../src/lib/plugins/pinned-columns';

type GridElement = HTMLElement & {
  columns: ColumnConfig[];
  rows: any[];
  gridConfig: GridConfig<any>;
};

// Sample data with mixed LTR/RTL text
const sampleData = [
  { id: 1, name: 'John Cohen / יוסף כהן', role: 'Manager', department: 'Development', salary: 15000, active: true },
  { id: 2, name: 'Mary Levy / מרים לוי', role: 'Engineer', department: 'Infrastructure', salary: 12000, active: true },
  { id: 3, name: 'David Abraham / דוד אברהם', role: 'Designer', department: 'Design', salary: 11000, active: false },
  { id: 4, name: 'Sarah Jacob / שרה יעקב', role: 'Analyst', department: 'Data', salary: 13000, active: true },
  { id: 5, name: 'Moses Israel / משה ישראל', role: 'Tester', department: 'Quality', salary: 10000, active: true },
];

// Columns with logical pinning
const columns: ColumnConfig[] = [
  { field: 'id', header: 'ID', width: 80, sticky: 'start' },
  { field: 'name', header: 'Name', width: 200 },
  { field: 'role', header: 'Role', width: 120 },
  { field: 'department', header: 'Department', width: 140 },
  { field: 'salary', header: 'Salary', type: 'number', width: 100 },
  { field: 'active', header: 'Active', type: 'boolean', width: 80, sticky: 'end' },
];

interface RTLDemoArgs {
  rtl: boolean;
}

const meta: Meta<RTLDemoArgs> = {
  title: 'Grid/RTL Support',
  tags: ['!dev'],
  argTypes: {
    rtl: {
      control: 'boolean',
      description: 'Enable RTL (Right-to-Left) layout',
      table: {
        defaultValue: { summary: 'false' },
      },
    },
  },
  args: {
    rtl: false,
  },
  parameters: {
    layout: 'padded',
  },
};

export default meta;

/**
 * Interactive demo showing the grid in LTR or RTL mode.
 * Toggle the RTL control to see how the grid adapts its layout.
 *
 * Notice how:
 * - The ID column (`sticky: 'start'`) pins to the left in LTR, right in RTL
 * - The Active column (`sticky: 'end'`) pins to the right in LTR, left in RTL
 * - Keyboard navigation (arrow keys) flips direction in RTL mode
 */
export const Demo: StoryObj<RTLDemoArgs> = {
  render: (args) => {
    const gridEl = document.createElement('tbw-grid') as GridElement;
    gridEl.setAttribute('dir', args.rtl ? 'rtl' : 'ltr');
    gridEl.style.height = '300px';
    gridEl.rows = sampleData;
    gridEl.gridConfig = {
      columns,
      plugins: [new PinnedColumnsPlugin()],
      sortable: true,
      resizable: true,
    };
    return gridEl;
  },
  parameters: {
    docs: {
      description: {
        story: `Toggle the **RTL** control to switch between Left-to-Right and Right-to-Left layouts.

The columns use logical pinning (\`sticky: 'start'\` and \`sticky: 'end'\`) which automatically adapts to the text direction.`,
      },
    },
  },
};
