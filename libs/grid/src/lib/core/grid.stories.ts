import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { ColumnConfig, GridConfig, HeaderContentDefinition, ShellConfig, ToolPanelDefinition } from '../../public';
import { FitModeEnum } from '../../public';

// Import from source for HMR
import '../../index';
import { VisibilityPlugin } from '../plugins/visibility';

type GridElement = HTMLElement & {
  columns: ColumnConfig[];
  rows: any[];
  fitMode: string;
  editOn: string;
  gridConfig: GridConfig<any>;
  registerToolPanel: (panel: ToolPanelDefinition) => void;
  registerHeaderContent: (content: HeaderContentDefinition) => void;
  openToolPanel: (id: string) => void;
  closeToolPanel: () => void;
  toggleToolPanel: (id: string) => void;
  refreshShellHeader: () => void;
};

// Available columns for the playground
const ALL_COLUMNS = ['id', 'name', 'active', 'score', 'created', 'role'] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number];

const meta: Meta = {
  title: 'Grid/Core',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The core data grid component with virtualization, sorting, editing, and keyboard navigation.',
      },
    },
  },
  argTypes: {
    // Data
    rowCount: {
      control: { type: 'range', min: 10, max: 10000, step: 100 },
      description: 'Number of rows to generate (virtualization demo)',
      table: { category: 'Data' },
    },
    // Layout
    fixedHeight: {
      control: 'boolean',
      description: 'Use fixed height (enables virtualization)',
      table: { category: 'Layout' },
    },
    height: {
      control: { type: 'text' },
      description: 'Grid height (CSS value)',
      table: { category: 'Layout' },
      if: { arg: 'fixedHeight' },
    },
    fitMode: {
      control: { type: 'radio' },
      options: ['stretch', 'fixed'],
      description: 'Column sizing strategy',
      table: { category: 'Layout', type: { summary: 'FitMode' } },
    },
    // Columns (multiselect)
    visibleColumns: {
      control: { type: 'check' },
      options: ALL_COLUMNS,
      description: 'Columns to display',
      table: { category: 'Columns' },
    },
    // Features
    sortable: {
      control: 'boolean',
      description: 'Enable column sorting',
      table: { category: 'Features' },
    },
    resizable: {
      control: 'boolean',
      description: 'Enable column resizing',
      table: { category: 'Features' },
    },
    editable: {
      control: 'boolean',
      description: 'Enable cell editing',
      table: { category: 'Features' },
    },
    editOn: {
      control: { type: 'radio' },
      options: ['click', 'dblclick'],
      description: 'Edit trigger mode',
      table: { category: 'Features' },
      if: { arg: 'editable' },
    },
  },
  args: {
    rowCount: 100,
    fitMode: FitModeEnum.STRETCH,
    fixedHeight: true,
    height: '500px',
    visibleColumns: [...ALL_COLUMNS],
    sortable: true,
    resizable: true,
    editable: true,
    editOn: 'dblclick',
  },
};
export default meta;

interface GridArgs {
  rowCount: number;
  fitMode: 'stretch' | 'fixed';
  fixedHeight: boolean;
  height: string;
  visibleColumns: ColumnKey[];
  sortable: boolean;
  resizable: boolean;
  editable: boolean;
  editOn: 'click' | 'dblclick';
}
type Story = StoryObj<GridArgs>;

// Column definitions factory
function buildColumnDefs(
  visibleColumns: ColumnKey[],
  opts: { sortable: boolean; resizable: boolean; editable: boolean }
): ColumnConfig[] {
  const columnDefs: Record<ColumnKey, ColumnConfig> = {
    id: { field: 'id', header: 'ID', type: 'number', sortable: opts.sortable, resizable: opts.resizable },
    name: {
      field: 'name',
      header: 'Name',
      sortable: opts.sortable,
      resizable: opts.resizable,
      editable: opts.editable,
    },
    active: { field: 'active', header: 'Active', type: 'boolean', sortable: opts.sortable, editable: opts.editable },
    score: {
      field: 'score',
      header: 'Score',
      type: 'number',
      sortable: opts.sortable,
      resizable: opts.resizable,
      editable: opts.editable,
    },
    created: { field: 'created', header: 'Created', type: 'date', sortable: opts.sortable, resizable: opts.resizable },
    role: {
      field: 'role',
      header: 'Role',
      type: 'select',
      sortable: opts.sortable,
      editable: opts.editable,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
        { label: 'Guest', value: 'guest' },
      ],
    },
  };
  return visibleColumns.map((key) => columnDefs[key]);
}

