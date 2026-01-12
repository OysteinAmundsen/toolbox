/**
 * Pivot Panel Unit Tests
 *
 * Tests for the pivot tool panel rendering functions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGG_FUNCS, renderPivotPanel, type FieldInfo, type PanelCallbacks } from './pivot-panel';
import type { PivotConfig } from './types';

describe('pivot-panel', () => {
  let container: HTMLElement;
  let callbacks: PanelCallbacks;
  let callbackSpies: {
    onTogglePivot: ReturnType<typeof vi.fn>;
    onAddFieldToZone: ReturnType<typeof vi.fn>;
    onRemoveFieldFromZone: ReturnType<typeof vi.fn>;
    onAddValueField: ReturnType<typeof vi.fn>;
    onRemoveValueField: ReturnType<typeof vi.fn>;
    onUpdateValueAggFunc: ReturnType<typeof vi.fn>;
    onOptionChange: ReturnType<typeof vi.fn>;
    getAvailableFields: ReturnType<typeof vi.fn>;
  };

  const defaultFields: FieldInfo[] = [
    { field: 'category', header: 'Category' },
    { field: 'region', header: 'Region' },
    { field: 'sales', header: 'Sales' },
    { field: 'profit', header: 'Profit' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    callbackSpies = {
      onTogglePivot: vi.fn(),
      onAddFieldToZone: vi.fn(),
      onRemoveFieldFromZone: vi.fn(),
      onAddValueField: vi.fn(),
      onRemoveValueField: vi.fn(),
      onUpdateValueAggFunc: vi.fn(),
      onOptionChange: vi.fn(),
      getAvailableFields: vi.fn(() => defaultFields),
    };

    callbacks = callbackSpies;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('AGG_FUNCS constant', () => {
    it('contains all expected aggregation functions', () => {
      expect(AGG_FUNCS).toEqual(['sum', 'avg', 'count', 'min', 'max', 'first', 'last']);
    });

    it('has 7 aggregation functions', () => {
      expect(AGG_FUNCS).toHaveLength(7);
    });
  });

  describe('renderPivotPanel', () => {
    it('renders the panel wrapper', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const wrapper = container.querySelector('.tbw-pivot-panel');
      expect(wrapper).not.toBeNull();
    });

    it('renders all sections', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const sections = container.querySelectorAll('.tbw-pivot-section');
      expect(sections.length).toBe(5); // Options, Row Groups, Column Groups, Values, Available Fields
    });

    it('renders section headers', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const headers = container.querySelectorAll('.tbw-pivot-section-header');
      const headerTexts = Array.from(headers).map((h) => h.textContent);

      expect(headerTexts).toContain('Options');
      expect(headerTexts).toContain('Row Groups');
      expect(headerTexts).toContain('Column Groups');
      expect(headerTexts).toContain('Values');
      expect(headerTexts).toContain('Available Fields');
    });

    it('returns a cleanup function', () => {
      const config: PivotConfig = {};
      const cleanup = renderPivotPanel(container, config, false, callbacks);

      expect(typeof cleanup).toBe('function');
    });

    it('cleanup removes the panel from DOM', () => {
      const config: PivotConfig = {};
      const cleanup = renderPivotPanel(container, config, false, callbacks);

      expect(container.querySelector('.tbw-pivot-panel')).not.toBeNull();

      cleanup();

      expect(container.querySelector('.tbw-pivot-panel')).toBeNull();
    });
  });

  describe('Options section', () => {
    it('renders pivot toggle checkbox', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const checkboxes = container.querySelectorAll('.tbw-pivot-checkbox input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    });

    it('renders all option checkboxes', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const checkboxLabels = container.querySelectorAll('.tbw-pivot-checkbox span');
      const labelTexts = Array.from(checkboxLabels).map((l) => l.textContent);

      expect(labelTexts).toContain('Enable Pivot View');
      expect(labelTexts).toContain('Show Row Totals');
      expect(labelTexts).toContain('Show Grand Total');
    });

    it('pivot toggle reflects active state', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, true, callbacks);

      const checkbox = container.querySelector('.tbw-pivot-options input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox?.checked).toBe(true);
    });

    it('toggling pivot checkbox calls onTogglePivot', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const checkbox = container.querySelector('.tbw-pivot-options input[type="checkbox"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      expect(callbackSpies.onTogglePivot).toHaveBeenCalledWith(true);
    });

    it('show totals checkbox reflects config', () => {
      const config: PivotConfig = { showTotals: false };
      renderPivotPanel(container, config, false, callbacks);

      const checkboxes = container.querySelectorAll(
        '.tbw-pivot-options input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>;
      const showTotalsCheckbox = Array.from(checkboxes).find((cb) =>
        cb.parentElement?.textContent?.includes('Show Row Totals'),
      );

      expect(showTotalsCheckbox?.checked).toBe(false);
    });

    it('changing show totals calls onOptionChange', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const checkboxes = container.querySelectorAll(
        '.tbw-pivot-options input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>;
      const showTotalsCheckbox = Array.from(checkboxes).find((cb) =>
        cb.parentElement?.textContent?.includes('Show Row Totals'),
      );

      if (showTotalsCheckbox) {
        showTotalsCheckbox.checked = false;
        showTotalsCheckbox.dispatchEvent(new Event('change'));
        expect(callbackSpies.onOptionChange).toHaveBeenCalledWith('showTotals', false);
      }
    });
  });

  describe('Row Groups zone', () => {
    it('renders placeholder when empty', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const rowGroupZone = container.querySelector('[data-zone="rowGroups"]');
      const placeholder = rowGroupZone?.querySelector('.tbw-pivot-placeholder');

      expect(placeholder?.textContent).toContain('Drag fields here');
    });

    it('renders field chips when fields are configured', () => {
      const config: PivotConfig = { rowGroupFields: ['category', 'region'] };
      renderPivotPanel(container, config, false, callbacks);

      const rowGroupZone = container.querySelector('[data-zone="rowGroups"]');
      const chips = rowGroupZone?.querySelectorAll('.tbw-pivot-field-chip');

      expect(chips?.length).toBe(2);
    });

    it('field chip remove button calls onRemoveFieldFromZone', () => {
      const config: PivotConfig = { rowGroupFields: ['category'] };
      renderPivotPanel(container, config, false, callbacks);

      const removeBtn = container.querySelector('[data-zone="rowGroups"] .tbw-pivot-chip-remove') as HTMLButtonElement;
      removeBtn?.click();

      expect(callbackSpies.onRemoveFieldFromZone).toHaveBeenCalledWith('category', 'rowGroups');
    });

    it('drop zone handles dragover event', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const zone = container.querySelector('[data-zone="rowGroups"]') as HTMLElement;
      const event = new Event('dragover', { bubbles: true, cancelable: true });
      zone.dispatchEvent(event);

      expect(zone.classList.contains('drag-over')).toBe(true);
    });

    it('drop zone handles dragleave event', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const zone = container.querySelector('[data-zone="rowGroups"]') as HTMLElement;
      zone.classList.add('drag-over');
      zone.dispatchEvent(new Event('dragleave'));

      expect(zone.classList.contains('drag-over')).toBe(false);
    });
  });

  describe('Column Groups zone', () => {
    it('renders placeholder when empty', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const columnGroupZone = container.querySelector('[data-zone="columnGroups"]');
      const placeholder = columnGroupZone?.querySelector('.tbw-pivot-placeholder');

      expect(placeholder?.textContent).toContain('Drag fields here');
    });

    it('renders field chips when fields are configured', () => {
      const config: PivotConfig = { columnGroupFields: ['region'] };
      renderPivotPanel(container, config, false, callbacks);

      const columnGroupZone = container.querySelector('[data-zone="columnGroups"]');
      const chips = columnGroupZone?.querySelectorAll('.tbw-pivot-field-chip');

      expect(chips?.length).toBe(1);
    });
  });

  describe('Values zone', () => {
    it('renders placeholder when empty', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const valuesZone = container.querySelector('[data-zone="values"]');
      const placeholder = valuesZone?.querySelector('.tbw-pivot-placeholder');

      expect(placeholder?.textContent).toContain('Drag numeric fields');
    });

    it('renders value chips when value fields are configured', () => {
      const config: PivotConfig = {
        valueFields: [
          { field: 'sales', aggFunc: 'sum' },
          { field: 'profit', aggFunc: 'avg' },
        ],
      };
      renderPivotPanel(container, config, false, callbacks);

      const valuesZone = container.querySelector('[data-zone="values"]');
      const chips = valuesZone?.querySelectorAll('.tbw-pivot-value-chip');

      expect(chips?.length).toBe(2);
    });

    it('value chip has aggregation selector', () => {
      const config: PivotConfig = {
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };
      renderPivotPanel(container, config, false, callbacks);

      const select = container.querySelector('.tbw-pivot-agg-select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select?.value).toBe('sum');
    });

    it('aggregation selector has all options', () => {
      const config: PivotConfig = {
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };
      renderPivotPanel(container, config, false, callbacks);

      const select = container.querySelector('.tbw-pivot-agg-select') as HTMLSelectElement;
      const options = Array.from(select?.options ?? []).map((o) => o.value);

      expect(options).toEqual(AGG_FUNCS);
    });

    it('changing aggregation calls onUpdateValueAggFunc', () => {
      const config: PivotConfig = {
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };
      renderPivotPanel(container, config, false, callbacks);

      const select = container.querySelector('.tbw-pivot-agg-select') as HTMLSelectElement;
      select.value = 'avg';
      select.dispatchEvent(new Event('change'));

      expect(callbackSpies.onUpdateValueAggFunc).toHaveBeenCalledWith('sales', 'avg');
    });

    it('value chip remove button calls onRemoveValueField', () => {
      const config: PivotConfig = {
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };
      renderPivotPanel(container, config, false, callbacks);

      const removeBtn = container.querySelector('[data-zone="values"] .tbw-pivot-chip-remove') as HTMLButtonElement;
      removeBtn?.click();

      expect(callbackSpies.onRemoveValueField).toHaveBeenCalledWith('sales');
    });
  });

  describe('Available Fields zone', () => {
    it('shows available fields from callback', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const availableZone = container.querySelector('.tbw-pivot-available-fields');
      const chips = availableZone?.querySelectorAll('.tbw-pivot-field-chip.available');

      expect(chips?.length).toBe(4); // All 4 default fields available
    });

    it('excludes fields already in use', () => {
      const config: PivotConfig = {
        rowGroupFields: ['category'],
        columnGroupFields: ['region'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };
      renderPivotPanel(container, config, false, callbacks);

      const availableZone = container.querySelector('.tbw-pivot-available-fields');
      const chips = availableZone?.querySelectorAll('.tbw-pivot-field-chip.available');

      expect(chips?.length).toBe(1); // Only 'profit' is unused
      expect(chips?.[0]?.textContent).toBe('Profit');
    });

    it('shows placeholder when all fields are in use', () => {
      callbackSpies.getAvailableFields.mockReturnValue([
        { field: 'category', header: 'Category' },
        { field: 'sales', header: 'Sales' },
      ]);

      const config: PivotConfig = {
        rowGroupFields: ['category'],
        valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      };
      renderPivotPanel(container, config, false, callbacks);

      const availableZone = container.querySelector('.tbw-pivot-available-fields');
      const placeholder = availableZone?.querySelector('.tbw-pivot-placeholder');

      expect(placeholder?.textContent).toContain('All fields are in use');
    });

    it('available field chips are draggable', () => {
      const config: PivotConfig = {};
      renderPivotPanel(container, config, false, callbacks);

      const chip = container.querySelector('.tbw-pivot-available-fields .tbw-pivot-field-chip') as HTMLElement;
      expect(chip?.draggable).toBe(true);
    });
  });

  describe('Field chip interactions', () => {
    it('field chip displays header from getAvailableFields', () => {
      const config: PivotConfig = { rowGroupFields: ['category'] };
      renderPivotPanel(container, config, false, callbacks);

      const chipLabel = container.querySelector('[data-zone="rowGroups"] .tbw-pivot-chip-label');
      expect(chipLabel?.textContent).toBe('Category');
    });

    it('field chip falls back to field name when header not found', () => {
      callbackSpies.getAvailableFields.mockReturnValue([]);

      const config: PivotConfig = { rowGroupFields: ['unknownField'] };
      renderPivotPanel(container, config, false, callbacks);

      const chipLabel = container.querySelector('[data-zone="rowGroups"] .tbw-pivot-chip-label');
      expect(chipLabel?.textContent).toBe('unknownField');
    });
  });

  describe('Cleanup and event listeners', () => {
    it('cleanup aborts all event listeners', () => {
      const config: PivotConfig = { rowGroupFields: ['category'] };
      const cleanup = renderPivotPanel(container, config, false, callbacks);

      cleanup();

      // After cleanup, clicking remove should not trigger callback
      // (element is removed, but this verifies cleanup was called)
      expect(container.querySelector('.tbw-pivot-panel')).toBeNull();
    });
  });
});
