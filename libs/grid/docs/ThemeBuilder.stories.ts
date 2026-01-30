/**
 * Interactive Theme Builder
 *
 * A fully interactive theme builder that allows users to customize
 * ALL CSS variables and export the result as a reusable theme CSS file.
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '@toolbox-web/grid';
import type { ColumnConfig, GridConfig, ShellConfig } from '@toolbox-web/grid';
import {
  ContextMenuPlugin,
  ExportPlugin,
  FilteringPlugin,
  MasterDetailPlugin,
  MultiSortPlugin,
  PinnedColumnsPlugin,
  SelectionPlugin,
  VisibilityPlugin,
} from '@toolbox-web/grid/all';

// ============================================================================
// SAMPLE DATA
// ============================================================================
interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
  salary: number;
  startDate: string;
  status: 'active' | 'inactive' | 'on-leave';
  rating: number;
  email: string;
}

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
const ROLES = ['Manager', 'Senior', 'Junior', 'Lead', 'Director'];
const STATUSES: Employee['status'][] = ['active', 'inactive', 'on-leave'];

function generateEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Employee ${i + 1}`,
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    role: ROLES[i % ROLES.length],
    salary: 50000 + Math.floor(Math.random() * 100000),
    startDate: new Date(2020 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), 1)
      .toISOString()
      .split('T')[0],
    status: STATUSES[i % STATUSES.length],
    rating: 1 + Math.floor(Math.random() * 5),
    email: `employee${i + 1}@company.com`,
  }));
}

const employees = generateEmployees(100);

// ============================================================================
// COLUMN CONFIG
// ============================================================================
const columns: ColumnConfig<Employee>[] = [
  { field: 'id', header: 'ID', width: 60, sticky: 'left' },
  { field: 'name', header: 'Name', width: 150 },
  { field: 'department', header: 'Department', width: 120 },
  { field: 'role', header: 'Role', width: 100 },
  {
    field: 'salary',
    header: 'Salary',
    width: 100,
    align: 'right',
    renderer: ({ value }) => `$${(value as number).toLocaleString()}`,
  },
  { field: 'startDate', header: 'Start Date', width: 110 },
  {
    field: 'status',
    header: 'Status',
    width: 90,
    renderer: ({ value, cellEl }) => {
      const colors: Record<string, string> = {
        active: 'var(--tbw-color-success)',
        inactive: 'var(--tbw-color-fg-muted)',
        'on-leave': 'var(--tbw-color-accent)',
      };
      cellEl.style.color = colors[value as string] || '';
      return (value as string).charAt(0).toUpperCase() + (value as string).slice(1);
    },
  },
  {
    field: 'rating',
    header: 'Rating',
    width: 80,
    align: 'center',
    renderer: ({ value }) => '★'.repeat(value as number) + '☆'.repeat(5 - (value as number)),
  },
  { field: 'email', header: 'Email', width: 180 },
];

// ============================================================================
// CSS VARIABLE DEFINITIONS
// ============================================================================
interface CSSVariableDefinition {
  name: string;
  defaultValue: string;
  description: string;
  type: 'color' | 'size' | 'font' | 'number' | 'select' | 'padding';
  options?: string[];
}

const CSS_VARIABLES: Record<string, CSSVariableDefinition[]> = {
  'Core Colors': [
    { name: '--tbw-color-bg', defaultValue: 'transparent', description: 'Grid background', type: 'color' },
    { name: '--tbw-color-panel-bg', defaultValue: '#eeeeee', description: 'Panel backgrounds', type: 'color' },
    { name: '--tbw-color-fg', defaultValue: '#222222', description: 'Primary text color', type: 'color' },
    { name: '--tbw-color-fg-muted', defaultValue: '#555555', description: 'Secondary text', type: 'color' },
    {
      name: '--tbw-color-accent',
      defaultValue: '#3b82f6',
      description: 'Accent color (focus, selection)',
      type: 'color',
    },
    { name: '--tbw-color-accent-fg', defaultValue: '#ffffff', description: 'Text on accent', type: 'color' },
    { name: '--tbw-color-success', defaultValue: '#4caf50', description: 'Success state', type: 'color' },
    { name: '--tbw-color-error', defaultValue: '#f44336', description: 'Error state', type: 'color' },
  ],
  'Row & Cell Colors': [
    { name: '--tbw-color-selection', defaultValue: '#fff7d6', description: 'Selection background', type: 'color' },
    { name: '--tbw-color-row-alt', defaultValue: 'transparent', description: 'Alternating row color', type: 'color' },
    { name: '--tbw-color-row-hover', defaultValue: '#f0f6ff', description: 'Row hover color', type: 'color' },
    { name: '--tbw-color-active-row-bg', defaultValue: '#fff7d6', description: 'Active row background', type: 'color' },
  ],
  Header: [
    { name: '--tbw-color-header-bg', defaultValue: '#e0e0e0', description: 'Header background', type: 'color' },
    { name: '--tbw-color-header-fg', defaultValue: '#333333', description: 'Header text color', type: 'color' },
    { name: '--tbw-header-height', defaultValue: '1.875em', description: 'Header row height', type: 'size' },
    {
      name: '--tbw-font-weight-header',
      defaultValue: 'bold',
      description: 'Header font weight',
      type: 'select',
      options: ['normal', 'bold', '500', '600', '700'],
    },
    {
      name: '--tbw-header-text-transform',
      defaultValue: 'none',
      description: 'Header text transform',
      type: 'select',
      options: ['none', 'uppercase', 'lowercase', 'capitalize'],
    },
    { name: '--tbw-header-letter-spacing', defaultValue: 'normal', description: 'Header letter spacing', type: 'size' },
  ],
  Borders: [
    { name: '--tbw-color-border', defaultValue: '#d0d0d4', description: 'Default border color', type: 'color' },
    { name: '--tbw-color-border-strong', defaultValue: '#777777', description: 'Strong border color', type: 'color' },
    { name: '--tbw-color-border-cell', defaultValue: '#d0d0d4', description: 'Cell border color', type: 'color' },
    { name: '--tbw-color-border-header', defaultValue: '#d0d0d4', description: 'Header border color', type: 'color' },
    { name: '--tbw-border-radius', defaultValue: '0.25em', description: 'Border radius', type: 'size' },
  ],
  Typography: [
    {
      name: '--tbw-font-family',
      defaultValue: 'inherit',
      description: 'Font family',
      type: 'select',
      options: [
        'inherit',
        'system-ui',
        'Arial, sans-serif',
        '"Segoe UI", sans-serif',
        '"Roboto", sans-serif',
        '"Inter", sans-serif',
        'monospace',
      ],
    },
    { name: '--tbw-font-size', defaultValue: '1em', description: 'Base font size', type: 'size' },
    { name: '--tbw-font-size-sm', defaultValue: '0.9285em', description: 'Small font size', type: 'size' },
    { name: '--tbw-font-size-xs', defaultValue: '0.7857em', description: 'Extra small font size', type: 'size' },
  ],
  Spacing: [
    { name: '--tbw-spacing-xs', defaultValue: '0.25em', description: 'Extra small spacing', type: 'size' },
    { name: '--tbw-spacing-sm', defaultValue: '0.375em', description: 'Small spacing', type: 'size' },
    { name: '--tbw-spacing-md', defaultValue: '0.5em', description: 'Medium spacing', type: 'size' },
    { name: '--tbw-spacing-lg', defaultValue: '0.75em', description: 'Large spacing', type: 'size' },
    { name: '--tbw-spacing-xl', defaultValue: '1em', description: 'Extra large spacing', type: 'size' },
    { name: '--tbw-cell-padding', defaultValue: '0.25em 0.5em', description: 'Cell padding', type: 'padding' },
    {
      name: '--tbw-cell-padding-header',
      defaultValue: '0.25em 0.5em',
      description: 'Header cell padding',
      type: 'padding',
    },
  ],
  'Row & Cell Dimensions': [
    { name: '--tbw-row-height', defaultValue: '1.75em', description: 'Row height', type: 'size' },
    {
      name: '--tbw-cell-white-space',
      defaultValue: 'nowrap',
      description: 'Cell text wrapping',
      type: 'select',
      options: ['nowrap', 'normal', 'pre', 'pre-wrap'],
    },
  ],
  'Focus & Selection': [
    { name: '--tbw-focus-outline', defaultValue: '2px solid #3b82f6', description: 'Focus ring style', type: 'size' },
    { name: '--tbw-focus-outline-offset', defaultValue: '-2px', description: 'Focus ring offset', type: 'size' },
    { name: '--tbw-range-border-color', defaultValue: '#3b82f6', description: 'Range selection border', type: 'color' },
  ],
  Icons: [
    { name: '--tbw-icon-size', defaultValue: '1em', description: 'Icon size', type: 'size' },
    { name: '--tbw-icon-size-sm', defaultValue: '0.875em', description: 'Small icon size', type: 'size' },
    { name: '--tbw-checkbox-size', defaultValue: '1em', description: 'Checkbox size', type: 'size' },
    { name: '--tbw-toggle-size', defaultValue: '1.25em', description: 'Toggle icon size', type: 'size' },
  ],
  'Resize Handle': [
    { name: '--tbw-resize-handle-width', defaultValue: '0.375em', description: 'Resize handle width', type: 'size' },
    {
      name: '--tbw-resize-handle-color',
      defaultValue: 'transparent',
      description: 'Resize handle color',
      type: 'color',
    },
    {
      name: '--tbw-resize-handle-color-hover',
      defaultValue: '#3b82f6',
      description: 'Resize handle hover color',
      type: 'color',
    },
    { name: '--tbw-resize-indicator-width', defaultValue: '2px', description: 'Resize indicator width', type: 'size' },
    {
      name: '--tbw-resize-indicator-color',
      defaultValue: '#3b82f6',
      description: 'Resize indicator color',
      type: 'color',
    },
  ],
  Animation: [
    { name: '--tbw-transition-duration', defaultValue: '120ms', description: 'Transition duration', type: 'size' },
    { name: '--tbw-animation-duration', defaultValue: '200ms', description: 'Animation duration', type: 'size' },
    {
      name: '--tbw-animation-easing',
      defaultValue: 'ease-out',
      description: 'Animation easing',
      type: 'select',
      options: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'],
    },
  ],
  'Sorting Indicators': [
    { name: '--tbw-sort-indicator-color', defaultValue: '#555555', description: 'Sort indicator color', type: 'color' },
    {
      name: '--tbw-sort-indicator-active-color',
      defaultValue: '#3b82f6',
      description: 'Active sort indicator',
      type: 'color',
    },
    {
      name: '--tbw-sort-indicator-visibility',
      defaultValue: 'visible',
      description: 'Sort indicator visibility',
      type: 'select',
      options: ['visible', 'hidden'],
    },
  ],
  'Shell & Panels': [
    { name: '--tbw-shell-header-height', defaultValue: '2.75em', description: 'Shell header height', type: 'size' },
    { name: '--tbw-shell-header-bg', defaultValue: '#eeeeee', description: 'Shell header background', type: 'color' },
    { name: '--tbw-tool-panel-width', defaultValue: '17.5em', description: 'Tool panel width', type: 'size' },
    { name: '--tbw-tool-panel-bg', defaultValue: '#eeeeee', description: 'Tool panel background', type: 'color' },
    {
      name: '--tbw-tool-panel-header-height',
      defaultValue: '2.5em',
      description: 'Tool panel header height',
      type: 'size',
    },
    { name: '--tbw-toolbar-button-size', defaultValue: '2em', description: 'Toolbar button size', type: 'size' },
  ],
  // Plugin-specific CSS variables
  'Context Menu (Plugin)': [
    { name: '--tbw-context-menu-bg', defaultValue: '#ffffff', description: 'Context menu background', type: 'color' },
    { name: '--tbw-context-menu-fg', defaultValue: '#333333', description: 'Context menu text color', type: 'color' },
    {
      name: '--tbw-context-menu-border',
      defaultValue: '#e0e0e0',
      description: 'Context menu border color',
      type: 'color',
    },
    {
      name: '--tbw-context-menu-hover',
      defaultValue: '#f5f5f5',
      description: 'Context menu item hover',
      type: 'color',
    },
    {
      name: '--tbw-context-menu-fg-disabled',
      defaultValue: '#aaaaaa',
      description: 'Disabled item text',
      type: 'color',
    },
    {
      name: '--tbw-context-menu-separator',
      defaultValue: '#e0e0e0',
      description: 'Menu separator color',
      type: 'color',
    },
    { name: '--tbw-context-menu-icon-color', defaultValue: '#666666', description: 'Menu icon color', type: 'color' },
    { name: '--tbw-context-menu-radius', defaultValue: '4px', description: 'Menu border radius', type: 'size' },
    {
      name: '--tbw-context-menu-shadow',
      defaultValue: '0 2px 10px rgba(0,0,0,0.1)',
      description: 'Menu box shadow',
      type: 'size',
    },
    { name: '--tbw-context-menu-min-width', defaultValue: '160px', description: 'Minimum menu width', type: 'size' },
    { name: '--tbw-context-menu-max-width', defaultValue: '280px', description: 'Maximum menu width', type: 'size' },
  ],
  'Filtering Panel (Plugin)': [
    { name: '--tbw-filter-panel-bg', defaultValue: '#ffffff', description: 'Filter panel background', type: 'color' },
    { name: '--tbw-filter-panel-fg', defaultValue: '#333333', description: 'Filter panel text color', type: 'color' },
    { name: '--tbw-filter-panel-border', defaultValue: '#cccccc', description: 'Filter panel border', type: 'color' },
    { name: '--tbw-filter-panel-radius', defaultValue: '4px', description: 'Filter panel radius', type: 'size' },
  ],
  'Row Grouping (Plugin)': [
    { name: '--tbw-grouping-rows-bg', defaultValue: '#f5f5f5', description: 'Group row background', type: 'color' },
    { name: '--tbw-grouping-rows-bg-hover', defaultValue: '#eeeeee', description: 'Group row hover bg', type: 'color' },
    {
      name: '--tbw-grouping-rows-toggle-hover',
      defaultValue: '#e0e0e0',
      description: 'Toggle button hover',
      type: 'color',
    },
    {
      name: '--tbw-grouping-rows-count-color',
      defaultValue: '#666666',
      description: 'Group count text color',
      type: 'color',
    },
  ],
  'Tree (Plugin)': [
    { name: '--tbw-tree-indent-width', defaultValue: '1.5em', description: 'Tree indentation width', type: 'size' },
    { name: '--tbw-tree-toggle-size', defaultValue: '1em', description: 'Tree toggle icon size', type: 'size' },
  ],
  'Visibility Panel (Plugin)': [
    { name: '--tbw-visibility-hover', defaultValue: '#f0f0f0', description: 'Visibility item hover', type: 'color' },
    { name: '--tbw-visibility-indicator', defaultValue: '#3b82f6', description: 'Visibility indicator', type: 'color' },
  ],
  'Loading Spinner': [
    { name: '--tbw-spinner-size', defaultValue: '48px', description: 'Spinner size (grid-level)', type: 'size' },
    { name: '--tbw-spinner-border-width', defaultValue: '3px', description: 'Spinner border thickness', type: 'size' },
    { name: '--tbw-spinner-color', defaultValue: '#3b82f6', description: 'Spinner active color', type: 'color' },
    { name: '--tbw-spinner-track-color', defaultValue: '#d0d0d4', description: 'Spinner track color', type: 'color' },
  ],
};

// ============================================================================
// THEME BUILDER COMPONENT
// ============================================================================
interface ThemeBuilderArgs {
  themeName: string;
  darkModeSupport: boolean;
  // All CSS variables as args (light values)
  // Dark mode values use *Dark suffix
  [key: string]: string | boolean;
}

// Helper to convert CSS variable name to arg name
function toArgName(varName: string): string {
  return varName.replace('--tbw-', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Build default args from CSS_VARIABLES
function buildDefaultArgs(): ThemeBuilderArgs {
  const args: ThemeBuilderArgs = {
    themeName: 'my-custom-theme',
    darkModeSupport: false,
  };
  for (const category of Object.values(CSS_VARIABLES)) {
    for (const variable of category) {
      const argName = toArgName(variable.name);
      args[argName] = variable.defaultValue;
      // Add dark mode variant for color types
      if (variable.type === 'color') {
        args[`${argName}Dark`] = variable.defaultValue;
      }
    }
  }
  return args;
}

// Build arg types for Storybook controls
function buildArgTypes(): Record<string, unknown> {
  const argTypes: Record<string, unknown> = {
    themeName: {
      control: 'text',
      description: 'CSS class name for your theme',
      table: { category: 'Export' },
    },
    darkModeSupport: {
      control: 'boolean',
      description: 'Enable dark mode support using light-dark() CSS function',
      table: { category: 'Export' },
    },
  };

  for (const [category, variables] of Object.entries(CSS_VARIABLES)) {
    for (const variable of variables) {
      const argName = toArgName(variable.name);

      if (variable.type === 'color') {
        // Light mode color
        argTypes[argName] = {
          control: 'color',
          description: `${variable.description} (light mode)`,
          table: { category, subcategory: 'Light' },
        };
        // Dark mode color variant
        argTypes[`${argName}Dark`] = {
          control: 'color',
          description: `${variable.description} (dark mode)`,
          table: { category, subcategory: 'Dark' },
        };
      } else if (variable.type === 'select' && variable.options) {
        argTypes[argName] = {
          control: 'select',
          options: variable.options,
          description: variable.description,
          table: { category },
        };
      } else {
        argTypes[argName] = {
          control: 'text',
          description: variable.description,
          table: { category },
        };
      }
    }
  }
  return argTypes;
}

// Export button handler
function copyToClipboard(text: string, button: HTMLButtonElement): void {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    const originalClass = button.className;
    button.textContent = '✓ Copied!';
    button.className = 'theme-builder-btn theme-builder-btn--success';
    setTimeout(() => {
      button.textContent = originalText;
      button.className = originalClass;
    }, 2000);
  });
}

// Download CSS file
function downloadCSS(css: string, filename: string): void {
  const blob = new Blob([css], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// STORY DEFINITION
// ============================================================================
const meta: Meta<ThemeBuilderArgs> = {
  title: 'Grid/Theming/Theme Builder',
  tags: ['!autodocs', '!dev'],
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true }, // We use our own panel
    actions: { disable: true },
    interactions: { disable: true },
    a11y: { disable: true },
    options: { showPanel: false }, // Hide the addons panel entirely
    docs: {
      description: {
        component: `
# Interactive Theme Builder

Customize **every CSS variable** of the grid and export your theme as a reusable CSS file.

## How to Use

1. **Open the Theme Panel** on the right side
2. **Toggle Dark Mode Support** to enable light/dark color pairs
3. **Adjust variables** - colors show side-by-side Light/Dark pickers
4. **Export** your theme using the buttons in the toolbar

## Tips

- Enable "Dark Mode Support" to generate \`light-dark()\` CSS for automatic theme switching
- Categories are collapsible - click to expand
- Only changed values are included in the export
        `,
      },
    },
  },
  argTypes: buildArgTypes(),
  args: buildDefaultArgs(),
};

export default meta;

type Story = StoryObj<ThemeBuilderArgs>;

// State management for the theme builder
interface ThemeState {
  themeName: string;
  darkModeSupport: boolean;
  values: Record<string, string>;
  darkValues: Record<string, string>;
  baselineValues: Record<string, string>;
  baselineDarkValues: Record<string, string>;
}

/**
 * Parse a light-dark() CSS function, handling nested functions like hsl(), rgb(), etc.
 * Returns [lightValue, darkValue] or null if not a light-dark() value.
 */
