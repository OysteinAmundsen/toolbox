import type { DataGridElement } from '@toolbox-web/grid';
import { inject, onScopeDispose, ref, unref, watch, type MaybeRef, type Ref } from 'vue';

import { GRID_ELEMENT_KEY } from './use-grid';

/**
 * Options for {@link useGridOverlay}.
 *
 * @public
 */
export interface UseGridOverlayOptions {
  /**
   * Whether the overlay is currently open. Accepts a plain boolean, a `ref`,
   * or a `computed`.
   *
   * Set to `false` to unregister the panel without unmounting it (e.g. when
   * the consumer toggles visibility via CSS rather than `v-if`). Defaults to
   * `true`.
   */
  open?: MaybeRef<boolean>;
  /**
   * Optional explicit grid element. When omitted, the hook resolves the
   * grid by:
   *
   * 1. Walking up the DOM from `panelRef.value` via `closest('tbw-grid')`
   *    (works for inline overlays).
   * 2. Falling back to the {@link GRID_ELEMENT_KEY} ref provided by
   *    `<TbwGrid>` (works for `<Teleport>`-rendered overlays whose DOM is
   *    detached from the grid subtree).
   */
  gridElement?: MaybeRef<DataGridElement | null | undefined>;
}

/**
 * Register a custom overlay panel (popover, listbox, calendar, color
 * picker) as part of the active editor so the grid does not commit and
 * exit row edit when focus or pointer interaction enters the panel.
 *
 * Mirrors the Angular `BaseOverlayEditor` and React `useGridOverlay`
 * contracts for Vue custom editors. Wires
 * `registerExternalFocusContainer(panel)` while open and
 * `unregisterExternalFocusContainer(panel)` on close / unmount.
 *
 * Pair with `ColumnEditorContext.grid` when the panel is rendered outside
 * any `<TbwGrid>` provider.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import { useGridOverlay } from '@toolbox-web/grid-vue';
 *
 * const props = defineProps<{ value: string; commit: (v: string) => void; cancel: () => void }>();
 * const open = ref(false);
 * const panelRef = ref<HTMLElement | null>(null);
 * useGridOverlay(panelRef, { open });
 * </script>
 *
 * <template>
 *   <input
 *     role="combobox"
 *     :aria-expanded="open"
 *     aria-controls="ac-listbox"
 *     :value="props.value"
 *     @click="open = true"
 *     @keydown.escape="props.cancel()"
 *   />
 *   <Teleport to="body" v-if="open">
 *     <div id="ac-listbox" ref="panelRef" role="listbox">
 *       <!-- options that call props.commit(option) -->
 *     </div>
 *   </Teleport>
 * </template>
 * ```
 *
 * @param panelRef - Template ref to the overlay panel DOM element. The hook
 *   is a no-op while `panelRef.value` is `null`.
 * @param options - {@link UseGridOverlayOptions}.
 *
 * @public
 */
export function useGridOverlay(
  panelRef: Ref<HTMLElement | null | undefined>,
  options: UseGridOverlayOptions = {},
): void {
  const { open = true, gridElement } = options;
  const ctxRef = inject(GRID_ELEMENT_KEY, ref(null));

  let registeredPanel: HTMLElement | null = null;
  let registeredGrid: DataGridElement | null = null;

  const unregister = () => {
    if (registeredPanel && registeredGrid) {
      registeredGrid.unregisterExternalFocusContainer?.(registeredPanel);
    }
    registeredPanel = null;
    registeredGrid = null;
  };

  watch(
    () => ({
      open: unref(open),
      panel: panelRef.value,
      grid: unref(gridElement),
      ctx: ctxRef.value,
    }),
    ({ open: isOpen, panel, grid, ctx }) => {
      // First, undo any prior registration — the panel element or grid may
      // have changed between invocations.
      unregister();

      if (!isOpen || !panel) return;

      const resolved = grid ?? (panel.closest('tbw-grid') as DataGridElement | null) ?? ctx ?? null;
      if (!resolved) return;

      resolved.registerExternalFocusContainer?.(panel);
      registeredPanel = panel;
      registeredGrid = resolved;
    },
    { immediate: true, flush: 'post' },
  );

  // Unregister when the host component unmounts mid-open.
  onScopeDispose(unregister);
}
