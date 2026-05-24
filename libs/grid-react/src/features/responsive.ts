/**
 * Responsive feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `responsive` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/responsive';
 *
 * <DataGrid responsive={{ breakpoint: 700 }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/responsive';

import type { DataGridElement, FrameworkAdapter } from '@toolbox-web/grid/all';
import { getResponsiveCardRenderer, type ResponsiveCardContext } from '../lib/grid-responsive-card';
import { renderToContainer } from '../lib/portal-bridge';
import { registerPostMountRefresh } from '../lib/post-mount-refresh-hooks';
import { registerResponsiveCardRendererBridge } from '../lib/react-grid-adapter';

// Install the responsive card row-renderer bridge on the React adapter.
// Augments the adapter so responsive-specific bridging lives with the
// responsive feature, not in the central adapter file.
registerResponsiveCardRendererBridge((gridElement, { trackPortal }) => {
  const renderFn = getResponsiveCardRenderer(gridElement);
  if (!renderFn) return undefined;

  return (row, rowIndex) => {
    const container = document.createElement('div');
    container.className = 'react-responsive-card';

    const ctx: ResponsiveCardContext<typeof row> = { row, index: rowIndex };
    const portalKey = renderToContainer(
      container,
      renderFn(ctx as ResponsiveCardContext<unknown>),
      undefined,
      gridElement,
    );
    trackPortal(portalKey, container, false);

    return container;
  };
});

// Refresh the ResponsivePlugin's card renderer once React has committed
// the `<GridResponsiveCard>` child. The plugin is created by feature props
// during grid init (before React commit), so it never sees the React-
// registered renderer without a post-mount kick. Replaces the hard-coded
// `refreshResponsiveCardRenderer` that used to live in `data-grid.tsx`.
type ResponsivePluginWithRefresh = {
  setCardRenderer?: (renderer: unknown) => void;
};
type ResponsiveFrameworkAdapter = FrameworkAdapter & {
  createResponsiveCardRenderer?: (gridEl: HTMLElement) => unknown;
};
registerPostMountRefresh('responsive', ({ gridEl }) => {
  // Only refresh when the user actually rendered a `<tbw-grid-responsive-card>`.
  if (!gridEl.querySelector('tbw-grid-responsive-card')) return;
  const cardRenderer = getResponsiveCardRenderer(gridEl);
  if (!cardRenderer) return;
  const grid = gridEl as DataGridElement & { __frameworkAdapter?: ResponsiveFrameworkAdapter };
  const plugin = grid.getPluginByName('responsive') as ResponsivePluginWithRefresh | undefined;
  if (!plugin?.setCardRenderer) return;
  const reactRenderer = grid.__frameworkAdapter?.createResponsiveCardRenderer?.(gridEl);
  if (reactRenderer) plugin.setCardRenderer(reactRenderer);
});
