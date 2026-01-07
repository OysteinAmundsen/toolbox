/**
 * Employee Management System Demo
 *
 * A comprehensive real-world demo showcasing @toolbox-web/grid capabilities
 * in an enterprise employee management scenario.
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite';
// Use relative import for Storybook HMR (enables live reload during development)
import {
  ClipboardPlugin,
  ColumnVirtualizationPlugin,
  ContextMenuPlugin,
  ExportPlugin,
  FilteringPlugin,
  GroupingColumnsPlugin,
  GroupingRowsPlugin,
  MasterDetailPlugin,
  MultiSortPlugin,
  PinnedColumnsPlugin,
  PinnedRowsPlugin,
  ReorderPlugin,
  SelectionPlugin,
  UndoRedoPlugin,
  VisibilityPlugin,
} from '../src/all';
import '../src/index';

import { DEPARTMENTS, generateEmployees } from './data';
import { bonusSliderEditor, dateEditor, starRatingEditor, statusSelectEditor } from './editors';
import './employee-management.css';
import { createDetailRenderer, ratingRenderer, statusViewRenderer, topPerformerRenderer } from './renderers';
// Import tool panel styles as inline string to inject into shadow DOM
import toolPanelStyles from './tool-panel-styles.css?inline';
import type { AllFeaturesArgs, Employee, GridElement } from './types';

type Story = StoryObj<AllFeaturesArgs>;

const meta: Meta = {
  title: 'Demos/Employee Management',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    rowCount: {
      control: { type: 'range', min: 50, max: 1000, step: 50 },
      description: 'Number of data rows',
      table: { category: 'Data' },
    },
    enableSelection: {
      control: 'boolean',
      description: 'Enable cell/row selection',
      table: { category: 'Features' },
    },
    enableFiltering: {
      control: 'boolean',
      description: 'Enable column filtering',
      table: { category: 'Features' },
    },
    enableSorting: {
      control: 'boolean',
      description: 'Enable multi-column sorting',
      table: { category: 'Features' },
    },
    enableEditing: {
      control: 'boolean',
      description: 'Enable inline editing',
      table: { category: 'Features' },
    },
    enableMasterDetail: {
      control: 'boolean',
      description: 'Enable expandable detail rows',
      table: { category: 'Features' },
    },
    enableRowGrouping: {
      control: 'boolean',
      description: 'Enable row grouping by department',
      table: { category: 'Features' },
    },
  },
  args: {
    rowCount: 200,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
    enableMasterDetail: true,
    enableRowGrouping: false,
  },
};
export default meta;

/**
 * ## Enterprise Employee Management Grid
 *
 * This comprehensive demo simulates a **real-world enterprise employee management system**
 * with all major grid features enabled.
 *
 * ### Features Demonstrated
 * - **200+ employees** with realistic data
 * - **Column groups** organizing related fields
 * - **Custom editors**: Star ratings, bonus sliders, status selects, date pickers
 * - **Custom renderers**: Status badges, rating colors, star indicators
 * - **Selection, sorting, filtering, export**
 * - **Master-detail** with expandable rows
 * - **Shell integration** with header stats and tool panels
 *
 * ### Try These Actions
 * 1. Double-click Rating column to use the star picker
 * 2. Double-click Bonus column to use the slider
 * 3. Click the 🔍 icon to open Quick Filters panel
 * 4. Right-click for context menu options
 */
