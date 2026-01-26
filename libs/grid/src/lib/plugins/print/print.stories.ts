/**
 * Print Plugin Stories
 *
 * Demonstrates the print layout functionality.
 */
import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import '../../../index';
import { PrintPlugin } from './PrintPlugin';

const employeeData = [
  {
    id: 1,
    name: 'Alice Johnson',
    department: 'Engineering',
    salary: 85000,
    status: 'Active',
    email: 'alice@company.com',
  },
  { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 72000, status: 'Active', email: 'bob@company.com' },
  {
    id: 3,
    name: 'Carol Williams',
    department: 'Engineering',
    salary: 92000,
    status: 'Active',
    email: 'carol@company.com',
  },
  { id: 4, name: 'David Brown', department: 'Sales', salary: 68000, status: 'On Leave', email: 'david@company.com' },
  { id: 5, name: 'Emma Davis', department: 'HR', salary: 65000, status: 'Active', email: 'emma@company.com' },
  {
    id: 6,
    name: 'Frank Miller',
    department: 'Engineering',
    salary: 88000,
    status: 'Active',
    email: 'frank@company.com',
  },
  { id: 7, name: 'Grace Wilson', department: 'Marketing', salary: 75000, status: 'Active', email: 'grace@company.com' },
  { id: 8, name: 'Henry Taylor', department: 'Sales', salary: 70000, status: 'Active', email: 'henry@company.com' },
  { id: 9, name: 'Ivy Anderson', department: 'Finance', salary: 82000, status: 'On Leave', email: 'ivy@company.com' },
  {
    id: 10,
    name: 'Jack Thomas',
    department: 'Engineering',
    salary: 95000,
    status: 'Active',
    email: 'jack@company.com',
  },
];

const meta: Meta = {
  title: 'Grid/Plugins/Print',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The **Print Plugin** enables printing the full grid content by temporarily disabling virtualization
and applying print-optimized styles. It handles large datasets gracefully with configurable row limits.

## Features

- 🖨️ **Print Layout Mode** - Optimized styles for printing
- 📄 **Page Orientation** - Portrait or landscape
- 🔄 **Header Repeat** - Repeats column headers on each page
- 📊 **Row Limits** - Configurable maximum rows with confirmation dialog
- 🔘 **Toolbar Button** - Optional print button in grid header
- 📝 **Title & Timestamp** - Optional print header with title and timestamp

## Installation

\`\`\`typescript
import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
// Or from all-in-one bundle
import { PrintPlugin } from '@toolbox-web/grid/all';
\`\`\`
        `,
      },
    },
  },
};

export default meta;

type Story = StoryObj;

/**
 * Basic print functionality. Click the "Print Grid" button to test the print dialog.
 * Uses `isolate: true` to print in a clean window without Storybook chrome.
 */
