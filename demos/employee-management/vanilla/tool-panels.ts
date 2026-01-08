/**
 * Tool Panels for the Vanilla Employee Management Demo
 *
 * Tool panels are registered with the grid's shell and appear in a sidebar.
 */

import { DEPARTMENTS, type Employee, type GridElement } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';
import { FilteringPlugin } from '@toolbox-web/grid/all';

/**
 * Injects all demo styles into the grid's shadow DOM.
 * This includes styles for editors, renderers, and tool panels.
 *
 * Uses the grid's registerStyles() API which is the recommended way
 * to inject custom styles into the grid's shadow DOM.
 */
export function injectToolPanelStyles(grid: GridElement): void {
  // Use the public API to register custom styles
  const registerStyles = (grid as { registerStyles?: (id: string, css: string) => void }).registerStyles;
  if (registerStyles) {
    registerStyles.call(grid, 'demo-styles', shadowDomStyles);
  } else {
    console.warn('[injectToolPanelStyles] registerStyles not available on grid');
  }
}

/**
 * Registers the Quick Filters tool panel.
 */
export function registerQuickFiltersPanel(grid: GridElement): void {
  const registerToolPanel = grid.registerToolPanel as (config: unknown) => void;
  if (!registerToolPanel) return;

  registerToolPanel.call(grid, {
    id: 'quick-filters',
    title: 'Quick Filters',
    icon: '🔍',
    tooltip: 'Apply quick filters to the data',
    order: 10,
    render: (container: HTMLElement) => {
      const content = document.createElement('div');
      content.className = 'tool-panel-content';
      content.innerHTML = `
        <div class="filter-section">
          <label class="filter-label">Department</label>
          <select id="dept-filter" class="filter-select">
            <option value="">All Departments</option>
            ${DEPARTMENTS.map((d) => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="filter-section">
          <label class="filter-label">Level</label>
          <div class="filter-pills">
            ${['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director']
              .map(
                (l) => `
              <label class="filter-pill"><input type="checkbox" value="${l}" class="level-filter"><span>${l}</span></label>
            `,
              )
              .join('')}
          </div>
        </div>
        <div class="filter-section">
          <label class="filter-label">Status</label>
          <div class="filter-pills">
            ${['Active', 'Remote', 'On Leave', 'Contract', 'Terminated']
              .map(
                (s) => `
              <label class="filter-pill"><input type="checkbox" value="${s}" class="status-filter"><span>${s}</span></label>
            `,
              )
              .join('')}
          </div>
        </div>
        <div class="filter-section">
          <label class="filter-label">Rating</label>
          <div class="filter-range">
            <input type="range" id="rating-filter" min="0" max="5" step="0.5" value="0">
            <span id="rating-value" class="filter-range__value">≥ 0</span>
          </div>
        </div>
        <div class="filter-section">
          <label class="filter-checkbox"><input type="checkbox" id="top-performer-filter"><span>⭐ Top Performers Only</span></label>
        </div>
        <div class="filter-actions">
          <button id="apply-filters" class="btn-primary">Apply Filters</button>
          <button id="clear-filters" class="btn-secondary">Clear</button>
        </div>
      `;
      container.appendChild(content);

      // Pill toggle styling
      content.querySelectorAll('.level-filter, .status-filter').forEach((input) => {
        input.addEventListener('change', (e) => {
          const cb = e.target as HTMLInputElement;
          cb.closest('.filter-pill')?.classList.toggle('filter-pill--active', cb.checked);
        });
      });

      // Rating slider
      const ratingSlider = content.querySelector('#rating-filter') as HTMLInputElement;
      const ratingValue = content.querySelector('#rating-value') as HTMLElement;
      ratingSlider?.addEventListener('input', () => (ratingValue.textContent = `≥ ${ratingSlider.value}`));

      // Apply filters
      content.querySelector('#apply-filters')?.addEventListener('click', () => {
        const getPlugin = grid.getPlugin as (
          cls: unknown,
        ) => { clearAllFilters?: () => void; setFilter?: (field: string, filter: unknown) => void } | undefined;
        const plugin = getPlugin?.(FilteringPlugin);
        if (!plugin) return;
        plugin.clearAllFilters?.();

        const dept = (content.querySelector('#dept-filter') as HTMLSelectElement).value;
        if (dept) plugin.setFilter?.('department', { type: 'text', operator: 'equals', value: dept });

        const levels = Array.from(content.querySelectorAll('.level-filter:checked')).map(
          (el) => (el as HTMLInputElement).value,
        );
        if (levels.length) plugin.setFilter?.('level', { type: 'set', operator: 'in', value: levels });

        const statuses = Array.from(content.querySelectorAll('.status-filter:checked')).map(
          (el) => (el as HTMLInputElement).value,
        );
        if (statuses.length) plugin.setFilter?.('status', { type: 'set', operator: 'in', value: statuses });

        const minRating = parseFloat(ratingSlider.value);
        if (minRating > 0)
          plugin.setFilter?.('rating', { type: 'number', operator: 'greaterThanOrEqual', value: minRating });

        if ((content.querySelector('#top-performer-filter') as HTMLInputElement).checked) {
          plugin.setFilter?.('isTopPerformer', { type: 'boolean', operator: 'equals', value: true });
        }
      });

      // Clear filters
      content.querySelector('#clear-filters')?.addEventListener('click', () => {
        const getPlugin = grid.getPlugin as (cls: unknown) => { clearAllFilters?: () => void } | undefined;
        getPlugin?.(FilteringPlugin)?.clearAllFilters?.();
        (content.querySelector('#dept-filter') as HTMLSelectElement).value = '';
        content.querySelectorAll('.level-filter, .status-filter').forEach((input) => {
          (input as HTMLInputElement).checked = false;
          input.closest('.filter-pill')?.classList.remove('filter-pill--active');
        });
        ratingSlider.value = '0';
        ratingValue.textContent = '≥ 0';
        (content.querySelector('#top-performer-filter') as HTMLInputElement).checked = false;
      });

      return () => content.remove();
    },
  });
}

