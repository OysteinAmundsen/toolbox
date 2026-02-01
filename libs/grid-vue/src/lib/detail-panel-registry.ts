/**
 * Registry for detail panel renderers.
 * @internal
 */
import type { VNode } from 'vue';

/**
 * Context object passed to the detail panel slot.
 */
export interface DetailPanelContext<T = unknown> {
  /** The row data for this detail panel */
  row: T;
  /** The row index */
  rowIndex: number;
}

/**
 * Registry for detail renderers (per grid element)
 */
export const detailRegistry = new WeakMap<HTMLElement, (ctx: DetailPanelContext<unknown>) => VNode[] | undefined>();

/**
 * Get the detail renderer for a grid element.
 * @internal
 */
export function getDetailRenderer(
  gridElement: HTMLElement,
): ((ctx: DetailPanelContext<unknown>) => VNode[] | undefined) | undefined {
  const detailElement = gridElement.querySelector('tbw-grid-detail') as HTMLElement | null;
  if (detailElement) {
    return detailRegistry.get(detailElement);
  }
  return undefined;
}