export const AllFeatures: Story = {
  parameters: {
    docs: {
      source: {
        code: '// See full source code in libs/grid/demo/',
        language: 'typescript',
      },
    },
  },
  render: (args: AllFeaturesArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.className = 'demo-grid';

    // Detect fullscreen/standalone mode (no Storybook chrome)
    const isFullscreen = () => {
      // Check if we're in isolated story view (toolbar "Open in new tab" or fullscreen)
      const inIframe = window.self !== window.top;
      const isStandaloneStory = !inIframe && window.location.search.includes('viewMode=story');
      const isDocsEmbed = document.querySelector('.docs-story') !== null;
      return isStandaloneStory || (!inIframe && !isDocsEmbed);
    };

    // Apply fullscreen class after a frame to let Storybook render
    requestAnimationFrame(() => {
      if (isFullscreen()) {
        grid.classList.add('demo-grid--fullscreen');
      }
    });

    grid.gridConfig = {
      shell: {
        header: {
          title: 'Employee Management System',
          toolbarButtons: [
            {
              id: 'export-csv',
              label: 'Export CSV',
              icon: '📄',
              order: 10,
              action: () => grid.getPlugin(ExportPlugin)?.exportCsv({ fileName: 'employees' }),
            },
            {
              id: 'export-excel',
              label: 'Export Excel',
              icon: '📊',
              order: 11,
              action: () => grid.getPlugin(ExportPlugin)?.exportExcel({ fileName: 'employees' }),
            },
          ],
        },
        toolPanel: { position: 'right', width: 300 },
      },
      columnGroups: [
        { id: 'employee', header: 'Employee Info', children: ['id', 'firstName', 'lastName', 'email'] },
        { id: 'organization', header: 'Organization', children: ['department', 'team', 'title', 'level'] },
        { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
        {
          id: 'status',
          header: 'Status & Performance',
          children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
        },
      ],
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 70, sortable: true },
        {
          field: 'firstName',
          header: 'First Name',
          minWidth: 100,
          editable: args.enableEditing,
          sortable: true,
          resizable: true,
        },
        {
          field: 'lastName',
          header: 'Last Name',
          minWidth: 100,
          editable: args.enableEditing,
          sortable: true,
          resizable: true,
        },
        { field: 'email', header: 'Email', minWidth: 200, resizable: true },
        {
          field: 'department',
          header: 'Dept',
          width: 120,
          sortable: true,
          editable: args.enableEditing,
          type: 'select',
          options: DEPARTMENTS.map((d) => ({ label: d, value: d })),
        },
        { field: 'team', header: 'Team', width: 110, sortable: true },
        { field: 'title', header: 'Title', minWidth: 160, editable: args.enableEditing, resizable: true },
        {
          field: 'level',
          header: 'Level',
          width: 90,
          sortable: true,
          editable: args.enableEditing,
          type: 'select',
          options: ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'].map((l) => ({ label: l, value: l })),
        },
        {
          field: 'salary',
          header: 'Salary',
          type: 'number',
          width: 110,
          editable: args.enableEditing,
          sortable: true,
          resizable: true,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        },
        {
          field: 'bonus',
          header: 'Bonus',
          type: 'number',
          width: 180,
          sortable: true,
          editable: args.enableEditing,
          editor: bonusSliderEditor,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        },
        {
          field: 'status',
          header: 'Status',
          width: 140,
          sortable: true,
          editable: args.enableEditing,
          editor: statusSelectEditor,
          viewRenderer: statusViewRenderer,
        },
        {
          field: 'hireDate',
          header: 'Hire Date',
          type: 'date',
          width: 130,
          sortable: true,
          editable: args.enableEditing,
          editor: dateEditor,
        },
        {
          field: 'rating',
          header: 'Rating',
          type: 'number',
          width: 120,
          sortable: true,
          editable: args.enableEditing,
          editor: starRatingEditor,
          viewRenderer: ratingRenderer,
        },
        { field: 'isTopPerformer', header: '⭐', type: 'boolean', width: 50, viewRenderer: topPerformerRenderer },
        { field: 'location', header: 'Location', width: 110, sortable: true },
      ],
      editOn: 'dblClick',
      plugins: [
        ...(args.enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
        ...(args.enableSorting ? [new MultiSortPlugin()] : []),
        ...(args.enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
        new ClipboardPlugin(),
        new ContextMenuPlugin(),
        new ReorderPlugin(),
        new GroupingColumnsPlugin(),
        new PinnedColumnsPlugin(),
        new ColumnVirtualizationPlugin(),
        new VisibilityPlugin(),
        ...(args.enableRowGrouping
          ? [
              new GroupingRowsPlugin({
                groupOn: (row: Employee) => row.department,
                defaultExpanded: true,
                showRowCount: true,
                aggregators: { salary: 'sum', rating: 'avg' },
              }),
            ]
          : []),
        ...(!args.enableRowGrouping && args.enableMasterDetail
          ? [
              new MasterDetailPlugin({
                detailRenderer: (row: Employee) => createDetailRenderer(row),
                showExpandColumn: true,
                animation: 'slide',
              }),
            ]
          : []),
        ...(args.enableEditing ? [new UndoRedoPlugin({ maxHistorySize: 100 })] : []),
        new ExportPlugin(),
        new PinnedRowsPlugin({
          position: 'bottom',
          showRowCount: true,
          showFilteredCount: true,
          aggregationRows: [
            {
              id: 'totals',
              position: 'bottom',
              cells: {
                id: 'Summary:',
                salary: (rows: unknown[]) =>
                  (rows as Employee[])
                    .reduce((acc, r) => acc + (r.salary || 0), 0)
                    .toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
                bonus: (rows: unknown[]) =>
                  (rows as Employee[])
                    .reduce((acc, r) => acc + (r.bonus || 0), 0)
                    .toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
                rating: (rows: unknown[]) => {
                  const vals = (rows as Employee[]).map((r) => r.rating).filter(Boolean);
                  return vals.length ? `Avg: ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)}` : '';
                },
              },
            },
          ],
        }),
      ],
    };

    grid.rows = generateEmployees(args.rowCount);

    // Inject tool panel styles into shadow DOM (needed since panels render inside shadow root)
    injectToolPanelStyles(grid);

    // Register shell header content
    registerHeaderStats(grid, args);

    // Register tool panels
    registerQuickFiltersPanel(grid);
    registerAnalyticsPanel(grid);

    return grid;
  },
};

/**
 * ## Row Grouping Demo
 * Employees grouped by department with aggregate calculations.
 */
export const GroupedByDepartment: Story = {
  args: {
    rowCount: 150,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
    enableMasterDetail: false,
    enableRowGrouping: true,
  },
  render: (args: AllFeaturesArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.className = 'demo-grid';

    // Detect fullscreen/standalone mode (no Storybook chrome)
    const isFullscreen = () => {
      const inIframe = window.self !== window.top;
      const isStandaloneStory = !inIframe && window.location.search.includes('viewMode=story');
      const isDocsEmbed = document.querySelector('.docs-story') !== null;
      return isStandaloneStory || (!inIframe && !isDocsEmbed);
    };

    requestAnimationFrame(() => {
      if (isFullscreen()) {
        grid.classList.add('demo-grid--fullscreen');
      }
    });

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 70, sortable: true },
        { field: 'firstName', header: 'First Name', minWidth: 100, sortable: true },
        { field: 'lastName', header: 'Last Name', minWidth: 100, sortable: true },
        { field: 'department', header: 'Dept', width: 120, sortable: true },
        { field: 'team', header: 'Team', width: 110, sortable: true },
        { field: 'title', header: 'Title', minWidth: 160 },
        { field: 'level', header: 'Level', width: 90, sortable: true },
        {
          field: 'salary',
          header: 'Salary',
          type: 'number',
          width: 110,
          sortable: true,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        },
        { field: 'rating', header: 'Rating', type: 'number', width: 80, sortable: true },
        { field: 'location', header: 'Location', width: 110, sortable: true },
      ],
      plugins: [
        ...(args.enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
        ...(args.enableSorting ? [new MultiSortPlugin()] : []),
        ...(args.enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
        new ClipboardPlugin(),
        new ContextMenuPlugin(),
        new PinnedColumnsPlugin(),
        new VisibilityPlugin(),
        new ExportPlugin(),
        new GroupingRowsPlugin({
          groupOn: (row: Employee) => row.department,
          defaultExpanded: true,
          showRowCount: true,
          indentWidth: 24,
          aggregators: { salary: 'sum', rating: 'avg' },
        }),
        new PinnedRowsPlugin({ position: 'bottom', showRowCount: true, showFilteredCount: true }),
      ],
    };

    grid.rows = generateEmployees(args.rowCount);
    return grid;
  },
};

