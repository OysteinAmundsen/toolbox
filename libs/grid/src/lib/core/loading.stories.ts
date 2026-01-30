import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

// Import from source for HMR
import '../../index';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  status: 'active' | 'inactive';
}

function generateEmployees(count: number): Employee[] {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];

  return Array.from({ length: count }, (_, i) => ({
    id: `emp-${i + 1}`,
    name: `${names[i % names.length]} ${i + 1}`,
    email: `${names[i % names.length].toLowerCase()}${i + 1}@example.com`,
    department: departments[i % departments.length],
    status: i % 3 === 0 ? 'inactive' : 'active',
  }));
}

const meta: Meta = {
  title: 'Grid/Loading States',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The grid provides built-in loading indicators at three levels:

- **Grid-level**: Full overlay with large spinner for data loading
- **Row-level**: Small spinner on individual rows for row operations
- **Cell-level**: Tiny spinner on cells for cell-specific operations

All loading states are user-instructed - you control when to show/hide them.
`,
      },
    },
  },
};
export default meta;

type Story = StoryObj;

/**
 * Grid-level loading shows a centered spinner with backdrop.
 * Use when fetching initial data or refreshing the entire grid.
 */
export const GridLoading: Story = {
  render: () => html`
    <div style="height: 400px; padding: 16px;">
      <div style="margin-bottom: 12px;">
        <button id="toggle-loading">Toggle Loading</button>
        <span id="status" style="margin-left: 12px; color: var(--tbw-color-fg-muted);">Status: Not Loading</span>
      </div>
      <tbw-grid id="loading-grid" style="height: 350px;"></tbw-grid>
    </div>
    <script type="module">
      const grid = document.getElementById('loading-grid');
      const toggleBtn = document.getElementById('toggle-loading');
      const status = document.getElementById('status');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
        { field: 'department', header: 'Department' },
      ];
      grid.rows = ${JSON.stringify(generateEmployees(20))};
      grid.gridConfig = { getRowId: (row) => row.id };

      toggleBtn.addEventListener('click', () => {
        grid.loading = !grid.loading;
        status.textContent = grid.loading ? 'Status: Loading...' : 'Status: Not Loading';
      });
    </script>
  `,
};

/**
 * Simulates fetching data with loading state.
 * The loading overlay appears while data is being fetched.
 */
export const FetchDataDemo: Story = {
  name: 'Fetch Data Simulation',
  render: () => html`
    <div style="height: 400px; padding: 16px;">
      <div style="margin-bottom: 12px;">
        <button id="fetch-data">Fetch Data (2s delay)</button>
        <button id="clear-data">Clear Data</button>
      </div>
      <tbw-grid id="fetch-grid" style="height: 350px;"></tbw-grid>
    </div>
    <script type="module">
      const grid = document.getElementById('fetch-grid');
      const fetchBtn = document.getElementById('fetch-data');
      const clearBtn = document.getElementById('clear-data');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
        { field: 'department', header: 'Department' },
      ];
      grid.gridConfig = { getRowId: (row) => row.id };
      grid.rows = [];

      fetchBtn.addEventListener('click', async () => {
        grid.loading = true;
        // Simulate API call
        await new Promise((r) => setTimeout(r, 2000));
        grid.rows = ${JSON.stringify(generateEmployees(50))};
        grid.loading = false;
      });

      clearBtn.addEventListener('click', () => {
        grid.rows = [];
      });
    </script>
  `,
};

/**
 * Row-level loading shows a small spinner on specific rows.
 * Use when saving or updating individual rows.
 */
export const RowLoading: Story = {
  render: () => html`
    <div style="height: 400px; padding: 16px;">
      <div style="margin-bottom: 12px;">
        <span style="color: var(--tbw-color-fg-muted);">Click a row to simulate saving (1s delay)</span>
      </div>
      <tbw-grid id="row-grid" style="height: 350px;"></tbw-grid>
    </div>
    <script type="module">
      const grid = document.getElementById('row-grid');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
        { field: 'status', header: 'Status' },
      ];
      grid.rows = ${JSON.stringify(generateEmployees(10))};
      grid.gridConfig = { getRowId: (row) => row.id };

      grid.addEventListener('row-click', async (e) => {
        const rowId = e.detail.row.id;
        grid.setRowLoading(rowId, true);
        // Simulate save operation
        await new Promise((r) => setTimeout(r, 1000));
        grid.setRowLoading(rowId, false);
      });
    </script>
  `,
};

/**
 * Cell-level loading shows a tiny spinner on specific cells.
 * Use for async validation or cell-specific operations.
 */
export const CellLoading: Story = {
  render: () => html`
    <div style="height: 400px; padding: 16px;">
      <div style="margin-bottom: 12px;">
        <button id="validate-emails">Validate All Emails (async)</button>
        <button id="clear-loading">Clear Loading States</button>
      </div>
      <tbw-grid id="cell-grid" style="height: 350px;"></tbw-grid>
    </div>
    <script type="module">
      const grid = document.getElementById('cell-grid');
      const validateBtn = document.getElementById('validate-emails');
      const clearBtn = document.getElementById('clear-loading');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
        { field: 'department', header: 'Department' },
      ];
      const employees = ${JSON.stringify(generateEmployees(8))};
      grid.rows = employees;
      grid.gridConfig = { getRowId: (row) => row.id };

      validateBtn.addEventListener('click', async () => {
        // Show loading on all email cells
        for (const emp of employees) {
          grid.setCellLoading(emp.id, 'email', true);
        }

        // Simulate staggered validation
        for (const emp of employees) {
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
          grid.setCellLoading(emp.id, 'email', false);
        }
      });

      clearBtn.addEventListener('click', () => {
        grid.clearAllLoading();
      });
    </script>
  `,
};

/**
 * Custom loading renderer allows you to provide your own loading component.
 * The renderer receives a context with the loading size ('large' or 'small').
 */
export const CustomLoadingRenderer: Story = {
  render: () => html`
    <div style="height: 400px; padding: 16px;">
      <div style="margin-bottom: 12px;">
        <button id="toggle-custom">Toggle Loading</button>
      </div>
      <tbw-grid id="custom-grid" style="height: 350px;"></tbw-grid>
    </div>
    <style>
      .custom-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        color: var(--tbw-color-fg);
      }
      .custom-loader svg {
        width: 48px;
        height: 48px;
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }
    </style>
    <script type="module">
      const grid = document.getElementById('custom-grid');
      const toggleBtn = document.getElementById('toggle-custom');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ];
      grid.rows = ${JSON.stringify(generateEmployees(10))};
      grid.gridConfig = {
        getRowId: (row) => row.id,
        loadingRenderer: (ctx) => {
          const el = document.createElement('div');
          el.className = 'custom-loader';
          el.innerHTML = \`
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
            <span>Fetching data...</span>
          \`;
          return el;
        },
      };

      toggleBtn.addEventListener('click', () => {
        grid.loading = !grid.loading;
      });
    </script>
  `,
};

/**
 * Loading state via HTML attribute.
 * You can set `loading` attribute directly in HTML.
 */
export const LoadingAttribute: Story = {
  name: 'Loading Attribute (HTML)',
  render: () => html`
    <div style="height: 400px; padding: 16px;">
      <div style="margin-bottom: 12px;">
        <button id="toggle-attr">Toggle via Attribute</button>
      </div>
      <tbw-grid id="attr-grid" style="height: 350px;" loading></tbw-grid>
    </div>
    <script type="module">
      const grid = document.getElementById('attr-grid');
      const toggleBtn = document.getElementById('toggle-attr');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ];
      grid.rows = ${JSON.stringify(generateEmployees(10))};
      grid.gridConfig = { getRowId: (row) => row.id };

      toggleBtn.addEventListener('click', () => {
        if (grid.hasAttribute('loading')) {
          grid.removeAttribute('loading');
        } else {
          grid.setAttribute('loading', '');
        }
      });
    </script>
  `,
};
