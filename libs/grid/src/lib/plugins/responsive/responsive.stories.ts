import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { ResponsivePlugin } from './ResponsivePlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins/Responsive',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Responsive plugin transforms the grid from a tabular layout to a card/list layout
when the grid width falls below a configurable breakpoint.

**Key Features:**
- Automatic mode switching based on grid width
- CSS-only card layout (no DOM replacement)
- Optional hidden columns in responsive mode
- Custom card renderer support (Phase 2)

**Use Cases:**
- Split-pane UIs where the grid panel can be resized
- Mobile/tablet responsive designs
- Dashboard widgets in narrow containers
- Master-detail patterns where detail panel takes space
        `,
      },
    },
  },
  argTypes: {
    breakpoint: {
      control: { type: 'range', min: 200, max: 1000, step: 50 },
      description: 'Width threshold in pixels to trigger responsive mode',
      table: { category: 'Responsive', type: { summary: 'number' } },
    },
    hideHeader: {
      control: 'boolean',
      description: 'Whether to hide the header row in responsive mode',
      table: { category: 'Responsive', type: { summary: 'boolean' } },
    },
    debounceMs: {
      control: { type: 'range', min: 0, max: 500, step: 50 },
      description: 'Debounce delay for resize events',
      table: { category: 'Responsive', type: { summary: 'number' } },
    },
  },
  args: {
    breakpoint: 500,
    hideHeader: true,
    debounceMs: 100,
  },
};
export default meta;

interface ResponsiveArgs {
  breakpoint: number;
  hideHeader: boolean;
  debounceMs: number;
}
type Story = StoryObj<ResponsiveArgs>;

// Sample data
const sampleData = [
  {
    id: 1,
    name: 'Alice Johnson',
    department: 'Engineering',
    salary: 95000,
    email: 'alice@example.com',
    startDate: '2020-03-15',
  },
  {
    id: 2,
    name: 'Bob Smith',
    department: 'Marketing',
    salary: 75000,
    email: 'bob@example.com',
    startDate: '2019-07-22',
  },
  {
    id: 3,
    name: 'Carol Williams',
    department: 'Engineering',
    salary: 105000,
    email: 'carol@example.com',
    startDate: '2018-11-01',
  },
  { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, email: 'dan@example.com', startDate: '2021-01-10' },
  {
    id: 5,
    name: 'Eve Davis',
    department: 'Marketing',
    salary: 72000,
    email: 'eve@example.com',
    startDate: '2022-05-03',
  },
  {
    id: 6,
    name: 'Frank Miller',
    department: 'Engineering',
    salary: 98000,
    email: 'frank@example.com',
    startDate: '2020-08-20',
  },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const, width: 60 },
  { field: 'name', header: 'Name', width: 150 },
  { field: 'department', header: 'Department', width: 120 },
  { field: 'salary', header: 'Salary', type: 'number' as const, width: 100 },
  { field: 'email', header: 'Email', width: 200 },
  { field: 'startDate', header: 'Start Date', width: 120 },
];

/**
 * Interactive demo - resize the grid container to see the responsive layout.
 * Use the slider in the controls to adjust the breakpoint.
 */
export const Default: Story = {
  args: {
    breakpoint: 500,
  },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<div style="resize: horizontal; overflow: auto; width: 700px; border: 2px dashed #ccc; padding: 8px;">
  <tbw-grid style="height: 350px;"></tbw-grid>
</div>

<script type="module">
import '@toolbox-web/grid';
import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [new ResponsivePlugin({ breakpoint: 500 })],
};
grid.rows = data;
</script>
`,
      },
    },
  },
  render: (args) => {
    // Create a resizable container to demonstrate the plugin
    const container = document.createElement('div');
    container.style.cssText = `
      resize: horizontal;
      overflow: auto;
      width: 700px;
      min-width: 250px;
      max-width: 100%;
      border: 2px dashed var(--sb-border);
      padding: 8px;
      background: var(--sb-bg);
    `;

    // Add instruction
    const instruction = document.createElement('div');
    instruction.style.cssText = 'margin-bottom: 8px; color: #666; font-size: 14px;';
    instruction.textContent = '↔ Drag the right edge to resize the container';
    container.appendChild(instruction);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new ResponsivePlugin({
          breakpoint: args.breakpoint,
          hideHeader: args.hideHeader,
          debounceMs: args.debounceMs,
        }),
      ],
    };
    grid.rows = sampleData;

    container.appendChild(grid);

    // Add status indicator
    const status = document.createElement('div');
    status.style.cssText = 'margin-top: 8px; font-size: 12px; color: var(--sbdocs-toc-link);';
    container.appendChild(status);

    // Update status on responsive change
    grid.addEventListener('responsive-change', ((e: CustomEvent) => {
      const { isResponsive, width, breakpoint } = e.detail;
      status.textContent = `Mode: ${isResponsive ? '📱 Card' : '📊 Table'} | Width: ${Math.round(width)}px | Breakpoint: ${breakpoint}px`;
    }) as EventListener);

    // Initial status
    requestAnimationFrame(() => {
      const width = grid.clientWidth;
      const isResponsive = width < args.breakpoint;
      status.textContent = `Mode: ${isResponsive ? '📱 Card' : '📊 Table'} | Width: ${Math.round(width)}px | Breakpoint: ${args.breakpoint}px`;
    });

    return container;
  },
};

