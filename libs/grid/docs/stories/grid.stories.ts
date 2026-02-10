import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type {
  ColumnConfig,
  GridConfig,
  HeaderContentDefinition,
  ShellConfig,
  ToolPanelDefinition,
} from '../../src/public';
import { FitModeEnum } from '../../src/public';

// Import from source for HMR
import '../../src/index';
import { EditingPlugin } from '../../src/lib/plugins/editing';
import { VisibilityPlugin } from '../../src/lib/plugins/visibility';

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
      description: 'Grid-wide toggle to enable/disable column sorting',
      table: { category: 'Features' },
    },
    resizable: {
      control: 'boolean',
      description: 'Grid-wide toggle to enable/disable column resizing',
      table: { category: 'Features' },
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
}
type Story = StoryObj<GridArgs>;

// Mutable ref so source.transform always reads the latest args
let currentPlaygroundArgs: GridArgs = {
  rowCount: 100,
  fitMode: 'stretch',
  fixedHeight: true,
  height: '500px',
  visibleColumns: [...ALL_COLUMNS],
  sortable: true,
  resizable: true,
};

function getPlaygroundSourceCode(args: GridArgs): string {
  const colEntries = args.visibleColumns.map((key) => {
    const props: string[] = [`field: '${key}'`];
    const headers: Record<string, string> = {
      id: 'ID',
      name: 'Name',
      active: 'Active',
      score: 'Score',
      created: 'Created',
      role: 'Role',
    };
    props.push(`header: '${headers[key]}'`);
    if (key === 'id' || key === 'score') props.push(`type: 'number'`);
    else if (key === 'active') props.push(`type: 'boolean'`);
    else if (key === 'created') props.push(`type: 'date'`);
    else if (key === 'role') props.push(`type: 'select'`);
    return `    { ${props.join(', ')} }`;
  });
  const heightLine = args.fixedHeight ? `\ngrid.style.height = '${args.height}';` : '';

  // Grid-wide config properties
  const configParts: string[] = [];
  configParts.push(`  columns: [\n${colEntries.join(',\n')}\n  ]`);
  if (!args.sortable) configParts.push(`  sortable: false`);
  if (!args.resizable) configParts.push(`  resizable: false`);

  return `import '@toolbox-web/grid';

const grid = document.querySelector('tbw-grid');${heightLine}
grid.fitMode = '${args.fitMode}';
grid.gridConfig = {
${configParts.join(',\n')},
};
grid.rows = generateRows(${args.rowCount});`;
}

