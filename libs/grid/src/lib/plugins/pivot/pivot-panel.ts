/**
 * Pivot Tool Panel Rendering
 *
 * Pure functions for rendering the pivot configuration panel.
 * Separated from PivotPlugin for better code organization.
 */

import type { AggFunc, PivotConfig, PivotValueField } from './types';

/** All available aggregation functions */
export const AGG_FUNCS: AggFunc[] = ['sum', 'avg', 'count', 'min', 'max', 'first', 'last'];

/** Field info for available fields */
export interface FieldInfo {
  field: string;
  header: string;
}

/** Callbacks for panel interactions */
export interface PanelCallbacks {
  onTogglePivot: (enabled: boolean) => void;
  onAddFieldToZone: (field: string, zone: 'rowGroups' | 'columnGroups') => void;
  onRemoveFieldFromZone: (field: string, zone: 'rowGroups' | 'columnGroups') => void;
  onAddValueField: (field: string, aggFunc: AggFunc) => void;
  onRemoveValueField: (field: string) => void;
  onUpdateValueAggFunc: (field: string, aggFunc: AggFunc) => void;
  onOptionChange: (option: 'showTotals' | 'showGrandTotal', value: boolean) => void;
  getAvailableFields: () => FieldInfo[];
}

/** Internal context passed to rendering functions */
interface RenderContext {
  config: PivotConfig;
  callbacks: PanelCallbacks;
  signal: AbortSignal;
}

/**
 * Render the complete pivot panel content.
 * Returns a cleanup function that removes all event listeners and DOM elements.
 */
export function renderPivotPanel(
  container: HTMLElement,
  config: PivotConfig,
  isActive: boolean,
  callbacks: PanelCallbacks,
): () => void {
  // Create AbortController for automatic listener cleanup
  const controller = new AbortController();
  const ctx: RenderContext = { config, callbacks, signal: controller.signal };

  const wrapper = document.createElement('div');
  wrapper.className = 'tbw-pivot-panel';

  // Options section (at top, includes pivot toggle)
  wrapper.appendChild(createSection('Options', () => createOptionsPanel(isActive, ctx)));

  // Row Groups section
  wrapper.appendChild(createSection('Row Groups', () => createFieldZone('rowGroups', ctx)));

  // Column Groups section
  wrapper.appendChild(createSection('Column Groups', () => createFieldZone('columnGroups', ctx)));

  // Values section
  wrapper.appendChild(createSection('Values', () => createValuesZone(ctx)));

  // Available fields section
  wrapper.appendChild(createSection('Available Fields', () => createAvailableFieldsZone(ctx)));

  container.appendChild(wrapper);

  // Cleanup: abort all listeners, then remove DOM
  return () => {
    controller.abort();
    wrapper.remove();
  };
}

/**
 * Create a collapsible section wrapper.
 */
function createSection(title: string, contentFactory: () => HTMLElement): HTMLElement {
  const section = document.createElement('div');
  section.className = 'tbw-pivot-section';

  const header = document.createElement('div');
  header.className = 'tbw-pivot-section-header';
  header.textContent = title;

  const content = document.createElement('div');
  content.className = 'tbw-pivot-section-content';
  content.appendChild(contentFactory());

  section.appendChild(header);
  section.appendChild(content);

  return section;
}

/**
 * Create a drop zone for row/column group fields.
 */
