<script setup lang="ts">
import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import { h, onMounted, ref, type VNode } from 'vue';
import type { CellSlotProps, EditorSlotProps } from './slot-types';
import { registerColumnEditor, registerColumnRenderer } from './vue-grid-adapter';

/**
 * Props for TbwGridColumn
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
  cell?: (props: CellSlotProps) => VNode[];
  /** Custom cell editor slot */
  editor?: (props: EditorSlotProps) => VNode[];
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
      const slotContent = slotFn({
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
      });
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
      });
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