// Column definitions factory
function buildColumnDefs(visibleColumns: ColumnKey[], opts: { sortable: boolean; resizable: boolean }): ColumnConfig[] {
  const columnDefs: Record<ColumnKey, ColumnConfig> = {
    id: { field: 'id', header: 'ID', type: 'number', sortable: opts.sortable, resizable: opts.resizable },
    name: {
      field: 'name',
      header: 'Name',
      sortable: opts.sortable,
      resizable: opts.resizable,
    },
    active: { field: 'active', header: 'Active', type: 'boolean', sortable: opts.sortable },
    score: {
      field: 'score',
      header: 'Score',
      type: 'number',
      sortable: opts.sortable,
      resizable: opts.resizable,
    },
    created: { field: 'created', header: 'Created', type: 'date', sortable: opts.sortable, resizable: opts.resizable },
    role: {
      field: 'role',
      header: 'Role',
      type: 'select',
      sortable: opts.sortable,
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
 * - Tab/Shift+Tab: Move to next/previous cell
 * - Home/End: Jump to first/last column
 * - Ctrl+Home/End: Jump to first/last row
 * - Page Up/Down: Scroll by page
 */
export const Playground: Story = {
  parameters: {
    docs: {
      source: {
        language: 'typescript',
        transform: () => getPlaygroundSourceCode(currentPlaygroundArgs),
      },
    },
  },
  render: (args: GridArgs) => {
    currentPlaygroundArgs = args;

    const effectiveHeight = args.fixedHeight ? args.height : 'auto';

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = `height: ${effectiveHeight}; display: block;`;

    // Build columns from selected options
    const columns = buildColumnDefs(args.visibleColumns, {
      sortable: true, // Column-level always enabled; grid-level toggle controls actual behavior
      resizable: true, // Column-level always enabled; grid-level toggle controls actual behavior
    });

    // Set props BEFORE grid is connected to DOM for single render pass
    grid.fitMode = args.fitMode;
    grid.gridConfig = {
      typeDefaults: {
        date: {
          format: (val: Date) =>
            val.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }),
        },
      },
      columns,
      sortable: args.sortable, // Grid-wide toggle
      resizable: args.resizable, // Grid-wide toggle
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
  },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid>
  <tbw-grid-column field="name" header="Name" sortable resizable></tbw-grid-column>
  <tbw-grid-column field="score" header="Score" type="number" sortable></tbw-grid-column>
  <tbw-grid-column field="role" header="Role" type="select" options="admin:Admin,user:User,guest:Guest"></tbw-grid-column>
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
  render: () => {
    const host = document.createElement('div');
    host.innerHTML = `
<tbw-grid style="height: 300px;">
  <tbw-grid-column field="name" header="Name" sortable resizable></tbw-grid-column>
  <tbw-grid-column field="score" header="Score" type="number" sortable></tbw-grid-column>
  <tbw-grid-column field="role" header="Role" type="select" options="admin:Admin,user:User,guest:Guest"></tbw-grid-column>
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
 * ## Custom Renderers
 *
 * Use `viewRenderer` for full control over cell rendering.
 * Renderers can return HTML strings or DOM elements.
 */
export const CustomRenderers: Story = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
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
    wrapper.style.cssText = 'height: 100%; display: flex; flex-direction: column; gap: 16px;';

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
  { field: 'name', header: 'Name', minWidth: 150 },
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

let currentShellArgs: ShellArgs = {} as ShellArgs;

function getShellSourceCode(args: ShellArgs): string {
  const imports = [`import '@toolbox-web/grid';`];
  if (args.showVisibilityPlugin) {
    imports.push(`import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';`);
  }

  const headerParts: string[] = [];
  if (args.showTitle) {
    headerParts.push(`title: '${args.title}'`);
  }
  const headerLine = headerParts.length > 0 ? `\n    header: { ${headerParts.join(', ')} },` : '';

  const toolPanelLine = args.panelPosition !== 'right' ? `\n    toolPanel: { position: '${args.panelPosition}' },` : '';

  const shellBlock = headerLine || toolPanelLine ? `\n  shell: {${headerLine}${toolPanelLine}\n  },` : '';

  const pluginsLine = args.showVisibilityPlugin ? `\n  plugins: [new VisibilityPlugin()],` : '';

  const extras: string[] = [];
  if (args.showHeaderContent) {
    extras.push(`
// Register custom header content
grid.registerHeaderContent({
  id: 'row-count',
  render: (container) => {
    container.innerHTML = '<span>20 rows</span>';
  },
});`);
  }
  if (args.showCustomPanel) {
    extras.push(`
// Register custom tool panel
grid.registerToolPanel({
  id: 'settings',
  title: 'Settings',
  icon: '⚙',
  tooltip: 'Grid settings',
  order: 10,
  render: (container) => {
    container.innerHTML = '<div>Custom settings panel</div>';
    return () => container.innerHTML = '';
  },
});`);
  }
  if (args.showToolbarButton) {
    extras.push(`
// Add toolbar button via light DOM
const toolButtons = document.createElement('tbw-grid-tool-buttons');
const refreshBtn = document.createElement('button');
refreshBtn.className = 'tbw-toolbar-btn';
refreshBtn.title = 'Refresh Data';
refreshBtn.textContent = '↻';
refreshBtn.onclick = () => { grid.rows = generateRows(20); };
toolButtons.appendChild(refreshBtn);
grid.appendChild(toolButtons);`);
  }

  return `<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
${imports.join('\n')}

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {${shellBlock}${pluginsLine}
};

grid.columns = [...];
grid.rows = [...];
${extras.join('\n')}
</script>
`;
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
    currentShellArgs = args;
    const htmlSnippet = `<tbw-grid style="height: 500px; display: block;"></tbw-grid>`;

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    // Build shell config
    const shellConfig: ShellConfig = {
      header: args.showTitle ? { title: args.title } : {},
      toolPanel: { position: args.panelPosition },
    };

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

    // Add toolbar button via light DOM if enabled
    if (args.showToolbarButton) {
      let refreshCount = 0;
      const toolButtons = document.createElement('tbw-grid-tool-buttons');
      const refreshBtn = document.createElement('button');
      refreshBtn.className = 'tbw-toolbar-btn';
      refreshBtn.title = 'Refresh Data';
      refreshBtn.setAttribute('aria-label', 'Refresh Data');
      refreshBtn.textContent = '↻';
      refreshBtn.onclick = () => {
        refreshCount++;
        console.log(`Refreshed ${refreshCount} times`);
        grid.rows = generateShellRows(20);
      };
      toolButtons.appendChild(refreshBtn);
      grid.appendChild(toolButtons);
    }

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
          content.style.cssText = '';
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
        transform: () => getShellSourceCode(currentShellArgs),
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

const grid = document.querySelector('tbw-grid');
grid.columns = columns;
grid.rows = rows;
// Shell renders automatically from light DOM - no plugins needed!
// Add plugins like VisibilityPlugin if you want a tool panel sidebar.
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

    // Shell renders automatically when <tbw-grid-header> is present in light DOM.
    // No plugins needed - the shell displays header, title, and content without tool panels.

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
        content.style.cssText = 'padding: 0.75rem;';
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
        content.style.cssText = 'padding: 0.75rem;';
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
    container.innerHTML = '<div>Filter UI here</div>';
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
      <div>
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

const grid = document.querySelector('tbw-grid');

// Add click handlers
const exportBtn = grid.querySelector('[title="Export"]');
exportBtn.addEventListener('click', () => alert('Export!'));

const printBtn = grid.querySelector('[title="Print"]');
printBtn.addEventListener('click', () => window.print());

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

// #region Dynamic Classes

// #region Events
/**
 * ## Core Grid Events
 *
 * The grid emits events for core interactions. This demo shows:
 * - `cell-click` / `row-click` - User interaction events
 * - `cell-activate` - Keyboard navigation events
 * - `sort-change` - Column sorting events
 * - `column-resize` - Column width change events
 * - `column-state-change` - Visibility/order/width state events
 *
 * For editing events (`cell-commit`, `row-commit`), see the Editing Plugin.
 */
export const CoreEvents: Story = {
  parameters: {
    docs: {
      source: {
        code: `
const grid = document.querySelector('tbw-grid');

// Cell clicked
grid.addEventListener('cell-click', (e) => {
  console.log('Cell:', e.detail.field, '=', e.detail.value);
});

// Row clicked
grid.addEventListener('row-click', (e) => {
  console.log('Row:', e.detail.rowIndex);
});

// Keyboard navigation activated a cell
grid.addEventListener('cell-activate', (e) => {
  console.log('Activated:', e.detail.rowIndex, e.detail.colIndex);
});

// Sort changed
grid.addEventListener('sort-change', (e) => {
  console.log('Sort:', e.detail.field, e.detail.direction);
});

// Column resized
grid.addEventListener('column-resize', (e) => {
  console.log('Resize:', e.detail.field, e.detail.width);
});

// Column state changed (visibility, order, widths)
grid.addEventListener('column-state-change', (e) => {
  console.log('State:', e.detail);
});
        `,
        language: 'typescript',
      },
    },
  },
  render: () => {
    const sampleData = [
      { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 85000 },
      { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 72000 },
      { id: 3, name: 'Carol White', department: 'Sales', salary: 68000 },
      { id: 4, name: 'David Brown', department: 'Engineering', salary: 92000 },
      { id: 5, name: 'Eve Davis', department: 'HR', salary: 65000 },
    ];

    const container = document.createElement('div');
    container.style.cssText = 'display: grid; grid-template-columns: 1fr 320px; gap: 16px;';

    // Grid
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.id = 'events-demo-grid';
    grid.style.height = '350px';
    grid.rows = sampleData;
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 60, sortable: true },
        { field: 'name', header: 'Name', sortable: true, resizable: true },
        { field: 'department', header: 'Department', sortable: true, resizable: true },
        { field: 'salary', header: 'Salary', type: 'number', sortable: true, resizable: true },
      ],
    } as GridConfig;

    // Event log panel
    const logPanel = document.createElement('div');
    logPanel.style.cssText =
      'border: 1px solid var(--sb-border); padding: 12px; border-radius: 4px; background: var(--sbdocs-bg); overflow-y: auto; max-height: 350px;';
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
        // Keep only last 20 entries
        while (log.children.length > 20) {
          log.lastChild?.remove();
        }
      };

      clearBtn?.addEventListener('click', () => {
        log.innerHTML = '';
      });

      grid.addEventListener('cell-click', (e: any) => {
        addLog('cell-click', `row ${e.detail.rowIndex}, field="${e.detail.field}", value="${e.detail.value}"`);
      });

      grid.addEventListener('row-click', (e: any) => {
        addLog('row-click', `row ${e.detail.rowIndex}`);
      });

      grid.addEventListener('cell-activate', (e: any) => {
        addLog('cell-activate', `row ${e.detail.rowIndex}, col ${e.detail.colIndex}`);
      });

      grid.addEventListener('sort-change', (e: any) => {
        const dir = e.detail.direction === 1 ? 'asc' : e.detail.direction === -1 ? 'desc' : 'none';
        addLog('sort-change', `field="${e.detail.field}", direction=${dir}`);
      });

      grid.addEventListener('column-resize', (e: any) => {
        addLog('column-resize', `field="${e.detail.field}", width=${e.detail.width}px`);
      });

      grid.addEventListener('column-state-change', (e: any) => {
        const state = e.detail;
        const widthCount = Object.keys(state.widths || {}).length;
        addLog('column-state-change', `${widthCount} widths, ${state.order?.length || 0} ordered`);
      });
    }, 50);

    return container;
  },
};
// #endregion