/**
 * When the grid width is below the breakpoint, it automatically switches to card layout.
 * Each row becomes a card with header-value pairs stacked vertically.
 */
export const CardMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Force card mode by using a container narrower than the breakpoint.',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'width: 350px; border: 1px solid var(--sb-border);';

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
        { field: 'salary', header: 'Salary', type: 'number' as const },
        { field: 'email', header: 'Email' },
      ],
      plugins: [new ResponsivePlugin({ breakpoint: 500 })],
    };
    grid.rows = sampleData;

    container.appendChild(grid);
    return container;
  },
};

/**
 * Use `hiddenColumns` to hide less important columns in card mode.
 * This helps focus on essential information in narrow layouts.
 */
export const HiddenColumns: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Hide the email and startDate columns when in responsive mode to reduce clutter.',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = `
      resize: horizontal;
      overflow: auto;
      width: 350px;
      min-width: 250px;
      max-width: 100%;
      border: 2px dashed var(--sb-border);
      padding: 8px;
    `;

    const instruction = document.createElement('div');
    instruction.style.cssText = 'margin-bottom: 8px; color: var(--sbdocs-toc-link); font-size: 14px;';
    instruction.textContent = 'Email and Start Date columns are hidden in card mode';
    container.appendChild(instruction);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new ResponsivePlugin({
          breakpoint: 600,
          hiddenColumns: ['email', 'startDate'],
        }),
      ],
    };
    grid.rows = sampleData;

    container.appendChild(grid);
    return container;
  },
};

/**
 * Use the plugin API to manually control responsive mode.
 */
export const ManualControl: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Use `setResponsive()` to force responsive mode regardless of width.',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');

    // Controls
    const controls = document.createElement('div');
    controls.style.cssText = 'margin-bottom: 12px; display: flex; gap: 8px;';

    const tableBtn = document.createElement('button');
    tableBtn.textContent = '📊 Table Mode';
    tableBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';

    const cardBtn = document.createElement('button');
    cardBtn.textContent = '📱 Card Mode';
    cardBtn.style.cssText = 'padding: 8px 16px; cursor: pointer;';

    controls.appendChild(tableBtn);
    controls.appendChild(cardBtn);
    container.appendChild(controls);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    const responsivePlugin = new ResponsivePlugin({
      breakpoint: 0, // Disabled - using manual control
    });

    grid.gridConfig = {
      columns: columns.slice(0, 4), // Fewer columns
      plugins: [responsivePlugin],
    };
    grid.rows = sampleData;

    tableBtn.addEventListener('click', () => responsivePlugin.setResponsive(false));
    cardBtn.addEventListener('click', () => responsivePlugin.setResponsive(true));

    container.appendChild(grid);
    return container;
  },
};

/**
 * **Phase 2 Feature**: Use a custom `cardRenderer` for complete control over card layout.
 * This allows for complex card designs with avatars, badges, custom layouts, etc.
 */
export const CustomCardRenderer: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Use \`cardRenderer\` when the default header-value pair layout isn't sufficient.
Your renderer receives the row data and index, and returns an HTMLElement.

**Note:** When using a custom cardRenderer, keyboard navigation is disabled.
The implementor is responsible for handling their own navigation within the card.
        `,
      },
      source: {
        code: `
const responsivePlugin = new ResponsivePlugin({
  breakpoint: 600,
  cardRenderer: (row) => {
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.innerHTML = \`
      <div class="avatar">\${row.name[0]}</div>
      <div class="info">
        <div class="name">\${row.name}</div>
        <div class="meta">\${row.department} · $\${row.salary.toLocaleString()}</div>
        <div class="email">\${row.email}</div>
      </div>
    \`;
    return card;
  },
});
`,
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = `
      resize: horizontal;
      overflow: auto;
      width: 400px;
      min-width: 300px;
      max-width: 100%;
      border: 2px dashed var(--sb-border);
      padding: 8px;
      background: var(--sb-bg);
    `;

    // Add instruction
    const instruction = document.createElement('div');
    instruction.style.cssText = 'margin-bottom: 8px; color: var(--sbdocs-toc-link); font-size: 14px;';
    instruction.textContent = '↔ Resize to see custom card layout';
    container.appendChild(instruction);

    // Add card styles
    const style = document.createElement('style');
    style.textContent = `
      .employee-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      .employee-card .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--tbw-color-accent, #4a90d9);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: bold;
        flex-shrink: 0;
      }
      .employee-card .info {
        flex: 1;
        min-width: 0;
      }
      .employee-card .name {
        font-weight: 600;
        font-size: 16px;
        color: var(--tbw-color-fg);
      }
      .employee-card .meta {
        font-size: 13px;
        color: var(--tbw-color-fg-muted, #666);
        margin-top: 2px;
      }
      .employee-card .email {
        font-size: 12px;
        color: var(--tbw-color-accent, #4a90d9);
        margin-top: 4px;
      }
      .employee-card .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        margin-left: 8px;
      }
      .employee-card .badge.engineering { background: #e3f2fd; color: #1565c0; }
      .employee-card .badge.marketing { background: #f3e5f5; color: #7b1fa2; }
      .employee-card .badge.sales { background: #e8f5e9; color: #2e7d32; }
    `;
    container.appendChild(style);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    interface Employee {
      id: number;
      name: string;
      department: string;
      salary: number;
      email: string;
      startDate: string;
    }

    const responsivePlugin = new ResponsivePlugin<Employee>({
      breakpoint: 600,
      cardRenderer: (row: Employee) => {
        const card = document.createElement('div');
        card.className = 'employee-card';

        // Get department badge class
        const deptClass = row.department.toLowerCase().replace(/\s+/g, '-');

        card.innerHTML = `
          <div class="avatar">${row.name[0]}</div>
          <div class="info">
            <div class="name">
              ${row.name}
              <span class="badge ${deptClass}">${row.department}</span>
            </div>
            <div class="meta">$${row.salary.toLocaleString()} · Started ${row.startDate}</div>
            <div class="email">${row.email}</div>
          </div>
        `;
        return card;
      },
    });

    grid.gridConfig = {
      columns,
      plugins: [responsivePlugin],
    };
    grid.rows = sampleData;

    container.appendChild(grid);

    // Add status indicator
    const status = document.createElement('div');
    status.style.cssText = 'margin-top: 8px; font-size: 12px; color: var(--sbdocs-toc-link);';
    container.appendChild(status);

    // Update status on responsive change
    grid.addEventListener('responsive-change', ((e: CustomEvent) => {
      const { isResponsive, width } = e.detail;
      status.textContent = `Mode: ${isResponsive ? '📱 Custom Cards' : '📊 Table'} | Width: ${Math.round(width)}px`;
    }) as EventListener);

    // Initial status
    requestAnimationFrame(() => {
      const width = grid.clientWidth;
      status.textContent = `Mode: ${width < 600 ? '📱 Custom Cards' : '📊 Table'} | Width: ${Math.round(width)}px`;
    });

    return container;
  },
};

