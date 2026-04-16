/**
 * Filtering Plugin (Class-based)
 *
 * Provides comprehensive filtering functionality for tbw-grid.
 * Supports text, number, date, set, and boolean filters with caching.
 * Includes UI with filter buttons in headers and dropdown filter panels.
 */

import { announce, getA11yMessage } from '../../core/internal/aria';
import { BaseGridPlugin, type GridElement, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import { isUtilityColumn } from '../../core/plugin/expander-column';
import type { ColumnConfig, ColumnState } from '../../core/types';
import type { ContextMenuParams, HeaderContextMenuItem } from '../context-menu/types';
import {
  BLANK_FILTER_VALUE,
  computeFilterCacheKey,
  filterRows,
  getUniqueValues,
  getUniqueValuesBatch,
} from './filter-model';
import { renderDateFilterPanel } from './filter-panel-date';
import { renderDefaultFilterPanel } from './filter-panel-default';
import { renderNumberFilterPanel } from './filter-panel-number';
import styles from './filtering.css?inline';
import filterPanelStyles from './FilteringPlugin.css?inline';
import type { BlankMode, FilterChangeDetail, FilterConfig, FilterModel, FilterPanelParams } from './types';

/**
 * Filtering Plugin for tbw-grid
 *
 * Adds column header filters with text search, dropdown options, and custom filter panels.
 * Supports both **local filtering** for small datasets and **async handlers** for server-side
 * filtering on large datasets.
 *
 * ## Installation
 *
 * ```ts
 * import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
 * ```
 *
 * ## Column Configuration
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `filterable` | `boolean` | Enable filtering for this column |
 * | `filterType` | `'text' \| 'select' \| 'number' \| 'date'` | Filter UI type |
 * | `filterOptions` | `unknown[]` | Predefined options for select filters |
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-filter-panel-bg` | `var(--tbw-color-panel-bg)` | Panel background |
 * | `--tbw-filter-panel-fg` | `var(--tbw-color-fg)` | Panel text color |
 * | `--tbw-filter-panel-border` | `var(--tbw-color-border)` | Panel border |
 * | `--tbw-filter-active-color` | `var(--tbw-color-accent)` | Active filter indicator |
 * | `--tbw-filter-input-bg` | `var(--tbw-color-bg)` | Input background |
 * | `--tbw-filter-input-focus` | `var(--tbw-color-accent)` | Input focus border |
 *
 * @example Basic Usage with Filterable Columns
 * ```ts
 * import { queryGrid } from '@toolbox-web/grid';
 * import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
 *
 * const grid = queryGrid('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name', filterable: true },
 *     { field: 'status', header: 'Status', filterable: true, filterType: 'select' },
 *     { field: 'email', header: 'Email', filterable: true },
 *   ],
 *   plugins: [new FilteringPlugin({ debounceMs: 300 })],
 * };
 * grid.rows = data;
 * ```
 *
 * @example Column Formatters in Filter Panel
 * When a column defines a `format` function, the built-in set filter panel
 * displays formatted labels instead of raw values. Search within the panel
 * also matches against the formatted text.
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     {
 *       field: 'price',
 *       filterable: true,
 *       format: (value) => `$${Number(value).toFixed(2)}`,
 *       // Filter checkboxes show "$9.99" instead of "9.99"
 *     },
 *   ],
 *   plugins: [new FilteringPlugin()],
 * };
 * ```
 *
 * @example Server-Side Filtering with Async Handlers
 * ```ts
 * new FilteringPlugin({
 *   // Fetch unique values from server for filter dropdown
 *   valuesHandler: async (field, column) => {
 *     const response = await fetch(`/api/distinct-values?field=${field}`);
 *     return response.json();
 *   },
 *   // Apply filters on the server
 *   filterHandler: async (filters, currentRows) => {
 *     const response = await fetch('/api/data', {
 *       method: 'POST',
 *       body: JSON.stringify({ filters }),
 *     });
 *     return response.json();
 *   },
 * });
 * ```
 *
 * @see {@link FilterConfig} for all configuration options
 * @see {@link FilterModel} for filter data structure
 * @see {@link FilterPanelParams} for custom panel renderer parameters
 *
 * @internal Extends BaseGridPlugin
 */
export class FilteringPlugin extends BaseGridPlugin<FilterConfig> {
  /**
   * Plugin manifest - declares events emitted by this plugin.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    events: [
      {
        type: 'filter-change',
        description: 'Emitted when filter criteria change. Broadcast to both DOM consumers and plugin bus.',
      },
    ],
    queries: [
      {
        type: 'getContextMenuItems',
        description: 'Contributes filter-related items to the header context menu',
      },
    ],
  };

  /** @internal */
  readonly name = 'filtering';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<FilterConfig> {
    return {
      debounceMs: 300,
      caseSensitive: false,
      trimInput: true,
      useWorker: true,
    };
  }

  // #region Helpers

  /**
   * Check if filtering is enabled at the grid level.
   * Grid-wide `filterable: false` disables filtering for all columns.
   */
  private isFilteringEnabled(): boolean {
    return this.grid.effectiveConfig?.filterable !== false;
  }

  /**
   * Check if a specific column is filterable, respecting both grid-level and column-level settings.
   */
  private isColumnFilterable(col: { filterable?: boolean; field?: string }): boolean {
    if (!this.isFilteringEnabled()) return false;
    return col.filterable !== false;
  }

  /**
   * Build a map of field → filterValue extractor for columns that have one.
   * Used to pass array-aware value extraction to the pure filter functions.
   */
  private getFilterValues():
    | Map<string, (value: unknown, row: Record<string, unknown>) => unknown | unknown[]>
    | undefined {
    const columns = this.grid.effectiveConfig?.columns;
    if (!columns) return undefined;

    let map: Map<string, (value: unknown, row: Record<string, unknown>) => unknown | unknown[]> | undefined;
    for (const col of columns) {
      if (col.field && col.filterValue) {
        if (!map) map = new Map();
        map.set(col.field, col.filterValue);
      }
    }
    return map;
  }

  // #endregion

  // #region Internal State
  private filters: Map<string, FilterModel> = new Map();
  private cachedResult: unknown[] | null = null;
  private cacheKey: string | null = null;
  /** Spot-check of input rows for cache invalidation when upstream plugins (e.g. sort) change row order */
  private cachedInputSpot: { len: number; first: unknown; mid: unknown; last: unknown } | null = null;
  private openPanelField: string | null = null;
  private panelElement: HTMLElement | null = null;
  private panelAnchorElement: HTMLElement | null = null; // For CSS anchor positioning cleanup
  private panelButtonElement: HTMLElement | null = null; // Filter button that opened the panel
  private searchText: Map<string, string> = new Map();
  private excludedValues: Map<string, Set<unknown>> = new Map();
  private panelAbortController: AbortController | null = null; // For panel-scoped listeners
  private globalStylesInjected = false;

  /**
   * Compute the inclusion (selected) map from the current filters and excluded values.
   * For `notIn` filters this is: uniqueValues \ excludedValues.
   * For `in` filters this is the filter's own value array (no data scan needed).
   * Only includes entries for fields that have a set filter.
   */
  private computeSelected(): Record<string, unknown[]> {
    const selected: Record<string, unknown[]> = {};

    // Collect `notIn` fields that need unique value lookups
    const notInFields: {
      field: string;
      filterValue?: (value: unknown, row: Record<string, unknown>) => unknown | unknown[];
    }[] = [];

    for (const [field, filter] of this.filters) {
      if (filter.type !== 'set') continue;
      if (filter.operator === 'in' && Array.isArray(filter.value)) {
        // For `in` filters, the selected values ARE the filter values — no data scan needed
        selected[field] = filter.value;
        continue;
      }
      if (filter.operator === 'notIn') {
        const col = this.grid.effectiveConfig?.columns?.find((c) => c.field === field);
        notInFields.push({ field, filterValue: col?.filterValue });
      }
    }

    if (notInFields.length > 0) {
      // Single pass through sourceRows for notIn fields only
      const uniqueMap = getUniqueValuesBatch(this.sourceRows as Record<string, unknown>[], notInFields);
      for (const { field } of notInFields) {
        const excluded = this.excludedValues.get(field);
        const unique = uniqueMap.get(field) ?? [];
        selected[field] = excluded ? unique.filter((v) => !excluded.has(v)) : unique;
      }
    }

    return selected;
  }

  /**
   * Sync excludedValues map from a filter model (for set filters).
   * For `notIn` filters, the excluded values are stored directly.
   * For `in` filters, the complement is computed (allUnique - inValues)
   * so that the filter panel UI can render checked/unchecked states correctly.
   */
  private syncExcludedValues(field: string, filter: FilterModel | null): void {
    if (!filter) {
      this.excludedValues.delete(field);
    } else if (filter.type === 'set' && filter.operator === 'notIn' && Array.isArray(filter.value)) {
      this.excludedValues.set(field, new Set(filter.value));
    } else if (filter.type === 'set' && filter.operator === 'in' && Array.isArray(filter.value)) {
      // For `in` filters we need the complement (excluded = allUnique - included)
      // so the filter panel can render correct checkbox states.
      // This requires data to be loaded. If sourceRows is empty, defer — the
      // complement will be computed lazily when the panel opens.
      const sourceRows = this.sourceRows as Record<string, unknown>[];
      if (!sourceRows || sourceRows.length === 0) {
        this.excludedValues.delete(field);
        return;
      }
      const inValues = filter.value as unknown[];
      const included: Set<unknown> = new Set(inValues.map((v) => (v == null ? BLANK_FILTER_VALUE : v)));
      const unique = this.getUniqueValues(field);
      const excluded: Set<unknown> = new Set(unique.filter((v) => !included.has(v)));
      this.excludedValues.set(field, excluded);
    } else if (filter.type === 'set') {
      // Other set operators may have different semantics; clear for safety
      this.excludedValues.delete(field);
    }
  }
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);
    this.injectGlobalStyles();
  }

  /** @internal */
  override detach(): void {
    this.filters.clear();
    this.cachedResult = null;
    this.cacheKey = null;
    this.cachedInputSpot = null;
    this.openPanelField = null;
    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }
    this.searchText.clear();
    this.excludedValues.clear();
    // Abort panel-scoped listeners (document click handler, etc.)
    this.panelAbortController?.abort();
    this.panelAbortController = null;
  }
  // #endregion

  // #region Query Handlers

  /**
   * Handle inter-plugin queries.
   * Contributes filter-related items to the header context menu.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'getContextMenuItems') {
      const params = query.context as ContextMenuParams;
      if (!params.isHeader) return undefined;

      const column = params.column as ColumnConfig;
      if (!column?.field) return undefined;

      // Only contribute items if filtering is enabled for this column
      if (!this.isFilteringEnabled()) return undefined;
      if (!this.isColumnFilterable(column)) return undefined;

      const items: HeaderContextMenuItem[] = [];
      const fieldFiltered = this.isFieldFiltered(column.field);
      const hasAnyFilter = this.filters.size > 0;

      if (fieldFiltered) {
        items.push({
          id: 'filtering/clear-column-filter',
          label: `Clear Filter`,
          icon: '✕',
          order: 20,
          action: () => this.clearFieldFilter(column.field),
        });
      }

      if (hasAnyFilter) {
        items.push({
          id: 'filtering/clear-all-filters',
          label: 'Clear All Filters',
          icon: '✕',
          order: 21,
          disabled: !hasAnyFilter,
          action: () => this.clearAllFilters(),
        });
      }

      return items.length > 0 ? items : undefined;
    }
    return undefined;
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processRows(rows: readonly unknown[]): unknown[] {
    if (!this.filters.size) return rows as unknown[];
    const filterList = [...this.filters.values()];

    // If using async filterHandler, processRows becomes a passthrough
    // Actual filtering happens in applyFiltersAsync and rows are set directly on grid
    if (this.config.filterHandler) {
      // Return cached result if available (set by async handler)
      if (this.cachedResult) return this.cachedResult;
      // Otherwise return rows as-is (filtering happens async)
      return rows as unknown[];
    }

    // Check cache — also verify input rows haven't changed (e.g. due to sort)
    const newCacheKey = computeFilterCacheKey(filterList);
    const inputSpot = {
      len: rows.length,
      first: rows[0],
      mid: rows[Math.floor(rows.length / 2)],
      last: rows[rows.length - 1],
    };
    const inputUnchanged =
      this.cachedInputSpot != null &&
      inputSpot.len === this.cachedInputSpot.len &&
      inputSpot.first === this.cachedInputSpot.first &&
      inputSpot.mid === this.cachedInputSpot.mid &&
      inputSpot.last === this.cachedInputSpot.last;

    if (this.cacheKey === newCacheKey && this.cachedResult && inputUnchanged) {
      return this.cachedResult;
    }

    // When input rows changed, recompute excludedValues for `in` filters
    // so the filter panel checkboxes reflect newly appeared unique values.
    if (!inputUnchanged) {
      for (const [field, filter] of this.filters) {
        if (filter.type === 'set' && filter.operator === 'in') {
          this.syncExcludedValues(field, filter);
        }
      }
    }

    // Filter rows synchronously (worker support can be added later)
    const result = filterRows(
      rows as Record<string, unknown>[],
      filterList,
      this.config.caseSensitive,
      this.getFilterValues(),
    );

    // Update cache
    this.cachedResult = result;
    this.cacheKey = newCacheKey;
    this.cachedInputSpot = inputSpot;

    return result;
  }

  /** @internal */
  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Find all header cells (using part attribute, not class)
    const headerCells = gridEl.querySelectorAll('[part~="header-cell"]');
    headerCells.forEach((cell) => {
      const colIndex = cell.getAttribute('data-col');
      if (colIndex === null) return;

      // Use visibleColumns since data-col is the index within _visibleColumns
      const col = this.visibleColumns[parseInt(colIndex, 10)] as ColumnConfig;
      if (!col || !this.isColumnFilterable(col)) return;

      // Skip utility columns (expander, selection checkbox, etc.)
      if (isUtilityColumn(col)) return;

      const field = col.field;
      if (!field) return;

      const hasFilter = this.filters.has(field);

      // Check if button already exists
      let filterBtn = cell.querySelector('.tbw-filter-btn') as HTMLElement | null;

      if (filterBtn) {
        // Update active state and icon of existing button
        const wasActive = filterBtn.classList.contains('active');
        filterBtn.classList.toggle('active', hasFilter);
        (cell as HTMLElement).classList.toggle('filtered', hasFilter);
        // Update aria-description for screen readers
        if (hasFilter) {
          (cell as HTMLElement).setAttribute('aria-description', 'Filtered');
        } else {
          (cell as HTMLElement).removeAttribute('aria-description');
        }
        // Update icon if active state changed
        if (wasActive !== hasFilter) {
          this.setIcon(filterBtn, hasFilter ? 'filterActive' : 'filter');
        }
        return;
      }

      // Create filter button
      filterBtn = document.createElement('button');
      filterBtn.className = 'tbw-filter-btn';
      filterBtn.setAttribute('aria-label', `Filter ${col.header ?? field}`);
      // Use grid icons configuration
      this.setIcon(filterBtn, hasFilter ? 'filterActive' : 'filter');

      // Mark button as active if filter exists
      if (hasFilter) {
        filterBtn.classList.add('active');
        (cell as HTMLElement).classList.add('filtered');
        (cell as HTMLElement).setAttribute('aria-description', 'Filtered');
      }

      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFilterPanel(field, col, filterBtn!);
      });

      // Insert before resize handle to maintain order: [label, sort-indicator, filter-btn, resize-handle]
      const resizeHandle = cell.querySelector('.resize-handle');
      if (resizeHandle) {
        cell.insertBefore(filterBtn, resizeHandle);
      } else {
        cell.appendChild(filterBtn);
      }
    });
  }
  // #endregion

  // #region Public API

  /**
   * Set a filter on a specific field.
   * Pass null to remove the filter.
   * @param options - `{ silent: true }` applies the filter without emitting `filter-change`
   */
  setFilter(field: string, filter: Omit<FilterModel, 'field'> | null, options?: { silent?: boolean }): void {
    if (filter === null) {
      this.filters.delete(field);
      this.syncExcludedValues(field, null);
    } else {
      const fullFilter = { ...filter, field };
      this.filters.set(field, fullFilter);
      this.syncExcludedValues(field, fullFilter);
    }
    // Invalidate cache
    this.cachedResult = null;
    this.cacheKey = null;
    this.cachedInputSpot = null;

    if (!options?.silent) {
      this.broadcast<FilterChangeDetail>('filter-change', {
        filters: [...this.filters.values()],
        filteredRowCount: 0, // Will be accurate after processRows
        selected: this.computeSelected(),
      });
      if (this.config.trackColumnState) {
        this.grid.requestStateChange?.();
      }
      const header = this.grid.effectiveConfig?.columns?.find((c) => c.field === field)?.header ?? field;
      announce(
        this.gridElement!,
        filter === null
          ? getA11yMessage(this.gridElement!, 'filterCleared', header)
          : getA11yMessage(this.gridElement!, 'filterApplied', header),
      );
    } else {
      // Silent: notify plugins only (no DOM event), using same event name for unified subscriptions
      this.emitPluginEvent('filter-change', { filters: [...this.filters.values()] });
    }
    this.requestRender();
  }

  /**
   * Get the current filter for a field.
   */
  getFilter(field: string): FilterModel | undefined {
    return this.filters.get(field);
  }

  /**
   * Get all active filters.
   */
  getFilters(): FilterModel[] {
    return [...this.filters.values()];
  }

  /**
   * Alias for getFilters() to match functional API naming.
   */
  getFilterModel(): FilterModel[] {
    return this.getFilters();
  }

  /**
   * Set filters from an array (replaces all existing filters).
   * @param options - `{ silent: true }` applies filters without emitting `filter-change`
   */
  setFilterModel(filters: FilterModel[], options?: { silent?: boolean }): void {
    this.filters.clear();
    this.excludedValues.clear();
    for (const filter of filters) {
      this.filters.set(filter.field, filter);
      this.syncExcludedValues(filter.field, filter);
    }
    this.cachedResult = null;
    this.cacheKey = null;
    this.cachedInputSpot = null;

    if (!options?.silent) {
      this.broadcast<FilterChangeDetail>('filter-change', {
        filters: [...this.filters.values()],
        filteredRowCount: 0,
        selected: this.computeSelected(),
      });
      if (this.config.trackColumnState) {
        this.grid.requestStateChange?.();
      }
    } else {
      // Silent: notify plugins only (no DOM event)
      this.emitPluginEvent('filter-change', { filters: [...this.filters.values()] });
    }
    this.requestRender();
  }

  /**
   * Clear all filters.
   * @param options - `{ silent: true }` clears filters without emitting `filter-change`
   */
  clearAllFilters(options?: { silent?: boolean }): void {
    this.filters.clear();
    this.excludedValues.clear();
    this.searchText.clear();

    this.applyFiltersInternal(options?.silent);
    if (!options?.silent) announce(this.gridElement!, getA11yMessage(this.gridElement!, 'allFiltersCleared'));
  }

  /**
   * Clear filter for a specific field.
   * @param options - `{ silent: true }` clears filter without emitting `filter-change`
   */
  clearFieldFilter(field: string, options?: { silent?: boolean }): void {
    this.filters.delete(field);
    this.excludedValues.delete(field);
    this.searchText.delete(field);

    this.applyFiltersInternal(options?.silent);
    if (!options?.silent) {
      const header = this.grid.effectiveConfig?.columns?.find((c) => c.field === field)?.header ?? field;
      announce(this.gridElement!, getA11yMessage(this.gridElement!, 'filterCleared', header));
    }
  }

  /**
   * Check if a field has an active filter.
   */
  isFieldFiltered(field: string): boolean {
    return this.filters.has(field);
  }

  /**
   * Get the count of filtered rows (from cache).
   */
  getFilteredRowCount(): number {
    return this.cachedResult?.length ?? this.rows.length;
  }

  /**
   * Get all active filters (alias for getFilters).
   */
  getActiveFilters(): FilterModel[] {
    return this.getFilters();
  }

  /**
   * Get unique values for a field (for set filter dropdowns).
   * Uses sourceRows to include all values regardless of current filter.
   * When a column has `filterValue`, individual extracted values are returned.
   */
  getUniqueValues(field: string): unknown[] {
    const col = this.grid.effectiveConfig?.columns?.find((c) => c.field === field);
    const getter = col?.filterValue;
    return getUniqueValues(this.sourceRows as Record<string, unknown>[], field, getter);
  }

  // #region Stale Filter Detection (#166)

  /**
   * Get set filters whose exclusion/inclusion list no longer matches any values
   * in the current data, effectively selecting zero rows.
   *
   * - `notIn`: stale when every current unique value is in the exclusion list (selected count = 0)
   * - `in`: stale when none of the included values exist in the current data
   */
  getStaleFilters(): FilterModel[] {
    const stale: FilterModel[] = [];
    for (const [field, filter] of this.filters) {
      if (filter.type !== 'set') continue;
      const unique = this.getUniqueValues(field);

      if (filter.operator === 'notIn' && Array.isArray(filter.value)) {
        const excluded = new Set(filter.value);
        const selectedCount = unique.filter((v) => !excluded.has(v)).length;
        if (selectedCount === 0) stale.push(filter);
      } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
        const included = new Set(filter.value);
        const matchCount = unique.filter((v) => included.has(v)).length;
        if (matchCount === 0) stale.push(filter);
      }
    }
    return stale;
  }

  // #endregion

  // #region Blank Filter Toggle Helpers (#169)

  /**
   * Get the current blank mode for a field.
   * - `'all'` — no blank filter active
   * - `'blanksOnly'` — `blank` operator active
   * - `'nonBlanksOnly'` — `notBlank` operator active
   */
  getBlankMode(field: string): BlankMode {
    const filter = this.filters.get(field);
    if (filter?.operator === 'blank') return 'blanksOnly';
    if (filter?.operator === 'notBlank') return 'nonBlanksOnly';
    return 'all';
  }

  /**
   * Toggle blank filter mode for a field.
   *
   * Handles transitions:
   * - `'all'` → clears the filter entirely
   * - `'blanksOnly'` → sets `blank` operator, stashing any active filter in `valueTo`
   * - `'nonBlanksOnly'` → sets `notBlank` operator, stashing any active filter in `valueTo`
   *
   * When switching back to `'all'`, the stashed filter (if any) is restored.
   */
  toggleBlankFilter(field: string, mode: BlankMode): void {
    if (mode === 'all') {
      // Restore stashed filter if one was preserved
      const currentFilter = this.filters.get(field);
      if (currentFilter?.valueTo && typeof currentFilter.valueTo === 'object') {
        const stashed = currentFilter.valueTo as Omit<FilterModel, 'field'>;
        this.setFilter(field, stashed);
      } else {
        this.setFilter(field, null);
      }
      return;
    }

    const currentFilter = this.filters.get(field);
    // Stash the current non-blank filter so it can be restored
    const stash =
      currentFilter && currentFilter.operator !== 'blank' && currentFilter.operator !== 'notBlank'
        ? {
            type: currentFilter.type,
            operator: currentFilter.operator,
            value: currentFilter.value,
            valueTo: currentFilter.valueTo,
          }
        : currentFilter?.valueTo; // Preserve existing stash when toggling between blank modes

    this.setFilter(field, {
      type: currentFilter?.type ?? 'text',
      operator: mode === 'blanksOnly' ? 'blank' : 'notBlank',
      value: '',
      valueTo: stash,
    });
  }

  // #endregion

  // #endregion

  // #region Private Methods

  /**
   * Copy CSS classes and data attributes from grid to filter panel.
   * This ensures theme classes (e.g., .eds-theme) cascade to the panel.
   */
  private copyGridThemeContext(panel: HTMLElement): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Copy all CSS classes from grid to panel (except internal ones)
    for (const className of gridEl.classList) {
      // Skip internal classes that shouldn't be copied
      if (className.startsWith('tbw-') || className === 'selecting') continue;
      panel.classList.add(className);
    }

    // Copy data-theme attribute if present
    const theme = gridEl.dataset.theme;
    if (theme) {
      panel.dataset.theme = theme;
    }
  }

  /**
   * Inject global styles for filter panel (rendered in document.body)
   */
  private injectGlobalStyles(): void {
    if (this.globalStylesInjected) return;
    if (document.getElementById('tbw-filter-panel-styles')) {
      this.globalStylesInjected = true;
      return;
    }
    // Only inject if we have valid CSS text (Vite's ?inline import)
    // When importing from source without Vite, the import is a module object, not a string
    if (typeof filterPanelStyles !== 'string' || !filterPanelStyles) {
      this.globalStylesInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'tbw-filter-panel-styles';
    style.textContent = filterPanelStyles;
    document.head.appendChild(style);
    this.globalStylesInjected = true;
  }

  /**
   * Toggle the filter panel for a field
   */
  private toggleFilterPanel(field: string, column: ColumnConfig, buttonEl: HTMLElement): void {
    // Close if already open
    if (this.openPanelField === field) {
      this.closeFilterPanel();
      return;
    }

    // Close any existing panel
    this.closeFilterPanel();

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'tbw-filter-panel';
    // Copy theme classes from grid to panel for proper theming
    this.copyGridThemeContext(panel);
    // Add animation class if animations are enabled
    if (this.isAnimationEnabled) {
      panel.classList.add('tbw-filter-panel-animated');
    }
    this.panelElement = panel;
    this.openPanelField = field;
    // Keep the filter button visible while the panel is open
    buttonEl.classList.add('active');
    this.panelButtonElement = buttonEl;

    // If using async valuesHandler, show loading state and fetch values
    if (this.config.valuesHandler) {
      panel.innerHTML = '<div class="tbw-filter-loading">Loading...</div>';
      document.body.appendChild(panel);
      this.positionPanel(panel, buttonEl);
      this.setupPanelCloseHandler(panel, buttonEl);

      this.config.valuesHandler(field, column).then((values) => {
        // Check if panel is still open for this field
        if (this.openPanelField !== field || !this.panelElement) return;
        panel.innerHTML = '';
        this.renderPanelContent(field, column, panel, values);
      });
      return;
    }

    // Sync path: get unique values from local rows
    const uniqueValues = getUniqueValues(this.sourceRows as Record<string, unknown>[], field, column.filterValue);

    // Position and append to body BEFORE rendering content
    // so getListItemHeight() can read CSS variables from computed styles
    document.body.appendChild(panel);
    this.positionPanel(panel, buttonEl);

    this.renderPanelContent(field, column, panel, uniqueValues);
    this.setupPanelCloseHandler(panel, buttonEl);
  }

  /**
   * Render filter panel content with given values
   */
  private renderPanelContent(field: string, column: ColumnConfig, panel: HTMLElement, uniqueValues: unknown[]): void {
    // For `in` filters, recompute excludedValues from current data if not yet populated.
    // This handles the case where setFilterModel was called before rows were loaded.
    const currentFilter = this.filters.get(field);
    if (
      currentFilter?.operator === 'in' &&
      currentFilter.type === 'set' &&
      Array.isArray(currentFilter.value) &&
      !this.excludedValues.has(field)
    ) {
      const inValues = currentFilter.value as unknown[];
      const included = new Set<unknown>(inValues.map((v) => (v == null ? BLANK_FILTER_VALUE : v)));
      const excluded = new Set<unknown>(uniqueValues.filter((v) => !included.has(v)));
      this.excludedValues.set(field, excluded);
    }

    // Get current excluded values or initialize empty
    let excludedSet = this.excludedValues.get(field);
    if (!excludedSet) {
      excludedSet = new Set();
      this.excludedValues.set(field, excludedSet);
    }

    // Get current search text
    const currentSearchText = this.searchText.get(field) ?? '';

    // Create panel params for custom renderer
    const params: FilterPanelParams = {
      field,
      column,
      uniqueValues,
      excludedValues: excludedSet,
      searchText: currentSearchText,
      currentFilter: this.filters.get(field),
      applySetFilter: (excluded: unknown[], valueTo?: unknown) => {
        this.applySetFilter(field, excluded, valueTo);
        this.closeFilterPanel();
      },
      applyTextFilter: (operator, value, valueTo) => {
        this.applyTextFilter(field, operator, value, valueTo);
        this.closeFilterPanel();
      },
      clearFilter: () => {
        this.clearFieldFilter(field);
        this.closeFilterPanel();
      },
      closePanel: () => this.closeFilterPanel(),
    };

    // Use custom renderer or default
    // Custom renderer can return undefined to fall back to default panel for specific columns
    // Resolution order: plugin config → typeDefaults → built-in
    let usedCustomRenderer = false;

    // 1. Check plugin-level filterPanelRenderer
    if (this.config.filterPanelRenderer) {
      this.config.filterPanelRenderer(panel, params);
      // If renderer added content to panel, it handled rendering
      usedCustomRenderer = panel.children.length > 0;
    }

    // 2. Check typeDefaults for this column's type
    if (!usedCustomRenderer && column.type) {
      const typeDefault = this.grid.effectiveConfig.typeDefaults?.[column.type];
      if (typeDefault?.filterPanelRenderer) {
        typeDefault.filterPanelRenderer(panel, params);
        usedCustomRenderer = panel.children.length > 0;
      }
    }

    // 3. Fall back to built-in type-specific panel renderers
    //    filterType takes precedence over column.type so consumers can
    //    e.g. show a set filter for a numeric column.
    if (!usedCustomRenderer) {
      const columnType = column.filterType ?? column.type;
      if (columnType === 'number') {
        renderNumberFilterPanel(panel, params, uniqueValues, this.filters);
      } else if (columnType === 'date') {
        renderDateFilterPanel(panel, params, uniqueValues, this.filters);
      } else {
        renderDefaultFilterPanel(
          panel,
          params,
          uniqueValues,
          excludedSet,
          { caseSensitive: this.config.caseSensitive, debounceMs: this.config.debounceMs },
          this.searchText,
        );
      }
    }
  }

  /**
   * Setup click-outside handler to close the panel
   */
  private setupPanelCloseHandler(panel: HTMLElement, buttonEl: HTMLElement): void {
    // Create abort controller for panel-scoped listeners
    // This allows cleanup when panel closes OR when grid disconnects
    this.panelAbortController = new AbortController();
    const { signal } = this.panelAbortController;

    // Add global click handler to close on outside click
    // Defer to next tick to avoid immediate close from the click that opened the panel.
    // Capture `signal` eagerly so detach() → abort() works even if the timeout fires after
    // panelAbortController has been nullified.
    setTimeout(() => {
      if (signal.aborted) return;
      document.addEventListener(
        'click',
        (e: MouseEvent) => {
          if (!panel.contains(e.target as Node) && e.target !== buttonEl) {
            this.closeFilterPanel();
          }
        },
        { signal },
      );
    }, 0);
  }

  /**
   * Close the filter panel
   */
  private closeFilterPanel(): void {
    const panel = this.panelElement;
    if (panel) {
      panel.remove();
      this.panelElement = null;
    }
    // Clean up anchor name from anchor element
    if (this.panelAnchorElement) {
      (this.panelAnchorElement.style as any).anchorName = '';
      this.panelAnchorElement = null;
    }
    // Remove forced-active from the filter button (unless the column has an actual filter)
    if (this.panelButtonElement) {
      const field = this.openPanelField;
      if (!field || !this.filters.has(field)) {
        this.panelButtonElement.classList.remove('active');
      }
      this.panelButtonElement = null;
    }
    this.openPanelField = null;
    // Abort panel-scoped listeners (document click handler)
    this.panelAbortController?.abort();
    this.panelAbortController = null;
  }

  /** Cache for CSS anchor positioning support check */
  private static supportsAnchorPositioning: boolean | null = null;

  /**
   * Check if browser supports CSS Anchor Positioning
   */
  private static checkAnchorPositioningSupport(): boolean {
    if (FilteringPlugin.supportsAnchorPositioning === null) {
      FilteringPlugin.supportsAnchorPositioning = CSS.supports('anchor-name', '--test');
    }
    return FilteringPlugin.supportsAnchorPositioning;
  }

  /**
   * Position the panel below the filter button
   * Uses CSS Anchor Positioning if supported, falls back to JS positioning
   */
  private positionPanel(panel: HTMLElement, buttonEl: HTMLElement): void {
    // Use the header row as the vertical anchor so the panel appears
    // right below the full header, and align horizontally to the
    // filter button's right edge.
    const headerRow = buttonEl.closest('.header-row') as HTMLElement | null;
    const anchorEl = headerRow ?? buttonEl;

    // Set anchor name for CSS anchor positioning
    (anchorEl.style as any).anchorName = '--tbw-filter-anchor';
    this.panelAnchorElement = anchorEl; // Store for cleanup

    // If CSS Anchor Positioning is supported, CSS handles positioning
    // but we need to detect if it flipped above to adjust animation
    if (FilteringPlugin.checkAnchorPositioningSupport()) {
      // CSS `right: anchor(right)` needs the button as the inline anchor.
      // Use the header row for the block axis via margin offset.
      (anchorEl.style as any).anchorName = '';
      (buttonEl.style as any).anchorName = '--tbw-filter-anchor';
      this.panelAnchorElement = buttonEl;

      // Offset: panel top should sit at the header row bottom, not the button bottom
      const headerBottom = anchorEl.getBoundingClientRect().bottom;
      const buttonBottom = buttonEl.getBoundingClientRect().bottom;
      const offset = headerBottom - buttonBottom;
      panel.style.marginTop = `${offset + 4}px`;

      requestAnimationFrame(() => {
        const panelRect = panel.getBoundingClientRect();
        const anchorRect = buttonEl.getBoundingClientRect();
        if (panelRect.top < anchorRect.top) {
          panel.classList.add('tbw-filter-panel-above');
        }
      });
      return;
    }

    // Fallback: JS-based positioning for older browsers
    const headerRect = anchorEl.getBoundingClientRect();
    const btnRect = buttonEl.getBoundingClientRect();

    panel.style.position = 'fixed';
    panel.style.top = `${headerRect.bottom + 4}px`;

    // Right-align: panel right edge = button right edge
    // We set left initially, then adjust after measuring panel width
    panel.style.left = `${btnRect.right}px`;

    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();

      // Right-align panel to button
      panel.style.left = `${btnRect.right - panelRect.width}px`;

      // Check horizontal overflow - flip to left-aligned if needed
      const adjustedLeft = btnRect.right - panelRect.width;
      if (adjustedLeft < 8) {
        panel.style.left = `${btnRect.left}px`;
      }

      // Check vertical overflow - flip to above header row
      if (panelRect.bottom > window.innerHeight - 8) {
        panel.style.top = `${headerRect.top - panelRect.height - 4}px`;
        panel.classList.add('tbw-filter-panel-above');
      }
    });
  }

  /**
   * Apply a set filter from the panel's excluded (unchecked) values.
   * Preserves the original operator: if the current filter uses `in`,
   * the included values are computed and stored as `in`; otherwise `notIn` is used.
   */
  private applySetFilter(field: string, excluded: unknown[], valueTo?: unknown): void {
    // Store excluded values for panel checkbox state
    this.excludedValues.set(field, new Set(excluded));

    if (excluded.length === 0) {
      // No exclusions = no filter
      this.filters.delete(field);
    } else {
      // Preserve the original operator through the panel round-trip
      const currentFilter = this.filters.get(field);
      if (currentFilter?.operator === 'in') {
        // Convert excluded → included to maintain `in` semantics
        const unique = this.getUniqueValues(field);
        const excludedSet = new Set(excluded);
        const included = unique.filter((v) => !excludedSet.has(v));
        this.filters.set(field, {
          field,
          type: 'set',
          operator: 'in',
          value: included,
          ...(valueTo !== undefined && { valueTo }),
        });
      } else {
        // Default: create "notIn" filter
        this.filters.set(field, {
          field,
          type: 'set',
          operator: 'notIn',
          value: excluded,
          ...(valueTo !== undefined && { valueTo }),
        });
      }
    }

    this.applyFiltersInternal();
  }

  /**
   * Apply a text/number/date filter.
   * Resolves the filter type from the column definition so that numeric and
   * date operators use the correct type in the filter model.
   */
  private applyTextFilter(
    field: string,
    operator: FilterModel['operator'],
    value: string | number,
    valueTo?: string | number,
  ): void {
    const col = this.grid.effectiveConfig?.columns?.find((c) => c.field === field);
    const type = col?.filterType ?? (col?.type as FilterModel['type']) ?? 'text';

    this.filters.set(field, {
      field,
      type,
      operator,
      value,
      valueTo,
    });

    this.applyFiltersInternal();
  }

  /**
   * Internal method to apply filters (sync or async based on config)
   * @param silent - When true, suppress the `filter-change` consumer event
   */
  private applyFiltersInternal(silent?: boolean): void {
    this.cachedResult = null;
    this.cacheKey = null;
    this.cachedInputSpot = null;

    const filterList = [...this.filters.values()];

    // If using async filterHandler, delegate to server
    if (this.config.filterHandler) {
      this.gridElement.setAttribute('aria-busy', 'true');

      const result = this.config.filterHandler(filterList, this.sourceRows as unknown[]);

      // Handle async or sync result
      const handleResult = (rows: unknown[]) => {
        this.gridElement.removeAttribute('aria-busy');
        this.cachedResult = rows;

        // Update grid rows directly for async filtering
        this.grid.rows = rows;

        if (!silent) {
          this.broadcast<FilterChangeDetail>('filter-change', {
            filters: filterList,
            filteredRowCount: rows.length,
            selected: this.computeSelected(),
          });
          if (this.config.trackColumnState) {
            this.grid.requestStateChange?.();
          }
        } else {
          // Silent: notify plugins only (no DOM event)
          this.emitPluginEvent('filter-change', { filters: filterList });
        }

        // Trigger afterRender to update filter button active state
        this.requestRender();
      };

      if (result && typeof (result as Promise<unknown[]>).then === 'function') {
        (result as Promise<unknown[]>).then(handleResult);
      } else {
        handleResult(result as unknown[]);
      }
      return;
    }

    // Sync path: emit event and re-render (processRows will handle filtering)
    if (!silent) {
      this.broadcast<FilterChangeDetail>('filter-change', {
        filters: filterList,
        filteredRowCount: 0,
        selected: this.computeSelected(),
      });
      if (this.config.trackColumnState) {
        this.grid.requestStateChange?.();
      }
    } else {
      // Silent: notify plugins only (no DOM event)
      this.emitPluginEvent('filter-change', { filters: filterList });
    }
    this.requestRender();
  }
  // #endregion

  // #region Column State Hooks

  /**
   * Return filter state for a column if it has an active filter.
   * Only contributes state when `trackColumnState` is enabled.
   * @internal
   */
  override getColumnState(field: string): Partial<ColumnState> | undefined {
    if (!this.config.trackColumnState) return undefined;

    const filterModel = this.filters.get(field);
    if (!filterModel) return undefined;

    return {
      filter: {
        type: filterModel.type,
        operator: filterModel.operator,
        value: filterModel.value,
        valueTo: filterModel.valueTo,
      },
    };
  }

  /**
   * Apply filter state from column state.
   * Only applies state when `trackColumnState` is enabled.
   * @internal
   */
  override applyColumnState(field: string, state: ColumnState): void {
    if (!this.config.trackColumnState) return;

    // Only process if the column has filter state
    if (!state.filter) {
      this.filters.delete(field);
      return;
    }

    // Reconstruct the FilterModel from the stored state
    const filterModel: FilterModel = {
      field,
      type: state.filter.type,
      operator: state.filter.operator as FilterModel['operator'],
      value: state.filter.value,
      valueTo: state.filter.valueTo,
    };

    this.filters.set(field, filterModel);
    // Invalidate cache so filter is reapplied
    this.cachedResult = null;
    this.cacheKey = null;
    this.cachedInputSpot = null;
  }
  // #endregion
}