/**
 * Registers the Analytics tool panel.
 */
export function registerAnalyticsPanel(grid: GridElement): void {
  const registerToolPanel = grid.registerToolPanel as (config: unknown) => void;
  if (!registerToolPanel) return;

  registerToolPanel.call(grid, {
    id: 'analytics',
    title: 'Analytics',
    icon: '📈',
    tooltip: 'View data analytics and insights',
    order: 20,
    render: (container: HTMLElement) => {
      const rows = (grid.rows || []) as Employee[];
      const totalSalary = rows.reduce((sum, r) => sum + r.salary, 0);
      const avgSalary = totalSalary / rows.length;
      const avgRating = rows.reduce((sum, r) => sum + r.rating, 0) / rows.length;
      const topPerformers = rows.filter((r) => r.isTopPerformer).length;
      const deptCounts = rows.reduce(
        (acc, r) => ({ ...acc, [r.department]: (acc[r.department] || 0) + 1 }),
        {} as Record<string, number>,
      );
      const sortedDepts = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
      const largestDept = sortedDepts[0];

      const formatCurrency = (v: number) =>
        v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

      const content = document.createElement('div');
      content.className = 'analytics-content';
      content.innerHTML = `
        <div class="stat-cards">
          <div class="stat-card stat-card--payroll">
            <div class="stat-card__label">Total Payroll</div>
            <div class="stat-card__value">${formatCurrency(totalSalary)}</div>
          </div>
          <div class="stat-card stat-card--salary">
            <div class="stat-card__label">Avg Salary</div>
            <div class="stat-card__value">${formatCurrency(avgSalary)}</div>
          </div>
          <div class="stat-card stat-card--rating">
            <div class="stat-card__label">Avg Rating</div>
            <div class="stat-card__value">${avgRating.toFixed(1)} ★</div>
          </div>
          <div class="stat-card stat-card--performers">
            <div class="stat-card__label">Top Performers</div>
            <div class="stat-card__value">${topPerformers}</div>
          </div>
        </div>
        <div class="dept-distribution">
          <h4 class="dept-distribution__title">Department Distribution</h4>
          <div class="dept-bars">
            ${sortedDepts
              .slice(0, 6)
              .map(
                ([dept, count]) => `
              <div class="dept-bar">
                <span class="dept-bar__name" title="${dept}">${dept}</span>
                <div class="dept-bar__track"><div class="dept-bar__fill" style="width: ${(count / rows.length) * 100}%"></div></div>
                <span class="dept-bar__count">${count}</span>
              </div>
            `,
              )
              .join('')}
          </div>
        </div>
        <div class="largest-dept">
          <div class="largest-dept__label">Largest Department</div>
          <div class="largest-dept__value">${largestDept?.[0] || 'N/A'} <span class="largest-dept__count">(${largestDept?.[1] || 0} employees)</span></div>
        </div>
      `;
      container.appendChild(content);
      return () => content.remove();
    },
  });
}
