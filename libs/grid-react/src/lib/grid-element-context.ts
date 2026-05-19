import type { DataGridElement } from '@toolbox-web/grid';
import { getOrCreateShared } from '@toolbox-web/grid';
import { createContext, type Context, type RefObject } from 'react';

/**
 * Context for sharing the grid element ref with child components.
 * Used by feature-specific hooks like useGridSelection, useGridExport.
 *
 * Extracted to a standalone file so that feature entry points can import
 * the context without pulling in the entire DataGrid module graph,
 * keeping the Rollup shared chunk minimal.
 *
 * Created lazily via the shared store so that two bundled copies of
 * `@toolbox-web/grid-react` on the same page (micro-frontend scenario,
 * issue #338) converge on a single Context identity. Without this, a
 * `<DataGrid>` wrapper from copy A and a child hook from copy B would call
 * `useContext` on different Context identities, and the child would always
 * see `null` — crashing with `TypeError: g is not a function` inside React.
 *
 * @internal
 */
export const GridElementContext = getOrCreateShared(
  'reactContexts',
  'gridElement',
  () => createContext<RefObject<DataGridElement | null> | null>(null),
) as Context<RefObject<DataGridElement | null> | null>;