function createFieldZone(zoneType: 'rowGroups' | 'columnGroups', ctx: RenderContext): HTMLElement {
  const { config, callbacks, signal } = ctx;
  const zone = document.createElement('div');
  zone.className = 'tbw-pivot-drop-zone';
  zone.setAttribute('data-zone', zoneType);

  const currentFields = zoneType === 'rowGroups' ? (config.rowGroupFields ?? []) : (config.columnGroupFields ?? []);

  if (currentFields.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'tbw-pivot-placeholder';
    placeholder.textContent = 'Drag fields here or click to add';
    zone.appendChild(placeholder);
  } else {
    for (const field of currentFields) {
      zone.appendChild(createFieldChip(field, zoneType, ctx));
    }
  }

  // Drop handling
  zone.addEventListener(
    'dragover',
    (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    },
    { signal },
  );

  zone.addEventListener(
    'dragleave',
    () => {
      zone.classList.remove('drag-over');
    },
    { signal },
  );

  zone.addEventListener(
    'drop',
    (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      const field = e.dataTransfer?.getData('text/plain');
      if (field) {
        callbacks.onAddFieldToZone(field, zoneType);
      }
    },
    { signal },
  );

  return zone;
}

/**
 * Create a field chip for row/column zones.
 */
function createFieldChip(field: string, zoneType: 'rowGroups' | 'columnGroups', ctx: RenderContext): HTMLElement {
  const { callbacks, signal } = ctx;
  const chip = document.createElement('div');
  chip.className = 'tbw-pivot-field-chip';
  chip.draggable = true;

  const fieldInfo = callbacks.getAvailableFields().find((f) => f.field === field);
  const label = document.createElement('span');
  label.className = 'tbw-pivot-chip-label';
  label.textContent = fieldInfo?.header ?? field;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'tbw-pivot-chip-remove';
  removeBtn.innerHTML = '×';
  removeBtn.title = 'Remove field';
  removeBtn.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      callbacks.onRemoveFieldFromZone(field, zoneType);
    },
    { signal },
  );

  chip.appendChild(label);
  chip.appendChild(removeBtn);

  // Drag handling for reordering
  chip.addEventListener(
    'dragstart',
    (e) => {
      e.dataTransfer?.setData('text/plain', field);
      e.dataTransfer?.setData('source-zone', zoneType);
      chip.classList.add('dragging');
    },
    { signal },
  );

  chip.addEventListener(
    'dragend',
    () => {
      chip.classList.remove('dragging');
    },
    { signal },
  );

  return chip;
}

/**
 * Create the values zone with aggregation controls.
 */
function createValuesZone(ctx: RenderContext): HTMLElement {
  const { config, callbacks, signal } = ctx;
  const zone = document.createElement('div');
  zone.className = 'tbw-pivot-drop-zone tbw-pivot-values-zone';
  zone.setAttribute('data-zone', 'values');

  const currentValues = config.valueFields ?? [];

  if (currentValues.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'tbw-pivot-placeholder';
    placeholder.textContent = 'Drag numeric fields here for aggregation';
    zone.appendChild(placeholder);
  } else {
    for (const valueField of currentValues) {
      zone.appendChild(createValueChip(valueField, ctx));
    }
  }

  // Drop handling with signal for cleanup
  zone.addEventListener(
    'dragover',
    (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    },
    { signal },
  );

  zone.addEventListener(
    'dragleave',
    () => {
      zone.classList.remove('drag-over');
    },
    { signal },
  );

  zone.addEventListener(
    'drop',
    (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const field = e.dataTransfer?.getData('text/plain');
      if (field) {
        callbacks.onAddValueField(field, 'sum');
      }
    },
    { signal },
  );

  return zone;
}

/**
 * Create a value chip with aggregation selector.
 */
