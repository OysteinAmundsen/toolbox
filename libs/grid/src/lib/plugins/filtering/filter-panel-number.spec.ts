/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderNumberFilterPanel } from './filter-panel-number';
import type { FilterModel, FilterPanelParams } from './types';

function createParams(overrides: Partial<FilterPanelParams> = {}): FilterPanelParams {
  return {
    field: 'amount',
    column: { field: 'amount', header: 'Amount', type: 'number' as any },
    uniqueValues: [],
    excludedValues: new Set(),
    searchText: '',
    currentFilter: undefined,
    applySetFilter: vi.fn(),
    applyTextFilter: vi.fn(),
    clearFilter: vi.fn(),
    closePanel: vi.fn(),
    ...overrides,
  } as FilterPanelParams;
}

describe('renderNumberFilterPanel', () => {
  let panel: HTMLElement;

  beforeEach(() => {
    panel = document.createElement('div');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region DOM Structure

  describe('DOM structure', () => {
    it('should render range inputs container with min/max inputs', () => {
      renderNumberFilterPanel(panel, createParams(), [], new Map());

      const range = panel.querySelector('.tbw-filter-range-inputs');
      expect(range).toBeDefined();

      const inputs = panel.querySelectorAll('input[type="number"]');
      expect(inputs.length).toBe(2);
    });

    it('should render Min and Max labels', () => {
      renderNumberFilterPanel(panel, createParams(), [], new Map());

      const labels = panel.querySelectorAll('.tbw-filter-range-label');
      expect(labels.length).toBe(2);
      expect(labels[0].textContent).toBe('Min');
      expect(labels[1].textContent).toBe('Max');
    });

    it('should render dual-thumb range slider', () => {
      renderNumberFilterPanel(panel, createParams(), [], new Map());

      const slider = panel.querySelector('.tbw-filter-range-slider');
      expect(slider).toBeDefined();

      const thumbs = panel.querySelectorAll('input[type="range"]');
      expect(thumbs.length).toBe(2);

      expect(panel.querySelector('.tbw-filter-range-track')).toBeDefined();
      expect(panel.querySelector('.tbw-filter-range-fill')).toBeDefined();
    });

    it('should render blank checkbox', () => {
      renderNumberFilterPanel(panel, createParams(), [], new Map());

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      expect(blankCb).toBeDefined();
      expect(blankCb.type).toBe('checkbox');
      expect(blankCb.checked).toBe(false);
    });

    it('should render Apply and Clear buttons', () => {
      renderNumberFilterPanel(panel, createParams(), [], new Map());

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn');
      expect(applyBtn).toBeDefined();
      expect(applyBtn!.textContent).toBe('Apply');

      const clearBtn = panel.querySelector('.tbw-filter-clear-btn');
      expect(clearBtn).toBeDefined();
      expect(clearBtn!.textContent).toBe('Clear Filter');
    });
  });

  // #endregion

  // #region Min/Max from data

  describe('min/max from data', () => {
    it('should compute min/max from numeric values', () => {
      const values = [10, 50, 25, 75, 100];
      renderNumberFilterPanel(panel, createParams(), values, new Map());

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].min).toBe('10');
      expect(inputs[0].max).toBe('100');
      expect(inputs[1].min).toBe('10');
      expect(inputs[1].max).toBe('100');
    });

    it('should default to 0-100 when no numeric values', () => {
      renderNumberFilterPanel(panel, createParams(), [], new Map());

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].min).toBe('0');
      expect(inputs[0].max).toBe('100');
    });

    it('should use filterParams min/max over data-derived values', () => {
      const params = createParams({
        column: {
          field: 'amount',
          header: 'Amount',
          type: 'number' as any,
          filterParams: { min: 0, max: 1000, step: 10 },
        },
      });
      renderNumberFilterPanel(panel, params, [5, 50], new Map());

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].min).toBe('0');
      expect(inputs[0].max).toBe('1000');
      expect(inputs[0].step).toBe('10');
    });

    it('should set slider min/max/step from data', () => {
      const values = [10, 50, 100];
      renderNumberFilterPanel(panel, createParams(), values, new Map());

      const sliders = panel.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
      expect(sliders[0].min).toBe('10');
      expect(sliders[0].max).toBe('100');
      expect(sliders[1].min).toBe('10');
      expect(sliders[1].max).toBe('100');
    });
  });

  // #endregion

  // #region Current filter restoration

  describe('current filter restoration', () => {
    it('should restore "between" filter values', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('amount', {
        field: 'amount',
        type: 'number',
        operator: 'between',
        value: 20,
        valueTo: 80,
      });
      renderNumberFilterPanel(panel, createParams(), [0, 100], filters);

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('20');
      expect(inputs[1].value).toBe('80');
    });

    it('should restore "greaterThanOrEqual" filter to min input', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('amount', {
        field: 'amount',
        type: 'number',
        operator: 'greaterThanOrEqual',
        value: 50,
      });
      renderNumberFilterPanel(panel, createParams(), [0, 100], filters);

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('50');
    });

    it('should restore "lessThanOrEqual" filter to max input', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('amount', {
        field: 'amount',
        type: 'number',
        operator: 'lessThanOrEqual',
        value: 75,
      });
      renderNumberFilterPanel(panel, createParams(), [0, 100], filters);

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[1].value).toBe('75');
    });

    it('should restore blank filter checkbox', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('amount', {
        field: 'amount',
        type: 'number',
        operator: 'blank',
        value: '',
      });
      renderNumberFilterPanel(panel, createParams(), [0, 100], filters);

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      expect(blankCb.checked).toBe(true);
    });
  });

  // #endregion

  // #region Blank toggle

  describe('blank toggle', () => {
    it('should disable number inputs and sliders when blank is checked', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('amount', {
        field: 'amount',
        type: 'number',
        operator: 'blank',
        value: '',
      });
      renderNumberFilterPanel(panel, createParams(), [0, 100], filters);

      const numInputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      const sliders = panel.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
      expect(numInputs[0].disabled).toBe(true);
      expect(numInputs[1].disabled).toBe(true);
      expect(sliders[0].disabled).toBe(true);
      expect(sliders[1].disabled).toBe(true);
    });

    it('should toggle disabled state when blank checkbox changes', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      const numInputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      const sliders = panel.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;

      // Initially enabled
      expect(numInputs[0].disabled).toBe(false);
      expect(sliders[0].disabled).toBe(false);

      // Check blank
      blankCb.checked = true;
      blankCb.dispatchEvent(new Event('change'));
      expect(numInputs[0].disabled).toBe(true);
      expect(sliders[0].disabled).toBe(true);

      // Uncheck
      blankCb.checked = false;
      blankCb.dispatchEvent(new Event('change'));
      expect(numInputs[0].disabled).toBe(false);
      expect(sliders[0].disabled).toBe(false);
    });
  });

  // #endregion

  // #region Slider-Input Sync

  describe('slider-input sync', () => {
    it('should sync min slider to min input on input event', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const minSlider = panel.querySelector('.tbw-filter-range-thumb-min') as HTMLInputElement;
      const minInput = panel.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;

      minSlider.value = '30';
      minSlider.dispatchEvent(new Event('input'));
      expect(minInput.value).toBe('30');
    });

    it('should sync max slider to max input on input event', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const maxSlider = panel.querySelector('.tbw-filter-range-thumb-max') as HTMLInputElement;
      const maxInput = panel.querySelectorAll('input[type="number"]')[1] as HTMLInputElement;

      maxSlider.value = '70';
      maxSlider.dispatchEvent(new Event('input'));
      expect(maxInput.value).toBe('70');
    });

    it('should sync min input to min slider on input event', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const minInput = panel.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
      const minSlider = panel.querySelector('.tbw-filter-range-thumb-min') as HTMLInputElement;

      minInput.value = '25';
      minInput.dispatchEvent(new Event('input'));
      expect(minSlider.value).toBe('25');
    });

    it('should sync max input to max slider on input event', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const maxInput = panel.querySelectorAll('input[type="number"]')[1] as HTMLInputElement;
      const maxSlider = panel.querySelector('.tbw-filter-range-thumb-max') as HTMLInputElement;

      maxInput.value = '85';
      maxInput.dispatchEvent(new Event('input'));
      expect(maxSlider.value).toBe('85');
    });

    it('should clamp min slider to not exceed max slider', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const minSlider = panel.querySelector('.tbw-filter-range-thumb-min') as HTMLInputElement;
      const maxSlider = panel.querySelector('.tbw-filter-range-thumb-max') as HTMLInputElement;
      const minInput = panel.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;

      maxSlider.value = '50';
      maxSlider.dispatchEvent(new Event('input'));

      minSlider.value = '60'; // exceeds max
      minSlider.dispatchEvent(new Event('input'));

      // Should clamp to max value
      expect(minInput.value).toBe('50');
    });

    it('should clamp max slider to not go below min slider', () => {
      renderNumberFilterPanel(panel, createParams(), [0, 100], new Map());

      const minSlider = panel.querySelector('.tbw-filter-range-thumb-min') as HTMLInputElement;
      const maxSlider = panel.querySelector('.tbw-filter-range-thumb-max') as HTMLInputElement;
      const maxInput = panel.querySelectorAll('input[type="number"]')[1] as HTMLInputElement;

      minSlider.value = '60';
      minSlider.dispatchEvent(new Event('input'));

      maxSlider.value = '40'; // below min
      maxSlider.dispatchEvent(new Event('input'));

      // Should clamp to min value
      expect(maxInput.value).toBe('60');
    });
  });

  // #endregion

  // #region Fill bar

  describe('fill bar', () => {
    it('should update fill position on initial render', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('amount', {
        field: 'amount',
        type: 'number',
        operator: 'between',
        value: 25,
        valueTo: 75,
      });
      renderNumberFilterPanel(panel, createParams(), [0, 100], filters);

      const fill = panel.querySelector('.tbw-filter-range-fill') as HTMLElement;
      expect(fill.style.left).toBe('25%');
      expect(fill.style.width).toBe('50%');
    });
  });

  // #endregion

  // #region Apply button

  describe('apply button', () => {
    it('should call applyTextFilter with "blank" when blank is checked', () => {
      const params = createParams();
      renderNumberFilterPanel(panel, params, [0, 100], new Map());

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      blankCb.checked = true;
      blankCb.dispatchEvent(new Event('change'));

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('blank', '');
    });

    it('should call applyTextFilter with "between" and min/max values', () => {
      const params = createParams();
      renderNumberFilterPanel(panel, params, [0, 100], new Map());

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '20';
      inputs[1].value = '80';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('between', 20, 80);
    });

    it('should clear the filter when Apply is clicked without moving min/max from defaults', () => {
      // Regression: default min/max bounds mean the user has not constrained anything;
      // applying `between` with the full data range would still exclude blank rows.
      // Apply-with-defaults must be equivalent to clearing the filter instead.
      const params = createParams();
      renderNumberFilterPanel(panel, params, [0, 100], new Map());

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.clearFilter).toHaveBeenCalled();
      expect(params.applyTextFilter).not.toHaveBeenCalled();
    });

    it('should treat empty inputs as unchanged and clear the filter', () => {
      // Regression: parseFloat('') is NaN; NaN fell through the `=== min` equality
      // check and produced `between(NaN, NaN)` which matches zero rows.
      const params = createParams();
      renderNumberFilterPanel(panel, params, [0, 100], new Map());

      const inputs = panel.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '';
      inputs[1].value = '';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.clearFilter).toHaveBeenCalled();
      expect(params.applyTextFilter).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Input sync guards

  describe('input sync edge cases', () => {
    it('should not reset slider when user types 0 into Min with a negative data range', () => {
      // Regression: `parseFloat(value) || min` turned a valid `0` into the panel's
      // lower bound (e.g. -100) because `0` is falsy.
      const values = [-100, -50, 0, 50, 100];
      renderNumberFilterPanel(panel, createParams(), values, new Map());

      const minInput = panel.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
      const minSlider = panel.querySelector('.tbw-filter-range-thumb-min') as HTMLInputElement;

      minInput.value = '0';
      minInput.dispatchEvent(new Event('input'));

      expect(minSlider.value).toBe('0');
    });

    it('should fall back to panel min when the Min input is cleared', () => {
      const values = [-100, 0, 100];
      renderNumberFilterPanel(panel, createParams(), values, new Map());

      const minInput = panel.querySelectorAll('input[type="number"]')[0] as HTMLInputElement;
      const minSlider = panel.querySelector('.tbw-filter-range-thumb-min') as HTMLInputElement;

      minInput.value = '';
      minInput.dispatchEvent(new Event('input'));

      // Cleared input means "no lower bound" — slider snaps back to panel min.
      expect(minSlider.value).toBe('-100');
    });
  });

  // #endregion

  // #region Clear button

  describe('clear button', () => {
    it('should call clearFilter when Clear is clicked', () => {
      const params = createParams();
      renderNumberFilterPanel(panel, params, [0, 100], new Map());

      const clearBtn = panel.querySelector('.tbw-filter-clear-btn') as HTMLButtonElement;
      clearBtn.click();

      expect(params.clearFilter).toHaveBeenCalled();
    });
  });

  // #endregion
});