function parseLightDark(value: string): [string, string] | null {
  const prefix = 'light-dark(';
  if (!value.startsWith(prefix)) return null;

  // Find the matching closing paren for light-dark()
  let depth = 1;
  let i = prefix.length;
  let commaIndex = -1;

  while (i < value.length && depth > 0) {
    const char = value[i];
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if (char === ',' && depth === 1 && commaIndex === -1) {
      // Found the comma separating light and dark values at the top level
      commaIndex = i;
    }
    i++;
  }

  if (commaIndex === -1) return null;

  const lightValue = value.slice(prefix.length, commaIndex).trim();
  const darkValue = value.slice(commaIndex + 1, i - 1).trim(); // i-1 to exclude closing paren

  return [lightValue, darkValue];
}

// Read computed CSS variable values from an element
function readComputedVariables(element: HTMLElement): { light: Record<string, string>; dark: Record<string, string> } {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const computedStyle = getComputedStyle(element);

  for (const category of Object.values(CSS_VARIABLES)) {
    for (const variable of category) {
      const argName = toArgName(variable.name);
      const rawValue = computedStyle.getPropertyValue(variable.name).trim();

      if (rawValue) {
        // Check if it's a light-dark() value
        const parsed = parseLightDark(rawValue);
        if (parsed) {
          light[argName] = parsed[0];
          dark[argName] = parsed[1];
        } else {
          // Same value for both modes
          light[argName] = rawValue;
          dark[argName] = rawValue;
        }
      } else {
        // Fallback to our defined defaults
        light[argName] = variable.defaultValue;
        dark[argName] = variable.defaultValue;
      }
    }
  }

  return { light, dark };
}