// #region Dynamic Styling
/**
 * ## Row Class Callback
 *
 * Use the `rowClass` callback to apply dynamic CSS classes to rows based on row data.
 * Perfect for conditional row styling like highlighting inactive users or priority items.
 *
 * In this example:
 * - Inactive rows have a red tint
 * - Admin rows have a blue tint
 */
export const RowClass: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<tbw-grid id="grid"></tbw-grid>
<script>
  const grid = document.getElementById('grid');
  grid.gridConfig = {
    rowClass: (row) => {
      const classes = [];
      if (!row.active) classes.push('row-inactive');
      if (row.role === 'admin') classes.push('row-admin');
      return classes;
    },
  };
  grid.rows = data;
</script>
<style>
  .row-inactive { background-color: rgba(255, 100, 100, 0.15); }
  .row-admin { background-color: rgba(100, 150, 255, 0.15); }
</style>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 400px; display: block;';

    // Add custom styles with light-dark() for theme support
    const style = document.createElement('style');
    style.textContent = `
      .row-inactive { background-color: light-dark(rgba(255, 100, 100, 0.15), rgba(255, 120, 120, 0.25)); }
      .row-admin { background-color: light-dark(rgba(100, 150, 255, 0.15), rgba(120, 160, 255, 0.25)); }
      /* Combined: admin and inactive */
      .row-inactive.row-admin { background-color: light-dark(rgba(200, 100, 200, 0.2), rgba(220, 120, 220, 0.3)); }
    `;

    grid.gridConfig = {
      rowClass: (row: any) => {
        const classes: string[] = [];
        if (!row.active) classes.push('row-inactive');
        if (row.role === 'admin') classes.push('row-admin');
        return classes;
      },
    };

    grid.columns = [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name' },
      { field: 'role', header: 'Role', width: 100 },
      { field: 'active', header: 'Active', type: 'boolean', width: 80 },
    ];
    grid.rows = generateRows(20);

    const wrapper = document.createElement('div');
    wrapper.appendChild(style);
    wrapper.appendChild(grid);
    return wrapper;
  },
};