export const Basic: Story = {
  render: () => {
    const printPlugin = new PrintPlugin({
      title: 'Employee Report',
      includeTitle: true,
      includeTimestamp: true,
    });

    const handlePrint = () => {
      const grid = document.querySelector('#print-basic-grid') as any;
      const plugin = grid?.getPlugin(PrintPlugin);
      plugin?.print({ isolate: true });
    };

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <button @click=${handlePrint} style="padding: 8px 16px; cursor: pointer;">🖨️ Print Grid</button>
        </div>
        <tbw-grid
          id="print-basic-grid"
          style="height: 400px;"
          .rows=${employeeData}
          .gridConfig=${{
            fitMode: 'stretch',
            columns: [
              { field: 'id', header: 'ID', width: 60 },
              { field: 'name', header: 'Name', minWidth: 150 },
              { field: 'department', header: 'Department', width: 120 },
              { field: 'email', header: 'Email', minWidth: 200 },
              { field: 'salary', header: 'Salary', width: 100, align: 'right' },
              { field: 'status', header: 'Status', width: 100 },
            ],
            plugins: [printPlugin],
          }}
        ></tbw-grid>
      </div>
    `;
  },
};

/**
 * Print with a toolbar button integrated into the grid shell.
 * The toolbar button uses isolate mode by default.
 */
export const ToolbarButton: Story = {
  render: () => {
    return html`
      <tbw-grid
        style="height: 400px;"
        .rows=${employeeData}
        .gridConfig=${{
          shell: {
            header: {
              title: 'Employee Directory',
            },
          },
          columns: [
            { field: 'id', header: 'ID', width: 60 },
            { field: 'name', header: 'Name', width: 180 },
            { field: 'department', header: 'Department', width: 120 },
            { field: 'salary', header: 'Salary', width: 100 },
          ],
          plugins: [
            new PrintPlugin({
              button: true,
              title: 'Employee Directory',
              isolate: true,
            }),
          ],
        }}
      ></tbw-grid>
    `;
  },
  parameters: {
    docs: {
      description: {
        story:
          'When `button: true` is set, a print button appears in the grid toolbar. Use `isolate: true` to ensure only the grid prints.',
      },
    },
  },
};

/**
 * Portrait orientation for narrow content that fits better vertically.
 */
export const PortraitOrientation: Story = {
  render: () => {
    const printPlugin = new PrintPlugin({
      orientation: 'portrait',
      title: 'Department Report',
    });

    const handlePrint = () => {
      const grid = document.querySelector('#print-portrait-grid') as any;
      const plugin = grid?.getPlugin(PrintPlugin);
      plugin?.print({ isolate: true });
    };

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <button @click=${handlePrint} style="padding: 8px 16px; cursor: pointer;">🖨️ Print (Portrait)</button>
        </div>
        <tbw-grid
          id="print-portrait-grid"
          style="height: 400px;"
          .rows=${employeeData}
          .gridConfig=${{
            columns: [
              { field: 'name', header: 'Name', width: 200 },
              { field: 'department', header: 'Department', width: 150 },
            ],
            plugins: [printPlugin],
          }}
        ></tbw-grid>
      </div>
    `;
  },
};

/**
 * Row limit with confirmation dialog for large datasets.
 * This demo generates 1000 rows, warns at 500+, and limits printing to 100.
 */
export const RowLimit: Story = {
  render: () => {
    // Generate 1000 sample rows
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      name: `Employee ${i + 1}`,
      department: ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'][i % 5],
      salary: 50000 + Math.floor(Math.random() * 50000),
    }));

    const printPlugin = new PrintPlugin({
      warnThreshold: 500, // Show confirmation dialog at 500+ rows
      maxRows: 100, // Hard limit: only print first 100 rows
      title: 'Large Dataset Print Test',
    });

    const handlePrint = () => {
      const grid = document.querySelector('#print-limit-grid') as any;
      const plugin = grid?.getPlugin(PrintPlugin);
      plugin?.print({ isolate: true });
    };

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div
          style="padding: 12px; background: var(--demo-sample-bg); border: 1px solid var(--demo-sample-border); border-radius: 4px; color: var(--sbdocs-fg);"
        >
          ⚠️ This grid has <strong>1,000 rows</strong>. The plugin uses <code>warnThreshold: 500</code> (shows
          confirmation dialog) and <code>maxRows: 100</code> (hard limit). Check the print preview to see only 100 rows.
        </div>
        <div>
          <button @click=${handlePrint} style="padding: 8px 16px; cursor: pointer;">
            🖨️ Print Grid (max 100 rows)
          </button>
        </div>
        <tbw-grid
          id="print-limit-grid"
          style="height: 400px;"
          .rows=${largeDataset}
          .gridConfig=${{
            columns: [
              { field: 'id', header: 'ID', width: 60 },
              { field: 'name', header: 'Name', width: 180 },
              { field: 'department', header: 'Department', width: 120 },
              { field: 'salary', header: 'Salary', width: 100, align: 'right' },
            ],
            plugins: [printPlugin],
          }}
        ></tbw-grid>
      </div>
    `;
  },
  parameters: {
    docs: {
      description: {
        story: `
**Two separate options control large dataset behavior:**

- \`warnThreshold: 500\` - Shows a confirmation dialog when rows exceed 500, letting users consent to the wait
- \`maxRows: 100\` - Hard limits the output to 100 rows regardless of user choice

You can use either or both:
- Only \`warnThreshold\` → Warns but prints all rows if confirmed
- Only \`maxRows\` → Silently limits without warning
- Both → Warns AND limits (shown in this example)
        `,
      },
    },
  },
};

/**
 * Listen to print events for analytics or logging.
 * Note: Browsers don't expose whether the user clicked Print or Cancel.
 */
