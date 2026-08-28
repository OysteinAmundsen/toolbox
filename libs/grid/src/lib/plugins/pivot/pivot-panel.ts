/**
 * Pivot Tool Panel Rendering
 *
 * Pure functions for rendering the pivot configuration panel.
 * Separated from PivotPlugin for better code organization.
 */

import { GridClasses } from '../../core/constants';
import type { Translate } from '../../core/types';
import {
  createDragAlternativeMenu,
  type DragAlternativeAction,
  type DragAlternativeMenu,
} from '../shared/drag-alternative-menu';
import type { AggFunc, CustomAggFunc, PivotConfig, PivotValueField } from './types';

/** Built-in aggregation function names (excludes custom functions) */
type BuiltInAggFunc = Exclude<AggFunc, CustomAggFunc>;

/** Zones a field can be dragged into. */
type GroupZone = 'rowGroups' | 'columnGroups';

/**
 * One menu shared by every chip. Each action re-renders the whole panel, so a
 * menu owned by a chip would be torn out from under itself mid-click.
 */
let chipMenu: DragAlternativeMenu | null = null;

/** All available built-in aggregation functions for the panel UI */
export const AGG_FUNCS: BuiltInAggFunc[] = ['sum', 'avg', 'count', 'min', 'max', 'first', 'last'];

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
  onReorderFieldInZone: (field: string, zone: 'rowGroups' | 'columnGroups', newIndex: number) => void;
  onMoveFieldBetweenZones: (
    field: string,
    fromZone: 'rowGroups' | 'columnGroups',
    toZone: 'rowGroups' | 'columnGroups',
  ) => void;
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
  t: Translate;
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
  t: Translate = (_key, fallback) => fallback,
): () => void {
  // Create AbortController for automatic listener cleanup
  const controller = new AbortController();
  const ctx: RenderContext = { config, callbacks, signal: controller.signal, t };

  const wrapper = document.createElement('div');
  wrapper.className = 'tbw-pivot-panel';

  // Options section (at top, includes pivot toggle)
  wrapper.appendChild(createSection(t('pivot.options', 'Options'), () => createOptionsPanel(isActive, ctx)));

  // Row Groups section
  wrapper.appendChild(createSection(t('pivot.rowGroups', 'Row Groups'), () => createFieldZone('rowGroups', ctx)));

  // Column Groups section
  wrapper.appendChild(
    createSection(t('pivot.columnGroups', 'Column Groups'), () => createFieldZone('columnGroups', ctx)),
  );

  // Values section
  wrapper.appendChild(createSection(t('pivot.values', 'Values'), () => createValuesZone(ctx)));

  // Available fields section
  wrapper.appendChild(
    createSection(t('pivot.availableFields', 'Available Fields'), () => createAvailableFieldsZone(ctx)),
  );

  container.appendChild(wrapper);

  // Cleanup: abort all listeners, then remove DOM
  return () => {
    controller.abort();
    chipMenu?.dispose();
    chipMenu = null;
    wrapper.remove();
  };
}

/**
 * Show the click-only alternative to dragging `chip` (WCAG 2.2 SC 2.5.7).
 */
function openChipMenu(chip: HTMLElement, label: string, actions: readonly DragAlternativeAction[]): void {
  chipMenu ??= createDragAlternativeMenu('tbw-pivot-chip-menu', 'tbw-pivot-chip-menu');
  chipMenu.open(chip, label, actions);
}

/**
 * Mark a chip as the pointer trigger for its move menu.
 *
 * The role goes on `target`, which for group chips is the label rather than the
 * chip itself — `role="button"` makes descendants presentational, which would
 * hide the chip's own remove button from assistive technology.
 */
function markAsMenuTrigger(target: HTMLElement, name: string, t: Translate): void {
  target.setAttribute('role', 'button');
  target.tabIndex = -1;
  target.setAttribute('aria-label', `${name} — ${t('pivot.chipHint', 'drag, or activate for move options')}`);
}

