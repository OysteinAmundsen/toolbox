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

  // `inputMin` / `inputMax` constrain what the user can enter (the HTML
  // `<input type="date">` min/max attributes). `filterParams` wins here so
  // consumers can widen the picker beyond what's currently in the data.
  const inputMin =
    parseFilterParam(filterParams?.min) || parseFilterParam(editorParams?.min) || formatDateForInput(dataMin);
  const inputMax =
    parseFilterParam(filterParams?.max) || parseFilterParam(editorParams?.max) || formatDateForInput(dataMax);

  // `defaultFrom` / `defaultTo` are the values that pre-populate the inputs
  // when no filter is active, AND the comparators used to detect a default-
  // equal submission on Apply. These must reflect the *actual data range* so
  // narrowing the inputs by a small amount actually filters rows. Falling
  // back to filterParams/editorParams only when there's no data ensures the
  // panel still functions when uniqueValues is empty (e.g. async data).
  const defaultFrom =
    formatDateForInput(dataMin) || parseFilterParam(filterParams?.min) || parseFilterParam(editorParams?.min);
  const defaultTo =
    formatDateForInput(dataMax) || parseFilterParam(filterParams?.max) || parseFilterParam(editorParams?.max);

  // Get current filter values if any. When no filter is set, pre-populate the
  // inputs with the data-derived defaults so the panel shows the actual data
  // range. For single-bound filters (gte/lte), keep the other input at its
  // default rather than blanking it — matches the number panel's behaviour.
  const currentFilter = currentFilters.get(field);
  let currentFrom = defaultFrom;
  let currentTo = defaultTo;
  const isBlankFilter = currentFilter?.operator === 'blank';
  if (currentFilter?.operator === 'between') {
    currentFrom = parseFilterParam(currentFilter.value) || defaultFrom;
    currentTo = parseFilterParam(currentFilter.valueTo) || defaultTo;
  } else if (currentFilter?.operator === 'greaterThanOrEqual') {
    currentFrom = parseFilterParam(currentFilter.value) || defaultFrom;
  } else if (currentFilter?.operator === 'lessThanOrEqual') {
    currentTo = parseFilterParam(currentFilter.value) || defaultTo;
  }
  // For 'blank' (and any other operator we don't recognise), keep the defaults
  // populated — the blank checkbox already conveys the active state and the
  // date inputs are disabled while it's checked.

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
  if (inputMin) fromInput.min = inputMin;
  if (inputMax) fromInput.max = inputMax;
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
  if (inputMin) toInput.min = inputMin;
  if (inputMax) toInput.max = inputMax;
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

    // Treat each bound that equals the data-derived default as "no constraint
    // on that side". A `from` equal to the default min is no narrower than the
    // open lower bound; same for `to` equal to the default max. Collapsing
    // these to empty here means a Both-Defaults submission becomes Clear, and
    // a Single-Defaults submission becomes a one-sided gte/lte — mirroring
    // the number panel's behaviour and avoiding silently-stored no-op filters.
    const effectiveFrom = from && from !== defaultFrom ? from : '';
    const effectiveTo = to && to !== defaultTo ? to : '';

    if (effectiveFrom && effectiveTo) {
      params.applyTextFilter('between', effectiveFrom, effectiveTo);
    } else if (effectiveFrom) {
      params.applyTextFilter('greaterThanOrEqual', effectiveFrom);
    } else if (effectiveTo) {
      params.applyTextFilter('lessThanOrEqual', effectiveTo);
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
