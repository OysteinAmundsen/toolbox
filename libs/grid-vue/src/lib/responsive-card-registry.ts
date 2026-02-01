/**
 * Registry for responsive card renderers.
 * @internal
 */
import type { VNode } from 'vue';

/**
 * Context object passed to the responsive card slot.
 */
export interface ResponsiveCardContext<T = unknown> {
  /** The row data */
  row: T;
  /** The row index */
  rowIndex: number;
}

/**
 * Registry for responsive card renderers (per element)
 */
export const cardRegistry = new WeakMap<HTMLElement, (ctx: ResponsiveCardContext<unknown>) => VNode[] | undefined>();

/**
 * Get the responsive card renderer for a grid element.
 * @internal
 */
export function getResponsiveCardRenderer(
  gridElement: HTMLElement,
): ((ctx: ResponsiveCardContext<unknown>) => VNode[] | undefined) | undefined {
  const cardElement = gridElement.querySelector('tbw-grid-responsive-card') as HTMLElement | null;
  if (cardElement) {
    return cardRegistry.get(cardElement);
  }
  return undefined;
}
