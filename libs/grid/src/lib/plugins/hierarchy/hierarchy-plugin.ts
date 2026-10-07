/**
 * Hierarchy Plugin
 *
 * Owns the hierarchical row model shared by structure-contributing plugins.
 */

import type { PluginManifest } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { RowElementInternal } from '../../core/types';
import { buildHierarchy } from './hierarchy';
import type { HierarchyContributor, HierarchyRowMeta } from './types';

/** Attribute write that skips the DOM mutation when the value is unchanged (per-frame hot path). */
function setAttrIfChanged(el: Element, name: string, value: number): void {
  const next = String(value);
  if (el.getAttribute(name) !== next) el.setAttribute(name, next);
}

function isContributor(plugin: unknown): plugin is HierarchyContributor & BaseGridPlugin {
  return typeof (plugin as Partial<HierarchyContributor>).processSiblings === 'function';
}

function processRowsPriority(plugin: BaseGridPlugin): number {
  return (plugin.constructor as typeof BaseGridPlugin).manifest?.hookPriority?.processRows ?? 0;
}

/**
 * Hierarchy Plugin for tbw-grid
 *
 * Builds one hierarchical row model from every attached structure contributor
 * — {@link https://toolboxjs.com/grid/plugins/tree/ | TreePlugin} discovers
 * child rows, {@link https://toolboxjs.com/grid/plugins/grouping-rows/ | GroupingRowsPlugin}
 * groups sibling lists — and announces each row's position with the WAI-ARIA
 * treegrid pattern (`aria-level` / `aria-setsize` / `aria-posinset`).
 *
 * Contributors know nothing about each other, so they compose: a grid with
 * both Tree and GroupingRows groups the children of every tree level.
 *
 * You never need to add this plugin yourself — TreePlugin and
 * GroupingRowsPlugin declare it as a dependency and the grid attaches it
 * automatically. It has no configuration.
 *
 * @example Group the children of every tree node
 * ```ts
 * import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
 * import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
 *
 * grid.gridConfig = {
 *   plugins: [
 *     new TreePlugin({ childrenField: 'children' }),
 *     new GroupingRowsPlugin({
 *       // Leave the root level ungrouped, group every child level by kind
 *       groupOn: (row, { depth }) => (depth > 0 ? row.kind : null),
 *     }),
 *   ],
 * };
 * ```
 *
 * @since 3.9.0
 */
export class HierarchyPlugin extends BaseGridPlugin {
  /** @internal */
  static override readonly manifest: PluginManifest = {
    modifiesRowStructure: true,
  };

  /** @internal */
  readonly name = 'hierarchy';

  #meta = new WeakMap<object, HierarchyRowMeta>();

  /** @internal */
  override detach(): void {
    // Restore the default `role="grid"` (template default in `core/internal/dom-builder.ts`).
    this.gridElement?.querySelector('.rows-body')?.setAttribute('role', 'grid');
    this.#meta = new WeakMap();
  }

  /**
   * Build the row model for a contributor's `processRows` hook.
   *
   * Every contributor forwards its hook here; only the one that runs last in
   * the `processRows` pipeline builds the model (for all contributors at
   * once) — the earlier ones pass their rows through untouched.
   *
   * @example
   * ```ts
   * override processRows(rows: readonly unknown[]): unknown[] {
   *   return this.grid.getPluginByName('hierarchy')?.process(rows, this) ?? [...rows];
   * }
   * ```
   *
   * @since 3.9.0
   */
  process(rows: readonly unknown[], caller: HierarchyContributor): unknown[] {
    const contributors = this.#contributors();
    if (!contributors.includes(caller as HierarchyContributor & BaseGridPlugin)) {
      this.#meta = new WeakMap();
      return buildHierarchy(rows, [caller], this.#meta);
    }
    if (contributors[contributors.length - 1] !== caller) return rows as unknown[];
    this.#meta = new WeakMap();
    return buildHierarchy(rows, contributors, this.#meta);
  }

  /**
   * Hierarchy position of a row in the current row model, or `undefined` when
   * the row is not rendered (e.g. collapsed under a parent).
   *
   * @example
   * ```ts
   * const meta = grid.getPluginByName('hierarchy')?.getRowMeta(grid.rows[0]);
   * console.log(meta?.level, meta?.posInSet, meta?.setSize);
   * ```
   *
   * @since 3.9.0
   */
  getRowMeta(row: unknown): HierarchyRowMeta | undefined {
    return typeof row === 'object' && row !== null ? this.#meta.get(row) : undefined;
  }

  /** @internal */
  override afterRender(): void {
    this.#applyAria();
  }

  /** @internal */
  override onScrollRender(): void {
    this.#applyAria();
  }

  /** Attached contributors, in `processRows` hook order. */
  #contributors(): Array<HierarchyContributor & BaseGridPlugin> {
    const plugins = (this.grid?._pluginManager?.getPlugins?.() ?? []) as readonly BaseGridPlugin[];
    return plugins.filter(isContributor).sort((a, b) => processRowsPriority(a) - processRowsPriority(b));
  }

  #applyAria(): void {
    if (this.#contributors().length === 0) return;
    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    let hierarchical = false;
    for (const rowEl of body.querySelectorAll('.data-grid-row')) {
      const meta = this.getRowMeta((rowEl as RowElementInternal).__rowDataRef);
      if (!meta) {
        // Pooled row elements may carry a position from a previous row model.
        rowEl.removeAttribute('aria-level');
        rowEl.removeAttribute('aria-setsize');
        rowEl.removeAttribute('aria-posinset');
        continue;
      }
      hierarchical = true;
      setAttrIfChanged(rowEl, 'aria-level', meta.level);
      setAttrIfChanged(rowEl, 'aria-setsize', meta.setSize);
      setAttrIfChanged(rowEl, 'aria-posinset', meta.posInSet);
    }

    // `treegrid` only while the model has hierarchy, so per-row level/setsize/posinset are valid in context.
    const role = hierarchical ? 'treegrid' : 'grid';
    const rowsBody = this.gridElement?.querySelector('.rows-body');
    if (rowsBody && rowsBody.getAttribute('role') !== role) rowsBody.setAttribute('role', role);
  }
}
