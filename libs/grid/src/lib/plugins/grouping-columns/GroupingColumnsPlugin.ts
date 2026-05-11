/**
 * Column Groups Plugin (Class-based)
 *
 * Enables multi-level column header grouping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { COLUMN_GROUPS_CONFLICT } from '../../core/internal/diagnostics';
import type { AfterCellRenderContext, PluginManifest, PluginQuery } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import {
  type CollectHeaderRowsContext,
  type HeaderRowCell,
  type HeaderRowContribution,
  QUERY_COLLECT_HEADER_ROWS,
} from '../../core/plugin/types';
import type { ColumnConfig } from '../../core/types';
import type { ColumnGroupInfo } from '../visibility/types';
import {
  applyGroupedHeaderCellClasses,
  buildGroupHeaderRow,
  computeColumnGroups,
  hasColumnGroups,
  mergeGroups,
  resolveColumnGroupDefs,
} from './grouping-columns';
import styles from './grouping-columns.css?inline';
import type { ColumnGroup, ColumnGroupDefinition, GroupingColumnsConfig } from './types';

/**
 * Column Grouping Plugin for tbw-grid
 *
 * Enables visual grouping of columns under shared headers. Supports two approaches:
 * declarative `columnGroups` at the grid level, or inline `group` property on columns.
 *
 * ## Installation
 *
 * ```ts
 * import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
 * ```
 *
 * ## Grid Config: `columnGroups`
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `id` | `string` | Unique group identifier |
 * | `header` | `string` | Display label for the group header |
 * | `children` | `string[]` | Array of column field names in this group |
 *
 * ## Column Config: `group`
 *
 * | Type | Description |
 * |------|-------------|
 * | `string` | Simple group ID (used as both id and label) |
 * | `{ id: string; label?: string }` | Group object with explicit id and optional label |
 *
 * @example Declarative columnGroups (Recommended)
 * ```ts
 * import '@toolbox-web/grid';
 * import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
 *
 * grid.gridConfig = {
 *   columnGroups: [
 *     { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName', 'email'] },
 *     { id: 'work', header: 'Work Info', children: ['department', 'title', 'salary'] },
 *   ],
 *   columns: [
 *     { field: 'firstName', header: 'First Name' },
 *     { field: 'lastName', header: 'Last Name' },
 *     // ...
 *   ],
 *   plugins: [new GroupingColumnsPlugin()],
 * };
 * ```
 *
 * @example Inline group Property
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
 *     { field: 'lastName', header: 'Last Name', group: 'personal' }, // string shorthand
 *   ],
 *   plugins: [new GroupingColumnsPlugin()],
 * };
 * ```
 *
 * @see {@link GroupingColumnsConfig} for all configuration options
 * @see {@link ColumnGroup} for the group structure
 * @see ReorderPlugin for drag-to-reorder within groups
 *
 * @internal Extends BaseGridPlugin
 * @since 0.1.1
 */
export class GroupingColumnsPlugin extends BaseGridPlugin<GroupingColumnsConfig> {
  /**
   * Plugin manifest - declares owned properties for configuration validation.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    ownedProperties: [
      {
        property: 'group',
        level: 'column',
        description: 'the "group" column property',
      },
      {
        property: 'columnGroups',
        level: 'config',
        description: 'the "columnGroups" config property',
        isUsed: (v) => Array.isArray(v) && v.length > 0,
      },
    ],
    queries: [
      { type: 'getColumnGrouping', description: 'Returns column group metadata for the visibility panel' },
      {
        type: QUERY_COLLECT_HEADER_ROWS,
        description: 'Contributes a group-header row above the leaf header for exports / printers',
      },
    ],
  };

  /** @internal */
  readonly name = 'groupingColumns';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<GroupingColumnsConfig> {
    return {
      showGroupBorders: true,
      lockGroupOrder: false,
    };
  }

