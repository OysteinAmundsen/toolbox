/**
 * Tree Viewport Mapping Utilities
 *
 * Pure functions for translating between flat viewport row indices and
 * top-level tree node indices. Used by the Tree plugin's
 * `datasource:viewport-mapping` query handler.
 */

import type { ViewportMappingResponse } from '../server-side/datasource-types';

/**
 * Translate a range of rendered row indices to the range of root nodes that own them.
 *
 * @param rootOwners - Index-aligned with the grid's final row list (including rows other
 *   contributors inserted, e.g. group headers): the 0-based ordinal of the root node each row
 *   belongs to, or `-1` for rows rendered before the first root.
 * @param rootCount - Number of root nodes in the rendered rows.
 */
export function mapViewportToRoots(
  rootOwners: readonly number[],
  rootCount: number,
  viewportStart: number,
  viewportEnd: number,
): ViewportMappingResponse {
  const last = rootOwners.length - 1;
  const ownerAt = (index: number) => Math.max(0, rootOwners[Math.max(0, Math.min(index, last))] ?? 0);
  return {
    startNode: ownerAt(viewportStart),
    endNode: ownerAt(viewportEnd) + 1, // exclusive
    totalLoadedNodes: rootCount,
  };
}