export const PrintEvents: Story = {
  render: () => {
    const printPlugin = new PrintPlugin({
      title: 'Event Demo',
      warnThreshold: 0, // No warning for this demo
    });

    const handlePrint = () => {
      const grid = document.querySelector('#print-events-grid') as any;
      const plugin = grid?.getPlugin(PrintPlugin);
      plugin?.print({ isolate: true });
    };

    const setupEventListeners = () => {
      const grid = document.querySelector('#print-events-grid');
      const log = document.querySelector('#event-log');

      if (!grid || !log) return;

      grid.addEventListener('print-start', (e: any) => {
        const msg = document.createElement('div');
        msg.textContent = `[print-start] Preparing ${e.detail.rowCount} rows...`;
        log.appendChild(msg);
      });

      grid.addEventListener('print-complete', (e: any) => {
        const msg = document.createElement('div');
        msg.textContent = `[print-complete] Dialog closed after ${e.detail.duration}ms`;
        log.appendChild(msg);
      });
    };

    setTimeout(setupEventListeners, 100);

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <button @click=${handlePrint} style="padding: 8px 16px; cursor: pointer;">🖨️ Print Grid</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 300px; gap: 16px;">
          <tbw-grid
            id="print-events-grid"
            style="height: 300px;"
            .rows=${employeeData.slice(0, 5)}
            .gridConfig=${{
              columns: [
                { field: 'name', header: 'Name' },
                { field: 'department', header: 'Department' },
              ],
              plugins: [printPlugin],
            }}
          ></tbw-grid>
          <div
            style="border: 1px solid var(--sb-border); padding: 12px; border-radius: 4px; background: var(--sbdocs-bg);"
          >
            <strong>Event Log:</strong>
            <div
              id="event-log"
              style="font-family: monospace; font-size: 12px; margin-top: 8px; color: var(--sbdocs-fg);"
            ></div>
          </div>
        </div>
      </div>
    `;
  },
  parameters: {
    docs: {
      description: {
        story: `
The plugin emits events during the print lifecycle:

- **\`print-start\`** - Fired when print begins (rows, limitApplied, originalRowCount)
- **\`print-complete\`** - Fired when the print dialog closes (duration, rowCount)

**Note:** Browsers don't expose whether the user clicked "Print" or "Cancel" in the dialog.
The \`success\` field only indicates whether the plugin encountered an error preparing the print -
it does NOT indicate the user's choice.
        `,
      },
    },
  },
};

/**
 * Hide specific columns when printing using the `printHidden` column property.
 * Useful for excluding action buttons, checkboxes, or other interactive elements.
 */
export const HiddenColumns: Story = {
  render: () => {
    const printPlugin = new PrintPlugin({
      title: 'Employee Report (Filtered)',
      includeTitle: true,
      includeTimestamp: true,
    });

    const handlePrint = () => {
      const grid = document.querySelector('#print-hidden-grid') as any;
      const plugin = grid?.getPlugin(PrintPlugin);
      plugin?.print({ isolate: true });
    };

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <button @click=${handlePrint} style="padding: 8px 16px; cursor: pointer;">🖨️ Print Grid</button>
          <span style="margin-left: 12px; color: var(--sbdocs-fg); opacity: 0.7; font-size: 14px;">
            Note: The "Actions" column will be hidden in print output
          </span>
        </div>
        <tbw-grid
          id="print-hidden-grid"
          style="height: 400px;"
          .rows=${employeeData}
          .gridConfig=${{
            columns: [
              { field: 'id', header: 'ID', width: 60 },
              { field: 'name', header: 'Name', width: 180 },
              { field: 'department', header: 'Department', width: 120 },
              { field: 'email', header: 'Email', width: 200 },
              { field: 'salary', header: 'Salary', width: 100, align: 'right' },
              {
                field: 'actions',
                header: 'Actions',
                width: 100,
                printHidden: true, // This column won't appear in print
                renderer: () => html`<button style="padding: 4px 8px;">Edit</button>`,
              },
            ],
            plugins: [printPlugin],
          }}
        ></tbw-grid>
      </div>
    `;
  },
  parameters: {
    docs: {
      description: {
        story: `
Use the \`printHidden: true\` column property to exclude specific columns from print output.
This is ideal for:
- Action buttons (Edit, Delete)
- Selection checkboxes
- Interactive elements that don't make sense on paper
- Sensitive data that shouldn't be printed
        `,
      },
    },
  },
};
