<script setup lang="ts" generic="TRow = unknown, TValue = any">
import type { CellRenderContext, ColumnEditorContext, HeaderCellContext, HeaderLabelContext } from '@toolbox-web/grid';
import { h, onMounted, ref, type VNode } from 'vue';
import type { CellSlotProps, EditorSlotProps, HeaderLabelSlotProps, HeaderSlotProps } from './slot-types';
import {
  registerColumnEditor,
  registerColumnHeaderLabelRenderer,
  registerColumnHeaderRenderer,
  registerColumnRenderer,
} from './vue-grid-adapter';

/**
 * Props for TbwGridColumn.
 *
 * @typeParam TRow - Row data shape. Defaults to `unknown`. Specify it
 *   (e.g. `<TbwGridColumn<Employee> ...>`) to get fully-typed `#cell` and
 *   `#editor` slot props (`row: Employee` instead of `row: unknown`).
 * @typeParam TValue - Cell value type. Defaults to `any` because the value
 *   shape is per-column and awkward to narrow inside template expressions.
 */
const props = defineProps<{
  /** Field path in the row object */
  field: string;
  /** Column header text */
  header?: string;
  /** Column width */
  width?: string | number;
  /** Minimum column width */
  minWidth?: string | number;
  /** Maximum column width */
  maxWidth?: string | number;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Whether the column is resizable */
  resizable?: boolean;
  /** Whether the column is editable */
  editable?: boolean;
  /** Data type for the column */
  type?: string;
  /** Column alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether the column is hidden */
  hidden?: boolean;
}>();

// Define slots with proper typing and get the slots object
const slots = defineSlots<{
  /** Custom cell renderer slot */
  cell?: (props: CellSlotProps<TRow, TValue>) => VNode[];
  /** Custom cell editor slot */
  editor?: (props: EditorSlotProps<TRow, TValue>) => VNode[];
  /**
   * Full header cell renderer slot. Consumer owns sort icons and filter
   * buttons — use the `renderSortIcon` / `renderFilterButton` helpers on
   * the slot props to opt in. Resize handles are appended automatically
   * by the grid for resizable columns; do not render one yourself.
   */
  header?: (props: HeaderSlotProps<TRow>) => VNode[];
  /**
   * Header label renderer slot. Grid keeps ownership of sort icons,
   * filter buttons, and resize handles; the slot content only replaces
   * the label text.
   */
  headerLabel?: (props: HeaderLabelSlotProps<TRow>) => VNode[];
}>();

// Template ref for the column element
const columnRef = ref<HTMLElement | null>(null);

onMounted(() => {
  const element = columnRef.value;
  if (!element) return;

  // Check if cell slot exists by trying to access it
  const hasCellSlot = !!slots.cell;
  const hasEditorSlot = !!slots.editor;

  // Register renderer if #cell slot is provided
  if (hasCellSlot) {
    registerColumnRenderer(element, (ctx: CellRenderContext<unknown, unknown>) => {
      const slotFn = slots.cell;
      if (!slotFn) return h('span');
      // Runtime row matches the consumer's TRow at call time; the cast bridges
      // the erased generic so the slot signature stays accurate to consumers.
      const slotContent = slotFn({
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
      } as CellSlotProps<TRow, TValue>);
      // Return the VNode array wrapped in a div
      return h('div', { style: 'display: contents' }, slotContent);
    });
  }

  // Register editor if #editor slot is provided
  if (hasEditorSlot) {
    registerColumnEditor(element, (ctx: ColumnEditorContext<unknown, unknown>) => {
      const slotFn = slots.editor;
      if (!slotFn) return h('span');
      const slotContent = slotFn({
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
        field: ctx.field,
        rowId: ctx.rowId ?? '',
        commit: ctx.commit,
        cancel: ctx.cancel,
        updateRow: ctx.updateRow,
        onValueChange: ctx.onValueChange,
      } as EditorSlotProps<TRow, TValue>);
      return h('div', { style: 'display: contents' }, slotContent);
    });
  }

  // Register header renderer if #header slot is provided
  if (slots.header) {
    registerColumnHeaderRenderer(element, (ctx: HeaderCellContext<unknown>) => {
      const slotFn = slots.header;
      if (!slotFn) return h('span');
      const slotContent = slotFn({
        column: ctx.column,
        value: ctx.value,
        sortState: ctx.sortState,
        filterActive: ctx.filterActive,
        cellEl: ctx.cellEl,
        renderSortIcon: ctx.renderSortIcon,
        renderFilterButton: ctx.renderFilterButton,
      } as HeaderSlotProps<TRow>);
      return h('div', { style: 'display: contents' }, slotContent);
    });
  }

  // Register header label renderer if #headerLabel slot is provided
  if (slots.headerLabel) {
    registerColumnHeaderLabelRenderer(element, (ctx: HeaderLabelContext<unknown>) => {
      const slotFn = slots.headerLabel;
      if (!slotFn) return h('span');
      const slotContent = slotFn({
        column: ctx.column,
        value: ctx.value,
      } as HeaderLabelSlotProps<TRow>);
      return h('div', { style: 'display: contents' }, slotContent);
    });
  }
});
</script>

<template>
  <tbw-grid-column
    ref="columnRef"
    :field="field"
    :header="header"
    :width="width"
    :min-width="minWidth"
    :max-width="maxWidth"
    :sortable="sortable"
    :resizable="resizable"
    :editable="editable"
    :type="type"
    :align="align"
    :hidden="hidden"
  >
    <!-- Hidden slot to capture slot definitions -->
  </tbw-grid-column>
</template>
