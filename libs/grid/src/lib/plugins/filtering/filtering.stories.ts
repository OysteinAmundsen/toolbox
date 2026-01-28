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

// Generate larger dataset for async demo
function generateMockData(count: number) {
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
  const statuses = ['Active', 'Inactive', 'On Leave'];
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      name: `Employee ${i + 1}`,
      department: departments[i % departments.length],
      salary: 50000 + Math.floor(Math.random() * 50000),
      status: statuses[i % statuses.length],
    });
  }
  return data;
}

/**
 * Async filtering with server-side handlers. Use `valuesHandler` to fetch
 * unique filter values from a server, and `filterHandler` to apply filters
 * remotely. Ideal for large datasets where not all data is loaded locally.
 */
export const AsyncFiltering: StoryObj = {
  name: 'Async/Server-Side Filtering',
  parameters: {
    docs: {
      description: {
        story: `For large or server-side datasets, use \`valuesHandler\` to fetch unique values
from the server and \`filterHandler\` to apply filters remotely. The filter panel
shows a loading indicator while fetching values.`,
      },
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
      // Fetch unique values from server
      valuesHandler: async (field, column) => {
        const response = await fetch(\`/api/distinct-values?field=\${field}\`);
        return response.json();
      },
      // Apply filters on server
      filterHandler: async (filters, currentRows) => {
        const response = await fetch('/api/data', {
          method: 'POST',
          body: JSON.stringify({ filters }),
        });
        return response.json();
      },
    }),
  ],
};

grid.rows = [...]; // Initial data
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    const serverData = generateMockData(1000);

    // Simulate server-side unique value extraction
    const getUniqueValues = async (field: string): Promise<unknown[]> => {
      await new Promise((r) => setTimeout(r, 200));
      const values = [...new Set(serverData.map((row) => (row as Record<string, unknown>)[field]))];
      return values.sort();
    };

    // Simulate server-side filtering
    // FilterModel uses { field, operator: 'notIn', value: excludedValues[] }
    const applyServerFilters = async (
      filters: { field: string; operator: string; value: unknown }[],
    ): Promise<typeof serverData> => {
      await new Promise((r) => setTimeout(r, 300));

      if (filters.length === 0) return serverData;

      return serverData.filter((row) => {
        return filters.every((filter) => {
          const excludedValues = filter.value as unknown[];
          if (!excludedValues || excludedValues.length === 0) return true;

          const val = (row as Record<string, unknown>)[filter.field];
          // 'notIn' means exclude these values, so row passes if value is NOT in excluded list
          return !excludedValues.includes(val);
        });
      });
    };

    grid.gridConfig = {
      columns,
      plugins: [
        new FilteringPlugin({
          valuesHandler: getUniqueValues,
          filterHandler: applyServerFilters,
        }),
      ],
    };

    grid.rows = serverData;

    return grid;
  },
};

/**
 * ## Filter Events
 *
 * The FilteringPlugin emits events when filter state changes:
 * - `filter-change` - Fired when filters are applied, changed, or cleared
 *
 * Open filter panels and apply filters to see the events.
 */
export const FilterEvents: StoryObj = {
  parameters: {
    docs: {
      source: {
        code: `
const grid = document.querySelector('tbw-grid');

grid.addEventListener('filter-change', (e) => {
  console.log('Active filters:', e.detail.filters);
  console.log('Visible rows:', e.detail.visibleRowCount);
});
        `,
        language: 'typescript',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: grid; grid-template-columns: 1fr 320px; gap: 16px;';

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.id = 'filter-events-grid';
    grid.style.height = '300px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
        { field: 'status', header: 'Status' },
      ],
      plugins: [new FilteringPlugin({ debounceMs: 300 })],
    };

    grid.rows = sampleData;

    // Event log panel
    const logPanel = document.createElement('div');
    logPanel.style.cssText =
      'border: 1px solid var(--sb-border); padding: 12px; border-radius: 4px; background: var(--sbdocs-bg); overflow-y: auto; max-height: 300px;';
    logPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong>Event Log:</strong>
        <button id="clear-log" style="padding: 4px 8px; cursor: pointer; font-size: 12px;">Clear</button>
      </div>
      <div id="event-log" style="font-family: monospace; font-size: 11px; color: var(--sbdocs-fg);"></div>
    `;

    container.appendChild(grid);
    container.appendChild(logPanel);

    // Setup event listeners
    setTimeout(() => {
      const log = container.querySelector('#event-log');
      const clearBtn = container.querySelector('#clear-log');

      if (!log) return;

      const addLog = (type: string, detail: string) => {
        const msg = document.createElement('div');
        msg.style.cssText = 'padding: 2px 0; border-bottom: 1px solid var(--sb-border);';
        msg.innerHTML = `<span style="color: var(--sb-accent-color);">[${type}]</span> ${detail}`;
        log.insertBefore(msg, log.firstChild);
        while (log.children.length > 15) {
          log.lastChild?.remove();
        }
      };

      clearBtn?.addEventListener('click', () => {
        log.innerHTML = '';
      });

      grid.addEventListener('filter-change', (e: CustomEvent) => {
        const d = e.detail;
        const filterCount = d.filters?.length || 0;
        const fields = d.filters?.map((f: { field: string }) => f.field).join(', ') || 'none';
        addLog('filter-change', `${filterCount} filter(s) on: ${fields}`);
      });
    }, 50);

    return container;
  },
};

// Sample data with typed columns for type-specific filter demos
const typedData = [
  { id: 1, name: 'Alice Johnson', salary: 95000, hireDate: '2020-03-15', rating: 4.5 },
  { id: 2, name: 'Bob Smith', salary: 75000, hireDate: '2019-07-22', rating: 3.8 },
  { id: 3, name: 'Carol Williams', salary: 105000, hireDate: '2018-11-10', rating: 4.9 },
  { id: 4, name: 'Dan Brown', salary: 85000, hireDate: '2021-01-05', rating: 4.2 },
  { id: 5, name: 'Eve Davis', salary: 72000, hireDate: '2022-06-18', rating: 3.5 },
  { id: 6, name: 'Frank Miller', salary: 98000, hireDate: '2017-09-30', rating: 4.7 },
  { id: 7, name: 'Grace Lee', salary: 82000, hireDate: '2020-12-01', rating: 4.0 },
  { id: 8, name: 'Henry Wilson', salary: 68000, hireDate: '2023-02-14', rating: 3.2 },
];

/**
 * Type-specific filter panels automatically display appropriate UI based on
 * column type:
 * - **Number columns**: Range slider with min/max inputs
 * - **Date columns**: Date range picker with from/to date inputs
 * - **Other columns**: Standard checkbox set filter
 *
 * The filter parameters (min, max, step) can be configured via `filterParams`
 * on the column, or will fall back to `editorParams` if set, or auto-detect
 * from the data.
 */
export const TypeSpecificFilters: Story = {
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
    { field: 'id', header: 'ID', type: 'number', filterable: false },
    { field: 'name', header: 'Name' }, // Set filter (default)
    {
      field: 'salary',
      header: 'Salary',
      type: 'number', // Range slider filter
      filterParams: { min: 50000, max: 150000, step: 5000 },
    },
    {
      field: 'hireDate',
      header: 'Hire Date',
      type: 'date', // Date range picker filter
      filterParams: { min: '2015-01-01', max: '2025-12-31' },
    },
    {
      field: 'rating',
      header: 'Rating',
      type: 'number', // Range slider with smaller step
      filterParams: { min: 1, max: 5, step: 0.1 },
    },
  ],
  plugins: [new FilteringPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice Johnson', salary: 95000, hireDate: '2020-03-15', rating: 4.5 },
  { id: 2, name: 'Bob Smith', salary: 75000, hireDate: '2019-07-22', rating: 3.8 },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number' as const, filterable: false },
        { field: 'name', header: 'Name' }, // Set filter (default)
        {
          field: 'salary',
          header: 'Salary',
          type: 'number' as const, // Range slider filter
          filterParams: { min: 50000, max: 150000, step: 5000 },
        },
        {
          field: 'hireDate',
          header: 'Hire Date',
          type: 'date' as const, // Date range picker filter
          filterParams: { min: '2015-01-01', max: '2025-12-31' },
        },
        {
          field: 'rating',
          header: 'Rating',
          type: 'number' as const, // Range slider with smaller step
          filterParams: { min: 1, max: 5, step: 0.1 },
        },
      ],
      plugins: [new FilteringPlugin()],
    };
    grid.rows = typedData;

    return grid;
  },
};
