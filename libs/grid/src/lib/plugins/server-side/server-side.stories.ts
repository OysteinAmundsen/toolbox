import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import type { GetRowsParams, GetRowsResult, ServerSideDataSource } from './types';
import { ServerSidePlugin } from './ServerSidePlugin';
import { PinnedRowsPlugin } from '../pinned-rows/PinnedRowsPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['virtual-scroll', 'paging'],
      description: 'Data loading mode',
      table: { category: 'Server-Side' },
    },
    pageSize: {
      control: { type: 'range', min: 10, max: 100, step: 10 },
      description: 'Rows per page (paging) or block size (virtual scroll)',
      table: { category: 'Server-Side' },
    },
  },
  args: {
    mode: 'virtual-scroll',
    pageSize: 50,
  },
};
export default meta;

interface ServerSideArgs {
  mode: 'virtual-scroll' | 'paging';
  pageSize: number;
}
type Story = StoryObj<ServerSideArgs>;

// Mock data generator for demo
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

/**
 * ## Server-Side Data
 *
 * Load data from a server with two modes:
 *
 * ### Virtual Scroll Mode
 * Uses the grid's built-in virtualization engine. As you scroll, data is fetched
 * automatically when approaching the buffer edge. The scrollbar reflects the total
 * dataset size, providing a seamless infinite scroll experience.
 *
 * ### Paging Mode
 * Traditional pagination with a pager in the status bar. Users navigate between
 * discrete pages, and data is fetched when changing pages.
 */
export const ServerSide: Story = {
  render: (args: ServerSideArgs) => {
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    const grid = document.createElement('tbw-grid') as GridElement;

    // Simulate a server with 10,000 rows
    const allData = generateMockData(10000);

    // Paging state (for paging mode)
    let currentPage = 0;
    let totalPages = 0;
    let totalRows = 0;

    // Create data source
    const createDataSource = (isPaging: boolean, pageSize: number): ServerSideDataSource => ({
      async getRows(params: GetRowsParams): Promise<GetRowsResult> {
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 200));

        const data = [...allData];

        // Apply sorting
        if (params.sortModel?.length) {
          const { field, direction } = params.sortModel[0];
          data.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const aVal = a[field];
            const bVal = b[field];
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === 'asc' ? cmp : -cmp;
          });
        }

        // Apply pagination
        const rows = data.slice(params.startRow, params.endRow);

        totalRows = data.length;
        totalPages = Math.ceil(totalRows / pageSize);

        return {
          rows,
          totalRowCount: data.length,
        };
      },
    });

    // Pager render function
    const renderPager = () => {
      const container = document.createElement('div');
      container.className = 'pager-controls';
      container.style.cssText = 'display: flex; align-items: center; gap: 8px;';

      const prevBtn = document.createElement('button');
      prevBtn.textContent = '← Prev';
      prevBtn.disabled = currentPage === 0;
      prevBtn.onclick = () => {
        if (currentPage > 0) {
          currentPage--;
          loadPage(currentPage);
        }
      };

      const pageInfo = document.createElement('span');
      pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages || 1}`;

      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.onclick = () => {
        if (currentPage < totalPages - 1) {
          currentPage++;
          loadPage(currentPage);
        }
      };

      container.appendChild(prevBtn);
      container.appendChild(pageInfo);
      container.appendChild(nextBtn);

      return container;
    };

    // Load a specific page (for paging mode)
    const loadPage = async (page: number) => {
      const dataSource = createDataSource(true, args.pageSize);
      const startRow = page * args.pageSize;
      const endRow = startRow + args.pageSize;

      const result = await dataSource.getRows({ startRow, endRow });
      grid.rows = result.rows;
      currentPage = page;

      // Force status bar re-render
      grid.dispatchEvent(new CustomEvent('tbw-refresh'));
    };

    const codeSnippet = (__$mode$: 'virtual-scroll' | 'paging', __$pageSize$: number) => {
      const isPaging = __$mode$ === 'paging';

      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number', sortable: true },
          { field: 'name', header: 'Name', sortable: true },
          { field: 'department', header: 'Department', sortable: true },
          { field: 'salary', header: 'Salary', type: 'number', sortable: true },
          { field: 'email', header: 'Email' },
        ],
        plugins: [
          // Only enable ServerSidePlugin for virtual scroll mode
          ...(isPaging
            ? []
            : [
                new ServerSidePlugin({
                  pageSize: __$pageSize$,
                  cacheBlockSize: __$pageSize$,
                }),
              ]),
          new PinnedRowsPlugin({
            position: 'bottom',
            showRowCount: true,
            customPanels: isPaging
              ? [
                  {
                    id: 'pager',
                    position: 'right',
                    render: () => renderPager(),
                  },
                ]
              : [
                  {
                    id: 'scroll-info',
                    position: 'right',
                    render: () => '<em>Scroll to load more rows...</em>',
                  },
                ],
          }),
        ],
      };

      if (isPaging) {
        // Paging mode: load first page directly
        loadPage(0);
      } else {
        // Virtual scroll mode: set data source
        setTimeout(() => {
          grid.getPlugin(ServerSidePlugin)?.setDataSource(createDataSource(false, __$pageSize$));
        }, 100);
      }
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.mode, args.pageSize);

    const modeDescription =
      args.mode === 'virtual-scroll'
        ? `
        <p><strong>Virtual Scroll Mode:</strong> The grid uses row virtualization with server-side data.</p>
        <ul>
          <li>Scroll down to load more rows automatically</li>
          <li>Data is fetched as you approach the buffer edge</li>
          <li>Scrollbar reflects total dataset size (10,000 rows)</li>
          <li>Block size: ${args.pageSize} rows per request</li>
        </ul>
      `
        : `
        <p><strong>Paging Mode:</strong> Traditional pagination with discrete pages.</p>
        <ul>
          <li>Use the pager controls to navigate between pages</li>
          <li>Page size: ${args.pageSize} rows per page</li>
          <li>Total: ${Math.ceil(10000 / args.pageSize)} pages</li>
        </ul>
      `;

    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-server-side',
      plugins: [
        { className: 'ServerSidePlugin', path: 'plugins/server-side' },
        { className: 'PinnedRowsPlugin', path: 'plugins/pinned-rows' },
      ],
      description: `
        <p>The <strong>Server-Side</strong> plugin enables lazy loading from a remote data source.</p>
        ${modeDescription}
        <p><em>This demo simulates 10,000 rows with a 200ms network delay.</em></p>
      `,
    });
  },
};
