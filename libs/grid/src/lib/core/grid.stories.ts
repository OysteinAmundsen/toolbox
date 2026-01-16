import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ColumnConfig, GridConfig, HeaderContentDefinition, ShellConfig, ToolPanelDefinition } from '../../public';
import { FitModeEnum } from '../../public';

// Import from source for HMR
import '../../index';
import { EditingPlugin } from '../plugins/editing';
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
  tags: ['!dev'],
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
      options: ['click', 'dblClick'],
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
    editOn: 'dblClick',
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
  editOn: 'click' | 'dblClick';
}
type Story = StoryObj<GridArgs>;

// Column definitions factory
function buildColumnDefs(
  visibleColumns: ColumnKey[],
  opts: { sortable: boolean; resizable: boolean; editable: boolean },
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');

// Configure grid
grid.fitMode = 'stretch';
grid.editOn = 'dblClick';

grid.columns = [
  { field: 'id', header: 'ID', type: 'number', sortable: true, resizable: true },
  { field: 'name', header: 'Name', sortable: true, resizable: true, editable: true },
  { field: 'active', header: 'Active', type: 'boolean', sortable: true, editable: true },
  { field: 'score', header: 'Score', type: 'number', sortable: true, resizable: true, editable: true },
  { field: 'created', header: 'Created', type: 'date', sortable: true, resizable: true },
  {
    field: 'role',
    header: 'Role',
    type: 'select',
    sortable: true,
    editable: true,
    options: [
      { label: 'Admin', value: 'admin' },
      { label: 'User', value: 'user' },
      { label: 'Guest', value: 'guest' },
    ],
  },
];

grid.rows = generateRows(100);

// Listen for cell edits
grid.addEventListener('cell-commit', (e) => {
  console.log('cell-commit:', e.detail.field, '=', e.detail.newValue);
});
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: GridArgs) => {
    const effectiveHeight = args.fixedHeight ? args.height : 'auto';

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = `height: ${effectiveHeight}; display: block;`;

    // Build columns from selected options
    const columns = buildColumnDefs(args.visibleColumns, {
      sortable: args.sortable,
      resizable: args.resizable,
      editable: args.editable,
    });

    // Set props BEFORE grid is connected to DOM for single render pass
    grid.fitMode = args.fitMode;
    grid.gridConfig = {
      columns,
      plugins: [
        new EditingPlugin({
          editOn: args.editOn === 'click' ? 'click' : 'dblclick',
        }),
      ],
    };
    grid.rows = generateRows(args.rowCount);

    grid.addEventListener('cell-commit', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('cell-commit:', detail.field, '=', detail.newValue);
    });

    return grid;
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- Option 1: Pure HTML with JSON attributes (simplest!) -->
<tbw-grid
  style="height: 300px;"
  rows='[
    {"id":1,"name":"Alice","score":95,"active":true},
    {"id":2,"name":"Bob","score":82,"active":false},
    {"id":3,"name":"Carol","score":91,"active":true}
  ]'>
</tbw-grid>

<!-- Option 2: JavaScript property assignment -->
<tbw-grid id="my-grid" style="height: 300px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';

const grid = document.querySelector('#my-grid');

// No columns defined - they're inferred from the data!
grid.rows = [
  { id: 1, name: 'Alice', score: 95, active: true, joined: new Date('2023-01-15') },
  { id: 2, name: 'Bob', score: 82, active: false, joined: new Date('2023-06-20') },
  { id: 3, name: 'Carol', score: 91, active: true, joined: new Date('2024-02-10') },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';

    // No columns defined - they're inferred from the data!
    grid.rows = [
      { id: 1, name: 'Alice', score: 95, active: true, joined: new Date('2023-01-15') },
      { id: 2, name: 'Bob', score: 82, active: false, joined: new Date('2023-06-20') },
      { id: 3, name: 'Carol', score: 91, active: true, joined: new Date('2024-02-10') },
    ];

    return grid;
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid>
  <tbw-grid-column field="name" header="Name" sortable editable resizable></tbw-grid-column>
  <tbw-grid-column field="score" header="Score" type="number" sortable editable></tbw-grid-column>
  <tbw-grid-column field="role" header="Role" type="select" editable options="admin:Admin,user:User,guest:Guest"></tbw-grid-column>
</tbw-grid>

<script type="module">
import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');
// Only rows needed - columns are defined in HTML
grid.rows = [
  { name: 'Alice', score: 95, role: 'admin' },
  { name: 'Bob', score: 82, role: 'user' },
  { name: 'Carol', score: 91, role: 'guest' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: GridArgs) => {
    const host = document.createElement('div');
    host.innerHTML = `
<tbw-grid style="height: 300px;">
  <tbw-grid-column field="name" header="Name" sortable ${args.editable ? 'editable' : ''} resizable></tbw-grid-column>
  <tbw-grid-column field="score" header="Score" type="number" sortable ${args.editable ? 'editable' : ''}></tbw-grid-column>
  <tbw-grid-column field="role" header="Role" type="select" ${args.editable ? 'editable' : ''} options="admin:Admin,user:User,guest:Guest"></tbw-grid-column>
</tbw-grid>`;
    const grid = host.querySelector('tbw-grid') as GridElement;

    // Only rows needed - columns are defined in HTML
    grid.rows = [
      { name: 'Alice', score: 95, role: 'admin' },
      { name: 'Bob', score: 82, role: 'user' },
      { name: 'Carol', score: 91, role: 'guest' },
    ];

    return grid;
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');

grid.columns = [
  { field: 'name', header: 'Name' },
  {
    field: 'score',
    header: 'Score',
    type: 'number',
    // Simple format function
    format: (value) => \`\${value} pts\`,
  },
  {
    field: 'status',
    header: 'Status',
    // viewRenderer for custom HTML
    viewRenderer: ({ value }) => {
      const color = value === 'active' ? 'green' : value === 'pending' ? 'orange' : 'gray';
      return \`<span style="color: \${color}; font-weight: bold;">● \${value}</span>\`;
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
      bar.innerHTML = \`<div style="width:\${value}%;height:100%;background:#4caf50"></div>\`;
      return bar;
    },
  },
];

grid.rows = [
  { name: 'Project A', score: 85, status: 'active', progress: 75 },
  { name: 'Project B', score: 62, status: 'pending', progress: 40 },
  { name: 'Project C', score: 91, status: 'completed', progress: 100 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';

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

    return grid;
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

    return wrapper;
  },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
import '@toolbox-web/grid';

const STORAGE_KEY = 'my-grid-state';
const grid = document.querySelector('tbw-grid');

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

grid.rows = [...];

// Listen for state changes
grid.addEventListener('column-state-change', (e) => {
  console.log('column-state-change', e.detail);
});

// Save state to localStorage
const state = grid.getColumnState();
localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

// Load state from localStorage
grid.columnState = JSON.parse(localStorage.getItem(STORAGE_KEY));

// Reset to initial column config
grid.resetColumnState();
</script>
`,
        language: 'html',
      },
    },
  },
};

// #region Shell Stories

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

    return grid;
  },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  shell: {
    header: { title: 'Employee Data' },
    toolPanel: { position: 'right' },
  },
  plugins: [new VisibilityPlugin()],
};