function createThemePanel(state: ThemeState, onUpdate: () => void): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'theme-builder-panel theme-builder-panel--dark-mode';

  // Header
  const header = document.createElement('div');
  header.className = 'theme-builder-panel__header';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'theme-builder-panel__toggle';
  toggleBtn.textContent = '◀';
  toggleBtn.title = 'Collapse panel';
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('theme-builder-panel--collapsed');
    toggleBtn.textContent = panel.classList.contains('theme-builder-panel--collapsed') ? '▶' : '◀';
  });
  header.appendChild(toggleBtn);

  const title = document.createElement('span');
  title.className = 'theme-builder-panel__title';
  title.textContent = 'Theme Variables';
  header.appendChild(title);

  const controls = document.createElement('div');
  controls.className = 'theme-builder-panel__controls';

  // Theme name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = state.themeName;
  nameInput.className = 'theme-builder-var-row__input';
  nameInput.style.width = '100px';
  nameInput.placeholder = 'Theme name';
  nameInput.addEventListener('input', () => {
    state.themeName = nameInput.value;
  });
  controls.appendChild(nameInput);

  // Dark mode toggle
  const darkToggle = document.createElement('label');
  darkToggle.className = 'theme-builder-dark-toggle';
  const darkCheckbox = document.createElement('input');
  darkCheckbox.type = 'checkbox';
  darkCheckbox.checked = state.darkModeSupport;
  darkCheckbox.addEventListener('change', () => {
    state.darkModeSupport = darkCheckbox.checked;
    panel.classList.toggle('theme-builder-panel--dark-mode', darkCheckbox.checked);
    onUpdate();
  });
  darkToggle.appendChild(darkCheckbox);
  darkToggle.appendChild(document.createTextNode('Dark'));
  controls.appendChild(darkToggle);

  header.appendChild(controls);
  panel.appendChild(header);

  // Content area with categories
  const content = document.createElement('div');
  content.className = 'theme-builder-panel__content';

  for (const [category, variables] of Object.entries(CSS_VARIABLES)) {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'theme-builder-category';

    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'theme-builder-category__header';
    categoryHeader.addEventListener('click', () => {
      categoryEl.classList.toggle('theme-builder-category--open');
    });

    const chevron = document.createElement('span');
    chevron.className = 'theme-builder-category__chevron';
    chevron.textContent = '▶';
    categoryHeader.appendChild(chevron);

    const name = document.createElement('span');
    name.className = 'theme-builder-category__name';
    name.textContent = category;
    categoryHeader.appendChild(name);

    const count = document.createElement('span');
    count.className = 'theme-builder-category__count';
    count.textContent = String(variables.length);
    categoryHeader.appendChild(count);

    categoryEl.appendChild(categoryHeader);

    const items = document.createElement('div');
    items.className = 'theme-builder-category__items';

    for (const variable of variables) {
      const argName = toArgName(variable.name);

      if (variable.type === 'color') {
        // Color row with side-by-side pickers
        const row = document.createElement('div');
        row.className = 'theme-builder-color-row';

        const label = document.createElement('div');
        label.className = 'theme-builder-color-row__label';
        label.innerHTML = `<code>${variable.name.replace('--tbw-', '')}</code>`;
        label.title = variable.description;
        row.appendChild(label);

        const pickers = document.createElement('div');
        pickers.className = 'theme-builder-color-row__pickers';

        // Helper to create a color picker with transparent checkbox
        const createColorPicker = (mode: 'light' | 'dark', getValue: () => string, setValue: (v: string) => void) => {
          const picker = document.createElement('div');
          picker.className =
            mode === 'dark'
              ? 'theme-builder-color-picker theme-builder-color-picker--dark'
              : 'theme-builder-color-picker';

          const modeLabel = document.createElement('span');
          modeLabel.className = 'theme-builder-color-picker__label';
          modeLabel.textContent = mode === 'light' ? 'Light' : 'Dark';
          picker.appendChild(modeLabel);

          const wrapper = document.createElement('div');
          wrapper.className = 'theme-builder-color-picker__wrapper';

          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.className = 'theme-builder-color-picker__input';
          const currentValue = getValue();
          const isCleared = currentValue === 'transparent';
          colorInput.value = isCleared ? '#ffffff' : normalizeColor(currentValue);
          colorInput.disabled = isCleared;
          colorInput.addEventListener('input', () => {
            setValue(colorInput.value);
            onUpdate();
          });
          wrapper.appendChild(colorInput);

          const transparentLabel = document.createElement('label');
          transparentLabel.className = 'theme-builder-color-picker__transparent';
          const transparentCheck = document.createElement('input');
          transparentCheck.type = 'checkbox';
          transparentCheck.checked = isCleared;
          transparentCheck.title = 'Set to transparent';
          transparentCheck.addEventListener('change', () => {
            if (transparentCheck.checked) {
              setValue('transparent');
              colorInput.disabled = true;
            } else {
              setValue(colorInput.value);
              colorInput.disabled = false;
            }
            onUpdate();
          });
          transparentLabel.appendChild(transparentCheck);
          const transparentText = document.createElement('span');
          transparentText.className = 'theme-builder-color-picker__transparent-label';
          transparentText.textContent = '∅';
          transparentText.title = 'Transparent';
          transparentLabel.appendChild(transparentText);
          wrapper.appendChild(transparentLabel);

          picker.appendChild(wrapper);
          return picker;
        };

        // Light color picker
        const lightPicker = createColorPicker(
          'light',
          () => state.values[argName] || variable.defaultValue,
          (v) => {
            state.values[argName] = v;
          },
        );
        pickers.appendChild(lightPicker);

        // Dark color picker
        const darkPicker = createColorPicker(
          'dark',
          () => state.darkValues[argName] || variable.defaultValue,
          (v) => {
            state.darkValues[argName] = v;
          },
        );
        pickers.appendChild(darkPicker);

        row.appendChild(pickers);
        items.appendChild(row);
      } else {
        // Non-color variable row
        const row = document.createElement('div');
        row.className = 'theme-builder-var-row';

        const label = document.createElement('div');
        label.className = 'theme-builder-var-row__label';
        label.innerHTML = `<code>${variable.name.replace('--tbw-', '')}</code>`;
        label.title = variable.description;
        row.appendChild(label);

        if (variable.type === 'select' && variable.options) {
          const select = document.createElement('select');
          select.className = 'theme-builder-var-row__select';
          for (const opt of variable.options) {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === (state.values[argName] || variable.defaultValue)) {
              option.selected = true;
            }
            select.appendChild(option);
          }
          select.addEventListener('change', () => {
            state.values[argName] = select.value;
            onUpdate();
          });
          row.appendChild(select);
        } else {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'theme-builder-var-row__input';
          input.value = state.values[argName] || variable.defaultValue;
          input.addEventListener('input', () => {
            state.values[argName] = input.value;
            onUpdate();
          });
          row.appendChild(input);
        }

        items.appendChild(row);
      }
    }

    categoryEl.appendChild(items);
    content.appendChild(categoryEl);
  }

  panel.appendChild(content);

  // Start with dark mode panel class if enabled
  if (!state.darkModeSupport) {
    panel.classList.remove('theme-builder-panel--dark-mode');
  }

  return panel;
}