/**
 * ## Cell Class Callback
 *
 * Use the `cellClass` column property to apply dynamic CSS classes to individual cells.
 * Perfect for conditional cell styling like data validation or value-based formatting.
 *
 * In this example:
 * - Score cells below 30 are red (low)
 * - Score cells 30-70 are yellow (medium)
 * - Score cells above 70 are green (high)
 */
export const CellClass: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<tbw-grid id="grid"></tbw-grid>
<script>
  grid.columns = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name' },
    {
      field: 'score',
      header: 'Score',
      cellClass: (value) => {
        if (value < 30) return ['score-low'];
        if (value > 70) return ['score-high'];
        return ['score-medium'];
      },
    },
  ];
</script>
<style>
  .score-low { background-color: rgba(255, 100, 100, 0.3); color: #a00; }
  .score-medium { background-color: rgba(255, 200, 100, 0.3); color: #850; }
  .score-high { background-color: rgba(100, 200, 100, 0.3); color: #060; }
</style>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 400px; display: block;';

    // Add custom styles with light-dark() for theme support
    const style = document.createElement('style');
    style.textContent = `
      .score-low { background-color: light-dark(rgba(255, 100, 100, 0.3), rgba(255, 120, 120, 0.35)); color: light-dark(#a00, #f88); font-weight: 500; }
      .score-medium { background-color: light-dark(rgba(255, 200, 100, 0.3), rgba(255, 210, 120, 0.35)); color: light-dark(#850, #fc6); }
      .score-high { background-color: light-dark(rgba(100, 200, 100, 0.3), rgba(120, 220, 120, 0.35)); color: light-dark(#060, #8f8); font-weight: 500; }
    `;

    grid.columns = [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name' },
      {
        field: 'score',
        header: 'Score',
        width: 100,
        cellClass: (value: number) => {
          if (value < 30) return ['score-low'];
          if (value > 70) return ['score-high'];
          return ['score-medium'];
        },
      },
      { field: 'role', header: 'Role', width: 100 },
    ];
    grid.rows = generateRows(20);

    const wrapper = document.createElement('div');
    wrapper.appendChild(style);
    wrapper.appendChild(grid);
    return wrapper;
  },
};

/**
 * ## Combined Row and Cell Classes
 *
 * You can use both `rowClass` and `cellClass` together for comprehensive styling.
 *
 * In this example:
 * - Rows are styled based on active status
 * - Score cells have gradient colors based on value
 * - Role cells have badges styled by role type
 */
export const CombinedDynamicClasses: Story = {
  parameters: {
    docs: {
      source: {
        code: `
grid.gridConfig = {
  rowClass: (row) => row.active ? [] : ['row-inactive'],
};
grid.columns = [
  { field: 'score', cellClass: (v) => v > 70 ? ['score-high'] : [] },
  { field: 'role', cellClass: (_, row) => [\`role-\${row.role}\`] },
];
`,
        language: 'javascript',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 400px; display: block;';

    const style = document.createElement('style');
    style.textContent = `
      .row-inactive { opacity: 0.6; }
      .score-high { background: light-dark(
        linear-gradient(90deg, rgba(100,200,100,0.3) 0%, transparent 100%),
        linear-gradient(90deg, rgba(120,220,120,0.35) 0%, transparent 100%)
      ); }
      .role-admin { background: light-dark(rgba(100,150,255,0.2), rgba(120,170,255,0.3)); font-weight: 600; }
      .role-user { background: light-dark(rgba(100,200,100,0.2), rgba(120,220,120,0.3)); }
      .role-guest { background: light-dark(rgba(200,200,200,0.2), rgba(180,180,180,0.25)); font-style: italic; }
    `;

    grid.gridConfig = {
      rowClass: (row: any) => (row.active ? [] : ['row-inactive']),
    };

    grid.columns = [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name' },
      {
        field: 'score',
        header: 'Score',
        width: 100,
        cellClass: (value: number) => (value > 70 ? ['score-high'] : []),
      },
      {
        field: 'role',
        header: 'Role',
        width: 100,
        cellClass: (_: any, row: any) => [`role-${row.role}`],
      },
      { field: 'active', header: 'Active', type: 'boolean', width: 80 },
    ];
    grid.rows = generateRows(20);

    const wrapper = document.createElement('div');
    wrapper.appendChild(style);
    wrapper.appendChild(grid);
    return wrapper;
  },
};

// #endregion

// #region Row Animation

type AnimationGridElement = GridElement & {
  animateRow: (rowIndex: number, type: 'change' | 'insert' | 'remove') => void;
  animateRows: (rowIndices: number[], type: 'change' | 'insert' | 'remove') => void;
};

/**
 * ## Row Animation Demo
 *
 * Demonstrates the Row Animation API with live examples of all animation types.
 *
 * **Features:**
 * - **Change Animation**: Flash highlight when row data is modified
 * - **Insert Animation**: Slide-in effect when new rows are added
 * - **Remove Animation**: Fade-out effect before row removal
 *
 * **Controls:**
 * - Use the buttons above the grid to trigger animations
 * - Toggle auto-simulation to see random changes at intervals
 */
export const RowAnimation: Story = {
  argTypes: {
    rowCount: { table: { disable: true } },
    fitMode: { table: { disable: true } },
    height: { table: { disable: true } },
    fixedHeight: { table: { disable: true } },
    visibleColumns: { table: { disable: true } },
    sortable: { table: { disable: true } },
    resizable: { table: { disable: true } },
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
  { field: 'id', header: 'ID', width: 60 },
  { field: 'name', header: 'Name' },
  { field: 'score', header: 'Score', type: 'number' },
  { field: 'status', header: 'Status' },
];

grid.rows = [...];

// Animate a single row (change highlight)
grid.animateRow(2, 'change');

// Animate multiple rows
grid.animateRows([0, 3, 5], 'change');

// Animate newly inserted row
grid.rows = [...grid.rows, newRow];
grid.animateRow(grid.rows.length - 1, 'insert');

// Customize animation via CSS
// tbw-grid {
//   --tbw-row-change-duration: 750ms;
//   --tbw-row-change-color: rgba(34, 197, 94, 0.25);
// }
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';

    // Control panel
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';

    // Create styled button helper
    const createButton = (text: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid var(--tbw-color-border);
        border-radius: 4px;
        background: var(--tbw-color-bg);
        color: var(--tbw-color-fg);
        cursor: pointer;
        font-size: 14px;
      `;
      btn.addEventListener('click', onClick);
      return btn;
    };

    const grid = document.createElement('tbw-grid') as AnimationGridElement;
    grid.style.height = '400px';
    grid.style.display = 'block';

    // Generate initial data
    const statuses = ['Active', 'Pending', 'Complete', 'Error'];
    let rowData = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Row ${i + 1}`,
      score: Math.floor(Math.random() * 100),
      status: statuses[Math.floor(Math.random() * statuses.length)],
    }));

    // Helper to delete a row by id with animation
    const deleteRow = (id: number) => {
      const idx = rowData.findIndex((r) => r.id === id);
      if (idx < 0) return;
      grid.animateRow(idx, 'remove');
      setTimeout(() => {
        rowData = rowData.filter((r) => r.id !== id);
        grid.rows = rowData;
        // Clean up stale remove animation attributes after re-render
        requestAnimationFrame(() => {
          grid.querySelectorAll('[data-animating="remove"]').forEach((el) => {
            el.removeAttribute('data-animating');
          });
        });
      }, 250);
    };

    // Helper to insert a row after a given id with animation
    let insertCounter = rowData.length;
    const insertRowAfter = (afterId: number) => {
      const idx = rowData.findIndex((r) => r.id === afterId);
      if (idx < 0) return;
      insertCounter++;
      const newRow = {
        id: insertCounter,
        name: `New Row ${insertCounter}`,
        score: Math.floor(Math.random() * 100),
        status: 'Pending',
      };
      rowData = [...rowData.slice(0, idx + 1), newRow, ...rowData.slice(idx + 1)];
      grid.rows = rowData;
      requestAnimationFrame(() => {
        grid.animateRow(idx + 1, 'insert');
      });
    };

    grid.columns = [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name', width: 150 },
      { field: 'score', header: 'Score', type: 'number', width: 100 },
      { field: 'status', header: 'Status', width: 120 },
      {
        field: '_actions',
        header: 'Actions',
        width: 100,
        sortable: false,
        viewRenderer: ({ row }) => {
          const wrapper = document.createElement('span');
          wrapper.style.cssText = 'display: flex; gap: 4px;';

          // Insert button
          const insertBtn = document.createElement('button');
          insertBtn.textContent = '➕';
          insertBtn.title = 'Insert row below';
          insertBtn.style.cssText =
            'cursor: pointer; padding: 2px 6px; border: none; background: none; font-size: 14px;';
          insertBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            insertRowAfter(row.id);
          });
          wrapper.appendChild(insertBtn);

          // Delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = '🗑️';
          deleteBtn.title = 'Delete row';
          deleteBtn.style.cssText =
            'cursor: pointer; padding: 2px 6px; border: none; background: none; font-size: 14px;';
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRow(row.id);
          });
          wrapper.appendChild(deleteBtn);

          return wrapper;
        },
      },
    ];
    grid.rows = rowData;
    grid.fitMode = 'stretch';

    // Button: Animate random row (change)
    controls.appendChild(
      createButton('🔄 Change Random Row', () => {
        const idx = Math.floor(Math.random() * rowData.length);
        rowData[idx].score = Math.floor(Math.random() * 100);
        grid.rows = [...rowData];
        grid.animateRow(idx, 'change');
      }),
    );

    // Button: Animate multiple rows
    controls.appendChild(
      createButton('🔄 Change 3 Rows', () => {
        const indices: number[] = [];
        while (indices.length < 3 && indices.length < rowData.length) {
          const idx = Math.floor(Math.random() * rowData.length);
          if (!indices.includes(idx)) {
            indices.push(idx);
            rowData[idx].score = Math.floor(Math.random() * 100);
          }
        }
        grid.rows = [...rowData];
        grid.animateRows(indices, 'change');
      }),
    );

    // Button: Insert new row at top
    controls.appendChild(
      createButton('➕ Insert at Top', () => {
        insertCounter++;
        const newRow = {
          id: insertCounter,
          name: `New Row ${insertCounter}`,
          score: Math.floor(Math.random() * 100),
          status: 'Pending',
        };
        rowData = [newRow, ...rowData];
        grid.rows = rowData;
        // Wait for render, then animate the first row (index 0)
        requestAnimationFrame(() => {
          grid.animateRow(0, 'insert');
        });
      }),
    );

    // Separator
    const separator = document.createElement('span');
    separator.style.cssText = 'width: 1px; height: 24px; background: var(--tbw-color-border); margin: 0 8px;';
    controls.appendChild(separator);

    // Auto-simulation toggle
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const autoBtn = createButton('▶️ Start Auto-Simulation', () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        autoBtn.textContent = '▶️ Start Auto-Simulation';
      } else {
        intervalId = setInterval(() => {
          const action = Math.random();
          if (action < 0.6) {
            // 60% chance: change random row
            const idx = Math.floor(Math.random() * rowData.length);
            rowData[idx].score = Math.floor(Math.random() * 100);
            rowData[idx].status = statuses[Math.floor(Math.random() * statuses.length)];
            grid.rows = [...rowData];
            grid.animateRow(idx, 'change');
          } else if (action < 0.8 && rowData.length < 25) {
            // 20% chance: insert row
            insertCounter++;
            const newRow = {
              id: insertCounter,
              name: `Row ${insertCounter}`,
              score: Math.floor(Math.random() * 100),
              status: 'Pending',
            };
            rowData = [...rowData, newRow];
            grid.rows = rowData;
            requestAnimationFrame(() => {
              grid.animateRow(rowData.length - 1, 'insert');
            });
          } else if (rowData.length > 5) {
            // 20% chance: remove row
            const idx = Math.floor(Math.random() * rowData.length);
            grid.animateRow(idx, 'remove');
            setTimeout(() => {
              rowData = rowData.filter((_, i) => i !== idx);
              grid.rows = rowData;
              // Clean up stale remove animation attributes after re-render
              requestAnimationFrame(() => {
                grid.querySelectorAll('[data-animating="remove"]').forEach((el) => {
                  el.removeAttribute('data-animating');
                });
              });
            }, 250);
          }
        }, 1500);
        autoBtn.textContent = '⏹️ Stop Auto-Simulation';
      }
    });
    controls.appendChild(autoBtn);

    container.appendChild(controls);
    container.appendChild(grid);

    return container;
  },
};

// #endregion
