<script setup lang="ts">
/**
 * Declarative wrapper around the grid's imperative
 * `registerHeaderContent` API. Mounts its default slot into the slot the
 * grid provides for header content via Vue's built-in `<Teleport>`, so
 * provide/inject, Pinia, Vue Router, and all other context flow through.
 * Must be a descendant of `<TbwGrid>`.
 *
 * @example
 * ```vue
 * <TbwGrid :rows="rows" :gridConfig="config">
 *   <TbwGridHeaderContent id="calendar-nav" :order="0">
 *     <HeaderNav :year="year" @year-change="setYear" />
 *   </TbwGridHeaderContent>
 * </TbwGrid>
 * ```
 *
 * @since 1.9.0
 */
import type { DataGridElement, HeaderContentDefinition } from '@toolbox-web/grid';
// Activate the `PluginNameMap` augmentation so `grid.getPluginByName('shell')`
// is typed as the shell plugin (which owns register/unregisterHeaderContent).
import type {} from '@toolbox-web/grid/plugins/shell';
import { inject, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { GRID_ELEMENT_KEY } from './use-grid';

/**
 * Props for `TbwGridHeaderContent`.
 */
const props = withDefaults(
  defineProps<{
    /**
     * Unique identifier for this header content entry.
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
  /** Default slot — content rendered into the grid shell header content area. */
  default?: () => unknown;
}>();

const fallbackId = useId();
const contentId = ref<string>(props.id ?? `tbw-header-content-${fallbackId}`);
watch(
  () => props.id,
  (next) => {
    contentId.value = next ?? `tbw-header-content-${fallbackId}`;
  },
);

const gridRef = inject(GRID_ELEMENT_KEY, ref<DataGridElement | null>(null));

/** Container slot the grid hands us during render. Used as the Teleport target. */
const container = ref<HTMLElement | null>(null);

let registeredId: string | null = null;
let cancelled = false;

async function registerWith(grid: DataGridElement): Promise<void> {
  try {
    await grid.ready?.();
  } catch {
    return;
  }
  if (cancelled) return;
  // Read props AFTER ready() resolves so any id/order change that happened
  // while ready was pending is honored on the initial registration (the
  // re-register watch below only fires for changes AFTER `registeredId`
  // is set, so a race window exists without this read-after-await).
  const id = contentId.value;
  const order = props.order;
  const def: HeaderContentDefinition = {
    id,
    order,
    render: (el) => {
      container.value = el;
      // No-op cleanup: the grid calls this between re-renders before invoking
      // `render` again with the SAME container (sticky by id). Tearing the
      // Teleport down here would destroy any internal state in the slot
      // contents on every shell refresh. We teardown only on component
      // unmount via `onBeforeUnmount` -> `unregisterHeaderContent`.
      return () => {
        /* intentionally empty */
      };
    },
  };
  // Route through the shell plugin (#370). The core grid-element delegates
  // (`grid.registerHeaderContent`) are deprecated (TBW076) and removed at v3;
  // fall back to them only on cores that predate the shell plugin.
  const shell = grid.getPluginByName?.('shell');
  if (shell?.registerHeaderContent) {
    shell.registerHeaderContent(def);
  } else {
    grid.registerHeaderContent?.(def);
  }
  registeredId = id;
}

function unregister(grid: DataGridElement | null, id: string | null): void {
  if (!grid || !id) return;
  const shell = grid.getPluginByName?.('shell');
  if (shell?.unregisterHeaderContent) {
    shell.unregisterHeaderContent(id);
  } else {
    grid.unregisterHeaderContent?.(id);
  }
}

onMounted(() => {
  const grid = gridRef.value;
  if (!grid) return;
  void registerWith(grid);
});

// Re-register if id or order changes after mount.
watch([contentId, () => props.order], async ([nextId, nextOrder], [prevId, prevOrder]) => {
  const grid = gridRef.value;
  if (!grid) return;
  if (registeredId && (nextId !== prevId || nextOrder !== prevOrder)) {
    unregister(grid, registeredId);
    registeredId = null;
    await registerWith(grid);
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
