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

import { getResponsiveCardRenderer, type ResponsiveCardContext } from '../lib/grid-responsive-card';
import { renderToContainer } from '../lib/portal-bridge';
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
