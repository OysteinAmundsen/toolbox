import type { FilterPanelParams } from '@toolbox-web/grid/all';

/**
 * Shared shape passed to every custom filter-panel renderer.
 *
 * Derived from the real {@link FilterPanelParams} (from
 * `@toolbox-web/grid/features/filtering`) via `Pick`, so the value the
 * plugin hands to `filterPanelRenderer` can be assigned directly without
 * any cast — and so each panel can still be unit-tested with a small
 * partial mock object covering just the fields below.
 */
export type CustomPanelParams = Pick<
  FilterPanelParams,
  'field' | 'currentFilter' | 'applyTextFilter' | 'clearFilter' | 'closePanel'
>;
