import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { PinnedRowsPlugin } from '../pinned-rows/PinnedRowsPlugin';
import { ServerSidePlugin } from './ServerSidePlugin';
import type { GetRowsParams, GetRowsResult, ServerSideDataSource } from './types';

// Import grid component
import '../../../index';

// Mock data generator
function generateMockData(count: number) {
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'];
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      name: `Employee ${i + 1}`,
      department: departments[i % departments.length],
      salary: 50000 + Math.floor(Math.random() * 50000),
      email: `employee${i + 1}@example.com`,
    });
  }
  return data;
}

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const, sortable: true },
  { field: 'name', header: 'Name', sortable: true },
  { field: 'department', header: 'Department', sortable: true },
  { field: 'salary', header: 'Salary', type: 'number' as const, sortable: true },
  { field: 'email', header: 'Email' },
];

const meta: Meta = {
  title: 'Grid/Plugins/Server-Side',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    pageSize: {
      control: { type: 'range', min: 10, max: 100, step: 10 },
      description: 'Rows per block/page',
      table: { category: 'Server-Side', defaultValue: { summary: '50' } },
    },
  },
  args: {
    pageSize: 50,
  },
};
export default meta;

interface ServerSideArgs {
  pageSize: number;
}
type Story = StoryObj<ServerSideArgs>;

/**
 * Virtual scroll with lazy loading. Scroll down to fetch more rows automatically.
 * This demo simulates 10,000 rows with a 200ms network delay.
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
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

const grid = document.querySelector('tbw-grid');
const plugin = new ServerSidePlugin({
  pageSize: 50,
  cacheBlockSize: 50,
});

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'department', header: 'Department', sortable: true },
    { field: 'salary', header: 'Salary', type: 'number', sortable: true },
    { field: 'email', header: 'Email' },
  ],
  plugins: [
    plugin,
    // Optional: shows scroll info in footer
    new PinnedRowsPlugin({
      position: 'bottom',
      showRowCount: true,
      customPanels: [
        { id: 'scroll-info', position: 'right', render: () => '<em>Scroll to load more rows...</em>' },
      ],
    }),
  ],
};

// Set data source after grid is ready
grid.ready().then(() => {
  plugin.setDataSource({
    async getRows(params) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 200));

      const response = await fetch(\`/api/data?start=\${params.startRow}&end=\${params.endRow}\`);
      const { rows, totalRowCount } = await response.json();
      return { rows, totalRowCount };
    },
  });
});
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: ServerSideArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    const allData = generateMockData(10000);

    const createDataSource = (): ServerSideDataSource => ({
      async getRows(params: GetRowsParams): Promise<GetRowsResult> {
        await new Promise((r) => setTimeout(r, 200));

        const data = [...allData];

        if (params.sortModel?.length) {
          const { field, direction } = params.sortModel[0];
          data.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const aVal = a[field];
            const bVal = b[field];
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === 'asc' ? cmp : -cmp;
          });
        }

        const rows = data.slice(params.startRow, params.endRow);

        return { rows, totalRowCount: data.length };
      },
    });

    const plugin = new ServerSidePlugin({
      pageSize: args.pageSize,
      cacheBlockSize: args.pageSize,
    });

    grid.gridConfig = {
      columns,
      plugins: [
        plugin,
        new PinnedRowsPlugin({
          position: 'bottom',
          showRowCount: true,
          customPanels: [
            {
              id: 'scroll-info',
              position: 'right',
              render: () => '<em>Scroll to load more rows...</em>',
            },
          ],
        }),
      ],
    };

    grid.ready().then(() => {
      plugin.setDataSource(createDataSource());
    });

    return grid;
  },
};

/**
 * Paging mode with manual page navigation.
 */
export const PagingMode: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<div>
  <div style="padding: 8px; display: flex; gap: 8px; align-items: center;">
    <button class="prev" style="padding: 4px 8px;">← Prev</button>
    <span class="page-info">Page 1</span>
    <button class="next" style="padding: 4px 8px;">Next →</button>
  </div>
  <tbw-grid style="height: 350px;"></tbw-grid>
</div>

<script type="module">
import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');
const pageSize = 50;
let currentPage = 0;
let totalPages = 10; // Assume 500 total rows

