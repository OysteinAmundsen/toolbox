/**
 * Default Filter Panel Renderer
 *
 * Renders the default set filter panel with search, virtualized checkbox list,
 * select-all tristate checkbox, and apply/clear buttons.
 */

import { computeVirtualWindow, shouldBypassVirtualization } from '../../core/internal/virtualization';
import type { FilterPanelParams } from './types';

// #region Constants

/** Default height for filter list items in pixels */
const DEFAULT_LIST_ITEM_HEIGHT = 28;
/** Number of extra items to render above/below the viewport */
const LIST_OVERSCAN = 3;
/** Don't virtualize if fewer than this many items */
const LIST_BYPASS_THRESHOLD = 50;

// #endregion

// #region Helpers

/**
 * Get the item height from CSS variable or fallback to default.
 * Reads --tbw-filter-item-height from the panel element.
 */
export function getListItemHeight(panelElement: HTMLElement | null): number {
  if (panelElement) {
    const cssValue = getComputedStyle(panelElement).getPropertyValue('--tbw-filter-item-height');
    if (cssValue && cssValue.trim()) {
      const parsed = parseFloat(cssValue);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return DEFAULT_LIST_ITEM_HEIGHT;
}

// #endregion

// #region Panel Rendering

/**
 * Render the default set-filter panel content.
 *
 * Creates search input, select-all checkbox, virtualized value list, and apply/clear buttons.
 *
 * @param panel - The panel container element
 * @param params - Filter panel parameters
 * @param uniqueValues - All unique values for this field
 * @param excludedValues - Currently excluded values
 * @param config - Plugin config (caseSensitive, debounceMs)
 * @param searchTextMap - Map of field → current search text
 */
export function renderDefaultFilterPanel(
  panel: HTMLElement,
  params: FilterPanelParams,
  uniqueValues: unknown[],
  excludedValues: Set<unknown>,
  config: { caseSensitive?: boolean; debounceMs?: number },
  searchTextMap: Map<string, string>,
): void {
  const { field, column } = params;
  const itemHeight = getListItemHeight(panel);

  // Helper: format a value using the column's format function (for ID-to-name translation, etc.)
  // When filterValue is set, unique values are already extracted primitives — skip format.
  const formatValue = (value: unknown): string => {
    if (value == null) return '(Blank)';
    if (column.format && !column.filterValue) {
      const formatted = column.format(value, undefined as never);
      if (formatted) return formatted;
    }
    return String(value);
  };

  // Sort unique values — numbers numerically, everything else by display name
  uniqueValues = uniqueValues.slice().sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return formatValue(a).localeCompare(formatValue(b));
  });

  // Search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'tbw-filter-search';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search...';
  searchInput.className = 'tbw-filter-search-input';
  searchInput.value = searchTextMap.get(field) ?? '';
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

  // Track current check state for values (persists across virtualizations)
  const checkState = new Map<string, boolean>();
  uniqueValues.forEach((value) => {
    const key = value == null ? '__null__' : String(value);
    checkState.set(key, !excludedValues.has(value));
  });

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

  // Initialize select all state
  updateSelectAllState();

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

  // Filtered values cache
  let filteredValues: unknown[] = [];

  // Create a single checkbox item element
  const createItem = (value: unknown, index: number): HTMLElement => {
    const displayValue = formatValue(value);
    const key = value == null ? '__null__' : String(value);

    const item = document.createElement('label');
    item.className = 'tbw-filter-value-item';
    item.style.position = 'absolute';
    item.style.top = `calc(var(--tbw-filter-item-height, 28px) * ${index})`;
    item.style.left = '0';
    item.style.right = '0';
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
    label.textContent = displayValue;

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
    spacer.style.height = `${totalItems * itemHeight}px`;

    // Bypass virtualization for small lists
    if (shouldBypassVirtualization(totalItems, LIST_BYPASS_THRESHOLD / 3)) {
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
      rowHeight: itemHeight,
      overscan: LIST_OVERSCAN,
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
    const caseSensitive = config.caseSensitive ?? false;
    const compareFilter = caseSensitive ? filterText : filterText.toLowerCase();

    // Filter the unique values - search against formatted display name
    filteredValues = uniqueValues.filter((value) => {
      const displayStr = formatValue(value);
      const compareValue = caseSensitive ? displayStr : displayStr.toLowerCase();
      return !filterText || compareValue.includes(compareFilter);
    });

    // Sort selected (checked) items first, then alphabetically within each group
    filteredValues.sort((a, b) => {
      const keyA = a == null ? '__null__' : String(a);
      const keyB = b == null ? '__null__' : String(b);
      const checkedA = checkState.get(keyA) ?? true;
      const checkedB = checkState.get(keyB) ?? true;
      if (checkedA !== checkedB) return checkedA ? -1 : 1;
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return formatValue(a).localeCompare(formatValue(b));
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
      searchTextMap.set(field, searchInput.value);
      renderValues(searchInput.value);
    }, config.debounceMs ?? 150);
  });

  // Apply/Clear buttons
  const buttonRow = document.createElement('div');
  buttonRow.className = 'tbw-filter-buttons';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
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
  clearBtn.type = 'button';
  clearBtn.className = 'tbw-filter-clear-btn';
  clearBtn.textContent = 'Clear Filter';
  clearBtn.addEventListener('click', () => {
    params.clearFilter();
  });
  buttonRow.appendChild(clearBtn);

  panel.appendChild(buttonRow);
}

// #endregion