/**
 * Use `cardRowHeight` to set a fixed height for custom cards.
 * This is useful when you want consistent card heights for virtualization performance.
 */
export const FixedCardHeight: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Set \`cardRowHeight\` to a number for fixed-height cards.
This helps with virtualization performance for large datasets.
Use \`'auto'\` (default) for variable-height cards.
        `,
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'width: 350px; border: 1px solid var(--sb-border);';

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .simple-card {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 100%;
      }
      .simple-card .initial {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: var(--tbw-color-accent, #4a90d9);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }
      .simple-card .details {
        flex: 1;
      }
      .simple-card .name { font-weight: 600; }
      .simple-card .dept { font-size: 13px; color: var(--tbw-color-fg-muted, #666); }
    `;
    container.appendChild(style);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    interface Employee {
      id: number;
      name: string;
      department: string;
      salary: number;
      email: string;
      startDate: string;
    }

    grid.gridConfig = {
      columns: columns.slice(0, 4),
      plugins: [
        new ResponsivePlugin<Employee>({
          breakpoint: 500,
          cardRowHeight: 60, // Fixed 60px height per card
          cardRenderer: (row: Employee) => {
            const card = document.createElement('div');
            card.className = 'simple-card';
            card.innerHTML = `
              <div class="initial">${row.name[0]}</div>
              <div class="details">
                <div class="name">${row.name}</div>
                <div class="dept">${row.department}</div>
              </div>
            `;
            return card;
          },
        }),
      ],
    };
    grid.rows = sampleData;

    container.appendChild(grid);

    const note = document.createElement('div');
    note.style.cssText = 'padding: 8px; font-size: 12px; color: var(--sbdocs-toc-link);';
    note.textContent = 'Each card has a fixed 60px height';
    container.appendChild(note);

    return container;
  },
};
