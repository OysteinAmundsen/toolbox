/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { renderDefaultFilterPanel } from './filter-panel-default';
import type { FilterPanelParams } from './types';

// #region Helpers

function createPanel() {
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  return panel;
}

function createParams(overrides: Partial<FilterPanelParams> = {}): FilterPanelParams {
  return {
    field: 'status',
    column: { field: 'status' } as ColumnConfig,
    uniqueValues: [],
    excludedValues: new Set(),
    searchText: '',
    currentFilter: undefined,
    applySetFilter: vi.fn(),
    clearFilter: vi.fn(),
    applyAdvancedFilter: vi.fn(),
    ...overrides,
  };
}

function getCheckboxLabels(panel: HTMLElement): { text: string; checked: boolean }[] {
  const items = panel.querySelectorAll<HTMLLabelElement>('.tbw-filter-value-item');
  const result: { text: string; checked: boolean }[] = [];
  for (const item of items) {
    const cb = item.querySelector<HTMLInputElement>('.tbw-filter-checkbox');
    const span = item.querySelector('span');
    if (span && cb && span.textContent !== 'Select All') {
      result.push({ text: span.textContent ?? '', checked: cb.checked });
    }
  }
  return result;
}

// #endregion

describe('renderDefaultFilterPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should sort selected items before unselected items', () => {
    const panel = createPanel();
    const uniqueValues = ['Apple', 'Banana', 'Cherry', 'Date'];
    const excludedValues = new Set<unknown>(['Apple', 'Cherry']);

    renderDefaultFilterPanel(
      panel,
      createParams({ uniqueValues, excludedValues }),
      uniqueValues,
      excludedValues,
      {},
      new Map(),
    );

    const labels = getCheckboxLabels(panel);

    // Checked items first (Banana, Date), then unchecked (Apple, Cherry)
    expect(labels.map((l) => l.text)).toEqual(['Banana', 'Date', 'Apple', 'Cherry']);
    expect(labels.map((l) => l.checked)).toEqual([true, true, false, false]);
  });

  it('should sort alphabetically within each group', () => {
    const panel = createPanel();
    const uniqueValues = ['Zebra', 'Apple', 'Mango', 'Banana'];
    const excludedValues = new Set<unknown>(['Zebra', 'Apple']);

    renderDefaultFilterPanel(
      panel,
      createParams({ uniqueValues, excludedValues }),
      uniqueValues,
      excludedValues,
      {},
      new Map(),
    );

    const labels = getCheckboxLabels(panel);

    // Checked: Banana, Mango (alpha) then unchecked: Apple, Zebra (alpha)
    expect(labels.map((l) => l.text)).toEqual(['Banana', 'Mango', 'Apple', 'Zebra']);
  });

  it('should sort all items alphabetically when none are excluded', () => {
    const panel = createPanel();
    const uniqueValues = ['Cherry', 'Apple', 'Banana'];
    const excludedValues = new Set<unknown>();

    renderDefaultFilterPanel(
      panel,
      createParams({ uniqueValues, excludedValues }),
      uniqueValues,
      excludedValues,
      {},
      new Map(),
    );

    const labels = getCheckboxLabels(panel);
    expect(labels.map((l) => l.text)).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(labels.every((l) => l.checked)).toBe(true);
  });

  it('should sort all items alphabetically when all are excluded', () => {
    const panel = createPanel();
    const uniqueValues = ['Cherry', 'Apple', 'Banana'];
    const excludedValues = new Set<unknown>(['Cherry', 'Apple', 'Banana']);

    renderDefaultFilterPanel(
      panel,
      createParams({ uniqueValues, excludedValues }),
      uniqueValues,
      excludedValues,
      {},
      new Map(),
    );

    const labels = getCheckboxLabels(panel);
    expect(labels.map((l) => l.text)).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(labels.every((l) => !l.checked)).toBe(true);
  });

  it('should handle (Blank) value correctly in sort order', () => {
    const panel = createPanel();
    const uniqueValues = ['Banana', null, 'Apple'];
    const excludedValues = new Set<unknown>([null]);

    renderDefaultFilterPanel(
      panel,
      createParams({ uniqueValues, excludedValues }),
      uniqueValues,
      excludedValues,
      {},
      new Map(),
    );

    const labels = getCheckboxLabels(panel);

    // Checked first (Apple, Banana), then unchecked ((Blank))
    expect(labels.map((l) => l.text)).toEqual(['Apple', 'Banana', '(Blank)']);
    expect(labels.map((l) => l.checked)).toEqual([true, true, false]);
  });
});
