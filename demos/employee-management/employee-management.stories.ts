/**
 * Employee Management System Demo
 *
 * A comprehensive real-world demo showcasing @toolbox-web/grid capabilities
 * in an enterprise employee management scenario.
 *
 * This story imports and reuses the vanilla TypeScript demo directly,
 * ensuring consistency between Storybook and the standalone demo.
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite';

// Import the grid component for Storybook HMR
import '@toolbox-web/grid';

// Import directly from the vanilla demo (relative - no alias needed)
import { createEmployeeGrid, type EmployeeGridOptions } from './vanilla/main';

// Shared demo styles (layout + component styles)
import './shared/demo-styles.css';

type Story = StoryObj<EmployeeGridOptions>;

let currentEmployeeArgs: EmployeeGridOptions = {} as EmployeeGridOptions;

function getEmployeeSourceCode(args: EmployeeGridOptions): string {
  const imports = [`import '@toolbox-web/grid';`];
  const pluginImports: string[] = [];
  const pluginInstances: string[] = [];

  if (args.enableSelection) {
    pluginImports.push('SelectionPlugin');
    pluginInstances.push(`new SelectionPlugin({ mode: 'range' })`);
  }
  if (args.enableFiltering) {
    pluginImports.push('FilteringPlugin');
    pluginInstances.push('new FilteringPlugin()');
  }
  if (args.enableSorting) {
    pluginImports.push('MultiSortPlugin');
    pluginInstances.push('new MultiSortPlugin()');
  }
  if (args.enableEditing) {
    pluginImports.push('EditingPlugin');
    pluginInstances.push('new EditingPlugin()');
  }
  if (args.enableMasterDetail) {
    pluginImports.push('MasterDetailPlugin');
    pluginInstances.push(`new MasterDetailPlugin({ detailHeight: 'auto' })`);
  }
  if (args.enableRowGrouping) {
    pluginImports.push('GroupingRowsPlugin');
    pluginInstances.push(`new GroupingRowsPlugin({ groupBy: ['department'] })`);
  }

  if (pluginImports.length > 0) {
    imports.push(`import { ${pluginImports.join(', ')} } from '@toolbox-web/grid/all';`);
  }

  const pluginsBlock =
    pluginInstances.length > 0 ? `\n  plugins: [\n    ${pluginInstances.join(',\n    ')},\n  ],` : '';

  return `${imports.join('\n')}

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
    { field: 'rating', header: 'Rating', type: 'number' },
    // ... more columns
  ],${pluginsBlock}
};

grid.rows = generateEmployees(${args.rowCount});
`;
}

/**
 * Creates a container with fixed height for the grid.
 * Required for virtualization to work in Storybook Canvas.
 */
function renderGridInContainer(args: EmployeeGridOptions): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'height: 600px; display: flex; flex-direction: column;';
  container.appendChild(createEmployeeGrid(args) as unknown as HTMLElement);
  return container;
}

const meta: Meta<EmployeeGridOptions> = {
  title: 'Demos/Employee Management',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    rowCount: {
      control: { type: 'range', min: 50, max: 1000, step: 50 },
      description: 'Number of data rows',
      table: { category: 'Data' },
    },
    enableSelection: {
      control: 'boolean',
      description: 'Enable cell/row selection',
      table: { category: 'Features' },
    },
    enableFiltering: {
      control: 'boolean',
      description: 'Enable column filtering',
      table: { category: 'Features' },
    },
    enableSorting: {
      control: 'boolean',
      description: 'Enable multi-column sorting',
      table: { category: 'Features' },
    },
    enableEditing: {
      control: 'boolean',
      description: 'Enable inline editing',
      table: { category: 'Features' },
    },
    enableMasterDetail: {
      control: 'boolean',
      description: 'Enable expandable detail rows',
      table: { category: 'Features' },
    },
    enableRowGrouping: {
      control: 'boolean',
      description: 'Enable row grouping by department',
      table: { category: 'Features' },
    },
  },
  args: {
    rowCount: 200,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
    enableMasterDetail: true,
    enableRowGrouping: false,
  },
};
export default meta;

/**
 * ## Enterprise Employee Management Grid
 *
 * This comprehensive demo simulates a **real-world enterprise employee management system**
 * with all major grid features enabled.
 *
 * ### Features Demonstrated
 * - **200+ employees** with realistic data
 * - **Column groups** organizing related fields
 * - **Custom editors**: Star ratings, bonus sliders, status selects, date pickers
 * - **Custom renderers**: Status badges, rating colors, star indicators
 * - **Selection, sorting, filtering, export**
 * - **Master-detail** with expandable rows
 * - **Shell integration** with header stats and tool panels
 *
 * ### Try These Actions
 * 1. Double-click Rating column to use the star picker
 * 2. Double-click Bonus column to use the slider
 * 3. Click the 🔍 icon to open Quick Filters panel
 * 4. Right-click for context menu options
 */
export const AllFeatures: Story = {
  parameters: {
    docs: {
      source: {
        transform: () => getEmployeeSourceCode(currentEmployeeArgs),
        language: 'typescript',
      },
    },
  },
  render: (args) => {
    currentEmployeeArgs = args;
    return renderGridInContainer(args);
  },
};

/**
 * ## Row Grouping Demo
 * Employees grouped by department with aggregate calculations.
 */
export const GroupedByDepartment: Story = {
  args: {
    rowCount: 150,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
    enableMasterDetail: false,
    enableRowGrouping: true,
  },
  render: (args) => renderGridInContainer(args),
};
