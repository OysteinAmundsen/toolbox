/**
 * Responsive feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `responsive` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/responsive';
 * import { h } from 'vue';
 * </script>
 *
 * <template>
 *   <TbwGrid :responsive="{
 *     breakpoint: 768,
 *     cardRenderer: (row) => h(EmployeeCard, { employee: row }),
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/responsive';

import type { DataGridElement } from '@toolbox-web/grid/all';
import type { VNode } from 'vue';
import { cardRegistry, type ResponsiveCardContext } from '../lib/responsive-card-registry';
import { renderToContainer } from '../lib/teleport-bridge';
import { registerPostMountRefresh, registerResponsiveCardRendererBridge } from '../lib/vue-grid-adapter';

// Install the responsive card row-renderer bridge on the Vue adapter.
// Augments the adapter so responsive-specific bridging lives with the
// responsive feature, not in the central adapter file.
registerResponsiveCardRendererBridge((gridElement, { trackTeleportKey }) => {
  const cardEl = gridElement.querySelector('tbw-grid-responsive-card') as HTMLElement | null;
  if (!cardEl) return undefined;

  const renderFn = cardRegistry.get(cardEl);
  if (!renderFn) return undefined;

  return (row, rowIndex) => {
    const container = document.createElement('div');
    container.className = 'vue-responsive-card';

    const ctx: ResponsiveCardContext<typeof row> = { row, rowIndex };
    const vnodes = renderFn(ctx as ResponsiveCardContext<unknown>);

    if (vnodes && vnodes.length > 0) {
      const teleportKey = renderToContainer(container, vnodes as unknown as VNode);
      trackTeleportKey(teleportKey);
    }

    return container;
  };
});

// Refresh the ResponsivePlugin's card renderer once Vue has rendered the
// `<TbwGridResponsiveCard>` child. The plugin is instantiated by feature props
// before Vue commits its children, so it never sees the registered renderer
// without a post-mount kick. Replaces the hard-coded `getPluginByName('responsive')`
// call that used to live in `TbwGrid.vue`.
registerPostMountRefresh('responsive', ({ gridEl }) => {
  const grid = gridEl as DataGridElement;
  const plugin = grid.getPluginByName('responsive') as { refreshCardRenderer?: () => void } | undefined;
  plugin?.refreshCardRenderer?.();
});
