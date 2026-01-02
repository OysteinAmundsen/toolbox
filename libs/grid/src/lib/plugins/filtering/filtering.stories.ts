import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { FilteringPlugin } from './FilteringPlugin';
import type { FilterPanelParams } from './types';

// Import grid component
import '../../../index';

// Sample data for filtering demos
const sampleData = [
  { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, status: 'Active' },
  { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, status: 'Active' },
  { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, status: 'On Leave' },
  { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, status: 'Active' },
  { id: 5, name: 'Eve Davis', department: 'Marketing', salary: 72000, status: 'Inactive' },
  { id: 6, name: 'Frank Miller', department: 'Engineering', salary: 98000, status: 'Active' },
  { id: 7, name: 'Grace Lee', department: 'Sales', salary: 82000, status: 'Active' },
  { id: 8, name: 'Henry Wilson', department: 'HR', salary: 68000, status: 'Active' },
  { id: 9, name: 'Ivy Chen', department: 'Engineering', salary: 112000, status: 'Active' },
  { id: 10, name: 'Jack Taylor', department: 'Marketing', salary: 78000, status: 'On Leave' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const, filterable: false },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary', type: 'number' as const },
  { field: 'status', header: 'Status' },
];

const meta: Meta = {
  title: 'Grid/Plugins/Filtering',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    debounceMs: {
      control: { type: 'range', min: 0, max: 1000, step: 50 },
      description: 'Debounce delay in ms for filter search',
      table: { category: 'Filtering', defaultValue: { summary: '150' } },
    },
    caseSensitive: {
      control: { type: 'boolean' },
      description: 'Case-sensitive text filtering',
      table: { category: 'Filtering', defaultValue: { summary: 'false' } },
    },
  },
  args: {
    debounceMs: 150,
    caseSensitive: false,
  },
};
export default meta;

interface FilteringArgs {
  debounceMs: number;
  caseSensitive: boolean;
}
type Story = StoryObj<FilteringArgs>;

/**
 * Basic filtering with built-in checkbox panel. Click the filter icon (⊻)
 * in any column header to open the filter panel. Use the controls to adjust
 * debounce timing and case sensitivity.
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
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'status', header: 'Status' },
  ],
  plugins: [
    new FilteringPlugin({
      debounceMs: 150,
      caseSensitive: false,
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
  render: (args: FilteringArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new FilteringPlugin({
          debounceMs: args.debounceMs,
          caseSensitive: args.caseSensitive,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Custom filter panel renderer example. The Status column uses a custom
 * radio-button style filter panel instead of the default checkbox list.
 */
export const CustomFilterPanel: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

const grid = document.querySelector('tbw-grid');

// Custom filter panel for Status column (radio-button style)
const statusFilterPanel = (container, params) => {
  container.innerHTML = \`
    <div style="padding: 8px; min-width: 140px;">
      <div style="font-weight: 600; margin-bottom: 8px;">Filter by Status</div>
      <div class="status-options"></div>
      <button class="clear-btn" style="margin-top: 8px; width: 100%; padding: 6px; cursor: pointer;">Clear</button>
    </div>
  \`;

  const optionsDiv = container.querySelector('.status-options');
  const options = ['All', ...params.uniqueValues.map(v => String(v))];

  options.forEach(opt => {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 4px 0; cursor: pointer;';
    const isAll = opt === 'All';
    label.innerHTML = \`<input type="radio" name="status" value="\${opt}" \${isAll && params.excludedValues.size === 0 ? 'checked' : ''}> \${opt}\`;

    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      if (isAll) {
        params.clearFilter();
      } else {
        // Exclude all except selected
        const excluded = params.uniqueValues.filter(v => String(v) !== opt);
        params.applySetFilter(excluded);
      }
    });
    optionsDiv.appendChild(label);
  });

  container.querySelector('.clear-btn').addEventListener('click', () => params.clearFilter());
};

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', filterable: false },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
    { field: 'status', header: 'Status' },
  ],
  plugins: [
    new FilteringPlugin({
      debounceMs: 150,
      caseSensitive: false,
      filterPanelRenderer: (container, params) => {
        if (params.field === 'status') {
          statusFilterPanel(container, params);
        } else {
          return undefined; // Use default panel for other columns
        }
      },
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, status: 'Active' },
  { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, status: 'Active' },
  { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, status: 'On Leave' },
  { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, status: 'Active' },
  { id: 5, name: 'Eve Davis', department: 'Marketing', salary: 72000, status: 'Inactive' },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: FilteringArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    // Custom filter panel for Status column (radio-button style)
    const statusFilterPanel = (container: HTMLElement, params: FilterPanelParams) => {
      container.innerHTML = `
        <div style="padding: 8px; min-width: 140px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: var(--tbw-color-fg);">
            Filter by Status
          </div>
          <div class="status-options"></div>
          <button class="clear-btn" style="margin-top: 8px; width: 100%; padding: 6px; cursor: pointer;">
            Clear
          </button>
        </div>
      `;

      const optionsDiv = container.querySelector('.status-options');
      if (!optionsDiv) return;

      const options = ['All', ...params.uniqueValues.map((v) => String(v))];

      options.forEach((opt) => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 4px 0; cursor: pointer;';
        const isAll = opt === 'All';
        label.innerHTML = `<input type="radio" name="status" value="${opt}" ${
          isAll && params.excludedValues.size === 0 ? 'checked' : ''
        }> ${opt}`;
        const input = label.querySelector('input');
        if (input) {
          input.addEventListener('change', () => {
            if (isAll) {
              params.clearFilter();
            } else {
              // Exclude all except selected
              const excluded = params.uniqueValues.filter((v) => String(v) !== opt);
              params.applySetFilter(excluded);
            }
          });
        }
        optionsDiv.appendChild(label);
      });

      const clearBtn = container.querySelector('.clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => params.clearFilter());
      }
    };

    grid.gridConfig = {
      columns,
      plugins: [
        new FilteringPlugin({
          debounceMs: args.debounceMs,
          caseSensitive: args.caseSensitive,
          filterPanelRenderer: (container, params) => {
            if (params.field === 'status') {
              statusFilterPanel(container, params);
            } else {
              return undefined; // Use default panel
            }
          },
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Filtering with case-sensitive search enabled.
 */
export const CaseSensitive: Story = {
  args: {
    caseSensitive: true,
    debounceMs: 150,
  },
  render: (args: FilteringArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new FilteringPlugin({
          debounceMs: args.debounceMs,
          caseSensitive: args.caseSensitive,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Instant filtering with no debounce delay (debounceMs: 0).
 */
export const NoDebounce: Story = {
  args: {
    debounceMs: 0,
    caseSensitive: false,
  },
  render: (args: FilteringArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new FilteringPlugin({
          debounceMs: args.debounceMs,
          caseSensitive: args.caseSensitive,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};
