import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

// Import from source for HMR
import '../../src/index';
import type { DataGridElement } from '../../src/lib/core/grid';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
}

function generateEmployees(count: number): Employee[] {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];

  return Array.from({ length: count }, (_, i) => ({
    id: `emp-${i + 1}`,
    name: `${names[i % names.length]} ${i + 1}`,
    email: `${names[i % names.length].toLowerCase()}${i + 1}@example.com`,
    department: departments[i % departments.length],
  }));
}

const employees = generateEmployees(8);

interface LoadingArgs {
  mode: 'grid' | 'row' | 'cell';
  autoReset: boolean;
}

const meta: Meta<LoadingArgs> = {
  title: 'Grid/Core/Loading',
  tags: ['!autodocs', '!dev'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['grid', 'row', 'cell'],
      description: 'Loading indicator type',
      table: {
        category: 'Loading',
        type: { summary: "'grid' | 'row' | 'cell'" },
        defaultValue: { summary: 'grid' },
      },
    },
    autoReset: {
      control: 'boolean',
      description: 'Auto-clear loading after 1 second',
      table: {
        category: 'Loading',
        defaultValue: { summary: 'true' },
      },
    },
  },
  args: {
    mode: 'grid',
    autoReset: true,
  },
};
export default meta;

type Story = StoryObj<LoadingArgs>;

// Unique ID to avoid conflicts when multiple instances render
let instanceId = 0;

// Mutable args reference - updated on each render so event listeners read current values
const currentArgs: LoadingArgs = { mode: 'grid', autoReset: true };

/**
 * Sets up the loading playground after the grid is in the DOM.
 */
function setupLoadingPlayground(container: Element): void {
  const grid = container.querySelector<DataGridElement<Employee>>('tbw-grid')!;
  const simulateBtn = container.querySelector<HTMLButtonElement>('.loading-demo__simulate')!;

  if (!grid || grid.hasAttribute('data-initialized')) return;
  grid.setAttribute('data-initialized', 'true');

  // Configure grid
  grid.columns = [
    { field: 'id', header: 'ID', width: 80 },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'department', header: 'Department' },
  ];
  grid.rows = employees;
  grid.gridConfig = { getRowId: (row) => row.id };

  // Row click handler - reads currentArgs at click time
  grid.addEventListener('row-click', (e: Event) => {
    if (currentArgs.mode !== 'row') return;
    const { row } = (e as CustomEvent).detail;
    const rowId = row.id;
    const timeout = currentArgs.autoReset ? 1000 : null;

    if (timeout) {
      grid.setRowLoading(rowId, true);
      setTimeout(() => grid.setRowLoading(rowId, false), timeout);
    } else {
      grid.setRowLoading(rowId, !grid.isRowLoading(rowId));
    }
  });

  // Cell click handler - reads currentArgs at click time
  grid.addEventListener('cell-click', (e: Event) => {
    if (currentArgs.mode !== 'cell') return;
    const { row, column } = (e as CustomEvent).detail;
    const rowId = row.id;
    const field = column.field;
    const timeout = currentArgs.autoReset ? 1000 : null;

    if (timeout) {
      grid.setCellLoading(rowId, field, true);
      setTimeout(() => grid.setCellLoading(rowId, field, false), timeout);
    } else {
      grid.setCellLoading(rowId, field, !grid.isCellLoading(rowId, field));
    }
  });

  // Simulate button - reads currentArgs at click time
  simulateBtn.addEventListener('click', async () => {
    grid.clearAllLoading();
    const timeout = currentArgs.autoReset ? 1000 : null;

    if (currentArgs.mode === 'grid') {
      grid.loading = true;
      if (timeout) {
        setTimeout(() => (grid.loading = false), timeout);
      }
    } else if (currentArgs.mode === 'row') {
      // Cascade through rows
      for (const emp of employees) {
        grid.setRowLoading(emp.id, true);
        await new Promise((r) => setTimeout(r, 100));
      }
      if (timeout) {
        setTimeout(() => grid.clearAllLoading(), timeout);
      }
    } else if (currentArgs.mode === 'cell') {
      // Cascade through email cells
      for (const emp of employees) {
        grid.setCellLoading(emp.id, 'email', true);
        await new Promise((r) => setTimeout(r, 100));
      }
      if (timeout) {
        setTimeout(() => grid.clearAllLoading(), timeout);
      }
    }
  });
}

const modeHints = {
  grid: 'Click <strong>▶ Simulate</strong> to show full-grid loading overlay.',
  row: 'Click any <strong>row</strong> to trigger row loading.',
  cell: 'Click any <strong>cell</strong> to trigger cell loading.',
};

// Generate mode-specific source code with full usage example
function getSourceCode(mode: LoadingArgs['mode'], autoReset: boolean): string {
  const setup = `import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = { getRowId: (row) => row.id };`;

  if (mode === 'grid') {
    return `${setup}

// Grid-level loading - use for initial data fetch
async function loadData() {
  grid.loading = true;
  try {
    const data = await fetch('/api/employees').then(r => r.json());
    grid.rows = data;
  } finally {
    grid.loading = false;
  }
}`;
  }

  if (mode === 'row') {
    return `${setup}

// Row-level loading - use for saving individual rows
async function saveRow(rowId: string, data: object) {
  grid.setRowLoading(rowId, true);
  try {
    await fetch(\`/api/employees/\${rowId}\`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } finally {
    grid.setRowLoading(rowId, false);
  }
}

// Check if row is currently loading
grid.isRowLoading('emp-1');  // boolean`;
  }

  // cell mode
  return `${setup}

// Cell-level loading - use for async validation
async function validateEmail(rowId: string, email: string) {
  grid.setCellLoading(rowId, 'email', true);
  try {
    const isValid = await checkEmailExists(email);
    return isValid;
  } finally {
    grid.setCellLoading(rowId, 'email', false);
  }
}

// Check if cell is currently loading
grid.isCellLoading('emp-1', 'email');  // boolean`;
}

