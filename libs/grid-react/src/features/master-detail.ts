/**
 * Master-Detail feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `masterDetail` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/master-detail';
 *
 * <DataGrid masterDetail={{ showExpandColumn: true }}>
 *   <GridDetailPanel>{({ row }) => <DetailView row={row} />}</GridDetailPanel>
 * </DataGrid>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/master-detail';

import { getDetailRenderer, type DetailPanelContext } from '../lib/grid-detail-panel';
import { renderToContainer } from '../lib/portal-bridge';
import { registerDetailRendererBridge } from '../lib/react-grid-adapter';

// Install the master-detail row-renderer bridge on the React adapter.
// This augments the adapter (mirroring how core plugins augment the grid
// via `registerPlugin`) so master-detail-specific bridging lives with the
// master-detail feature, not in the central adapter file.
registerDetailRendererBridge((gridElement, { trackPortal }) => {
  const renderFn = getDetailRenderer(gridElement);
  if (!renderFn) return undefined;

  return (row, rowIndex) => {
    const container = document.createElement('div');
    container.className = 'react-detail-panel';

    const ctx: DetailPanelContext<typeof row> = { row, rowIndex };
    const portalKey = renderToContainer(
      container,
      renderFn(ctx as DetailPanelContext<unknown>),
      undefined,
      gridElement,
    );
    trackPortal(portalKey, container, false);

    return container;
  };
});