function createValueChip(valueField: PivotValueField, ctx: RenderContext): HTMLElement {
  const { callbacks, signal } = ctx;
  const chip = document.createElement('div');
  chip.className = 'tbw-pivot-field-chip tbw-pivot-value-chip';

  const fieldInfo = callbacks.getAvailableFields().find((f) => f.field === valueField.field);

  const labelWrapper = document.createElement('div');
  labelWrapper.className = 'tbw-pivot-value-label-wrapper';

  const label = document.createElement('span');
  label.className = 'tbw-pivot-chip-label';
  label.textContent = fieldInfo?.header ?? valueField.field;

  const aggSelect = document.createElement('select');
  aggSelect.className = 'tbw-pivot-agg-select';
  aggSelect.title = 'Aggregation function';

  for (const aggFunc of AGG_FUNCS) {
    const option = document.createElement('option');
    option.value = aggFunc;
    option.textContent = aggFunc.toUpperCase();
    option.selected = aggFunc === valueField.aggFunc;
    aggSelect.appendChild(option);
  }

  aggSelect.addEventListener(
    'change',
    () => {
      callbacks.onUpdateValueAggFunc(valueField.field, aggSelect.value as AggFunc);
    },
    { signal },
  );

  const removeBtn = document.createElement('button');
  removeBtn.className = 'tbw-pivot-chip-remove';
  removeBtn.innerHTML = '×';
  removeBtn.title = 'Remove value field';
  removeBtn.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      callbacks.onRemoveValueField(valueField.field);
    },
    { signal },
  );

  labelWrapper.appendChild(label);
  labelWrapper.appendChild(aggSelect);

  chip.appendChild(labelWrapper);
  chip.appendChild(removeBtn);

  return chip;
}

/**
 * Create the available fields zone.
 */
function createAvailableFieldsZone(ctx: RenderContext): HTMLElement {
  const { config, callbacks, signal } = ctx;
  const zone = document.createElement('div');
  zone.className = 'tbw-pivot-available-fields';

  const allFields = callbacks.getAvailableFields();
  const usedFields = new Set([
    ...(config.rowGroupFields ?? []),
    ...(config.columnGroupFields ?? []),
    ...(config.valueFields?.map((v) => v.field) ?? []),
  ]);

  // Filter to show only unused fields
  const availableFields = allFields.filter((f) => !usedFields.has(f.field));

  if (availableFields.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tbw-pivot-placeholder';
    empty.textContent = 'All fields are in use';
    zone.appendChild(empty);
  } else {
    for (const field of availableFields) {
      const chip = document.createElement('div');
      chip.className = 'tbw-pivot-field-chip available';
      chip.textContent = field.header;
      chip.draggable = true;
      chip.title = `Drag to add "${field.field}" to a zone`;

      chip.addEventListener(
        'dragstart',
        (e) => {
          e.dataTransfer?.setData('text/plain', field.field);
          chip.classList.add('dragging');
        },
        { signal },
      );

      chip.addEventListener(
        'dragend',
        () => {
          chip.classList.remove('dragging');
        },
        { signal },
      );

      zone.appendChild(chip);
    }
  }

  return zone;
}

/**
 * Create the options panel with pivot toggle and checkboxes for totals.
 */
function createOptionsPanel(isActive: boolean, ctx: RenderContext): HTMLElement {
  const { config, callbacks, signal } = ctx;
  const panel = document.createElement('div');
  panel.className = 'tbw-pivot-options';

  // Pivot Mode toggle
  panel.appendChild(
    createCheckbox(
      'Enable Pivot View',
      isActive,
      (checked) => {
        callbacks.onTogglePivot(checked);
      },
      signal,
    ),
  );

  // Show Totals checkbox
  panel.appendChild(
    createCheckbox(
      'Show Row Totals',
      config.showTotals ?? true,
      (checked) => {
        callbacks.onOptionChange('showTotals', checked);
      },
      signal,
    ),
  );

  // Show Grand Total checkbox
  panel.appendChild(
    createCheckbox(
      'Show Grand Total',
      config.showGrandTotal ?? true,
      (checked) => {
        callbacks.onOptionChange('showGrandTotal', checked);
      },
      signal,
    ),
  );

  return panel;
}

/**
 * Create a checkbox with label.
 */
function createCheckbox(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
  signal: AbortSignal,
): HTMLElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'tbw-pivot-checkbox';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked), { signal });

  const span = document.createElement('span');
  span.textContent = label;

  wrapper.appendChild(input);
  wrapper.appendChild(span);

  return wrapper;
}
