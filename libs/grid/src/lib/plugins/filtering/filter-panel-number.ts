/**
 * Number Filter Panel Renderer
 *
 * Renders a number range filter panel with min/max inputs,
 * a dual-thumb range slider, and a blank-value checkbox.
 */

import type { FilterModel, FilterPanelParams } from './types';

// #region Helpers

/**
 * Convert a value to a number with a fallback.
 */
function toNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  }
  return fallback;
}

// #endregion

// #region Panel Rendering

/**
 * Render a number range filter panel with min/max inputs and slider.
 *
 * Creates number inputs, a dual-thumb range slider, a blank checkbox,
 * and apply/clear buttons.
 *
 * @param panel - The panel container element
 * @param params - Filter panel parameters
 * @param uniqueValues - All unique values for this field
 * @param currentFilters - Map of field → FilterModel for current filter state
 */
export function renderNumberFilterPanel(
  panel: HTMLElement,
  params: FilterPanelParams,
  uniqueValues: unknown[],
  currentFilters: Map<string, FilterModel>,
): void {
  const { field, column } = params;

  // Get range configuration from filterParams, editorParams, or compute from data
  const filterParams = column.filterParams;
  const editorParams = column.editorParams as { min?: number; max?: number; step?: number } | undefined;

  // Compute min/max from data if not specified
  const numericValues = uniqueValues.filter((v) => typeof v === 'number' && !isNaN(v)) as number[];
  const dataMin = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const dataMax = numericValues.length > 0 ? Math.max(...numericValues) : 100;

  const min = toNumber(filterParams?.min ?? editorParams?.min, dataMin);
  const max = toNumber(filterParams?.max ?? editorParams?.max, dataMax);
  const step = filterParams?.step ?? editorParams?.step ?? 1;

  // Get current filter values if any
  const currentFilter = currentFilters.get(field);
  let currentMin = min;
  let currentMax = max;
  const isBlankFilter = currentFilter?.operator === 'blank';
  if (currentFilter?.operator === 'between') {
    currentMin = toNumber(currentFilter.value, min);
    currentMax = toNumber(currentFilter.valueTo, max);
  } else if (currentFilter?.operator === 'greaterThanOrEqual') {
    currentMin = toNumber(currentFilter.value, min);
  } else if (currentFilter?.operator === 'lessThanOrEqual') {
    currentMax = toNumber(currentFilter.value, max);
  }

  // Range inputs container
  const rangeContainer = document.createElement('div');
  rangeContainer.className = 'tbw-filter-range-inputs';

  // Min input
  const minGroup = document.createElement('div');
  minGroup.className = 'tbw-filter-range-group';

  const minLabel = document.createElement('label');
  minLabel.textContent = 'Min';
  minLabel.className = 'tbw-filter-range-label';

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.className = 'tbw-filter-range-input';
  minInput.min = String(min);
  minInput.max = String(max);
  minInput.step = String(step);
  minInput.value = String(currentMin);

  minGroup.appendChild(minLabel);
  minGroup.appendChild(minInput);
  rangeContainer.appendChild(minGroup);

  // Separator
  const separator = document.createElement('span');
  separator.className = 'tbw-filter-range-separator';
  separator.textContent = '–';
  rangeContainer.appendChild(separator);

  // Max input
  const maxGroup = document.createElement('div');
  maxGroup.className = 'tbw-filter-range-group';

  const maxLabel = document.createElement('label');
  maxLabel.textContent = 'Max';
  maxLabel.className = 'tbw-filter-range-label';

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.className = 'tbw-filter-range-input';
  maxInput.min = String(min);
  maxInput.max = String(max);
  maxInput.step = String(step);
  maxInput.value = String(currentMax);

  maxGroup.appendChild(maxLabel);
  maxGroup.appendChild(maxInput);
  rangeContainer.appendChild(maxGroup);

  panel.appendChild(rangeContainer);

  // Range slider (dual thumb using two range inputs)
  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'tbw-filter-range-slider';

  const sliderTrack = document.createElement('div');
  sliderTrack.className = 'tbw-filter-range-track';

  const sliderFill = document.createElement('div');
  sliderFill.className = 'tbw-filter-range-fill';

  const minSlider = document.createElement('input');
  minSlider.type = 'range';
  minSlider.className = 'tbw-filter-range-thumb tbw-filter-range-thumb-min';
  minSlider.min = String(min);
  minSlider.max = String(max);
  minSlider.step = String(step);
  minSlider.value = String(currentMin);

  const maxSlider = document.createElement('input');
  maxSlider.type = 'range';
  maxSlider.className = 'tbw-filter-range-thumb tbw-filter-range-thumb-max';
  maxSlider.min = String(min);
  maxSlider.max = String(max);
  maxSlider.step = String(step);
  maxSlider.value = String(currentMax);

  sliderContainer.appendChild(sliderTrack);
  sliderContainer.appendChild(sliderFill);
  sliderContainer.appendChild(minSlider);
  sliderContainer.appendChild(maxSlider);
  panel.appendChild(sliderContainer);

  // "Blank" checkbox — filter rows with no value in this column
  const blankRow = document.createElement('label');
  blankRow.className = 'tbw-filter-blank-option';

  const blankCheckbox = document.createElement('input');
  blankCheckbox.type = 'checkbox';
  blankCheckbox.className = 'tbw-filter-blank-checkbox';
  blankCheckbox.checked = isBlankFilter;

  const blankLabel = document.createTextNode('Blank');
  blankRow.appendChild(blankCheckbox);
  blankRow.appendChild(blankLabel);

  // Toggle range inputs disabled state when blank is checked
  const toggleRangeInputs = (disabled: boolean): void => {
    minInput.disabled = disabled;
    maxInput.disabled = disabled;
    minSlider.disabled = disabled;
    maxSlider.disabled = disabled;
    rangeContainer.classList.toggle('tbw-filter-disabled', disabled);
    sliderContainer.classList.toggle('tbw-filter-disabled', disabled);
  };
  toggleRangeInputs(isBlankFilter);

  blankCheckbox.addEventListener('change', () => {
    toggleRangeInputs(blankCheckbox.checked);
  });

  panel.appendChild(blankRow);

  // Update fill position
  const updateFill = () => {
    const minVal = parseFloat(minSlider.value);
    const maxVal = parseFloat(maxSlider.value);
    const range = max - min;
    const leftPercent = ((minVal - min) / range) * 100;
    const rightPercent = ((maxVal - min) / range) * 100;
    sliderFill.style.left = `${leftPercent}%`;
    sliderFill.style.width = `${rightPercent - leftPercent}%`;
  };

  // Sync inputs with sliders
  minSlider.addEventListener('input', () => {
    const val = Math.min(parseFloat(minSlider.value), parseFloat(maxSlider.value));
    minSlider.value = String(val);
    minInput.value = String(val);
    updateFill();
  });

  maxSlider.addEventListener('input', () => {
    const val = Math.max(parseFloat(maxSlider.value), parseFloat(minSlider.value));
    maxSlider.value = String(val);
    maxInput.value = String(val);
    updateFill();
  });

  // Sync sliders with inputs.
  // Use Number.isFinite(…) as the guard rather than `|| min` / `|| max` — the
  // latter silently rewrites a legitimate `0` input to the panel's lower bound
  // when the data range straddles zero (e.g. min=-100).
  minInput.addEventListener('input', () => {
    const parsed = parseFloat(minInput.value);
    let val = Number.isFinite(parsed) ? parsed : min;
    val = Math.max(min, Math.min(val, parseFloat(maxInput.value)));
    minSlider.value = String(val);
    updateFill();
  });

  maxInput.addEventListener('input', () => {
    const parsed = parseFloat(maxInput.value);
    let val = Number.isFinite(parsed) ? parsed : max;
    val = Math.min(max, Math.max(val, parseFloat(minInput.value)));
    maxSlider.value = String(val);
    updateFill();
  });

  // Initialize fill
  updateFill();

  // Apply/Clear buttons
  const buttonRow = document.createElement('div');
  buttonRow.className = 'tbw-filter-buttons';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'tbw-filter-apply-btn';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    if (blankCheckbox.checked) {
      params.applyTextFilter('blank', '');
      return;
    }
    const minVal = parseFloat(minInput.value);
    const maxVal = parseFloat(maxInput.value);
    // An empty input parses to NaN; treat that as "not constrained" and fall
    // back to the panel bound. Then, when neither side has actually been moved
    // from the data-derived defaults, Apply means "no filter" — applying a
    // `between` over the full range would silently drop blank rows.
    const effectiveMin = Number.isFinite(minVal) ? minVal : min;
    const effectiveMax = Number.isFinite(maxVal) ? maxVal : max;
    if (effectiveMin === min && effectiveMax === max) {
      params.clearFilter();
      return;
    }
    params.applyTextFilter('between', effectiveMin, effectiveMax);
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

// #endregion