// Generate sample data
function generateRows(count: number) {
  const roles = ['admin', 'user', 'guest'];
  const names = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Henry'];
  const rows: any[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      name: names[i % names.length] + ' ' + (Math.floor(i / names.length) + 1),
      active: i % 3 !== 0,
      score: Math.floor(Math.random() * 100),
      created: new Date(Date.now() - i * 86400000),
      role: roles[i % roles.length],
    });
  }
  return rows;
}

/**
 * ## Interactive Grid Playground
 *
 * Full-featured demo with virtualization, sorting, editing, and keyboard navigation.
 *
 * **Controls:**
 * - **Row Count**: Drag to test virtualization (try 10,000 rows!)
 * - **Columns**: Select which columns to display
 * - **Features**: Toggle sorting, resizing, and editing
 *
 * **Keyboard Navigation:**
 * - Arrow keys: Move focus between cells
 * - Enter: Start editing / confirm edit
 * - Escape: Cancel editing
 * - Tab/Shift+Tab: Move to next/previous editable cell
 * - Home/End: Jump to first/last column
 * - Ctrl+Home/End: Jump to first/last row
 * - Page Up/Down: Scroll by page
 */
export const Playground: Story = {
  render: (args: GridArgs) => {
    const effectiveHeight = args.fixedHeight ? args.height : 'auto';
    const htmlSnippet = `<tbw-grid style="height: ${effectiveHeight}; display: block;"></tbw-grid>`;

    // Create grid element directly to set props BEFORE DOM connection (single render pass)
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = `height: ${effectiveHeight}; display: block;`;

    const codeSnippet = (
      __$rowCount$: number,
      __$fitMode$: string,
      __$sortable$: boolean,
      __$resizable$: boolean,
      __$editable$: boolean,
      __$editOn$: string
    ) => {
      // Generate sample data
      const roles = ['admin', 'user', 'guest'];
      const names = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Henry'];
      const rows: any[] = [];
      for (let i = 0; i < __$rowCount$; i++) {
        rows.push({
          id: i + 1,
          name: names[i % names.length] + ' ' + (Math.floor(i / names.length) + 1),
          active: i % 3 !== 0,
          score: Math.floor(Math.random() * 100),
          created: new Date(Date.now() - i * 86400000),
          role: roles[i % roles.length],
        });
      }

      // Configure grid
      grid.fitMode = __$fitMode$;
      grid.editOn = __$editOn$;

      grid.columns = [
        { field: 'id', header: 'ID', type: 'number', sortable: __$sortable$, resizable: __$resizable$ },
        { field: 'name', header: 'Name', sortable: __$sortable$, resizable: __$resizable$, editable: __$editable$ },
        { field: 'active', header: 'Active', type: 'boolean', sortable: __$sortable$, editable: __$editable$ },
        {
          field: 'score',
          header: 'Score',
          type: 'number',
          sortable: __$sortable$,
          resizable: __$resizable$,
          editable: __$editable$,
        },
        { field: 'created', header: 'Created', type: 'date', sortable: __$sortable$, resizable: __$resizable$ },
        {
          field: 'role',
          header: 'Role',
          type: 'select',
          sortable: __$sortable$,
          editable: __$editable$,
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
            { label: 'Guest', value: 'guest' },
          ],
        },
      ];
      grid.rows = rows;

      // Listen for cell edits
      grid.addEventListener('cell-commit', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        console.log('cell-commit:', detail.field, '=', detail.newValue);
      });
    };

    // Build columns from selected options
    const columns = buildColumnDefs(args.visibleColumns, {
      sortable: args.sortable,
      resizable: args.resizable,
      editable: args.editable,
    });

    // Set props BEFORE grid is connected to DOM for single render pass
    grid.fitMode = args.fitMode;
    grid.editOn = args.editOn;
    grid.columns = columns;
    grid.rows = generateRows(args.rowCount);

    grid.addEventListener('cell-commit', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('cell-commit:', detail.field, '=', detail.newValue);
    });

    const jsSnippet = extractCode(codeSnippet, args);
    const heightInfo = args.fixedHeight ? `height: ${args.height}` : 'auto height';
    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-playground',
      description: `
        <p>Rendering <strong>${args.rowCount.toLocaleString()} rows</strong> with <strong>${
        args.visibleColumns.length
      } columns</strong> (${heightInfo}).</p>
        <p><strong>Virtualization:</strong> ${
          args.fixedHeight
            ? 'Only visible rows are in the DOM — try scrolling with 10,000 rows!'
            : 'Disabled (auto height renders all rows).'
        }</p>
        <p><strong>Keyboard:</strong> Arrow keys navigate, <code>Enter</code> edits, <code>Escape</code> cancels, <code>Tab</code> moves between editable cells.</p>
      `,
    });
  },
};