const loadPage = async (page) => {
  currentPage = page;
  const response = await fetch(\`/api/data?page=\${page}&size=\${pageSize}\`);
  const { rows, totalRowCount } = await response.json();
  grid.rows = rows;
  totalPages = Math.ceil(totalRowCount / pageSize);

  // Update UI
  document.querySelector('.page-info').textContent = \`Page \${page + 1} of \${totalPages}\`;
  document.querySelector('.prev').disabled = page === 0;
  document.querySelector('.next').disabled = page >= totalPages - 1;
};

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'department', header: 'Department', sortable: true },
    { field: 'salary', header: 'Salary', type: 'number', sortable: true },
    { field: 'email', header: 'Email' },
  ],
};

// Wire up pagination buttons
document.querySelector('.prev').addEventListener('click', () => loadPage(currentPage - 1));
document.querySelector('.next').addEventListener('click', () => loadPage(currentPage + 1));

// Load first page
loadPage(0);
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: ServerSideArgs) => {
    const container = document.createElement('div');

    const pager = document.createElement('div');
    pager.style.cssText = 'padding: 8px; display: flex; gap: 8px; align-items: center;';
    pager.innerHTML = `
      <button class="prev" style="padding: 4px 8px;">← Prev</button>
      <span class="page-info">Page 1</span>
      <button class="next" style="padding: 4px 8px;">Next →</button>
    `;
    container.appendChild(pager);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    container.appendChild(grid);

    const allData = generateMockData(500);
    const pageSize = args.pageSize;
    let currentPage = 0;
    const totalPages = Math.ceil(allData.length / pageSize);

    const loadPage = (page: number) => {
      currentPage = page;
      const start = page * pageSize;
      grid.rows = allData.slice(start, start + pageSize);

      const pageInfo = pager.querySelector('.page-info') as HTMLElement;
      pageInfo.textContent = `Page ${page + 1} of ${totalPages}`;

      (pager.querySelector('.prev') as HTMLButtonElement).disabled = page === 0;
      (pager.querySelector('.next') as HTMLButtonElement).disabled = page >= totalPages - 1;
    };

    pager.querySelector('.prev')?.addEventListener('click', () => loadPage(currentPage - 1));
    pager.querySelector('.next')?.addEventListener('click', () => loadPage(currentPage + 1));

    grid.gridConfig = { columns };
    loadPage(0);

    return container;
  },
};

/**
 * Server-side sorting using the async sortHandler.
 *
 * When a column header is clicked, the grid calls the custom `sortHandler`
 * which fetches pre-sorted data from the server instead of sorting locally.
 * This is ideal for large datasets where sorting should happen on the backend.
 */
export const ServerSideSorting: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');

// Simulated server data
const serverData = generateMockData(1000);

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'department', header: 'Department', sortable: true },
    { field: 'salary', header: 'Salary', type: 'number', sortable: true },
    { field: 'email', header: 'Email' },
  ],

  // Async sort handler - fetches sorted data from server
  sortHandler: async (rows, sortState, columns) => {
    console.log('Server-side sort:', sortState);

    // Show loading state (optional)
    grid.setAttribute('aria-busy', 'true');

    try {
      // Simulate API call with network delay
      await new Promise(r => setTimeout(r, 300));

      // In real apps, you'd call your API:
      // const response = await fetch(\`/api/data?sort=\${sortState.field}&dir=\${sortState.direction}\`);
      // return response.json();

      // Simulated server-side sort
      const sorted = [...serverData].sort((a, b) => {
        const aVal = a[sortState.field];
        const bVal = b[sortState.field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return cmp * sortState.direction;
      });

      return sorted;
    } finally {
      grid.removeAttribute('aria-busy');
    }
  },
};

// Set initial data
grid.rows = serverData;
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

    grid.gridConfig = {
      columns,
      sortHandler: async (rows, sortState) => {
        // Show loading indicator
        grid.setAttribute('aria-busy', 'true');

        try {
          // Simulate server delay
          await new Promise((r) => setTimeout(r, 300));

          // Server-side sort simulation
          const sorted = [...serverData].sort((a, b) => {
            const aVal = (a as Record<string, unknown>)[sortState.field];
            const bVal = (b as Record<string, unknown>)[sortState.field];
            const cmp = aVal! < bVal! ? -1 : aVal! > bVal! ? 1 : 0;
            return cmp * sortState.direction;
          });

          return sorted;
        } finally {
          grid.removeAttribute('aria-busy');
        }
      },
    };

    grid.rows = serverData;

    return grid;
  },
};
