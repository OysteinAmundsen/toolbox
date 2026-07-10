/**
 * Tag Registry (leaf module)
 *
 * Holds the grid's registered custom-element tag name as standalone module
 * state so that modules needing the active tag (e.g. `style-injector`) do not
 * import the `DataGridElement` class, which would create an import cycle with
 * `grid.ts`.
 *
 * `DataGridElement.tagName` / `DataGridElement.activeTag` delegate here, so the
 * public static API is unchanged. See issue #339 for multi-version coexistence.
 *
 * @module internal/tag-registry
 */

/** The canonical, unsuffixed grid custom-element tag name. */
export const GRID_TAG_NAME = 'tbw-grid';

let activeGridTag: string = GRID_TAG_NAME;

/**
 * Tag name this bundle should render and query for. Equals {@link GRID_TAG_NAME}
 * in the common single-version case, or a version-suffixed tag when a second
 * bundle coexists on the page.
 */
export function getActiveGridTag(): string {
  return activeGridTag;
}

/** Update the active tag. Called during custom-element registration. */
export function setActiveGridTag(tag: string): void {
  activeGridTag = tag;
}
