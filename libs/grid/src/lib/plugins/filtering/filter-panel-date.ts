/**
 * Date Filter Panel Renderer
 *
 * Renders a date range filter panel with from/to date inputs,
 * min/max constraints, a blank-value checkbox, and apply/clear buttons.
 */

import type { FilterModel, FilterPanelParams } from './types';

// #region Helpers

/**
 * Format a Date as YYYY-MM-DD for `<input type="date">`.
 */
function formatDateForInput(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Parse a filter parameter value to a date string suitable for `<input type="date">`.
 */
function parseFilterParam(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return formatDateForInput(new Date(value));
  return '';
}

// #endregion

// #region Panel Rendering

/**
 * Render a date range filter panel with from/to inputs and a blank checkbox.
 *
 * Computes min/max date constraints from the data when not specified via
 * `filterParams` or `editorParams` on the column.
 *
 * @param panel - The panel container element
 * @param params - Filter panel parameters
 * @param uniqueValues - All unique values for this field
 * @param currentFilters - Map of field → FilterModel for current filter state
 */
export function renderDateFilterPanel(
  panel: HTMLElement,
  params: FilterPanelParams,
  uniqueValues: unknown[],
  currentFilters: Map<string, FilterModel>,
): void {
  const { field, column } = params;

  // Get range configuration from filterParams, editorParams, or compute from data
  const filterParams = column.filterParams;
  const editorParams = column.editorParams as { min?: string; max?: string } | undefined;

  // Compute min/max from data if not specified
  const dateValues = uniqueValues
    .filter((v) => v instanceof Date || (typeof v === 'string' && !isNaN(Date.parse(v))))
    .map((v) => (v instanceof Date ? v : new Date(v as string)))
    .filter((d) => !isNaN(d.getTime()));

  const dataMin = dateValues.length > 0 ? new Date(Math.min(...dateValues.map((d) => d.getTime()))) : null;
  const dataMax = dateValues.length > 0 ? new Date(Math.max(...dateValues.map((d) => d.getTime()))) : null;

  const minDate =
    parseFilterParam(filterParams?.min) || parseFilterParam(editorParams?.min) || formatDateForInput(dataMin);
  const maxDate =
    parseFilterParam(filterParams?.max) || parseFilterParam(editorParams?.max) || formatDateForInput(dataMax);

  // Get current filter values if any
  const currentFilter = currentFilters.get(field);
  let currentFrom = '';
  let currentTo = '';
  const isBlankFilter = currentFilter?.operator === 'blank';
  if (currentFilter?.operator === 'between') {
    currentFrom = parseFilterParam(currentFilter.value) || '';
    currentTo = parseFilterParam(currentFilter.valueTo) || '';
  } else if (currentFilter?.operator === 'greaterThanOrEqual') {
    currentFrom = parseFilterParam(currentFilter.value) || '';
  } else if (currentFilter?.operator === 'lessThanOrEqual') {
    currentTo = parseFilterParam(currentFilter.value) || '';
  }

  // Date range inputs container
  const rangeContainer = document.createElement('div');
  rangeContainer.className = 'tbw-filter-date-range';

  // From input
  const fromGroup = document.createElement('div');
  fromGroup.className = 'tbw-filter-date-group';

  const fromLabel = document.createElement('label');
  fromLabel.textContent = 'From';
  fromLabel.className = 'tbw-filter-range-label';

  const fromInput = document.createElement('input');
  fromInput.type = 'date';
  fromInput.className = 'tbw-filter-date-input';
  if (minDate) fromInput.min = minDate;
  if (maxDate) fromInput.max = maxDate;
  fromInput.value = currentFrom;

  fromGroup.appendChild(fromLabel);
  fromGroup.appendChild(fromInput);
  rangeContainer.appendChild(fromGroup);

  // Separator
  const separator = document.createElement('span');
  separator.className = 'tbw-filter-range-separator';
  separator.textContent = '–';
  rangeContainer.appendChild(separator);

  // To input
  const toGroup = document.createElement('div');
  toGroup.className = 'tbw-filter-date-group';

  const toLabel = document.createElement('label');
  toLabel.textContent = 'To';
  toLabel.className = 'tbw-filter-range-label';

  const toInput = document.createElement('input');
  toInput.type = 'date';
  toInput.className = 'tbw-filter-date-input';
  if (minDate) toInput.min = minDate;
  if (maxDate) toInput.max = maxDate;
  toInput.value = currentTo;

  toGroup.appendChild(toLabel);
  toGroup.appendChild(toInput);
  rangeContainer.appendChild(toGroup);

  panel.appendChild(rangeContainer);

  // "Show only blank" checkbox
  const blankRow = document.createElement('label');
  blankRow.className = 'tbw-filter-blank-option';

  const blankCheckbox = document.createElement('input');
  blankCheckbox.type = 'checkbox';
  blankCheckbox.className = 'tbw-filter-blank-checkbox';
  blankCheckbox.checked = isBlankFilter;

  const blankLabel = document.createTextNode('Show only blank');
  blankRow.appendChild(blankCheckbox);
  blankRow.appendChild(blankLabel);

  // Toggle date inputs disabled state when blank is checked
  const toggleDateInputs = (disabled: boolean): void => {
    fromInput.disabled = disabled;
    toInput.disabled = disabled;
    rangeContainer.classList.toggle('tbw-filter-disabled', disabled);
  };
  toggleDateInputs(isBlankFilter);

  blankCheckbox.addEventListener('change', () => {
    toggleDateInputs(blankCheckbox.checked);
  });

  panel.appendChild(blankRow);

  // Apply/Clear buttons
  const buttonRow = document.createElement('div');
  buttonRow.className = 'tbw-filter-buttons';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'tbw-filter-apply-btn';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    if (blankCheckbox.checked) {
      params.applyTextFilter('blank', '');
      return;
    }

    const from = fromInput.value;
    const to = toInput.value;

    if (from && to) {
      params.applyTextFilter('between', from, to);
    } else if (from) {
      params.applyTextFilter('greaterThanOrEqual', from);
    } else if (to) {
      params.applyTextFilter('lessThanOrEqual', to);
    } else {
      params.clearFilter();
    }
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