// Normalize color to hex format for color picker
function normalizeColor(color: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return color;
  }
  if (color === 'transparent') {
    return '#ffffff';
  }
  // For other formats, try to parse
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return `#${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`;
  }
  return '#000000';
}

// Generate CSS from state
function generateCSSFromState(state: ThemeState): string {
  const lines: string[] = [
    `/*`,
    ` * Custom Theme: ${state.themeName}`,
    ` * Generated by @toolbox-web/grid Theme Builder`,
    ` * ${new Date().toISOString().split('T')[0]}`,
    state.darkModeSupport ? ` * Dark mode: enabled (uses light-dark() CSS function)` : ` * Dark mode: disabled`,
    ` */`,
    `@layer tbw-theme {`,
    `  tbw-grid.${state.themeName},`,
    `  .${state.themeName} tbw-grid {`,
  ];

  for (const [category, variables] of Object.entries(CSS_VARIABLES)) {
    const categoryLines: string[] = [];
    for (const variable of variables) {
      const argName = toArgName(variable.name);
      const lightValue = state.values[argName];
      const darkValue = state.darkValues[argName];
      const baselineLight = state.baselineValues[argName] || variable.defaultValue;
      const baselineDark = state.baselineDarkValues[argName] || variable.defaultValue;

      if (variable.type === 'color') {
        const lightChanged = lightValue && lightValue !== baselineLight;
        const darkChanged = darkValue && darkValue !== baselineDark;

        if (state.darkModeSupport) {
          if (lightChanged || darkChanged) {
            const light = lightValue || baselineLight;
            const dark = darkValue || baselineDark;
            categoryLines.push(`    ${variable.name}: light-dark(${light}, ${dark});`);
          }
        } else {
          if (lightChanged) {
            categoryLines.push(`    ${variable.name}: ${lightValue};`);
          }
        }
      } else {
        if (lightValue && lightValue !== baselineLight) {
          categoryLines.push(`    ${variable.name}: ${lightValue};`);
        }
      }
    }
    if (categoryLines.length > 0) {
      lines.push(`    /* ${category} */`);
      lines.push(...categoryLines);
    }
  }

  lines.push(`  }`);
  lines.push(`}`);
  return lines.join('\n');
}