/**
 * ## Column Inference
 *
 * When no columns are provided, the grid infers column definitions from the data.
 * Types are detected automatically: strings, numbers, booleans, and dates.
 */
export const ColumnInference: Story = {
  args: {
    rowCount: 5,
  },
  argTypes: {
    // Hide controls for this simple demo
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: () => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = () => {
      // No columns defined - they're inferred from the data!
      grid.rows = [
        { id: 1, name: 'Alice', score: 95, active: true, joined: new Date('2023-01-15') },
        { id: 2, name: 'Bob', score: 82, active: false, joined: new Date('2023-06-20') },
        { id: 3, name: 'Carol', score: 91, active: true, joined: new Date('2024-02-10') },
      ];
    };

    codeSnippet();
    const jsSnippet = extractCode(codeSnippet, {});
    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-inference',
      description: `
        <p>No <code>columns</code> prop provided — types are <strong>auto-detected</strong> from the data.</p>
        <p>The grid infers: <code>number</code>, <code>string</code>, <code>boolean</code>, and <code>Date</code> types.</p>
        <p>Column headers are generated from field names (camelCase → Title Case).</p>
      `,
    });
  },
};

/**
 * ## Light DOM Configuration
 *
 * Columns can be defined declaratively in HTML using `<tbw-grid-column>` elements.
 * This is useful for HTML-first workflows or when columns are static.
 */
