/**
 * Employee Management Grid Factory
 *
 * Pure factory function that creates a fully configured employee grid element.
 * Decoupled from the route shell so the docs site can call `createEmployeeGrid()`
 * directly via the `@demo/vanilla` alias.
 */

// Import shared demo styles (applies to document)
import '@demo/shared/employee-management/demo-styles.css';

// Import the grid component (registers <tbw-grid> custom element)
import '@toolbox-web/grid';

// Import grid factory and plugins
import { createGrid, type DataGridElement } from '@toolbox-web/grid/all';

// Import shared data generators and types
import { generateEmployees, type Employee } from '@demo/shared/employee-management';

// Import grid configuration from separate file
import { createGridConfig, type GridConfigOptions } from './grid-config';

// Import tool panel registration
import { injectToolPanelStyles, registerAnalyticsPanel, registerQuickFiltersPanel } from './tool-panels';

/**
 * Options for creating an employee grid.
 * Extends GridConfigOptions with row count.
 */
export interface EmployeeGridOptions extends GridConfigOptions {
  rowCount: number;
}

/**
 * Creates a fully configured employee management grid.
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
  exportCsvBtn.onclick = () => grid.getPluginByName?.('export')?.exportCsv?.({ fileName: 'employees' });

  const exportExcelBtn = document.createElement('button');
  exportExcelBtn.className = 'tbw-toolbar-btn';
  exportExcelBtn.setAttribute('title', 'Export Excel');
  exportExcelBtn.setAttribute('aria-label', 'Export Excel');
  exportExcelBtn.textContent = '📊';
  exportExcelBtn.onclick = () => grid.getPluginByName?.('export')?.exportExcel?.({ fileName: 'employees' });

  toolButtons.appendChild(exportCsvBtn);
  toolButtons.appendChild(exportExcelBtn);
  grid.appendChild(toolButtons);

  // Apply configuration
  grid.gridConfig = createGridConfig(configOptions);

  // Set initial data
  grid.rows = generateEmployees(rowCount);

  // Register tool panels and inject styles after grid is ready
  grid.ready?.().then(() => {
    registerQuickFiltersPanel(grid);
    registerAnalyticsPanel(grid);
    grid.refreshShellHeader?.();
    injectToolPanelStyles(grid);
  });

  return grid;
}

// Re-export config helpers so consumers can build their own grid variants
export { createGridConfig, type GridConfigOptions } from './grid-config';