/** Menu entries mirroring every drag the chip supports, plus its remove button. */
function fieldChipActions(field: string, zoneType: GroupZone, ctx: RenderContext): DragAlternativeAction[] {
  const { config, callbacks, t } = ctx;
  const fields = zoneType === 'rowGroups' ? (config.rowGroupFields ?? []) : (config.columnGroupFields ?? []);
  const index = fields.indexOf(field);
  const otherZone: GroupZone = zoneType === 'rowGroups' ? 'columnGroups' : 'rowGroups';

  return [
    {
      label: t('pivot.moveUp', 'Move up'),
      disabled: index <= 0,
      run: () => callbacks.onReorderFieldInZone(field, zoneType, index - 1),
    },
    {
      label: t('pivot.moveDown', 'Move down'),
      disabled: index < 0 || index >= fields.length - 1,
      // The callback takes an insert-before index in the pre-move list, so
      // stepping down one place means aiming past the field that follows.
      run: () => callbacks.onReorderFieldInZone(field, zoneType, index + 2),
    },
    {
      label:
        otherZone === 'columnGroups'
          ? t('pivot.moveToColumnGroups', 'Move to Column Groups')
          : t('pivot.moveToRowGroups', 'Move to Row Groups'),
      run: () => callbacks.onMoveFieldBetweenZones(field, zoneType, otherZone),
    },
    {
      // Matches dropping the chip on the values zone, which also only adds.
      label: t('pivot.moveToValues', 'Move to Values'),
      run: () => callbacks.onAddValueField(field, 'sum'),
    },
    {
      label: t('pivot.removeField', 'Remove field'),
      run: () => callbacks.onRemoveFieldFromZone(field, zoneType),
    },
  ];
}

