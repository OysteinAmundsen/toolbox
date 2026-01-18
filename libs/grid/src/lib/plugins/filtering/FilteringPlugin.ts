/**
 * Filtering Plugin (Class-based)
 *
 * Provides comprehensive filtering functionality for tbw-grid.
 * Supports text, number, date, set, and boolean filters with caching.
 * Includes UI with filter buttons in headers and dropdown filter panels.
 */

import { computeVirtualWindow, shouldBypassVirtualization } from '../../core/internal/virtualization';
import { BaseGridPlugin, type GridElement } from '../../core/plugin/base-plugin';
import type { ColumnConfig, ColumnState } from '../../core/types';
import { computeFilterCacheKey, filterRows, getUniqueValues } from './filter-model';
import styles from './filtering.css?inline';
import filterPanelStyles from './FilteringPlugin.css?inline';
import type { FilterChangeDetail, FilterConfig, FilterModel, FilterPanelParams } from './types';

/**
 * Filtering Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new FilteringPlugin({ enabled: true, debounceMs: 300 })
 * ```
 */
export class FilteringPlugin extends BaseGridPlugin<FilterConfig> {
  readonly name = 'filtering';
  override readonly styles = styles;

  protected override get defaultConfig(): Partial<FilterConfig> {
    return {
      debounceMs: 300,
      caseSensitive: false,
      trimInput: true,
      useWorker: true,
    };
  }

  // #region Internal State
  private filters: Map<string, FilterModel> = new Map();
  private cachedResult: unknown[] | null = null;
  private cacheKey: string | null = null;
  private openPanelField: string | null = null;
  private panelElement: HTMLElement | null = null;
  private panelAnchorElement: HTMLElement | null = null; // For CSS anchor positioning cleanup
  private searchText: Map<string, string> = new Map();
  private excludedValues: Map<string, Set<unknown>> = new Map();
  private panelAbortController: AbortController | null = null; // For panel-scoped listeners
  private globalStylesInjected = false;

  // Virtualization constants for filter value list
  private static readonly LIST_ITEM_HEIGHT = 28;
  private static readonly LIST_OVERSCAN = 3;
  private static readonly LIST_BYPASS_THRESHOLD = 50; // Don't virtualize if < 50 items

  /**
   * Sync excludedValues map from a filter model (for set filters).
   */
  private syncExcludedValues(field: string, filter: FilterModel | null): void {
    if (!filter) {
      this.excludedValues.delete(field);
    } else if (filter.type === 'set' && filter.operator === 'notIn' && Array.isArray(filter.value)) {
      this.excludedValues.set(field, new Set(filter.value));
    } else if (filter.type === 'set') {
      // Other set operators may have different semantics; clear for safety
      this.excludedValues.delete(field);
    }
  }
  // #endregion

  // #region Lifecycle

  override attach(grid: GridElement): void {
    super.attach(grid);
    this.injectGlobalStyles();
  }

