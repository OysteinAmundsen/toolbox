/**
 * Registry for tool panel renderers.
 * @internal
 */
import type { VNode } from 'vue';

/**
 * Context object passed to the tool panel slot.
 */
export interface ToolPanelContext {
  /** The grid element */
  gridElement: HTMLElement;
}

/**
 * Registry for tool panel renderers (per element)
 */
export const toolPanelRegistry = new WeakMap<HTMLElement, (ctx: ToolPanelContext) => VNode[] | undefined>();

/**
 * Get the tool panel renderer for an element.
 * @internal
 */
export function getToolPanelRenderer(
  panelElement: HTMLElement,
): ((ctx: ToolPanelContext) => VNode[] | undefined) | undefined {
  return toolPanelRegistry.get(panelElement);
}
