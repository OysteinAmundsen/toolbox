import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { UndoRedoPlugin } from './UndoRedoPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    maxHistorySize: {
      control: { type: 'range', min: 10, max: 200, step: 10 },
      description: 'Maximum number of actions to keep in history',
      table: { category: 'Undo/Redo' },
    },
  },
  args: {
    maxHistorySize: 100,
  },
};
export default meta;

interface UndoRedoArgs {
  maxHistorySize: number;
}
type Story = StoryObj<UndoRedoArgs>;

/**
 * ## Undo/Redo
 *
 * Track cell edits and enable Ctrl+Z to undo and Ctrl+Y to redo.
 * Edit cells in the grid, then use keyboard shortcuts to undo/redo changes.
 */
export const UndoRedo: Story = {
  render: (args: UndoRedoArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$maxHistorySize$: number) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name', editable: true },
          { field: 'quantity', header: 'Quantity', type: 'number', editable: true },
          { field: 'price', header: 'Price', type: 'number', editable: true },
        ],
        plugins: [
          new UndoRedoPlugin({
            maxHistorySize: __$maxHistorySize$,
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Widget A', quantity: 10, price: 25.99 },
        { id: 2, name: 'Widget B', quantity: 5, price: 49.99 },
        { id: 3, name: 'Widget C', quantity: 20, price: 15.0 },
      ];

      grid.addEventListener('undo', (e: CustomEvent) => {
        console.log('Undo:', e.detail);
      });

      grid.addEventListener('redo', (e: CustomEvent) => {
        console.log('Redo:', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.maxHistorySize);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-undo-redo',
      plugins: [{ className: 'UndoRedoPlugin', path: 'plugins/undo-redo' }],
      description: `
        <p><strong>Try it:</strong> Double-click any editable cell (Name, Quantity, or Price) to edit it, 
        then use keyboard shortcuts to undo/redo your changes.</p>
        <ul>
          <li><code>Ctrl+Z</code> (or <code>Cmd+Z</code> on Mac) — Undo the last edit</li>
          <li><code>Ctrl+Y</code> or <code>Ctrl+Shift+Z</code> — Redo the last undone edit</li>
        </ul>
        <p>The plugin maintains separate undo and redo stacks. Performing a new edit after undoing 
        will clear the redo stack. History is limited to ${args.maxHistorySize} actions.</p>
      `,
    });
  },
};