  override detach(): void {
    this.filters.clear();
    this.cachedResult = null;
    this.cacheKey = null;
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

  // #region Hooks

  override processRows(rows: readonly unknown[]): unknown[] {
    const filterList = [...this.filters.values()];
    if (!filterList.length) return [...rows];

    // If using async filterHandler, processRows becomes a passthrough
    // Actual filtering happens in applyFiltersAsync and rows are set directly on grid
    if (this.config.filterHandler) {
      // Return cached result if available (set by async handler)
      if (this.cachedResult) return this.cachedResult;
      // Otherwise return rows as-is (filtering happens async)
      return [...rows];
    }

    // Check cache
    const newCacheKey = computeFilterCacheKey(filterList);
    if (this.cacheKey === newCacheKey && this.cachedResult) {
      return this.cachedResult;
    }

    // Filter rows synchronously (worker support can be added later)
    const result = filterRows([...rows] as Record<string, unknown>[], filterList, this.config.caseSensitive);

    // Update cache
    this.cachedResult = result;
    this.cacheKey = newCacheKey;

    return result;
  }

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
      if (!col || col.filterable === false) return;

      const field = col.field;
      if (!field) return;

      const hasFilter = this.filters.has(field);

      // Check if button already exists
      let filterBtn = cell.querySelector('.tbw-filter-btn') as HTMLElement | null;

      if (filterBtn) {
        // Update active state of existing button
        filterBtn.classList.toggle('active', hasFilter);
        (cell as HTMLElement).classList.toggle('filtered', hasFilter);
        return;
      }

      // Create filter button
      filterBtn = document.createElement('button');
      filterBtn.className = 'tbw-filter-btn';
      filterBtn.setAttribute('aria-label', `Filter ${col.header ?? field}`);
      filterBtn.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>`;

      // Mark button as active if filter exists
      if (hasFilter) {
        filterBtn.classList.add('active');
        (cell as HTMLElement).classList.add('filtered');
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
   */
  setFilter(field: string, filter: Omit<FilterModel, 'field'> | null): void {
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

    this.emit<FilterChangeDetail>('filter-change', {
      filters: [...this.filters.values()],
      filteredRowCount: 0, // Will be accurate after processRows
    });
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
   */
  setFilterModel(filters: FilterModel[]): void {
    this.filters.clear();
    this.excludedValues.clear();
    for (const filter of filters) {
      this.filters.set(filter.field, filter);
      this.syncExcludedValues(filter.field, filter);
    }
    this.cachedResult = null;
    this.cacheKey = null;

    this.emit<FilterChangeDetail>('filter-change', {
      filters: [...this.filters.values()],
      filteredRowCount: 0,
    });
    this.requestRender();
  }

  /**
   * Clear all filters.
   */
  clearAllFilters(): void {
    this.filters.clear();
    this.excludedValues.clear();
    this.searchText.clear();

    this.applyFiltersInternal();
  }

  /**
   * Clear filter for a specific field.
   */
  clearFieldFilter(field: string): void {
    this.filters.delete(field);
    this.excludedValues.delete(field);
    this.searchText.delete(field);

    this.applyFiltersInternal();
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
   */
  getUniqueValues(field: string): unknown[] {
    return getUniqueValues(this.sourceRows as Record<string, unknown>[], field);
  }
  // #endregion

  // #region Private Methods

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
    // Add animation class if animations are enabled
    if (this.isAnimationEnabled) {
      panel.classList.add('tbw-filter-panel-animated');
    }
    this.panelElement = panel;
    this.openPanelField = field;

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
    const uniqueValues = getUniqueValues(this.sourceRows as Record<string, unknown>[], field);
    this.renderPanelContent(field, column, panel, uniqueValues);

    // Position and append to body
    document.body.appendChild(panel);
    this.positionPanel(panel, buttonEl);
    this.setupPanelCloseHandler(panel, buttonEl);
  }

  /**
   * Render filter panel content with given values
   */
  private renderPanelContent(field: string, column: ColumnConfig, panel: HTMLElement, uniqueValues: unknown[]): void {
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
      applySetFilter: (excluded: unknown[]) => {
        this.applySetFilter(field, excluded);
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
    let usedCustomRenderer = false;
    if (this.config.filterPanelRenderer) {
      this.config.filterPanelRenderer(panel, params);
      // If renderer added content to panel, it handled rendering
      usedCustomRenderer = panel.children.length > 0;
    }
    if (!usedCustomRenderer) {
      this.renderDefaultFilterPanel(panel, params, uniqueValues, excludedSet);
    }
  }

  /**
   * Setup click-outside handler to close the panel
   */
  private setupPanelCloseHandler(panel: HTMLElement, buttonEl: HTMLElement): void {
    // Create abort controller for panel-scoped listeners
    // This allows cleanup when panel closes OR when grid disconnects
    this.panelAbortController = new AbortController();

    // Add global click handler to close on outside click
    // Defer to next tick to avoid immediate close from the click that opened the panel
    setTimeout(() => {
      document.addEventListener(
        'click',
        (e: MouseEvent) => {
          if (!panel.contains(e.target as Node) && e.target !== buttonEl) {
            this.closeFilterPanel();
          }
        },
        { signal: this.panelAbortController?.signal },
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
    // Clean up anchor name from header cell
    if (this.panelAnchorElement) {
      this.panelAnchorElement.style.anchorName = '';
      this.panelAnchorElement = null;
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
   * Position the panel below the header cell
   * Uses CSS Anchor Positioning if supported, falls back to JS positioning
   */
  private positionPanel(panel: HTMLElement, buttonEl: HTMLElement): void {
    // Find the parent header cell
    const headerCell = buttonEl.closest('.cell') as HTMLElement | null;
    const anchorEl = headerCell ?? buttonEl;

    // Set anchor name on the header cell for CSS anchor positioning
    anchorEl.style.anchorName = '--tbw-filter-anchor';
    this.panelAnchorElement = anchorEl; // Store for cleanup

    // If CSS Anchor Positioning is supported, CSS handles positioning
    // but we need to detect if it flipped above to adjust animation
    if (FilteringPlugin.checkAnchorPositioningSupport()) {
      // Check position after CSS anchor positioning takes effect
      requestAnimationFrame(() => {
        const panelRect = panel.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        // If panel top is above anchor top, it flipped to above
        if (panelRect.top < anchorRect.top) {
          panel.classList.add('tbw-filter-panel-above');
        }
      });
      return;
    }

    // Fallback: JS-based positioning for older browsers
    const rect = anchorEl.getBoundingClientRect();

    panel.style.position = 'fixed';
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.left = `${rect.left}px`;

    // Adjust if overflows viewport edges
    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();

      // Check horizontal overflow - align right edge to header cell right edge
      if (panelRect.right > window.innerWidth - 8) {
        panel.style.left = `${rect.right - panelRect.width}px`;
      }

      // Check vertical overflow - flip to above header cell
      if (panelRect.bottom > window.innerHeight - 8) {
        panel.style.top = `${rect.top - panelRect.height - 4}px`;
        panel.classList.add('tbw-filter-panel-above');
      }
    });
  }

  /**
   * Render the default filter panel content
   */
  private renderDefaultFilterPanel(
    panel: HTMLElement,
    params: FilterPanelParams,
    uniqueValues: unknown[],
    excludedValues: Set<unknown>,
  ): void {
    const { field } = params;

    // Search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'tbw-filter-search';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.className = 'tbw-filter-search-input';
    searchInput.value = this.searchText.get(field) ?? '';
    searchContainer.appendChild(searchInput);
    panel.appendChild(searchContainer);

    // Select All tristate checkbox
    const actionsRow = document.createElement('div');
    actionsRow.className = 'tbw-filter-actions';

    const selectAllLabel = document.createElement('label');
    selectAllLabel.className = 'tbw-filter-value-item';
    selectAllLabel.style.padding = '0';
    selectAllLabel.style.margin = '0';

    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.className = 'tbw-filter-checkbox';

    const selectAllText = document.createElement('span');
    selectAllText.textContent = 'Select All';

    selectAllLabel.appendChild(selectAllCheckbox);
    selectAllLabel.appendChild(selectAllText);
    actionsRow.appendChild(selectAllLabel);

    // Update tristate checkbox based on checkState
    const updateSelectAllState = () => {
      const values = [...checkState.values()];
      const allChecked = values.every((v) => v);
      const noneChecked = values.every((v) => !v);

      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = !allChecked && !noneChecked;
    };

    // Toggle all on click
    selectAllCheckbox.addEventListener('change', () => {
      const newState = selectAllCheckbox.checked;
      for (const key of checkState.keys()) {
        checkState.set(key, newState);
      }
      updateSelectAllState();
      renderVisibleItems();
    });

    panel.appendChild(actionsRow);

    // Values container with virtualization support
    const valuesContainer = document.createElement('div');
    valuesContainer.className = 'tbw-filter-values';

    // Spacer for virtual height
    const spacer = document.createElement('div');
    spacer.className = 'tbw-filter-values-spacer';
    valuesContainer.appendChild(spacer);

    // Content container positioned absolutely
    const contentContainer = document.createElement('div');
    contentContainer.className = 'tbw-filter-values-content';
    valuesContainer.appendChild(contentContainer);

    // Track current check state for values (persists across virtualizations)
    const checkState = new Map<string, boolean>();
    uniqueValues.forEach((value) => {
      const key = value == null ? '__null__' : String(value);
      checkState.set(key, !excludedValues.has(value));
    });

    // Initialize select all state
    updateSelectAllState();

    // Filtered values cache
    let filteredValues: unknown[] = [];

    // Create a single checkbox item element
    const createItem = (value: unknown, index: number): HTMLElement => {
      const strValue = value == null ? '(Blank)' : String(value);
      const key = value == null ? '__null__' : String(value);

      const item = document.createElement('label');
      item.className = 'tbw-filter-value-item';
      item.style.position = 'absolute';
      item.style.top = `${index * FilteringPlugin.LIST_ITEM_HEIGHT}px`;
      item.style.left = '0';
      item.style.right = '0';
      item.style.height = `${FilteringPlugin.LIST_ITEM_HEIGHT}px`;
      item.style.boxSizing = 'border-box';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'tbw-filter-checkbox';
      checkbox.checked = checkState.get(key) ?? true;
      checkbox.dataset.value = key;

      // Sync check state on change and update tristate checkbox
      checkbox.addEventListener('change', () => {
        checkState.set(key, checkbox.checked);
        updateSelectAllState();
      });

      const label = document.createElement('span');
      label.textContent = strValue;

      item.appendChild(checkbox);
      item.appendChild(label);
      return item;
    };

    // Render visible items using virtualization
    const renderVisibleItems = () => {
      const totalItems = filteredValues.length;
      const viewportHeight = valuesContainer.clientHeight;
      const scrollTop = valuesContainer.scrollTop;

      // Set total height for scrollbar
      spacer.style.height = `${totalItems * FilteringPlugin.LIST_ITEM_HEIGHT}px`;

      // Bypass virtualization for small lists
      if (shouldBypassVirtualization(totalItems, FilteringPlugin.LIST_BYPASS_THRESHOLD / 3)) {
        contentContainer.innerHTML = '';
        contentContainer.style.transform = 'translateY(0px)';
        filteredValues.forEach((value, idx) => {
          contentContainer.appendChild(createItem(value, idx));
        });
        return;
      }

      // Use computeVirtualWindow for real-scroll virtualization
      const window = computeVirtualWindow({
        totalRows: totalItems,
        viewportHeight,
        scrollTop,
        rowHeight: FilteringPlugin.LIST_ITEM_HEIGHT,
        overscan: FilteringPlugin.LIST_OVERSCAN,
      });

      // Position content container
      contentContainer.style.transform = `translateY(${window.offsetY}px)`;

      // Clear and render visible items
      contentContainer.innerHTML = '';
      for (let i = window.start; i < window.end; i++) {
        contentContainer.appendChild(createItem(filteredValues[i], i - window.start));
      }
    };

    // Filter and re-render values
    const renderValues = (filterText: string) => {
      const caseSensitive = this.config.caseSensitive ?? false;
      const compareFilter = caseSensitive ? filterText : filterText.toLowerCase();

      // Filter the unique values
      filteredValues = uniqueValues.filter((value) => {
        const strValue = value == null ? '(Blank)' : String(value);
        const compareValue = caseSensitive ? strValue : strValue.toLowerCase();
        return !filterText || compareValue.includes(compareFilter);
      });

      if (filteredValues.length === 0) {
        spacer.style.height = '0px';
        contentContainer.innerHTML = '';
        const noMatch = document.createElement('div');
        noMatch.className = 'tbw-filter-no-match';
        noMatch.textContent = 'No matching values';
        contentContainer.appendChild(noMatch);
        return;
      }

      renderVisibleItems();
    };

    // Scroll handler for virtualization
    valuesContainer.addEventListener(
      'scroll',
      () => {
        if (filteredValues.length > 0) {
          renderVisibleItems();
        }
      },
      { passive: true },
    );

    renderValues(searchInput.value);
    panel.appendChild(valuesContainer);

    // Debounced search
    let debounceTimer: ReturnType<typeof setTimeout>;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchText.set(field, searchInput.value);
        renderValues(searchInput.value);
      }, this.config.debounceMs ?? 150);
    });

    // Apply/Clear buttons
    const buttonRow = document.createElement('div');
    buttonRow.className = 'tbw-filter-buttons';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'tbw-filter-apply-btn';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      // Read from checkState map (works with virtualization)
      const excluded: unknown[] = [];
      for (const [key, isChecked] of checkState) {
        if (!isChecked) {
          if (key === '__null__') {
            excluded.push(null);
          } else {
            // Try to match original value type
            const original = uniqueValues.find((v) => String(v) === key);
            excluded.push(original !== undefined ? original : key);
          }
        }
      }
      params.applySetFilter(excluded);
    });
    buttonRow.appendChild(applyBtn);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'tbw-filter-clear-btn';
    clearBtn.textContent = 'Clear Filter';
    clearBtn.addEventListener('click', () => {
      params.clearFilter();
    });
    buttonRow.appendChild(clearBtn);

    panel.appendChild(buttonRow);
  }

  /**
   * Apply a set filter (exclude values)
   */
  private applySetFilter(field: string, excluded: unknown[]): void {
    // Store excluded values
    this.excludedValues.set(field, new Set(excluded));

    if (excluded.length === 0) {
      // No exclusions = no filter
      this.filters.delete(field);
    } else {
      // Create "notIn" filter
      this.filters.set(field, {
        field,
        type: 'set',
        operator: 'notIn',
        value: excluded,
      });
    }

    this.applyFiltersInternal();
  }

  /**
   * Apply a text filter
   */
  private applyTextFilter(field: string, operator: FilterModel['operator'], value: string, valueTo?: string): void {
    this.filters.set(field, {
      field,
      type: 'text',
      operator,
      value,
      valueTo,
    });

    this.applyFiltersInternal();
  }

  /**
   * Internal method to apply filters (sync or async based on config)
   */
  private applyFiltersInternal(): void {
    this.cachedResult = null;
    this.cacheKey = null;

    const filterList = [...this.filters.values()];

    // If using async filterHandler, delegate to server
    if (this.config.filterHandler) {
      const gridEl = this.grid as unknown as Element;
      gridEl.setAttribute('aria-busy', 'true');

      const result = this.config.filterHandler(filterList, this.sourceRows as unknown[]);

      // Handle async or sync result
      const handleResult = (rows: unknown[]) => {
        gridEl.removeAttribute('aria-busy');
        this.cachedResult = rows;

        // Update grid rows directly for async filtering
        (this.grid as unknown as { rows: unknown[] }).rows = rows;

        this.emit<FilterChangeDetail>('filter-change', {
          filters: filterList,
          filteredRowCount: rows.length,
        });

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
    this.emit<FilterChangeDetail>('filter-change', {
      filters: filterList,
      filteredRowCount: 0,
    });
    this.requestRender();
  }
  // #endregion

  // #region Column State Hooks

  /**
   * Return filter state for a column if it has an active filter.
   */
  override getColumnState(field: string): Partial<ColumnState> | undefined {
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
   */
  override applyColumnState(field: string, state: ColumnState): void {
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
  }
  // #endregion
}
