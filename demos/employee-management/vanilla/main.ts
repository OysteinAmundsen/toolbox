/**
 * Employee Management Demo - Vanilla TypeScript Implementation
 *
 * This demo showcases @toolbox-web/grid in a pure vanilla TypeScript setup.
 * No frameworks - just web standards and the grid component.
 *
 * Features demonstrated:
 * - Complete grid configuration with 15+ plugins
 * - Custom editors (star rating, bonus slider, status select, date picker)
 * - Custom view renderers (status badges, rating colors)
 * - Master-detail with expandable rows
 * - Shell integration (header, tool panels)
 * - Row grouping and aggregation
 */

// Import shared demo styles (applies to document)
import '@demo/shared/demo-styles.css';

// Import the grid component (registers <tbw-grid> custom element)
import '@toolbox-web/grid';

// Import grid factory and plugins
import { createGrid, ExportPlugin, type ColumnMoveDetail, type DataGridElement } from '@toolbox-web/grid/all';

// Import shared data generators and types
import { generateEmployees, type Employee } from '@demo/shared';

// Import grid configuration from separate file
import { COLUMN_GROUPS, createGridConfig, type GridConfigOptions } from './grid-config';

// Import tool panel registration
import { injectToolPanelStyles, registerAnalyticsPanel, registerQuickFiltersPanel } from './tool-panels';

// Re-export for Storybook and external use
export { COLUMN_GROUPS, createGridConfig, type GridConfigOptions } from './grid-config';

// =============================================================================
// GRID FACTORY - Creates a fully configured employee grid
// =============================================================================

/**
 * Options for creating an employee grid.
 * Extends GridConfigOptions with row count.
 */
export interface EmployeeGridOptions extends GridConfigOptions {
  rowCount: number;
}

/**
 * Creates a fully configured employee management grid.
 * This is the main entry point for both the vanilla demo and Storybook stories.
 *
 * @param options - Configuration options for the grid
 * @returns The configured grid element
 */
export function createEmployeeGrid(options: EmployeeGridOptions): DataGridElement<Employee> {
  const { rowCount, ...configOptions } = options;

  // Create the grid element using the typed factory function
  const grid = createGrid<Employee>();
  grid.id = 'employee-grid';
  grid.className = 'demo-grid';

  // Create toolbar buttons container (users have full control over button HTML)
  const toolButtons = document.createElement('tbw-grid-tool-buttons');

  const exportCsvBtn = document.createElement('button');
  exportCsvBtn.className = 'tbw-toolbar-btn';
  exportCsvBtn.setAttribute('title', 'Export CSV');
  exportCsvBtn.setAttribute('aria-label', 'Export CSV');
  exportCsvBtn.textContent = '📄';
  exportCsvBtn.onclick = () => grid.getPlugin?.(ExportPlugin)?.exportCsv?.({ fileName: 'employees' });

  const exportExcelBtn = document.createElement('button');
  exportExcelBtn.className = 'tbw-toolbar-btn';
  exportExcelBtn.setAttribute('title', 'Export Excel');
  exportExcelBtn.setAttribute('aria-label', 'Export Excel');
  exportExcelBtn.textContent = '📊';
  exportExcelBtn.onclick = () => grid.getPlugin?.(ExportPlugin)?.exportExcel?.({ fileName: 'employees' });

  toolButtons.appendChild(exportCsvBtn);
  toolButtons.appendChild(exportExcelBtn);
  grid.appendChild(toolButtons);

  // Apply configuration
  grid.gridConfig = createGridConfig(configOptions);

  // Set initial data
  grid.rows = generateEmployees(rowCount);

  // Demonstrate cancelable events: prevent columns from moving outside their groups
  // This shows the error flash animation when a move would break group contiguity
  grid.addEventListener('column-move', (e) => {
    const event = e as CustomEvent<ColumnMoveDetail>;
    const { field, columnOrder } = event.detail;

    // Find which group this field belongs to
    const sourceGroup = COLUMN_GROUPS.find((g) => g.children.includes(field));
    if (!sourceGroup) return; // Not in a group, allow the move

    // Get the indices of all columns in the source group (in the new/proposed order)
    const groupColumnIndices = sourceGroup.children
      .map((f) => columnOrder.indexOf(f))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);

    if (groupColumnIndices.length <= 1) return;

    // Check if the group columns are contiguous (no gaps between them)
    const minIndex = groupColumnIndices[0];
    const maxIndex = groupColumnIndices[groupColumnIndices.length - 1];
    const isContiguous = groupColumnIndices.length === maxIndex - minIndex + 1;

    if (!isContiguous) {
      console.log(`[Column Move Cancelled] Cannot move "${field}" outside its group "${sourceGroup.id}"`);
      event.preventDefault();

      // Flash the column header with error color to indicate cancellation
      const headerCell = grid.querySelector(`.header-row .cell[data-field="${field}"]`) as HTMLElement;
      if (headerCell) {
        headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
        headerCell.animate(
          [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
          { duration: 400, easing: 'ease-out' },
        );
      }
    }
  });

  // Register tool panels and inject styles after grid is ready
  grid.ready?.().then(() => {
    registerQuickFiltersPanel(grid);
    registerAnalyticsPanel(grid);
    grid.refreshShellHeader?.();
    injectToolPanelStyles(grid);
  });

  return grid;
}

// =============================================================================
// STANDALONE PAGE INITIALIZATION
// =============================================================================

/**
 * Initializes the demo when running as a standalone HTML page.
 * Wires up the control panel to dynamically reconfigure the grid.
 */
function initializeDemo() {
  // Get control panel elements (only exist in standalone HTML page)
  const rowCountSlider = document.getElementById('row-count') as HTMLInputElement | null;
  const rowCountValue = document.getElementById('row-count-value') as HTMLElement | null;

  if (!rowCountSlider) {
    // Not running as standalone page - skip initialization
    return;
  }

  // Get initial control values
  const getControlValues = (): EmployeeGridOptions => ({
    rowCount: parseInt(rowCountSlider.value, 10),
    enableSelection: (document.getElementById('enable-selection') as HTMLInputElement).checked,
    enableFiltering: (document.getElementById('enable-filtering') as HTMLInputElement).checked,
    enableSorting: (document.getElementById('enable-sorting') as HTMLInputElement).checked,
    enableEditing: (document.getElementById('enable-editing') as HTMLInputElement).checked,
    enableMasterDetail: (document.getElementById('enable-detail') as HTMLInputElement).checked,
  });

  // Create the grid and add it to the page
  const container = document.querySelector('.grid-wrapper');
  if (!container) return;

  let grid = createEmployeeGrid(getControlValues());
  container.appendChild(grid as unknown as HTMLElement);

  // Wire up row count slider
  rowCountSlider.addEventListener('input', () => {
    if (rowCountValue) rowCountValue.textContent = rowCountSlider.value;
  });

  rowCountSlider.addEventListener('change', () => {
    grid.rows = generateEmployees(parseInt(rowCountSlider.value, 10));
  });

  // Checkbox controls require full re-creation (plugins change)
  ['enable-selection', 'enable-filtering', 'enable-sorting', 'enable-editing', 'enable-detail'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      // Remove old grid and create new one
      (grid as unknown as HTMLElement).remove();
      grid = createEmployeeGrid(getControlValues());
      container.appendChild(grid as unknown as HTMLElement);
    });
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDemo);
} else {
  initializeDemo();
}
