/**
 * Shared shape passed to every custom filter-panel renderer. Mirrors the
 * subset of `FilterPanelParams` (from `@toolbox-web/grid/features/filtering`)
 * that the demo's panels actually use, so each panel can be unit-tested
 * with a plain object.
 */
export type CustomPanelParams = {
  field: string;
  currentFilter?: { operator?: string; value?: unknown; valueTo?: unknown };
  applyTextFilter: (op: string, v: number | string, vTo?: number | string) => void;
  clearFilter: () => void;
  closePanel: () => void;
};
