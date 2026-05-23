/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDateFilterPanel } from './filter-panel-date';
import type { FilterModel, FilterPanelParams } from './types';

function createParams(overrides: Partial<FilterPanelParams> = {}): FilterPanelParams {
  return {
    field: 'date',
    column: { field: 'date', header: 'Date', type: 'date' as any },
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

describe('renderDateFilterPanel', () => {
  let panel: HTMLElement;

  beforeEach(() => {
    panel = document.createElement('div');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region DOM Structure

  describe('DOM structure', () => {
    it('should render date range container with from/to inputs', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

      const range = panel.querySelector('.tbw-filter-date-range');
      expect(range).toBeDefined();

      const inputs = panel.querySelectorAll('input[type="date"]');
      expect(inputs.length).toBe(2);
    });

    it('should render From and To labels', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

      const labels = panel.querySelectorAll('.tbw-filter-range-label');
      expect(labels.length).toBe(2);
      expect(labels[0].textContent).toBe('From');
      expect(labels[1].textContent).toBe('To');
    });

    it('should render a separator', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

      const sep = panel.querySelector('.tbw-filter-range-separator');
      expect(sep).toBeDefined();
      expect(sep!.textContent).toBe('–');
    });

    it('should render blank checkbox', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      expect(blankCb).toBeDefined();
      expect(blankCb.type).toBe('checkbox');
      expect(blankCb.checked).toBe(false);
    });

    it('should render Apply and Clear buttons', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

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

  describe('min/max auto-computation', () => {
    it('should set min/max from date values in data', () => {
      const values = [new Date('2024-01-01'), new Date('2024-06-15'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, createParams(), values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].min).toBe('2024-01-01');
      expect(inputs[0].max).toBe('2024-12-31');
      expect(inputs[1].min).toBe('2024-01-01');
      expect(inputs[1].max).toBe('2024-12-31');
    });

    it('should parse string dates from data', () => {
      const values = ['2024-03-15', '2024-09-20'];
      renderDateFilterPanel(panel, createParams(), values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].min).toBe('2024-03-15');
      expect(inputs[0].max).toBe('2024-09-20');
    });

    it('should use filterParams min/max over data-derived values', () => {
      const params = createParams({
        column: {
          field: 'date',
          header: 'Date',
          type: 'date' as any,
          filterParams: { min: '2020-01-01', max: '2030-12-31' },
        },
      });
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, params, values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].min).toBe('2020-01-01');
      expect(inputs[0].max).toBe('2030-12-31');
    });
  });

  // #endregion

  // #region Current filter restoration

  describe('current filter restoration', () => {
    it('should restore "between" filter values', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'between',
        value: '2024-03-01',
        valueTo: '2024-06-30',
      });
      renderDateFilterPanel(panel, createParams(), [], filters);

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2024-03-01');
      expect(inputs[1].value).toBe('2024-06-30');
    });

    it('should restore "greaterThanOrEqual" filter to From input and keep To at default max', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'greaterThanOrEqual',
        value: '2024-05-01',
      });
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, createParams(), values, filters);

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2024-05-01');
      // Other bound stays populated with its default so the user can see the
      // open upper bound rather than an empty input (parity with number panel).
      expect(inputs[1].value).toBe('2024-12-31');
    });

    it('should restore "lessThanOrEqual" filter to To input and keep From at default min', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'lessThanOrEqual',
        value: '2024-11-30',
      });
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, createParams(), values, filters);

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2024-01-01');
      expect(inputs[1].value).toBe('2024-11-30');
    });

    it('should restore blank filter checkbox', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'blank',
        value: '',
      });
      renderDateFilterPanel(panel, createParams(), [], filters);

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      expect(blankCb.checked).toBe(true);
    });
  });

  // #endregion

  // #region Blank toggle behavior

  describe('blank toggle', () => {
    it('should disable date inputs when blank is checked', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'blank',
        value: '',
      });
      renderDateFilterPanel(panel, createParams(), [], filters);

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].disabled).toBe(true);
      expect(inputs[1].disabled).toBe(true);
    });

    it('should add disabled class to range container when blank is checked', () => {
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'blank',
        value: '',
      });
      renderDateFilterPanel(panel, createParams(), [], filters);

      const range = panel.querySelector('.tbw-filter-date-range');
      expect(range!.classList.contains('tbw-filter-disabled')).toBe(true);
    });

    it('should toggle date inputs disabled when blank checkbox changes', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;

      // Initially enabled
      expect(inputs[0].disabled).toBe(false);

      // Check blank
      blankCb.checked = true;
      blankCb.dispatchEvent(new Event('change'));
      expect(inputs[0].disabled).toBe(true);
      expect(inputs[1].disabled).toBe(true);

      // Uncheck blank
      blankCb.checked = false;
      blankCb.dispatchEvent(new Event('change'));
      expect(inputs[0].disabled).toBe(false);
      expect(inputs[1].disabled).toBe(false);
    });
  });

  // #endregion

  // #region Apply button

  describe('apply button', () => {
    it('should call applyTextFilter with "blank" when blank is checked', () => {
      const params = createParams();
      renderDateFilterPanel(panel, params, [], new Map());

      const blankCb = panel.querySelector('.tbw-filter-blank-checkbox') as HTMLInputElement;
      blankCb.checked = true;
      blankCb.dispatchEvent(new Event('change'));

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('blank', '');
    });

    it('should call applyTextFilter with "between" when both from and to are set', () => {
      const params = createParams();
      renderDateFilterPanel(panel, params, [], new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '2024-01-01';
      inputs[1].value = '2024-12-31';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('between', '2024-01-01', '2024-12-31');
    });

    it('should call applyTextFilter with "greaterThanOrEqual" when only from is set', () => {
      const params = createParams();
      renderDateFilterPanel(panel, params, [], new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '2024-06-01';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('greaterThanOrEqual', '2024-06-01');
    });

    it('should call applyTextFilter with "lessThanOrEqual" when only to is set', () => {
      const params = createParams();
      renderDateFilterPanel(panel, params, [], new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      inputs[1].value = '2024-09-15';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('lessThanOrEqual', '2024-09-15');
    });

    it('should call clearFilter when neither from nor to is set', () => {
      const params = createParams();
      renderDateFilterPanel(panel, params, [], new Map());

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.clearFilter).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Clear button

  describe('clear button', () => {
    it('should call clearFilter when Clear is clicked', () => {
      const params = createParams();
      renderDateFilterPanel(panel, params, [], new Map());

      const clearBtn = panel.querySelector('.tbw-filter-clear-btn') as HTMLButtonElement;
      clearBtn.click();

      expect(params.clearFilter).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Auto-populate from data range

  describe('auto-populate from data range', () => {
    it('should pre-populate from/to inputs with data min/max when no filter is active', () => {
      const values = [new Date('2024-01-01'), new Date('2024-06-15'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, createParams(), values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2024-01-01');
      expect(inputs[1].value).toBe('2024-12-31');
    });

    it('should leave inputs empty when no data and no filter', () => {
      renderDateFilterPanel(panel, createParams(), [], new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('');
      expect(inputs[1].value).toBe('');
    });

    it('should pre-populate with data-derived defaults but use filterParams for input min/max constraints', () => {
      const params = createParams({
        column: {
          field: 'date',
          header: 'Date',
          type: 'date' as any,
          filterParams: { min: '2020-01-01', max: '2030-12-31' },
        },
      });
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, params, values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      // Default *values* reflect the actual data so narrowing the inputs by a
      // small amount actually filters rows (the user's reported bug fix).
      expect(inputs[0].value).toBe('2024-01-01');
      expect(inputs[1].value).toBe('2024-12-31');
      // The input's allowed range still respects filterParams.
      expect(inputs[0].min).toBe('2020-01-01');
      expect(inputs[0].max).toBe('2030-12-31');
    });

    it('should fall back to filterParams defaults when no data is available', () => {
      const params = createParams({
        column: {
          field: 'date',
          header: 'Date',
          type: 'date' as any,
          filterParams: { min: '2020-01-01', max: '2030-12-31' },
        },
      });
      renderDateFilterPanel(panel, params, [], new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2020-01-01');
      expect(inputs[1].value).toBe('2030-12-31');
    });

    it('should clearFilter when Apply is clicked with unchanged data range defaults', () => {
      const params = createParams();
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, params, values, new Map());

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.clearFilter).toHaveBeenCalled();
      expect(params.applyTextFilter).not.toHaveBeenCalled();
    });

    it('should apply "between" when user narrows below the data range', () => {
      const params = createParams();
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, params, values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '2024-03-01';
      inputs[1].value = '2024-09-30';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('between', '2024-03-01', '2024-09-30');
    });

    it('should apply "lessThanOrEqual" when only To is narrowed (From left at default min)', () => {
      // Regression: changing only To while From was pre-populated with the data
      // min used to emit `between(defaultMin, newTo)`, which silently excluded
      // blank rows and round-tripped as a confusing filter. The default-equal
      // From is now collapsed away so the filter is stored as a true upper
      // bound only — and the panel restores To to the user's value with From
      // back at the default min.
      const params = createParams();
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, params, values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2024-01-01');
      expect(inputs[1].value).toBe('2024-12-31');

      // User reduces the max by 2 months — From left untouched.
      inputs[1].value = '2024-10-31';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('lessThanOrEqual', '2024-10-31');
    });

    it('should apply "greaterThanOrEqual" when only From is narrowed (To left at default max)', () => {
      const params = createParams();
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, params, values, new Map());

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      inputs[0].value = '2024-04-01';

      const applyBtn = panel.querySelector('.tbw-filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(params.applyTextFilter).toHaveBeenCalledWith('greaterThanOrEqual', '2024-04-01');
    });

    it('should restore a narrowed "lessThanOrEqual" filter with the default From after reopen', () => {
      // Full round-trip for the user-reported bug: narrow To by 2 months,
      // Apply, reopen — From shows the data min again (not blank) and To
      // shows the user's value.
      const filters = new Map<string, FilterModel>();
      filters.set('date', {
        field: 'date',
        type: 'date',
        operator: 'lessThanOrEqual',
        value: '2024-10-31',
      });
      const values = [new Date('2024-01-01'), new Date('2024-12-31')];
      renderDateFilterPanel(panel, createParams(), values, filters);

      const inputs = panel.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe('2024-01-01');
      expect(inputs[1].value).toBe('2024-10-31');
    });
  });

  // #endregion
});