// =============================================================================
// SHELL REGISTRATIONS - Header content and tool panels
// =============================================================================

/**
 * Injects tool panel styles into the grid's shadow DOM.
 * This is necessary because tool panels render inside the shadow root,
 * which doesn't have access to external stylesheets.
 */
function injectToolPanelStyles(grid: GridElement): void {
  // Wait for grid to be fully ready (shadow DOM created)
  grid.ready().then(() => {
    const shadow = grid.shadowRoot;
    if (!shadow) return;

    // Check if already injected
    if (shadow.querySelector('#demo-tool-panel-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'demo-tool-panel-styles';
    styleEl.textContent = toolPanelStyles;
    shadow.appendChild(styleEl);
  });
}

function registerHeaderStats(grid: GridElement, args: AllFeaturesArgs): void {
  grid.registerHeaderContent({
    id: 'row-stats',
    render: (container: HTMLElement) => {
      const statsEl = document.createElement('div');
      statsEl.className = 'header-stats';
      statsEl.innerHTML = `
        <span><strong>${args.rowCount}</strong> employees</span>
        <span class="header-stats__divider"></span>
        <span class="selection-count">No selection</span>
      `;
      container.appendChild(statsEl);

      const handleSelection = () => {
        const plugin = grid.getPlugin(SelectionPlugin);
        if (!plugin) return;
        const ranges = plugin.getRanges?.() || [];
        const count = ranges.reduce(
          (sum: number, r: { from: { row: number; col: number }; to: { row: number; col: number } }) => {
            return sum + (Math.abs(r.to.row - r.from.row) + 1) * (Math.abs(r.to.col - r.from.col) + 1);
          },
          0,
        );
        statsEl.querySelector('.selection-count')!.textContent = count > 0 ? `${count} cells selected` : 'No selection';
      };

      grid.addEventListener('selection-change', handleSelection);
      return () => {
        grid.removeEventListener('selection-change', handleSelection);
        statsEl.remove();
      };
    },
  });
}

function registerQuickFiltersPanel(grid: GridElement): void {
  grid.registerToolPanel({
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
        const plugin = grid.getPlugin(FilteringPlugin);
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
        grid.getPlugin(FilteringPlugin)?.clearAllFilters?.();
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

function registerAnalyticsPanel(grid: GridElement): void {
  grid.registerToolPanel({
    id: 'analytics',
    title: 'Analytics',
    icon: '📈',
    tooltip: 'View data analytics and insights',
    order: 20,
    render: (container: HTMLElement) => {
      const rows = grid.rows as Employee[];
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