grid.columns = [...];
grid.rows = [...];

// Register custom header content
grid.registerHeaderContent({
  id: 'row-count',
  render: (container) => {
    container.innerHTML = '<span>20 rows</span>';
  },
});
</script>
`,
        language: 'html',
      },
    },
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 500px; display: block;">
  <tbw-grid-header title="Employee Directory">
    <tbw-grid-header-content>
      <span style="color: #666;">20 employees</span>
    </tbw-grid-header-content>
  </tbw-grid-header>
</tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');
grid.columns = columns;
grid.rows = rows;
grid.gridConfig = { plugins: [new VisibilityPlugin()] };
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
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

    return grid;
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

    return grid;
  },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 500px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  shell: { header: { title: 'Multi-Panel Demo' } },
  plugins: [new VisibilityPlugin()], // Adds "Columns" panel
};

grid.columns = [...];
grid.rows = [...];

// Register custom "Filter" panel
grid.registerToolPanel({
  id: 'filter',
  title: 'Filter',
  icon: '🔍',
  tooltip: 'Filter data',
  order: 20,
  render: (container) => {
    container.innerHTML = '<div style="padding: 16px;">Filter UI here</div>';
    return () => container.innerHTML = '';
  },
});

// Register custom "Settings" panel
grid.registerToolPanel({
  id: 'settings',
  title: 'Settings',
  icon: '⚙',
  tooltip: 'Grid settings',
  order: 50,
  render: (container) => {
    container.innerHTML = \`
      <div style="padding: 16px;">
        <label><input type="checkbox" checked /> Row hover effect</label><br/>
        <label><input type="checkbox" checked /> Alternating row colors</label>
      </div>
    \`;
    return () => container.innerHTML = '';
  },
});
</script>
`,
        language: 'html',
      },
    },
  },
};

/**
 * ## Toolbar Buttons
 *
 * Toolbar buttons are provided via light-DOM HTML using the `<tbw-grid-tool-buttons>` container.
 * The grid does NOT create buttons - developers have full control over button HTML.
 *
 * Put your buttons inside the container element:
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML - Toolbar buttons via light-DOM container -->
<tbw-grid>
  <tbw-grid-header title="Toolbar Demo"></tbw-grid-header>
  <tbw-grid-tool-buttons>
    <button class="tbw-toolbar-btn" title="Export" aria-label="Export">📥</button>
    <button class="tbw-toolbar-btn" title="Print" aria-label="Print">🖨️</button>
  </tbw-grid-tool-buttons>
</tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');

// Add click handlers
const exportBtn = grid.querySelector('[title="Export"]');
exportBtn.addEventListener('click', () => alert('Export!'));

const printBtn = grid.querySelector('[title="Print"]');
printBtn.addEventListener('click', () => window.print());

grid.gridConfig = {
  plugins: [new VisibilityPlugin()],
};

grid.columns = [...];
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    let exportCount = 0;

    // Create header for title
    const header = document.createElement('tbw-grid-header');
    header.setAttribute('title', 'Toolbar Demo');
    grid.appendChild(header);

    // Create toolbar buttons container
    const toolButtons = document.createElement('tbw-grid-tool-buttons');

    const exportBtn = document.createElement('button');
    exportBtn.className = 'tbw-toolbar-btn';
    exportBtn.title = 'Export';
    exportBtn.setAttribute('aria-label', 'Export');
    exportBtn.textContent = '📥';
    exportBtn.onclick = () => {
      exportCount++;
      alert(`Export clicked! (${exportCount})`);
    };

    const printBtn = document.createElement('button');
    printBtn.className = 'tbw-toolbar-btn';
    printBtn.title = 'Print';
    printBtn.setAttribute('aria-label', 'Print');
    printBtn.textContent = '🖨️';
    printBtn.onclick = () => window.print();

    toolButtons.appendChild(exportBtn);
    toolButtons.appendChild(printBtn);
    grid.appendChild(toolButtons);

    grid.gridConfig = {
      plugins: [new VisibilityPlugin()],
    };

    grid.columns = shellColumns;
    grid.rows = generateShellRows(20);

    return grid;
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
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

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

grid.columns = [...];
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
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

    return grid;
  },
};

// #endregion
