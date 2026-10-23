import { GridClasses } from '../../core/constants';

/** Class of the MasterDetailPlugin expander toggle. @internal */
export const MASTER_DETAIL_TOGGLE_CLASS = 'master-detail-toggle';

/**
 * True when a click lands on (or inside — custom icons are children) a master-detail toggle.
 * @internal
 */
export function isMasterDetailToggleTarget(event: Event | undefined): boolean {
  return !!(event?.target as Element | null)?.closest?.(`.${MASTER_DETAIL_TOGGLE_CLASS}`);
}

const STRUCTURAL_TOGGLE_SELECTOR = `.${GridClasses.TREE_TOGGLE},.${MASTER_DETAIL_TOGGLE_CLASS},.${GridClasses.GROUP_TOGGLE}`;

/**
 * True when a click lands on a structural expand/collapse toggle (tree, master-detail or
 * group row). Such clicks belong to the expander plugin; other click handlers (e.g. editing)
 * must not act on them, whatever order the plugins are registered in (#565).
 * @internal
 */
export function isStructuralToggleTarget(event: Event): boolean {
  const target = event.target as Element | null;
  return !!target?.closest?.(STRUCTURAL_TOGGLE_SELECTOR);
}
