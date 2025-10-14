import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { FilteringPlugin } from './FilteringPlugin';
import type { FilterPanelParams } from './types';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    debounceMs: {
      control: { type: 'range', min: 0, max: 1000, step: 50 },
      description: 'Debounce delay in ms for filter search',
      table: { category: 'Filtering' },
    },
    caseSensitive: {
      control: { type: 'boolean' },
      description: 'Case-sensitive text filtering',
      table: { category: 'Filtering' },
    },
  },
  args: {
    debounceMs: 150,
    caseSensitive: false,
  },
};
export default meta;

interface FilteringArgs {
  debounceMs: number;
  caseSensitive: boolean;
}
type Story = StoryObj<FilteringArgs>;

/**
 * ## Column Filtering
 *
 * The filtering plugin enables column-based filtering with filter buttons
 * in the header. Click the filter icon to open a dropdown panel with:
 * - Search input to find specific values
 * - Checkbox list to include/exclude values
 * - Select All / Clear quick actions
 * - Apply and Clear Filter buttons
 *
 * The **Status** column uses a custom filter panel to demonstrate the
 * `filterPanelRenderer` option for bringing your own UI.
 */
export const Filtering: Story = {
  render: (args: FilteringArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$debounceMs$: number, __$caseSensitive$: boolean) => {
      // Custom filter panel for the Status column (radio-button style)
      const statusFilterPanel = (container: HTMLElement, params: FilterPanelParams) => {
        container.innerHTML = `
          <div style="padding: 8px; min-width: 140px;">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--tbw-color-fg);">
              Filter by Status
            </div>
            <div class="status-options"></div>
            <button class="clear-btn" style="margin-top: 8px; width: 100%; padding: 6px; cursor: pointer;">
              Clear
            </button>
          </div>
        `;

        const optionsDiv = container.querySelector('.status-options');
        if (!optionsDiv) return;

        const options = ['All', ...params.uniqueValues.map((v) => String(v))];

        options.forEach((opt) => {
          const label = document.createElement('label');
          label.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 4px 0; cursor: pointer;';
          const isAll = opt === 'All';
          label.innerHTML = `<input type="radio" name="status" value="${opt}" ${
            isAll && params.excludedValues.size === 0 ? 'checked' : ''
          }> ${opt}`;
          const input = label.querySelector('input');
          if (input) {
            input.addEventListener('change', () => {
              if (isAll) {
                params.clearFilter();
              } else {
                // Exclude all except selected
                const excluded = params.uniqueValues.filter((v) => String(v) !== opt);
                params.applySetFilter(excluded);
              }
            });
          }
          optionsDiv.appendChild(label);
        });

        const clearBtn = container.querySelector('.clear-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => params.clearFilter());
        }
      };

      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number', filterable: false },
          { field: 'name', header: 'Name' },
          { field: 'department', header: 'Department' },
          { field: 'salary', header: 'Salary', type: 'number' },
          { field: 'status', header: 'Status' }, // Uses custom panel
        ],
        plugins: [
          new FilteringPlugin({
            debounceMs: __$debounceMs$,
            caseSensitive: __$caseSensitive$,
            filterPanelRenderer: (container, params) => {
              // Use custom panel only for Status column
              if (params.field === 'status') {
                statusFilterPanel(container, params);
              } else {
                // Return undefined to use default panel
                return undefined;
              }
            },
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, status: 'Active' },
        { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, status: 'Active' },
        { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, status: 'On Leave' },
        { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, status: 'Active' },
        { id: 5, name: 'Eve Davis', department: 'Marketing', salary: 72000, status: 'Inactive' },
        { id: 6, name: 'Frank Miller', department: 'Engineering', salary: 98000, status: 'Active' },
        { id: 7, name: 'Grace Lee', department: 'Sales', salary: 82000, status: 'Active' },
        { id: 8, name: 'Henry Wilson', department: 'HR', salary: 68000, status: 'Active' },
        { id: 9, name: 'Ivy Chen', department: 'Engineering', salary: 112000, status: 'Active' },
        { id: 10, name: 'Jack Taylor', department: 'Marketing', salary: 78000, status: 'On Leave' },
      ];

      grid.addEventListener('filter-change', (e: CustomEvent) => {
        console.log('filter-change', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.debounceMs, args.caseSensitive);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-filtering',
      plugins: [{ className: 'FilteringPlugin', path: 'plugins/filtering' }],
      types: [{ name: 'FilterPanelParams', path: 'plugins/filtering/types' }],
      description: `
        <p>The <strong>Filtering</strong> plugin enables column-based data filtering with a dropdown panel UI.</p>
        <p><strong>Try it:</strong> Click the filter icon (⊻) in any column header to open the filter panel.</p>
        <ul>
          <li><strong>Default panel:</strong> Name, Department, Salary columns use the built-in checkbox panel</li>
          <li><strong>Custom panel:</strong> The <strong>Status</strong> column uses a custom radio-button panel via <code>filterPanelRenderer</code></li>
        </ul>
        <p>Active filters show a blue indicator dot on the column header.</p>
      `,
    });
  },
};
