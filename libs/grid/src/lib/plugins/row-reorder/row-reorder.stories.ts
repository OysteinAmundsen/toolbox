import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { RowReorderPlugin } from './RowReorderPlugin';

// Import grid component
import '../../../index';

// Sample data for row reorder demos
const sampleData = [
  { id: 1, name: 'Alice', department: 'Engineering', email: 'alice@example.com', priority: 1 },
  { id: 2, name: 'Bob', department: 'Marketing', email: 'bob@example.com', priority: 2 },
  { id: 3, name: 'Carol', department: 'Engineering', email: 'carol@example.com', priority: 3 },
  { id: 4, name: 'David', department: 'Sales', email: 'david@example.com', priority: 4 },
  { id: 5, name: 'Eve', department: 'Engineering', email: 'eve@example.com', priority: 5 },
];

const columns = [
  { field: 'priority', header: '#', type: 'number' as const, width: 50 },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'email', header: 'Email' },
];

interface RowReorderArgs {
  handlePosition: 'start' | 'end';
  keyboardEnabled: boolean;
  showHandleOnHover: boolean;
  animation: false | 'flip' | 'fade';
}

/** Generate code snippet for row reorder */
function generateRowReorderCode(args: RowReorderArgs): string {
  const animationStr = args.animation === false ? 'false' : `'${args.animation}'`;
  return `<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'priority', header: '#', type: 'number', width: 50 },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'email', header: 'Email' },
  ],
  plugins: [
    new RowReorderPlugin({
      handlePosition: '${args.handlePosition}',
      keyboardEnabled: ${args.keyboardEnabled},
      showHandleOnHover: ${args.showHandleOnHover},
      animation: ${animationStr},
    }),
  ],
};

// Listen for row move events
grid.addEventListener('row-move', (e) => {
  console.log('Row moved:', e.detail);
});

grid.rows = [...];
</script>`;
}

const meta: Meta<RowReorderArgs> = {
  title: 'Grid/Plugins/Row Reorder',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    handlePosition: {
      control: 'select',
      options: ['start', 'end'],
      description: 'Position of the drag handle column',
      table: { defaultValue: { summary: "'start'" } },
    },
    keyboardEnabled: {
      control: 'boolean',
      description: 'Enable Ctrl+Up/Down keyboard shortcuts',
      table: { defaultValue: { summary: 'true' } },
    },
    showHandleOnHover: {
      control: 'boolean',
      description: 'Only show drag handle on row hover',
      table: { defaultValue: { summary: 'false' } },
    },
    animation: {
      control: 'select',
      options: [false, 'flip', 'fade'],
      description: 'Animation type for row movement',
      table: { defaultValue: { summary: "'flip'" } },
    },
  },
  args: {
    handlePosition: 'start',
    keyboardEnabled: true,
    showHandleOnHover: false,
    animation: 'flip',
  },
};
export default meta;

type Story = StoryObj<RowReorderArgs>;

/**
 * Drag rows using the grip handle to reorder them, or use Ctrl+Up/Down
 * to move the focused row with the keyboard.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        transform: (_code: string, ctx: { args: RowReorderArgs }) => generateRowReorderCode(ctx.args),
        language: 'html',
      },
    },
  },
  render: (args) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new RowReorderPlugin({
          handlePosition: args.handlePosition,
          keyboardEnabled: args.keyboardEnabled,
          showHandleOnHover: args.showHandleOnHover,
          animation: args.animation,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * The drag handle can be placed at the end of each row.
 */
export const HandleAtEnd: Story = {
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new RowReorderPlugin({
          handlePosition: 'end',
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Show the drag handle only when hovering over a row.
 */
export const HandleOnHover: Story = {
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new RowReorderPlugin({
          showHandleOnHover: true,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Cancel the row move by calling `event.preventDefault()` in
 * the `row-move` event handler.
 */
export const CancelableEvent: Story = {
  render: () => {
    const container = document.createElement('div');
    container.style.height = '350px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const status = document.createElement('div');
    status.style.padding = '8px';
    status.style.marginBottom = '8px';
    status.style.background = 'var(--tbw-color-bg-alt)';
    status.style.borderRadius = '4px';
    status.textContent = 'Try moving "Bob" - it will be blocked!';
    container.appendChild(status);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.flex = '1';

    grid.gridConfig = {
      columns,
      plugins: [new RowReorderPlugin()],
    };
    grid.rows = sampleData;

    // Prevent moving Bob
    grid.addEventListener('row-move', (e) => {
      const detail = (e as CustomEvent).detail;
      if (detail.row.name === 'Bob') {
        e.preventDefault();
        status.textContent = '❌ Cannot move Bob!';
        status.style.background = 'var(--tbw-color-danger-light)';
      } else {
        status.textContent = `✓ Moved ${detail.row.name} from index ${detail.fromIndex} to ${detail.toIndex}`;
        status.style.background = 'var(--tbw-color-success-light)';
      }
    });

    container.appendChild(grid);
    return container;
  },
};
