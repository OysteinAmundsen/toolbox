/**
 * Employee Management Route
 *
 * Mounts the employee-management demo (grid + control panel) into the host
 * element provided by the shell router.
 *
 * The pure grid factory lives in `./grid-factory` so the docs site can
 * import `createEmployeeGrid` without dragging the route shell along.
 */

import { generateEmployees } from '@demo/shared/employee-management';
import { createEmployeeGrid, type EmployeeGridOptions } from './grid-factory';

// Re-export for the docs site (`@demo/vanilla/employee-management`).
export { createEmployeeGrid, createGridConfig } from './grid-factory';
export type { EmployeeGridOptions, GridConfigOptions } from './grid-factory';

const CONTROL_PANEL_HTML = /* html */ `
  <div class="demo-container">
    <header class="demo-header">
      <div class="demo-controls">
        <label>
          <span class="row-count-display">Rows: <strong data-row-count-value>200</strong></span>
          <input type="range" data-row-count min="50" max="1000" step="50" value="200" />
        </label>
        <label><input type="checkbox" data-toggle="enableSelection" checked /> Selection</label>
        <label><input type="checkbox" data-toggle="enableFiltering" checked /> Filtering</label>
        <label><input type="checkbox" data-toggle="enableSorting" checked /> Sorting</label>
        <label><input type="checkbox" data-toggle="enableEditing" checked /> Editing</label>
        <label><input type="checkbox" data-toggle="enableMasterDetail" checked /> Master-Detail</label>
      </div>
    </header>
    <div class="grid-wrapper"></div>
  </div>
`;

type ToggleKey = Exclude<keyof EmployeeGridOptions, 'rowCount'>;

const TOGGLE_KEYS: readonly ToggleKey[] = [
  'enableSelection',
  'enableFiltering',
  'enableSorting',
  'enableEditing',
  'enableMasterDetail',
];

/**
 * Mount the employee-management route into `host`.
 * Returns a teardown function the router calls when navigating away.
 */
export function mount(host: HTMLElement): () => void {
  host.innerHTML = CONTROL_PANEL_HTML;

  const rowCountSlider = host.querySelector<HTMLInputElement>('[data-row-count]');
  const rowCountValue = host.querySelector<HTMLElement>('[data-row-count-value]');
  const wrapper = host.querySelector<HTMLDivElement>('.grid-wrapper');
  if (!rowCountSlider || !rowCountValue || !wrapper) {
    throw new Error('employee-management route: missing control panel elements');
  }

  const readControls = (): EmployeeGridOptions => {
    const opts: EmployeeGridOptions = { rowCount: parseInt(rowCountSlider.value, 10) };
    for (const key of TOGGLE_KEYS) {
      const input = host.querySelector<HTMLInputElement>(`[data-toggle="${key}"]`);
      if (input) opts[key] = input.checked;
    }
    return opts;
  };

  let grid = createEmployeeGrid(readControls());
  wrapper.appendChild(grid);

  rowCountSlider.addEventListener('input', () => {
    rowCountValue.textContent = rowCountSlider.value;
  });

  rowCountSlider.addEventListener('change', () => {
    grid.rows = generateEmployees(parseInt(rowCountSlider.value, 10));
  });

  // Plugin-toggle changes require full grid re-creation
  for (const key of TOGGLE_KEYS) {
    host.querySelector<HTMLInputElement>(`[data-toggle="${key}"]`)?.addEventListener('change', () => {
      grid.remove();
      grid = createEmployeeGrid(readControls());
      wrapper.appendChild(grid);
    });
  }

  return () => {
    grid.remove();
    host.innerHTML = '';
  };
}