  // #region Internal State
  private groups: ColumnGroup[] = [];
  private isActive = false;
  /** Fields that are the last column in a group (for group-end border class). */
  #groupEndFields = new Set<string>();
  /** Resolved column group definitions (with auto-generated ids). */
  #resolvedGroupDefs: (ColumnGroupDefinition & { id: string })[] = [];
  /** Map of group id → per-group renderer from ColumnGroupDefinition.renderer */
  #groupRenderers = new Map<string, NonNullable<ColumnGroupDefinition['renderer']>>();
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Listen for cancelable column-move events to enforce group contiguity
    this.gridElement.addEventListener('column-move', this.#onColumnMove, {
      signal: this.disconnectSignal,
    });
  }

  /** @internal */
  override detach(): void {
    this.groups = [];
    this.isActive = false;
    this.#groupEndFields.clear();
    this.#resolvedGroupDefs = [];
    this.#groupRenderers.clear();
  }

  // #region Column Move Guard

  /**
   * Handle the cancelable column-move event.
   * - When lockGroupOrder is enabled, prevents moves that would break group contiguity.
   * - Always refreshes #groupEndFields after a successful move so that afterCellRender
   *   applies group-end borders to the correct (reordered) last column.
   */
  #onColumnMove = (e: Event): void => {
    if (!this.isActive) return;

    const event = e as CustomEvent<{ field: string; columnOrder: string[] }>;
    const { field, columnOrder } = event.detail;

    if (this.config.lockGroupOrder) {
      // Aggregate all columns per group ID (across fragments) for full contiguity check
      const fullGroups = new Map<string, ColumnConfig[]>();
      for (const group of this.groups) {
        if (group.id.startsWith('__implicit__')) continue;
        const existing = fullGroups.get(group.id);
        if (existing) {
          existing.push(...group.columns);
        } else {
          fullGroups.set(group.id, [...group.columns]);
        }
      }
      for (const [, columns] of fullGroups) {
        if (!this.#isGroupContiguous(columns, columnOrder)) {
          event.preventDefault();
          this.#flashHeaderCell(field);
          return;
        }
      }
    }

    // Recompute group-end fields based on proposed column order.
    // setColumnOrder runs synchronously after this handler returns,
    // but afterCellRender (which reads #groupEndFields) fires during
    // the subsequent refreshVirtualWindow. Precompute using the
    // proposed columnOrder so the borders are correct immediately.
    this.#recomputeGroupEndFields(columnOrder);
  };

  /**
   * Recompute which fields are group-end based on a column order.
   * Marks every boundary where adjacent columns belong to different groups,
   * which naturally handles fragmented groups (same group ID split across
   * non-contiguous positions).
   */
  #recomputeGroupEndFields(columnOrder: string[]): void {
    this.#groupEndFields.clear();

    // Build field → group ID map from all groups
    const fieldToGroup = new Map<string, string>();
    for (const group of this.groups) {
      for (const col of group.columns) {
        fieldToGroup.set(col.field, group.id);
      }
    }

    // Mark every position where the group changes (skip the very last column)
    for (let i = 0; i < columnOrder.length - 1; i++) {
      const currentGroup = fieldToGroup.get(columnOrder[i]);
      const nextGroup = fieldToGroup.get(columnOrder[i + 1]);
      if (currentGroup !== nextGroup) {
        this.#groupEndFields.add(columnOrder[i]);
      }
    }
  }

  /**
   * Check if all columns are contiguous in the proposed column order.
   */
  #isGroupContiguous(columns: ColumnConfig[], columnOrder: string[]): boolean {
    const indices = columns
      .map((c) => columnOrder.indexOf(c.field))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (indices.length <= 1) return true;
    return indices.length === indices[indices.length - 1] - indices[0] + 1;
  }

  /**
   * Flash the header cell with an error color to indicate a blocked move.
   */
  #flashHeaderCell(field: string): void {
    const headerCell = this.gridElement?.querySelector(
      `.header-row [part~="header-cell"][data-field="${field}"]`,
    ) as HTMLElement;
    if (!headerCell) return;

    headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
    headerCell.animate(
      [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
      { duration: 400, easing: 'ease-out' },
    );
  }
  // #endregion

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'getColumnGrouping') {
      return this.#getStableColumnGrouping();
    }
    if (query.type === QUERY_COLLECT_HEADER_ROWS) {
      return this.#buildHeaderRowContribution((query as PluginQuery<CollectHeaderRowsContext>).context);
    }
    return undefined;
  }

  /**
   * Build a {@link HeaderRowContribution} aligned to the caller-supplied
   * leaf-column array. Reuses the same fragment-aware compute/merge pipeline
   * the visual header row uses, so reordered / hidden columns and embedded
   * utility columns produce identical spans to what the user sees.
   *
   * Returns `undefined` (rather than an empty row) when no meaningful groups
   * exist, so the export/print consumer can keep its current single-row
   * layout unchanged.
   */
  #buildHeaderRowContribution(context: CollectHeaderRowsContext): HeaderRowContribution | undefined {
    const columns = context?.columns;
    if (!Array.isArray(columns) || columns.length === 0) return undefined;

    const groups = computeColumnGroups(columns);
    if (groups.length === 0) return undefined;

    const { merged } = mergeGroups(groups);

    const cells: HeaderRowCell[] = [];
    for (const g of merged) {
      const gid = String(g.id);
      const isImplicit = gid.startsWith('__implicit__');

      // Span = distance from the group's first column to its last in the
      // resolved columns array. This naturally absorbs any utility columns
      // that sit between fragments of the same group (matches the visual
      // header's `gridColumn: 'start / span N'` calculation).
      const first = g.columns[0];
      const last = g.columns[g.columns.length - 1];
      if (!first || !last) continue;
      const start = columns.findIndex((c) => c.field === first.field);
      const end = columns.findIndex((c) => c.field === last.field);
      if (start < 0 || end < 0) continue;
      const span = end - start + 1;

      cells.push({
        label: isImplicit ? '' : (g.label ?? g.id),
        span,
        source: this.name,
      });
    }

    if (cells.length === 0) return undefined;

    // INVARIANT: cell spans sum to columns.length. If they don't, there are
    // gaps (e.g. columns between merged groups that no fragment claims) —
    // fill them with blank spacers so consumers can rely on the invariant.
    const totalSpan = cells.reduce((s, c) => s + c.span, 0);
    if (totalSpan !== columns.length) {
      // Conservative fallback: collapse to a single blank row of correct span.
      // This shouldn't trip under normal grouping flows but guards against
      // unexpected column-set drift between the live grid and the snapshot
      // passed by the consumer.
      return { cells: [{ label: '', span: columns.length, source: this.name }] };
    }

    return { cells };
  }

  /**
   * Get stable column grouping info that includes ALL columns (visible and hidden).
   * Used by the visibility panel to maintain group structure regardless of visibility state.
   * Fields within each group are sorted by current display order.
   */
  #getStableColumnGrouping(): ColumnGroupInfo[] {
    let result: ColumnGroupInfo[];

    // 1. Prefer resolved declarative columnGroups (from plugin config or gridConfig)
    if (this.#resolvedGroupDefs.length > 0) {
      result = this.#resolvedGroupDefs
        .filter((g) => g.children.length > 0)
        .map((g) => ({
          id: g.id,
          label: g.header,
          fields: [...g.children],
        }));
    } else if (this.isActive && this.groups.length > 0) {
      // 2. If active groups exist from processColumns, use them.
      // Aggregate fragments (same group id at non-contiguous positions) into one entry.
      const groupMap = new Map<string, ColumnGroupInfo>();
      for (const g of this.groups) {
        if (g.id.startsWith('__implicit__')) continue;
        const existing = groupMap.get(g.id);
        if (existing) {
          for (const c of g.columns) {
            if (!existing.fields.includes(c.field)) existing.fields.push(c.field);
          }
        } else {
          groupMap.set(g.id, {
            id: g.id,
            label: g.label ?? g.id,
            fields: g.columns.map((c) => c.field),
          });
        }
      }
      result = Array.from(groupMap.values());
      // Also check hidden columns for inline group properties not in active groups
      const allCols = this.columns as ColumnConfig[];
      for (const col of allCols) {
        if ((col as any).hidden && col.group) {
          const gId = typeof col.group === 'string' ? col.group : col.group.id;
          const gLabel = typeof col.group === 'string' ? col.group : (col.group.label ?? col.group.id);
          const existing = result.find((g) => g.id === gId);
          if (existing) {
            if (!existing.fields.includes(col.field)) existing.fields.push(col.field);
          } else {
            result.push({ id: gId, label: gLabel, fields: [col.field] });
          }
        }
      }
    } else {
      // 3. Fall back: scan ALL columns (including hidden) for inline group properties
      const allCols = this.columns as ColumnConfig[];
      const groupMap = new Map<string, ColumnGroupInfo>();
      for (const col of allCols) {
        if (!col.group) continue;
        const gId = typeof col.group === 'string' ? col.group : col.group.id;
        const gLabel = typeof col.group === 'string' ? col.group : (col.group.label ?? col.group.id);
        const existing = groupMap.get(gId);
        if (existing) {
          if (!existing.fields.includes(col.field)) existing.fields.push(col.field);
        } else {
          groupMap.set(gId, { id: gId, label: gLabel, fields: [col.field] });
        }
      }
      result = Array.from(groupMap.values());
    }

    // Sort fields within each group by current display order so consumers
    // (e.g. the visibility panel) render columns in their reordered positions.
    const displayOrder = this.grid?.getColumnOrder();
    if (displayOrder && displayOrder.length > 0) {
      const orderIndex = new Map(displayOrder.map((f, i) => [f, i]));
      for (const group of result) {
        group.fields.sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
      }
    }

    return result;
  }
  // #endregion

  // #region Static Detection

  /**
   * Auto-detect column groups from column configuration.
   * Detects both inline `column.group` properties and declarative `columnGroups` config.
   */
  static detect(rows: readonly any[], config: any): boolean {
    // Check for declarative columnGroups in plugin feature config
    const featureConfig = config?.features?.groupingColumns;
    if (
      featureConfig &&
      typeof featureConfig === 'object' &&
      Array.isArray(featureConfig.columnGroups) &&
      featureConfig.columnGroups.length > 0
    ) {
      return true;
    }
    // Check for declarative columnGroups in gridConfig
    if (config?.columnGroups && Array.isArray(config.columnGroups) && config.columnGroups.length > 0) {
      return true;
    }
    // Check for inline group properties on columns
    const columns = config?.columns;
    if (!Array.isArray(columns)) return false;
    return hasColumnGroups(columns);
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Resolve columnGroups source — plugin config takes precedence over gridConfig
    const pluginColumnGroups = this.config?.columnGroups;
    const gridColumnGroups = this.grid?.gridConfig?.columnGroups;
    let columnGroupDefs: ColumnGroupDefinition[] | undefined;

    if (pluginColumnGroups && Array.isArray(pluginColumnGroups) && pluginColumnGroups.length > 0) {
      // Warn if both sources are defined
      if (gridColumnGroups && Array.isArray(gridColumnGroups) && gridColumnGroups.length > 0) {
        this.warn(
          COLUMN_GROUPS_CONFLICT,
          'columnGroups defined in both gridConfig and groupingColumns feature config. ' +
            'Using feature config (higher precedence).',
        );
      }
      columnGroupDefs = pluginColumnGroups;
    } else if (gridColumnGroups && Array.isArray(gridColumnGroups) && gridColumnGroups.length > 0) {
      columnGroupDefs = gridColumnGroups;
    }

    let processedColumns: ColumnConfig[];

    if (columnGroupDefs && columnGroupDefs.length > 0) {
      // Resolve ids (auto-generate from header when missing) and validate
      const resolved = resolveColumnGroupDefs(columnGroupDefs);
      this.#resolvedGroupDefs = resolved;

      // Collect per-group renderers
      this.#groupRenderers.clear();
      for (const def of resolved) {
        if (def.renderer) {
          this.#groupRenderers.set(def.id, def.renderer);
        }
      }

      // Build a map of field → group info from the declarative config
      const fieldToGroup = new Map<string, { id: string; label: string }>();
      for (const group of resolved) {
        for (const field of group.children) {
          fieldToGroup.set(field, { id: group.id, label: group.header });
        }
      }

      // Apply group property to columns that don't already have one
      processedColumns = columns.map((col) => {
        const groupInfo = fieldToGroup.get(col.field);
        if (groupInfo && !col.group) {
          return { ...col, group: groupInfo };
        }
        return col;
      });
    } else {
      this.#resolvedGroupDefs = [];
      this.#groupRenderers.clear();
      processedColumns = [...columns];
    }

    // Compute groups from column definitions (now including applied groups)
    const groups = computeColumnGroups(processedColumns);

    if (groups.length === 0) {
      this.isActive = false;
      this.groups = [];
      return processedColumns;
    }

    // Attach per-group renderers to computed groups
    if (this.#groupRenderers.size > 0) {
      for (const g of groups) {
        const r = this.#groupRenderers.get(g.id);
        if (r) g.renderer = r;
      }
    }

    this.isActive = true;
    this.groups = groups;

    // Pre-compute group-end fields for the afterCellRender hook
    this.#groupEndFields.clear();
    for (const g of groups) {
      const lastCol = g.columns[g.columns.length - 1];
      if (lastCol?.field) {
        this.#groupEndFields.add(lastCol.field);
      }
    }

    // Return columns with group info applied
    return processedColumns;
  }

  /** @internal */
  override afterRender(): void {
    if (!this.isActive) {
      // Remove any existing group header
      const header = this.gridElement?.querySelector('.header');
      const existingGroupRow = header?.querySelector('.header-group-row');
      if (existingGroupRow) existingGroupRow.remove();
      return;
    }

    const header = this.gridElement?.querySelector('.header');
    if (!header) return;

    // Remove existing group row if present
    const existingGroupRow = header.querySelector('.header-group-row');
    if (existingGroupRow) existingGroupRow.remove();

    // Recompute groups from visible columns only (hidden columns have no CSS grid track).
    // This also picks up any plugin-added columns (e.g. expander) that weren't present
    // during processColumns.
    const finalColumns = this.visibleColumns as ColumnConfig[];
    const groups = computeColumnGroups(finalColumns);
    if (groups.length === 0) return;

    // Attach per-group renderers from resolved definitions
    if (this.#groupRenderers.size > 0) {
      for (const g of groups) {
        const r = this.#groupRenderers.get(g.id);
        if (r) g.renderer = r;
      }
    }

    // Keep #groupEndFields in sync for afterCellRender (covers scheduler-driven renders)
    this.#groupEndFields.clear();
    const precomputed = mergeGroups(groups);
    for (let gi = 0; gi < precomputed.merged.length; gi++) {
      const g = precomputed.merged[gi];
      const lastCol = g.columns[g.columns.length - 1];
      // Don't mark the last group — no adjacent group follows it
      if (lastCol?.field && gi < precomputed.merged.length - 1) {
        this.#groupEndFields.add(lastCol.field);
      }
    }

    // Build and insert group header row
    const groupRow = buildGroupHeaderRow(groups, finalColumns, this.config.groupHeaderRenderer, precomputed);
    if (groupRow) {
      // Toggle border visibility class
      groupRow.classList.toggle('no-borders', !this.config.showGroupBorders);

      const headerRow = header.querySelector('.header-row');
      if (headerRow) {
        header.insertBefore(groupRow, headerRow);
      } else {
        header.appendChild(groupRow);
      }
    }

    // Apply classes to header cells
    const headerRow = header.querySelector('.header-row') as HTMLElement;
    if (headerRow) {
      // Toggle border visibility on header cells
      headerRow.classList.toggle('no-group-borders', !this.config.showGroupBorders);
      applyGroupedHeaderCellClasses(headerRow, groups, finalColumns, precomputed);
    }
  }

  /**
   * Apply group-end class to individual cells during render and scroll.
   * This is more efficient than querySelectorAll in afterRender and ensures
   * cells recycled during scroll also get the class applied.
   * @internal
   */
  override afterCellRender(context: AfterCellRenderContext): void {
    if (!this.isActive || !this.config.showGroupBorders) return;
    context.cellElement.classList.toggle('group-end', this.#groupEndFields.has(context.column.field));
  }
  // #endregion

  // #region Public API

  /**
   * Check if column groups are active.
   * @returns Whether grouping is active
   */
  isGroupingActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the computed column groups.
   * @returns Array of column groups
   */
  getGroups(): ColumnGroup[] {
    return this.groups;
  }

  /**
   * Get columns in a specific group (aggregated across all fragments).
   * @param groupId - The group ID to find
   * @returns Array of columns in the group
   */
  getGroupColumns(groupId: string): ColumnConfig[] {
    return this.groups.filter((g) => g.id === groupId).flatMap((g) => g.columns);
  }

  /**
   * Refresh column groups (recompute from current columns).
   */
  refresh(): void {
    this.requestRender();
  }
  // #endregion
}
