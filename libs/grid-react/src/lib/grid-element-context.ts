import type { DataGridElement } from '@toolbox-web/grid';
import { createContext, type RefObject } from 'react';

/**
 * Context for sharing the grid element ref with child components.
 * Used by feature-specific hooks like useGridSelection, useGridExport.
 *
 * Extracted to a standalone file so that feature entry points can import
 * the context without pulling in the entire DataGrid module graph,
 * keeping the Rollup shared chunk minimal.
 *
 * @internal
 */
export const GridElementContext = createContext<RefObject<DataGridElement | null> | null>(null);
