/**
 * Shared demo-local types used by both `grid-factory.ts` and the renderer
 * modules under `./renderers/`.
 */

/**
 * `FilterModel` shape that the filtering plugin attaches to every `getRows`
 * call as `params.filterModel`. Inlined to avoid coupling the demo to an
 * internal plugin path; matches `FilterModel` from `@toolbox-web/grid`.
 */
export type DemoFilterModel = {
  field: string;
  type: string;
  operator: string;
  value: unknown;
  valueTo?: unknown;
};
