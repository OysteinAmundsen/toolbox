<script setup lang="ts">
/**
 * Declarative wrapper around the grid's imperative
 * `registerToolbarContent` API. Mounts its default slot into the slot the
 * grid provides for toolbar content via Vue's built-in `<Teleport>`, so
 * provide/inject, Pinia, Vue Router, and all other context flow through.
 * Must be a descendant of `<TbwGrid>`.
 *
 * Prefer this over `<tbw-grid-tool-buttons>` (light DOM) when you need
 * reactive props or callbacks bound to Vue component state. Use the
 * light-DOM form for static markup that should be moved verbatim into the
 * toolbar.
 *
 * @example
 * ```vue
 * <TbwGrid :rows="rows" :gridConfig="config">
 *   <TbwGridToolbarContent id="calendar-nav" :order="0">
 *     <ToolbarNav @prev="prev" @today="today" @next="next" />
 *   </TbwGridToolbarContent>
 * </TbwGrid>
 * ```
 *
 * @since 1.9.0
 */
import type { DataGridElement, ToolbarContentDefinition } from '@toolbox-web/grid';
import { inject, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { GRID_ELEMENT_KEY } from './use-grid';

/**
 * Props for `TbwGridToolbarContent`.
 */
const props = withDefaults(
  defineProps<{
    /**
     * Unique identifier for this toolbar content entry.
     * Defaults to a stable Vue-generated id.
     */
    id?: string;
    /**
     * Render order priority. Lower values appear first.
     * @default 100
     */
    order?: number;
  }>(),
  { order: 100 },
);

defineSlots<{
  /** Default slot — content rendered into the grid shell toolbar. */
  default?: () => unknown;
}>();

const fallbackId = useId();
const contentId = ref<string>(props.id ?? `tbw-toolbar-content-${fallbackId}`);
watch(
  () => props.id,
  (next) => {
    contentId.value = next ?? `tbw-toolbar-content-${fallbackId}`;
  },
);

const gridRef = inject(GRID_ELEMENT_KEY, ref<DataGridElement | null>(null));

const container = ref<HTMLElement | null>(null);

let registeredId: string | null = null;
let cancelled = false;

async function registerWith(grid: DataGridElement, id: string, order: number): Promise<void> {
  try {
    await grid.ready?.();
  } catch {
    return;
  }
  if (cancelled) return;
  const def: ToolbarContentDefinition = {
    id,
    order,
    render: (el) => {
      container.value = el;
      // No-op cleanup — see comment in TbwGridHeaderContent.vue. Teardown
      // happens on wrapper unmount via `unregisterToolbarContent`.
      return () => {
        /* intentionally empty */
      };
    },
  };
  grid.registerToolbarContent?.(def);
  registeredId = id;
}

function unregister(grid: DataGridElement | null, id: string | null): void {
  if (!grid || !id) return;
  grid.unregisterToolbarContent?.(id);
}

onMounted(() => {
  const grid = gridRef.value;
  if (!grid) return;
  void registerWith(grid, contentId.value, props.order);
});

watch([contentId, () => props.order], async ([nextId, nextOrder], [, prevOrder]) => {
  const grid = gridRef.value;
  if (!grid) return;
  if (registeredId && (registeredId !== nextId || nextOrder !== prevOrder)) {
    unregister(grid, registeredId);
    registeredId = null;
    await registerWith(grid, nextId, nextOrder);
  }
});

onBeforeUnmount(() => {
  cancelled = true;
  unregister(gridRef.value, registeredId);
  registeredId = null;
});
</script>

<template>
  <Teleport v-if="container" :to="container">
    <slot />
  </Teleport>
</template>
