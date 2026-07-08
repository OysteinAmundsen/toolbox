<script setup lang="ts" generic="TRow = unknown, TValue = any">
/**
 * Declarative type-default component. Renders a `<tbw-grid-type>` custom
 * element and registers a Vue type-level cell renderer keyed by type name,
 * applied to every column whose `type` matches `name`.
 *
 * @since 2.0.0
 */
import type { CellRenderContext, ColumnEditorContext } from '@toolbox-web/grid';
import { h, onMounted, ref, type VNode } from 'vue';
import type { CellSlotProps, EditorSlotProps } from './slot-types';
import { registerTypeEditor, registerTypeRenderer } from './vue-grid-adapter';

const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

const props = defineProps<{
  /** Type name that columns reference through `type`. */
  name: string;
  /** Optional params surfaced as typeDefault.* in template expressions. */
  params?: Record<string, string | number | boolean>;
}>();

const slots = defineSlots<{
  /** Type-level cell renderer slot. */
  cell?: (props: CellSlotProps<TRow, TValue>) => VNode[];
  /** Type-level cell editor slot. Requires the editing feature/plugin. */
  editor?: (props: EditorSlotProps<TRow, TValue>) => VNode[];
}>();

const typeRef = ref<HTMLElement | null>(null);

onMounted(() => {
  const element = typeRef.value;
  if (!element) return;

  if (slots.cell) {
    registerTypeRenderer(element, (ctx: CellRenderContext<unknown, unknown>) => {
      const slotFn = slots.cell;
      if (!slotFn) return h('span');
      const slotContent = slotFn({
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
      } as CellSlotProps<TRow, TValue>);
      return h('div', { style: 'display: contents' }, slotContent);
    });
  }

  if (slots.editor) {
    registerTypeEditor(element, (ctx: ColumnEditorContext<unknown, unknown>) => {
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
});

const dataParams = (params: Record<string, string | number | boolean> | undefined): Record<string, string> => {
  if (!params) return {};
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    attrs[`data-${toKebabCase(k)}`] = String(v);
  }
  return attrs;
};
</script>

<template>
  <tbw-grid-type ref="typeRef" :name="name" v-bind="dataParams(props.params)">
    <tbw-grid-column-view v-if="slots.cell" />
    <tbw-grid-column-editor v-if="slots.editor" />
  </tbw-grid-type>
</template>