/**
 * ## Loading States Playground
 *
 * Interactive demo for all loading indicator types.
 *
 * **Modes:**
 * - **Grid**: Full overlay spinner covering entire grid
 * - **Row**: Per-row loading indicator (click rows to trigger)
 * - **Cell**: Per-cell loading indicator (click cells to trigger)
 *
 * **Auto Reset:**
 * - **On**: Loading clears automatically after 1 second
 * - **Off**: Loading persists until manually cleared (click again to toggle)
 *
 * Use **▶ Simulate** to demonstrate cascading loading animations.
 */
export const LoadingPlayground: Story = {
  name: 'Loading States',
  parameters: {
    docs: {
      source: {
        language: 'typescript',
        // Dynamic source code based on current args
        transform: () => getSourceCode(currentArgs.mode, currentArgs.autoReset),
      },
    },
  },
  render: (args) => {
    // Update mutable args reference so event listeners read current values
    currentArgs.mode = args.mode;
    currentArgs.autoReset = args.autoReset;

    const id = `loading-demo-${++instanceId}`;
    const hint = modeHints[args.mode];

    // Schedule setup after render
    requestAnimationFrame(() => {
      const container = document.getElementById(id);
      if (container) setupLoadingPlayground(container);
    });

    return html`
      <style>
        .loading-demo {
          display: flex;
          flex-direction: column;
          height: 400px;
        }
        .loading-demo__bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: light-dark(#f5f5f5, #2a2a2a);
          border-bottom: 1px solid var(--sb-border);
          font-size: 13px;
          color: var(--sbdocs-fg);
        }
        .loading-demo__hint {
          flex: 1;
        }
        .loading-demo__hint strong {
          color: var(--sbdocs-heading);
        }
        .loading-demo__simulate {
          padding: 6px 14px;
          border: 1px solid var(--sb-border);
          border-radius: 4px;
          background: var(--tbw-accent);
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .loading-demo__simulate:hover {
          opacity: 0.9;
        }
      </style>
      <div class="loading-demo" id="${id}">
        <div class="loading-demo__bar">
          <div class="loading-demo__hint">${unsafeHTML(hint)}</div>
          <button class="loading-demo__simulate">▶ Simulate</button>
        </div>
        <tbw-grid style="flex: 1; min-height: 0;"></tbw-grid>
      </div>
    `;
  },
};

// Unique ID for custom renderer story
let customRendererId = 0;

/**
 * Replace the default spinner with a custom loading component.
 * This example shows a Material Design-style linear progress bar.
 */
export const CustomLoadingRenderer: Story = {
  name: 'Custom Loading Renderer',
  argTypes: {
    mode: { table: { disable: true } },
    autoReset: { table: { disable: true } },
  },
  parameters: {
    docs: {
      source: {
        language: 'typescript',
        code: `import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  getRowId: (row) => row.id,
  loadingRenderer: (ctx) => {
    // ctx.size: 'large' (grid) or 'small' (row/cell)
    const container = document.createElement('div');
    container.className = 'progress-bar-container';
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    container.appendChild(bar);
    return container;
  },
};`,
      },
    },
  },
  render: () => {
    const id = `custom-loading-${++customRendererId}`;

    requestAnimationFrame(() => {
      const container = document.getElementById(id);
      if (!container) return;

      const grid = container.querySelector<DataGridElement<Employee>>('tbw-grid')!;
      const toggleBtn = container.querySelector<HTMLButtonElement>('.custom-loading__toggle')!;

      if (grid.hasAttribute('data-initialized')) return;
      grid.setAttribute('data-initialized', 'true');

      grid.columns = [
        { field: 'id', header: 'ID', width: 80 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
        { field: 'department', header: 'Department' },
      ];
      grid.rows = employees;
      grid.gridConfig = {
        getRowId: (row) => row.id,
        loadingRenderer: () => {
          const container = document.createElement('div');
          container.className = 'progress-bar-container';
          const bar = document.createElement('div');
          bar.className = 'progress-bar';
          container.appendChild(bar);
          return container;
        },
      };

      toggleBtn.addEventListener('click', () => {
        grid.loading = !grid.loading;
      });
    });

    return html`
      <style>
        .custom-loading {
          display: flex;
          flex-direction: column;
          height: 400px;
        }
        .custom-loading__bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: light-dark(#f5f5f5, #2a2a2a);
          border-bottom: 1px solid var(--sb-border);
          font-size: 13px;
          color: var(--sbdocs-fg);
        }
        .custom-loading__hint {
          flex: 1;
        }
        .custom-loading__toggle {
          padding: 6px 14px;
          border: 1px solid var(--sb-border);
          border-radius: 4px;
          background: var(--tbw-accent);
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .custom-loading__toggle:hover {
          opacity: 0.9;
        }
        .progress-bar-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.08));
          overflow: hidden;
          z-index: 1000;
        }
        .progress-bar {
          height: 100%;
          background: light-dark(#1976d2, #64b5f6);
          width: 30%;
          animation: progress-indeterminate 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-origin: left;
        }
        @keyframes progress-indeterminate {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
      </style>
      <div class="custom-loading" id="${id}">
        <div class="custom-loading__bar">
          <div class="custom-loading__hint">
            Replace the default spinner with a <strong>linear progress bar</strong>.
          </div>
          <button class="custom-loading__toggle">Toggle Loading</button>
        </div>
        <tbw-grid style="flex: 1; min-height: 0;"></tbw-grid>
      </div>
    `;
  },
};