/** Menu entries for an unused field, mirroring a drag into each zone. */
function availableChipActions(field: string, ctx: RenderContext): DragAlternativeAction[] {
  const { callbacks, t } = ctx;
  return [
    {
      label: t('pivot.addToRowGroups', 'Add to Row Groups'),
      run: () => callbacks.onAddFieldToZone(field, 'rowGroups'),
    },
    {
      label: t('pivot.addToColumnGroups', 'Add to Column Groups'),
      run: () => callbacks.onAddFieldToZone(field, 'columnGroups'),
    },
    {
      label: t('pivot.addToValues', 'Add to Values'),
      run: () => callbacks.onAddValueField(field, 'sum'),
    },
  ];
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
    placeholder.textContent = ctx.t('pivot.dropFields', 'Drag fields here');
    zone.appendChild(placeholder);
  } else {
    for (const field of currentFields) {
      zone.appendChild(createFieldChip(field, zoneType, ctx));
    }
  }

  // Drop handling — supports reorder within zone and cross-zone moves
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
      const sourceZone = e.dataTransfer?.getData('source-zone') as 'rowGroups' | 'columnGroups' | undefined;
      if (!field) return;

      // Determine drop position for reordering
      const chips = zone.querySelectorAll('.tbw-pivot-field-chip');
      let dropIndex = chips.length;
      for (let i = 0; i < chips.length; i++) {
        const rect = chips[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          dropIndex = i;
          break;
        }
      }

      if (sourceZone && sourceZone !== zoneType && (sourceZone === 'rowGroups' || sourceZone === 'columnGroups')) {
        // Cross-zone move
        callbacks.onMoveFieldBetweenZones(field, sourceZone, zoneType);
      } else if (sourceZone === zoneType) {
        // Reorder within same zone
        callbacks.onReorderFieldInZone(field, zoneType, dropIndex);
      } else {
        // New field from available fields
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
function createFieldChip(field: string, zoneType: GroupZone, ctx: RenderContext): HTMLElement {
  const { callbacks, signal } = ctx;
  const chip = document.createElement('div');
  chip.className = 'tbw-pivot-field-chip';
  chip.draggable = true;

  const fieldInfo = callbacks.getAvailableFields().find((f) => f.field === field);
  const name = fieldInfo?.header ?? field;
  const label = document.createElement('span');
  label.className = 'tbw-pivot-chip-label';
  label.textContent = name;
  markAsMenuTrigger(label, name, ctx.t);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'tbw-pivot-chip-remove';
  removeBtn.innerHTML = '×';
  removeBtn.title = ctx.t('pivot.removeField', 'Remove field');
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
      chip.classList.add(GridClasses.DRAGGING);
    },
    { signal },
  );

  chip.addEventListener(
    'dragend',
    () => {
      chip.classList.remove(GridClasses.DRAGGING);
    },
    { signal },
  );

  // A press-and-release without movement never fires `dragstart`, so a plain
  // click is the tap that SC 2.5.7 asks us to honour.
  chip.addEventListener('click', () => openChipMenu(chip, name, fieldChipActions(field, zoneType, ctx)), { signal });

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
    placeholder.textContent = ctx.t('pivot.dropNumericFields', 'Drag numeric fields here');
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

  const isCustomAgg = typeof valueField.aggFunc === 'function';

  const aggSelect = document.createElement('select');
  aggSelect.className = 'tbw-pivot-agg-select';
  aggSelect.title = ctx.t('pivot.aggFunction', 'Aggregation function');

  if (isCustomAgg) {
    const option = document.createElement('option');
    option.value = '__custom__';
    option.textContent = ctx.t('pivot.customAgg', 'CUSTOM');
    option.selected = true;
    aggSelect.appendChild(option);
    aggSelect.disabled = true;
  }

  for (const aggFunc of AGG_FUNCS) {
    const option = document.createElement('option');
    option.value = aggFunc;
    option.textContent = aggFunc.toUpperCase();
    if (!isCustomAgg) option.selected = aggFunc === valueField.aggFunc;
    aggSelect.appendChild(option);
  }

  aggSelect.addEventListener(
    'change',
    () => {
      callbacks.onUpdateValueAggFunc(valueField.field, aggSelect.value as BuiltInAggFunc);
    },
    { signal },
  );

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'tbw-pivot-chip-remove';
  removeBtn.innerHTML = '×';
  removeBtn.title = ctx.t('pivot.removeValueField', 'Remove value field');
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
    empty.textContent = ctx.t('pivot.allFieldsUsed', 'All fields are in use');
    zone.appendChild(empty);
  } else {
    // Search filter for available fields (only when 6+ fields)
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'tbw-pivot-fields-list';

    if (availableFields.length >= 6) {
      const search = document.createElement('input');
      search.type = 'text';
      search.placeholder = ctx.t('pivot.filterFields', 'Filter fields\u2026');
      search.className = 'tbw-pivot-field-search';
      search.addEventListener(
        'input',
        () => {
          const query = search.value.toLowerCase();
          for (const chip of fieldsContainer.querySelectorAll('.tbw-pivot-field-chip')) {
            const el = chip as HTMLElement;
            el.style.display = el.textContent?.toLowerCase().includes(query) ? '' : 'none';
          }
        },
        { signal },
      );
      zone.appendChild(search);
    }

    for (const field of availableFields) {
      const chip = document.createElement('div');
      chip.className = 'tbw-pivot-field-chip available';
      chip.textContent = field.header;
      chip.draggable = true;
      chip.title = ctx.t('pivot.availableChipHint', 'Drag into a zone, or click to choose one');
      markAsMenuTrigger(chip, field.header, ctx.t);

      chip.addEventListener(
        'dragstart',
        (e) => {
          e.dataTransfer?.setData('text/plain', field.field);
          chip.classList.add(GridClasses.DRAGGING);
        },
        { signal },
      );

      chip.addEventListener(
        'dragend',
        () => {
          chip.classList.remove(GridClasses.DRAGGING);
        },
        { signal },
      );

      chip.addEventListener('click', () => openChipMenu(chip, field.header, availableChipActions(field.field, ctx)), {
        signal,
      });

      fieldsContainer.appendChild(chip);
    }

    zone.appendChild(fieldsContainer);
  }

  return zone;
}

/**
 * Create the options panel with pivot toggle and checkboxes for totals.
 */
function createOptionsPanel(isActive: boolean, ctx: RenderContext): HTMLElement {
  const { config, callbacks, signal, t } = ctx;
  const panel = document.createElement('div');
  panel.className = 'tbw-pivot-options';

  // Pivot Mode toggle
  panel.appendChild(
    createCheckbox(
      t('pivot.enable', 'Enable Pivot View'),
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
      t('pivot.showRowTotals', 'Show Row Totals'),
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
      t('pivot.showGrandTotal', 'Show Grand Total'),
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
