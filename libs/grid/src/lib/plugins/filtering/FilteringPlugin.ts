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
import type { FilterChangeDetail, FilterConfig, FilterModel, FilterPanelParams } from './types';

/** Global styles for filter panel (rendered in document.body) */
const filterPanelStyles = `
.tbw-filter-panel {
  position: fixed;
  background: var(--tbw-filter-panel-bg, var(--tbw-color-panel-bg, light-dark(#eeeeee, #222222)));
  color: var(--tbw-filter-panel-fg, var(--tbw-color-fg, light-dark(#222222, #eeeeee)));
  border: 1px solid var(--tbw-filter-panel-border, var(--tbw-color-border, light-dark(#d0d0d4, #454545)));
  border-radius: var(--tbw-filter-panel-radius, var(--tbw-border-radius, 4px));
  box-shadow: 0 4px 16px var(--tbw-filter-panel-shadow, var(--tbw-color-shadow, light-dark(rgba(0,0,0,0.1), rgba(0,0,0,0.3))));
  padding: 12px;
  z-index: 10000;
  min-width: 200px;
  max-width: 280px;
  max-height: 350px;
  display: flex;
  flex-direction: column;
  font-family: var(--tbw-font-family, system-ui, sans-serif);
  font-size: var(--tbw-font-size, 13px);
}

.tbw-filter-search {
  margin-bottom: 8px;
}

.tbw-filter-search-input {
  width: 100%;
  padding: 6px 10px;
  background: var(--tbw-filter-input-bg, var(--tbw-color-bg, transparent));
  color: inherit;
  border: 1px solid var(--tbw-filter-input-border, var(--tbw-color-border, light-dark(#d0d0d4, #454545)));
  border-radius: var(--tbw-filter-input-radius, 4px);
  font-size: inherit;
  box-sizing: border-box;
}

.tbw-filter-search-input:focus {
  outline: none;
  border-color: var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6));
  box-shadow: 0 0 0 2px rgba(from var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6)) r g b / 15%);
}

.tbw-filter-actions {
  display: flex;
  padding: 4px 2px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--tbw-filter-divider, var(--tbw-color-border, light-dark(#d0d0d4, #454545)));
}

.tbw-filter-action-btn {
  background: transparent;
  border: none;
  color: var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6));
  cursor: pointer;
  font-size: 12px;
  padding: 2px 0;
}

.tbw-filter-action-btn:hover {
  text-decoration: underline;
}

.tbw-filter-values {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 8px;
  max-height: 180px;
  position: relative;
}

.tbw-filter-values-spacer {
  width: 1px;
}

.tbw-filter-values-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.tbw-filter-value-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  cursor: pointer;
  border-radius: 3px;
}

.tbw-filter-value-item:hover {
  background: var(--tbw-filter-hover, var(--tbw-color-row-hover, light-dark(#f0f6ff, #1c1c1c)));
}

.tbw-filter-checkbox {
  margin: 0;
  cursor: pointer;
  accent-color: var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6));
}

.tbw-filter-no-match {
  color: var(--tbw-filter-muted, var(--tbw-color-fg-muted, light-dark(#555555, #aaaaaa)));
  padding: 8px 0;
  text-align: center;
  font-style: italic;
}

.tbw-filter-buttons {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--tbw-filter-divider, var(--tbw-color-border, light-dark(#d0d0d4, #454545)));
}

.tbw-filter-apply-btn {
  flex: 1;
  padding: 6px 12px;
  background: var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6));
  color: var(--tbw-filter-accent-fg, var(--tbw-color-accent-fg, light-dark(#ffffff, #000000)));
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.tbw-filter-apply-btn:hover {
  filter: brightness(0.9);
}

.tbw-filter-clear-btn {
  flex: 1;
  padding: 6px 12px;
  background: transparent;
  color: var(--tbw-filter-muted, var(--tbw-color-fg-muted, light-dark(#555555, #aaaaaa)));
  border: 1px solid var(--tbw-filter-input-border, var(--tbw-color-border, light-dark(#d0d0d4, #454545)));
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.tbw-filter-clear-btn:hover {
  background: var(--tbw-filter-hover, var(--tbw-color-row-hover, light-dark(#f0f6ff, #1c1c1c)));
}
`;

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
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<FilterConfig> {
    return {
      enabled: true,
      debounceMs: 300,
      caseSensitive: false,
      trimInput: true,
      useWorker: true,
    };
  }

  // ===== Internal State =====
  private filters: Map<string, FilterModel> = new Map();
  private cachedResult: unknown[] | null = null;
  private cacheKey: string | null = null;
  private openPanelField: string | null = null;
  private panelElement: HTMLElement | null = null;
  private searchText: Map<string, string> = new Map();
  private excludedValues: Map<string, Set<unknown>> = new Map();
  private panelAbortController: AbortController | null = null; // For panel-scoped listeners
  private globalStylesInjected = false;

  // Virtualization constants for filter value list
  private static readonly LIST_ITEM_HEIGHT = 28;
  private static readonly LIST_OVERSCAN = 3;
  private static readonly LIST_BYPASS_THRESHOLD = 50; // Don't virtualize if < 50 items

  // ===== Lifecycle =====

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

  // ===== Hooks =====

  override processRows(rows: readonly unknown[]): unknown[] {
    const filterList = [...this.filters.values()];
    if (!filterList.length) return [...rows];

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
    if (!this.config.enabled) return;

    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    // Find all header cells (using part attribute, not class)
    const headerCells = shadowRoot.querySelectorAll('[part~="header-cell"]');
    headerCells.forEach((cell) => {
      const colIndex = cell.getAttribute('data-col');
      if (colIndex === null) return;

      const col = this.columns[parseInt(colIndex, 10)] as ColumnConfig;
      if (!col || col.filterable === false) return;

      // Skip if button already exists
      if (cell.querySelector('.tbw-filter-btn')) return;

      const field = col.field;
      if (!field) return;

      // Create filter button
      const filterBtn = document.createElement('button');
      filterBtn.className = 'tbw-filter-btn';
      filterBtn.setAttribute('aria-label', `Filter ${col.header ?? field}`);
      filterBtn.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>`;

      // Mark button as active if filter exists
      if (this.filters.has(field)) {
        filterBtn.classList.add('active');
        cell.classList.add('filtered');
      }

      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFilterPanel(field, col, filterBtn);
      });

      // Append to header cell
      cell.appendChild(filterBtn);
    });
  }

  // ===== Public API =====

  /**
   * Set a filter on a specific field.
   * Pass null to remove the filter.
   */
  setFilter(field: string, filter: Omit<FilterModel, 'field'> | null): void {
    if (filter === null) {
      this.filters.delete(field);
    } else {
      this.filters.set(field, { ...filter, field });
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
    for (const filter of filters) {
      this.filters.set(filter.field, filter);
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
    this.cachedResult = null;
    this.cacheKey = null;

    this.emit<FilterChangeDetail>('filter-change', {
      filters: [],
      filteredRowCount: this.rows.length,
    });
    this.requestRender();
  }

  /**
   * Clear filter for a specific field.
   */
  clearFieldFilter(field: string): void {
    this.filters.delete(field);
    this.excludedValues.delete(field);
    this.searchText.delete(field);

    this.cachedResult = null;
    this.cacheKey = null;

    this.emit<FilterChangeDetail>('filter-change', {
      filters: [...this.filters.values()],
      filteredRowCount: 0,
    });
    this.requestRender();
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

  // ===== Private Methods =====

  /**
   * Inject global styles for filter panel (rendered in document.body)
   */
  private injectGlobalStyles(): void {
    if (this.globalStylesInjected) return;
    if (document.getElementById('tbw-filter-panel-styles')) {
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
    this.panelElement = panel;
    this.openPanelField = field;

    // Get unique values for this field (from source rows, not filtered)
    const uniqueValues = getUniqueValues(this.sourceRows as Record<string, unknown>[], field);

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
      const result = this.config.filterPanelRenderer(panel, params);
      // If renderer added content to panel, it handled rendering
      usedCustomRenderer = panel.children.length > 0;
    }
    if (!usedCustomRenderer) {
      this.renderDefaultFilterPanel(panel, params, uniqueValues, excludedSet);
    }

    // Position and append to body
    document.body.appendChild(panel);
    this.positionPanel(panel, buttonEl);

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
        { signal: this.panelAbortController?.signal }
      );
    }, 0);
  }

  /**
   * Close the filter panel
   */
  private closeFilterPanel(): void {
    if (this.panelElement) {
      this.panelElement.remove();
      this.panelElement = null;
    }
    this.openPanelField = null;
    // Abort panel-scoped listeners (document click handler)
    this.panelAbortController?.abort();
    this.panelAbortController = null;
  }

  /**
   * Position the panel below the button
   */
  private positionPanel(panel: HTMLElement, buttonEl: HTMLElement): void {
    const rect = buttonEl.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = `${rect.bottom + 4}px`;
    panel.style.left = `${rect.left}px`;

    // Adjust if overflows right edge
    requestAnimationFrame(() => {
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.right > window.innerWidth - 8) {
        panel.style.left = `${window.innerWidth - panelRect.width - 8}px`;
      }
      // Adjust if overflows bottom
      if (panelRect.bottom > window.innerHeight - 8) {
        panel.style.top = `${rect.top - panelRect.height - 4}px`;
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
    excludedValues: Set<unknown>
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
      const lowerFilter = filterText.toLowerCase();

      // Filter the unique values
      filteredValues = uniqueValues.filter((value) => {
        const strValue = value == null ? '(Blank)' : String(value);
        return !filterText || strValue.toLowerCase().includes(lowerFilter);
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
      { passive: true }
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

    this.cachedResult = null;
    this.cacheKey = null;

    this.emit<FilterChangeDetail>('filter-change', {
      filters: [...this.filters.values()],
      filteredRowCount: 0,
    });
    this.requestRender();
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

    this.cachedResult = null;
    this.cacheKey = null;

    this.emit<FilterChangeDetail>('filter-change', {
      filters: [...this.filters.values()],
      filteredRowCount: 0,
    });
    this.requestRender();
  }

  // ===== Column State Hooks =====

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

  // ===== Styles =====

  override readonly styles = `
    .header-cell.filtered::before {
      content: '';
      position: absolute;
      top: 4px;
      right: 4px;
      width: 6px;
      height: 6px;
      background: var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6));
      border-radius: 50%;
    }
    .tbw-filter-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px;
      margin-left: 4px;
      opacity: 0.4;
      transition: opacity 0.15s;
      color: inherit;
      vertical-align: middle;
    }
    .tbw-filter-btn:hover,
    .tbw-filter-btn.active {
      opacity: 1;
    }
    .tbw-filter-btn.active {
      color: var(--tbw-filter-accent, var(--tbw-color-accent, #3b82f6));
    }
  `;
}