// Apply state to grid element
function applyStateToGrid(grid: HTMLElement, state: ThemeState): void {
  for (const category of Object.values(CSS_VARIABLES)) {
    for (const variable of category) {
      const argName = toArgName(variable.name);
      const lightValue = state.values[argName] || variable.defaultValue;
      const darkValue = state.darkValues[argName] || variable.defaultValue;

      if (variable.type === 'color' && state.darkModeSupport) {
        grid.style.setProperty(variable.name, `light-dark(${lightValue}, ${darkValue})`);
      } else {
        grid.style.setProperty(variable.name, lightValue);
      }
    }
  }
}

/**
 * Interactive theme builder with live preview and export functionality.
 *
 * Use the Theme Panel on the right to customize CSS variables.
 * Toggle "Dark" to enable side-by-side light/dark color pickers.
 */
export const Builder: Story = {
  parameters: {
    // Override at story level to ensure panel is hidden
    options: { showPanel: false },
  },
  render: () => {
    const container = document.createElement('div');
    container.className = 'theme-builder-container';

    // Main area with grid and panel
    const main = document.createElement('div');
    main.className = 'theme-builder-main';

    // Grid wrapper
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'theme-builder-grid-wrapper';

    const gridConfig: GridConfig<Employee> = {
      columns,
      defaultColDef: {
        sortable: true,
        resizable: true,
        filterable: true,
      },
      shell: {
        header: { title: 'Theme Builder Preview' },
        toolPanel: { position: 'right' },
      } satisfies ShellConfig,
      plugins: [
        new SelectionPlugin({ mode: 'row' }),
        new FilteringPlugin(),
        new MultiSortPlugin(),
        new PinnedColumnsPlugin(),
        new VisibilityPlugin(),
        new ExportPlugin(),
        new ContextMenuPlugin(),
        new MasterDetailPlugin({
          detailRenderer: (row: Employee) => {
            const div = document.createElement('div');
            div.style.padding = '16px';
            div.innerHTML = `
              <h4 style="margin: 0 0 8px 0;">Employee Details</h4>
              <p><strong>Name:</strong> ${row.name}</p>
              <p><strong>Department:</strong> ${row.department}</p>
              <p><strong>Email:</strong> ${row.email}</p>
            `;
            return div;
          },
        }),
      ],
    };

    const grid = document.createElement('tbw-grid') as HTMLElement & {
      rows: Employee[];
      gridConfig: GridConfig<Employee>;
      ready: () => Promise<void>;
    };
    grid.rows = employees;
    grid.gridConfig = gridConfig;
    grid.style.cssText = 'height: 100%;';

    gridWrapper.appendChild(grid);
    main.appendChild(gridWrapper);
    container.appendChild(main);

    // Initialize state - will be populated after grid is ready
    const state: ThemeState = {
      themeName: 'my-custom-theme',
      darkModeSupport: true,
      values: {},
      darkValues: {},
      baselineValues: {},
      baselineDarkValues: {},
    };

    // Panel placeholder - will be created after reading computed values
    let panelEl: HTMLElement | null = null;

    // Reset function to restore baseline values
    const resetToBaseline = () => {
      state.values = { ...state.baselineValues };
      state.darkValues = { ...state.baselineDarkValues };
      applyStateToGrid(grid, state);
      // Recreate panel with updated values
      if (panelEl) {
        const newPanel = createThemePanel(state, () => applyStateToGrid(grid, state));
        panelEl.replaceWith(newPanel);
        panelEl = newPanel;
      }
    };

    // After grid is ready, read computed values and create panel
    requestAnimationFrame(() => {
      // Read the current computed CSS values from the grid
      const computed = readComputedVariables(grid);

      // Set both current values and baseline from computed
      state.values = { ...computed.light };
      state.darkValues = { ...computed.dark };
      state.baselineValues = { ...computed.light };
      state.baselineDarkValues = { ...computed.dark };

      // Create export toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'theme-builder-toolbar';

      const label = document.createElement('span');
      label.textContent = 'Export Theme:';
      label.className = 'theme-builder-toolbar__label';
      toolbar.appendChild(label);

      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋 Copy CSS';
      copyBtn.className = 'theme-builder-btn';
      copyBtn.addEventListener('click', () => {
        const css = generateCSSFromState(state);
        copyToClipboard(css, copyBtn);
      });
      toolbar.appendChild(copyBtn);

      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = '💾 Download CSS';
      downloadBtn.className = 'theme-builder-btn';
      downloadBtn.addEventListener('click', () => {
        const css = generateCSSFromState(state);
        downloadCSS(css, `${state.themeName}.css`);
      });
      toolbar.appendChild(downloadBtn);

      const previewBtn = document.createElement('button');
      previewBtn.textContent = '👁 Preview CSS';
      previewBtn.className = 'theme-builder-btn';
      previewBtn.addEventListener('click', () => {
        const css = generateCSSFromState(state);
        const modal = document.createElement('div');
        modal.className = 'theme-builder-modal';
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.remove();
        });

        const content = document.createElement('div');
        content.className = 'theme-builder-modal__content';

        const modalTitle = document.createElement('h3');
        modalTitle.textContent = 'Generated CSS';
        modalTitle.className = 'theme-builder-modal__title';
        content.appendChild(modalTitle);

        const pre = document.createElement('pre');
        pre.className = 'theme-builder-modal__code';
        pre.textContent = css;
        content.appendChild(pre);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'theme-builder-btn theme-builder-btn--primary';
        closeBtn.style.marginTop = '12px';
        closeBtn.addEventListener('click', () => modal.remove());
        content.appendChild(closeBtn);

        modal.appendChild(content);
        document.body.appendChild(modal);
      });
      toolbar.appendChild(previewBtn);

      // Reset button
      const resetBtn = document.createElement('button');
      resetBtn.textContent = '↺ Reset';
      resetBtn.className = 'theme-builder-btn';
      resetBtn.style.marginLeft = 'auto';
      resetBtn.addEventListener('click', resetToBaseline);
      toolbar.appendChild(resetBtn);

      container.insertBefore(toolbar, main);

      // Create theme panel with current values
      panelEl = createThemePanel(state, () => applyStateToGrid(grid, state));
      main.appendChild(panelEl);
    });

    return container;
  },
};