export const LightDOMColumns: Story = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: (args: GridArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `
<tbw-grid>
  <tbw-grid-column field="name" header="Name" sortable ${args.editable ? 'editable' : ''} resizable></tbw-grid-column>
  <tbw-grid-column field="score" header="Score" type="number" sortable ${
    args.editable ? 'editable' : ''
  }></tbw-grid-column>
  <tbw-grid-column field="role" header="Role" type="select" ${
    args.editable ? 'editable' : ''
  } options="admin:Admin,user:User,guest:Guest"></tbw-grid-column>
</tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = () => {
      // Only rows needed - columns are defined in HTML
      grid.rows = [
        { name: 'Alice', score: 95, role: 'admin' },
        { name: 'Bob', score: 82, role: 'user' },
        { name: 'Carol', score: 91, role: 'guest' },
      ];
    };

    codeSnippet();
    const jsSnippet = extractCode(codeSnippet, {});
    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-lightdom',
      description: `
        <p>Columns defined via <code>&lt;tbw-grid-column&gt;</code> elements in the HTML.</p>
        <p>Great for <strong>HTML-first</strong> workflows, CMS templates, or server-rendered pages.</p>
        <p>Attributes: <code>field</code>, <code>header</code>, <code>type</code>, <code>sortable</code>, <code>editable</code>, <code>resizable</code>, <code>options</code>.</p>
      `,
    });
  },
};

/**
 * ## Custom Formatters
 *
 * Use the `format` function for simple value transformations,
 * or `viewRenderer` for full control over cell rendering.
 */
export const CustomFormatters: Story = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: () => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = () => {
      grid.columns = [
        { field: 'name', header: 'Name' },
        {
          field: 'score',
          header: 'Score',
          type: 'number',
          // Simple format function
          format: (value: number) => `${value} pts`,
        },
        {
          field: 'status',
          header: 'Status',
          // viewRenderer for custom HTML
          viewRenderer: ({ value }) => {
            const color = value === 'active' ? 'green' : value === 'pending' ? 'orange' : 'gray';
            return `<span style="color: ${color}; font-weight: bold;">● ${value}</span>`;
          },
        },
        {
          field: 'progress',
          header: 'Progress',
          type: 'number',
          // viewRenderer can return HTMLElement
          viewRenderer: ({ value }) => {
            const bar = document.createElement('div');
            bar.style.cssText = 'height:8px;background:#e0e0e0;border-radius:4px;overflow:hidden';
            bar.innerHTML = `<div style="width:${value}%;height:100%;background:#4caf50"></div>`;
            return bar;
          },
        },
      ];

      grid.rows = [
        { name: 'Project A', score: 85, status: 'active', progress: 75 },
        { name: 'Project B', score: 62, status: 'pending', progress: 40 },
        { name: 'Project C', score: 91, status: 'completed', progress: 100 },
      ];
    };

    codeSnippet();
    const jsSnippet = extractCode(codeSnippet, {});
    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-formatters',
      description: `
        <p><code>format</code> — simple value → string transformation (e.g., "85 pts").</p>
        <p><code>viewRenderer</code> — return HTML string or <code>HTMLElement</code> for rich cell content.</p>
        <p>Examples: status badges, progress bars, custom icons, formatted currencies.</p>
      `,
    });
  },
};

/**
 * ## Column State Persistence
 *
 * Demonstrates saving and restoring user column customizations:
 * - **Column order** — drag columns to reorder (requires ReorderPlugin)
 * - **Column widths** — resize columns
 * - **Visibility** — hide/show columns
 * - **Sort state** — click headers to sort
 *
 * The grid emits `column-state-change` events when users modify columns.
 * Use `grid.columnState` getter/setter to save and restore state.
 *
 * Try these actions, then click **Save State** and **Reload Page** to verify persistence!
 */
export const ColumnStatePersistence: Story = {
  render: () => {
    const STORAGE_KEY = 'tbw-grid-column-state-demo';

    // Wrapper with control buttons
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'height: 100%; display: flex; flex-direction: column; gap: 16px; padding: 16px;';

    // Control buttons container
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';
    controls.innerHTML = `
      <button id="save-state" style="padding: 8px 16px; cursor: pointer;">💾 Save State</button>
      <button id="load-state" style="padding: 8px 16px; cursor: pointer;">📂 Load State</button>
      <button id="clear-state" style="padding: 8px 16px; cursor: pointer;">🗑️ Clear Saved State</button>
      <button id="reset-state" style="padding: 8px 16px; cursor: pointer;">↩️ Reset to Default</button>
      <span id="status" style="margin-left: 16px; color: #666;"></span>
    `;
    wrapper.appendChild(controls);

    // Grid container
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = 'flex: 1; min-height: 300px;';
    gridContainer.innerHTML = `<tbw-grid style="height: 100%; display: block;"></tbw-grid>`;
    wrapper.appendChild(gridContainer);

    const grid = gridContainer.querySelector('tbw-grid') as GridElement;
    const status = controls.querySelector('#status') as HTMLSpanElement;

    function showStatus(msg: string) {
      status.textContent = msg;
      setTimeout(() => (status.textContent = ''), 3000);
    }

    const codeSnippet = () => {
      // Check for saved state on load
      const savedState = localStorage.getItem(STORAGE_KEY);
      const initialState = savedState ? JSON.parse(savedState) : undefined;

      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number', sortable: true, resizable: true },
          { field: 'name', header: 'Name', sortable: true, resizable: true },
          { field: 'department', header: 'Department', sortable: true, resizable: true },
          { field: 'salary', header: 'Salary', type: 'number', sortable: true, resizable: true },
          { field: 'hired', header: 'Hired', type: 'date', sortable: true, resizable: true },
        ],
        // Restore saved state if available
        columnState: initialState,
      };

      grid.rows = [
        { id: 1, name: 'Alice Smith', department: 'Engineering', salary: 95000, hired: new Date('2021-03-15') },
        { id: 2, name: 'Bob Johnson', department: 'Marketing', salary: 75000, hired: new Date('2020-07-22') },
        { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, hired: new Date('2019-11-01') },
        { id: 4, name: 'David Brown', department: 'Sales', salary: 65000, hired: new Date('2022-01-10') },
        { id: 5, name: 'Eve Davis', department: 'HR', salary: 70000, hired: new Date('2021-09-05') },
      ];

      // Listen for state changes (debounced at 100ms)
      grid.addEventListener('column-state-change', (e: Event) => {
        console.log('column-state-change', (e as CustomEvent).detail);
        showStatus('State changed! Click "Save State" to persist.');
      });
    };

    codeSnippet();

    // Button handlers
    controls.querySelector('#save-state')!.addEventListener('click', () => {
      const state = (grid as any).getColumnState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showStatus('✅ State saved to localStorage!');
      console.log('Saved state:', state);
    });

    controls.querySelector('#load-state')!.addEventListener('click', () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        (grid as any).columnState = JSON.parse(saved);
        showStatus('✅ State loaded from localStorage!');
      } else {
        showStatus('⚠️ No saved state found');
      }
    });

    controls.querySelector('#clear-state')!.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      showStatus('🗑️ Saved state cleared');
    });

    controls.querySelector('#reset-state')!.addEventListener('click', () => {
      (grid as any).resetColumnState();
      showStatus('↩️ Reset to default column state');
    });

    // Show initial status if state was restored
    if (localStorage.getItem(STORAGE_KEY)) {
      showStatus('📂 Restored saved state from localStorage');
    }

    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    const jsSnippet = `${extractCode(codeSnippet, {})}

// Save state to localStorage
grid.addEventListener('column-state-change', (e) => {
  localStorage.setItem('my-grid-state', JSON.stringify(e.detail));
});

// Or manually get/set state
const state = grid.getColumnState();
grid.columnState = savedState;

// Reset to initial column config
grid.resetColumnState();`;

    return buildExclusiveGridCodeView(wrapper, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-column-state',
      description: `
        <p><strong>Try these actions:</strong></p>
        <ul>
          <li><strong>Resize columns</strong> — drag column borders</li>
          <li><strong>Sort columns</strong> — click headers</li>
          <li><strong>Hide columns</strong> — right-click header → Hide (if context menu enabled)</li>
        </ul>
        <p>Then <strong>Save State</strong> and reload the page to verify persistence!</p>
        <p>The <code>column-state-change</code> event fires (debounced) after each user change.</p>
      `,
    });
  },
};

// ============================================================================
// SHELL STORIES
// ============================================================================

// Shell-specific columns
const shellColumns: ColumnConfig[] = [
  { field: 'id', header: 'ID', type: 'number', width: 80 },
  { field: 'name', header: 'Name', width: 150 },
  { field: 'department', header: 'Department', width: 150 },
  { field: 'salary', header: 'Salary', type: 'number', width: 120 },
  { field: 'active', header: 'Active', type: 'boolean', width: 80 },
];

// Generate sample data for shell stories
function generateShellRows(count: number) {
  const departments = ['Engineering', 'Sales', 'Marketing', 'Support'];
  const names = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Henry'];
  const rows: any[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      name: names[i % names.length] + ' ' + (Math.floor(i / names.length) + 1),
      department: departments[i % departments.length],
      salary: 50000 + Math.floor(Math.random() * 50000),
      active: i % 3 !== 0,
    });
  }
  return rows;
}

interface ShellArgs {
  showTitle: boolean;
  title: string;
  showVisibilityPlugin: boolean;
  showCustomPanel: boolean;
  panelPosition: 'left' | 'right';
  showHeaderContent: boolean;
  showToolbarButton: boolean;
}

/**
 * ## Shell with Title and Visibility Plugin
 *
 * The shell provides a header bar with:
 * - **Title** (left section)
 * - **Plugin Content** (center section) - where plugins can add UI
 * - **Toolbar** (right section) - panel toggle buttons
 *
 * The VisibilityPlugin automatically registers a tool panel via `getToolPanel()`.
 */
export const ShellBasic: StoryObj<ShellArgs> = {
  argTypes: {
    // Override base argTypes for shell-specific controls
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    fixedHeight: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
    showTitle: {
      control: 'boolean',
      description: 'Show title in shell header',
      table: { category: 'Header' },
    },
    title: {
      control: 'text',
      description: 'Grid title',
      table: { category: 'Header' },
      if: { arg: 'showTitle' },
    },
    showVisibilityPlugin: {
      control: 'boolean',
      description: 'Include VisibilityPlugin (column visibility panel)',
      table: { category: 'Plugins' },
    },
    showCustomPanel: {
      control: 'boolean',
      description: 'Show custom tool panel via API',
      table: { category: 'Panels' },
    },
    panelPosition: {
      control: { type: 'radio' },
      options: ['left', 'right'],
      description: 'Tool panel position',
      table: { category: 'Panels' },
    },
    showHeaderContent: {
      control: 'boolean',
      description: 'Show custom header content (row count)',
      table: { category: 'Header' },
    },
    showToolbarButton: {
      control: 'boolean',
      description: 'Show custom toolbar button',
      table: { category: 'Header' },
    },
  },
  args: {
    showTitle: true,
    title: 'Employee Data',
    showVisibilityPlugin: true,
    showCustomPanel: false,
    panelPosition: 'right',
    showHeaderContent: true,
    showToolbarButton: true,
  },
  render: (args: ShellArgs) => {
    const htmlSnippet = `<tbw-grid style="height: 500px; display: block;"></tbw-grid>`;

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    // Build shell config
    const shellConfig: ShellConfig = {
      header: args.showTitle ? { title: args.title } : {},
      toolPanel: { position: args.panelPosition },
    };

    // Add toolbar button if enabled
    if (args.showToolbarButton) {
      let refreshCount = 0;
      shellConfig.header!.toolbarButtons = [
        {
          id: 'refresh',
          label: 'Refresh Data',
          icon: '↻',
          action: () => {
            refreshCount++;
            console.log(`Refreshed ${refreshCount} times`);
            grid.rows = generateShellRows(20); // Regenerate data
          },
        },
      ];
    }

    // Build gridConfig with plugins
    const plugins: any[] = [];
    if (args.showVisibilityPlugin) {
      plugins.push(new VisibilityPlugin());
    }

    grid.gridConfig = {
      shell: shellConfig,
      plugins,
    };

    grid.columns = shellColumns;
    grid.rows = generateShellRows(20);

    // Register custom header content (row count display)
    if (args.showHeaderContent) {
      grid.registerHeaderContent({
        id: 'row-count',
        order: 10,
        render: (container) => {
          const span = document.createElement('span');
          span.className = 'row-count-display';
          span.style.cssText =
            'font-size: 13px; color: #666; padding: 4px 8px; background: #f0f0f0; border-radius: 4px;';
          span.textContent = `${grid.rows.length} rows`;
          container.appendChild(span);
          return () => span.remove();
        },
      });
    }

    // Register custom tool panel via API
    if (args.showCustomPanel) {
      grid.registerToolPanel({
        id: 'settings',
        title: 'Settings',
        icon: '⚙',
        tooltip: 'Grid settings',
        order: 10, // Before columns panel (100)
        render: (container) => {
          const content = document.createElement('div');
          content.style.cssText = 'padding: 16px;';
          content.innerHTML = `
            <h3 style="margin: 0 0 16px;">Grid Settings</h3>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <input type="checkbox" checked />
              <span>Enable row hover</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <input type="checkbox" checked />
              <span>Show grid lines</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" />
              <span>Compact mode</span>
            </label>
          `;
          container.appendChild(content);
          return () => content.remove();
        },
      });
    }

    const codeSnippet = (__$title$: string, __$position$: string) => {
      const grid = document.querySelector('tbw-grid');
      grid!.gridConfig = {
        shell: {
          header: { title: __$title$ },
          toolPanel: { position: __$position$ },
        },
        plugins: [new VisibilityPlugin()],
      };

      // Register custom header content
      grid!.registerHeaderContent({
        id: 'row-count',
        render: (container) => {
          container.innerHTML = '<span>20 rows</span>';
        },
      });
    };

    const jsSnippet = extractCode(codeSnippet, {
      __$title$: `'${args.title}'`,
      __$position$: `'${args.panelPosition}'`,
    });

    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'shell-basic',
    });
  },
};

/**
 * ## Shell Light DOM Configuration
 *
 * Shell elements can be configured via Light DOM for framework-friendly DX.
 *
 * ```html
 * <tbw-grid>
 *   <tbw-grid-header title="My Grid">
 *     <tbw-grid-header-content slot="header-content">
 *       <span>Custom content</span>
 *     </tbw-grid-header-content>
 *     <tbw-grid-tool-button slot="toolbar" icon="★" label="Star">
 *     </tbw-grid-tool-button>
 *   </tbw-grid-header>
 * </tbw-grid>
 * ```
 */
export const ShellLightDOMConfig: StoryObj = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    fixedHeight: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: () => {
    const htmlSnippet = `
<tbw-grid style="height: 500px; display: block;">
  <tbw-grid-header title="Employee Directory">
    <tbw-grid-header-content>
      <span style="color: #666;">20 employees</span>
    </tbw-grid-header-content>
  </tbw-grid-header>
</tbw-grid>`;

    // Create container with light DOM structure
    const container = document.createElement('div');
    container.innerHTML = `
      <tbw-grid style="height: 500px; display: block;">
        <tbw-grid-header title="Employee Directory">
          <tbw-grid-header-content>
            <span style="color: #666; font-size: 13px; padding: 4px 8px; background: #f0f0f0; border-radius: 4px;">20 employees</span>
          </tbw-grid-header-content>
        </tbw-grid-header>
      </tbw-grid>
    `;

    const grid = container.querySelector('tbw-grid') as GridElement;
    grid.columns = shellColumns;
    grid.rows = generateShellRows(20);

    // Need to register at least one panel to show shell (or enable visibility plugin)
    grid.gridConfig = {
      plugins: [new VisibilityPlugin()],
    };

    const jsSnippet = `
const grid = document.querySelector('tbw-grid');
grid.columns = columns;
grid.rows = rows;
grid.gridConfig = { plugins: [new VisibilityPlugin()] };
`;

    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'shell-light-dom',
    });
  },
};

/**
 * ## Multiple Tool Panels
 *
 * Multiple plugins can register tool panels. The toolbar shows toggle buttons
 * for each panel, sorted by `order`. Clicking a panel button opens it; clicking
 * again (or clicking another) closes it.
 */
export const ShellMultiplePanels: StoryObj = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    fixedHeight: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: () => {
    const htmlSnippet = `<tbw-grid style="height: 500px; display: block;"></tbw-grid>`;

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    grid.gridConfig = {
      shell: {
        header: { title: 'Multi-Panel Demo' },
      },
      plugins: [new VisibilityPlugin()],
    };

    grid.columns = shellColumns;
    grid.rows = generateShellRows(20);

    // Register a filter panel
    grid.registerToolPanel({
      id: 'filter',
      title: 'Filter',
      icon: '🔍',
      tooltip: 'Filter data',
      order: 20,
      render: (container) => {
        const content = document.createElement('div');
        content.style.cssText = 'padding: 16px;';
        content.innerHTML = `
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Name contains</label>
            <input type="text" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;" placeholder="Search...">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Department</label>
            <select style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
              <option value="">All</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Support">Support</option>
            </select>
          </div>
          <button style="width: 100%; padding: 8px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">Apply Filter</button>
        `;
        container.appendChild(content);
        return () => content.remove();
      },
    });

    // Register a settings panel
    grid.registerToolPanel({
      id: 'settings',
      title: 'Settings',
      icon: '⚙',
      tooltip: 'Grid settings',
      order: 50,
      render: (container) => {
        const content = document.createElement('div');
        content.style.cssText = 'padding: 16px;';
        content.innerHTML = `
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <input type="checkbox" checked />
            <span>Row hover effect</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <input type="checkbox" checked />
            <span>Alternating row colors</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" />
            <span>Compact mode</span>
          </label>
        `;
        container.appendChild(content);
        return () => content.remove();
      },
    });

    const jsSnippet = `
const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  shell: { header: { title: 'Multi-Panel Demo' } },
  plugins: [new VisibilityPlugin()],
};

