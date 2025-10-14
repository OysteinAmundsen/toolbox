import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { ClipboardPlugin } from './ClipboardPlugin';
import { SelectionPlugin } from '../selection/SelectionPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    enableRangeSelection: {
      control: { type: 'boolean' },
      description: 'Enable range selection (drag to select multiple cells)',
      table: { category: 'Selection' },
    },
    includeHeaders: {
      control: { type: 'boolean' },
      description: 'Include column headers when copying',
      table: { category: 'Clipboard' },
    },
    delimiter: {
      control: { type: 'select' },
      options: ['tab', 'comma', 'semicolon'],
      mapping: { tab: '\t', comma: ',', semicolon: ';' },
      description: 'Column delimiter for copied text',
      table: { category: 'Clipboard' },
    },
    quoteStrings: {
      control: { type: 'boolean' },
      description: 'Wrap string values in quotes',
      table: { category: 'Clipboard' },
    },
  },
  args: {
    enableRangeSelection: true,
    includeHeaders: false,
    delimiter: 'tab',
    quoteStrings: false,
  },
};
export default meta;

interface ClipboardArgs {
  enableRangeSelection: boolean;
  includeHeaders: boolean;
  delimiter: string;
  quoteStrings: boolean;
}
type Story = StoryObj<ClipboardArgs>;

/**
 * ## Clipboard Copy/Paste
 *
 * The clipboard plugin enables Ctrl+C to copy and Ctrl+V to paste.
 *
 * - **With rows selected:** Copy all selected rows as a range
 * - **With no selection:** Copy the focused cell only
 *
 * **Works with or without the Selection plugin.**
 */
export const Clipboard: Story = {
  render: (args: ClipboardArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (
      __$enableRangeSelection$: boolean,
      __$includeHeaders$: boolean,
      __$delimiter$: string,
      __$quoteStrings$: boolean
    ) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'email', header: 'Email' },
          { field: 'department', header: 'Department' },
        ],
        plugins: [
          // Selection plugin enables range copy; disable for single-cell only
          new SelectionPlugin(__$enableRangeSelection$ ? { mode: 'range' } : { enabled: false }),
          new ClipboardPlugin({
            includeHeaders: __$includeHeaders$,
            delimiter: __$delimiter$,
            quoteStrings: __$quoteStrings$,
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
        { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
        { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering' },
        { id: 4, name: 'Dan', email: 'dan@example.com', department: 'Sales' },
      ];

      grid.addEventListener('copy', (e: CustomEvent) => {
        console.log('Copied:', e.detail);
      });

      grid.addEventListener('paste', (e: CustomEvent) => {
        console.log('Pasted:', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.enableRangeSelection, args.includeHeaders, args.delimiter, args.quoteStrings);

    // Build the view first
    const view = buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-clipboard',
      plugins: [
        { className: 'SelectionPlugin', path: 'plugins/selection' },
        { className: 'ClipboardPlugin', path: 'plugins/clipboard' },
      ],
      description: `
        <p>The <strong>Clipboard</strong> plugin enables copy/paste with keyboard shortcuts.</p>
        <p><strong>Selection mode:</strong> ${
          args.enableRangeSelection
            ? 'Selection plugin enabled — click and drag to select multiple cells'
            : 'single cell copy only'
        }</p>
        <p><strong>Try it:</strong></p>
        <ol>
          ${
            args.enableRangeSelection
              ? '<li><strong>Range copy:</strong> Click and drag, or Shift+click to select a range, then <code>Ctrl+C</code></li>'
              : ''
          }
          <li><strong>Single cell:</strong> Click a cell, then <code>Ctrl+C</code></li>
          <li>Paste into Excel, Google Sheets, or a text editor</li>
        </ol>
        <div id="clipboard-preview" style="margin-top: 16px; padding: 12px; background: var(--tbw-code-bg, #1e1e1e); border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #9cdcfe; min-height: 40px;">
          <em style="color: #6a9955;">Press Ctrl+C to see copied content here...</em>
        </div>
      `,
    });

    // Listen for copy events and update the preview
    grid.addEventListener('copy', ((e: CustomEvent) => {
      const preview = view.querySelector('#clipboard-preview');
      if (preview) {
        const { text, rowCount, columnCount } = e.detail;
        const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        preview.innerHTML = `<span style="color: #6a9955;">// Copied ${rowCount} row(s) × ${columnCount} column(s)</span>\n${escapedText}`;
      }
    }) as EventListener);

    return view;
  },
};