// Register custom panels
grid.registerToolPanel({
  id: 'filter',
  title: 'Filter',
  icon: '🔍',
  order: 20,
  render: (container) => {
    container.innerHTML = '<div>Filter UI here</div>';
  },
});
`;

    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'shell-multi-panel',
    });
  },
};

/**
 * ## Toolbar Buttons
 *
 * Toolbar buttons can be configured via:
 * 1. `gridConfig.shell.header.toolbarButtons` - static config
 * 2. `grid.registerToolbarButton()` - dynamic API
 * 3. Light DOM `<tbw-grid-tool-button>` elements
 */
export const ShellToolbarButtons: StoryObj = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    fixedHeight: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: () => {
    const htmlSnippet = `<tbw-grid style="height: 500px; display: block;"></tbw-grid>`;

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    let exportCount = 0;

    grid.gridConfig = {
      shell: {
        header: {
          title: 'Toolbar Demo',
          toolbarButtons: [
            {
              id: 'export',
              label: 'Export',
              icon: '📥',
              action: () => {
                exportCount++;
                alert(`Export clicked! (${exportCount})`);
              },
            },
            {
              id: 'print',
              label: 'Print',
              icon: '🖨️',
              action: () => window.print(),
            },
          ],
        },
      },
      plugins: [new VisibilityPlugin()],
    };

    grid.columns = shellColumns;
    grid.rows = generateShellRows(20);

    const jsSnippet = `
const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  shell: {
    header: {
      title: 'Toolbar Demo',
      toolbarButtons: [
        { id: 'export', label: 'Export', icon: '📥', action: () => alert('Export!') },
        { id: 'print', label: 'Print', icon: '🖨️', action: () => window.print() },
      ],
    },
  },
  plugins: [new VisibilityPlugin()],
};
`;

    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'shell-toolbar',
    });
  },
};

/**
 * ## Left Panel Position
 *
 * Tool panels can be positioned on the left side of the grid.
 */
export const ShellLeftPanelPosition: StoryObj = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    fixedHeight: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
    editable: { table: { disable: true } },
    editOn: { table: { disable: true } },
  },
  render: () => {
    const htmlSnippet = `<tbw-grid style="height: 500px; display: block;"></tbw-grid>`;

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    grid.gridConfig = {
      shell: {
        header: { title: 'Left Panel Position' },
        toolPanel: {
          position: 'left',
          defaultOpen: 'columns', // Open columns panel by default
        },
      },
      plugins: [new VisibilityPlugin()],
    };

    grid.columns = shellColumns;
    grid.rows = generateShellRows(20);

    const jsSnippet = `
const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  shell: {
    header: { title: 'Left Panel Position' },
    toolPanel: {
      position: 'left',
      defaultOpen: 'columns', // Open by default
    },
  },
  plugins: [new VisibilityPlugin()],
};
`;

    return buildExclusiveGridCodeView(grid, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'shell-left-panel',
    });
  },
};
