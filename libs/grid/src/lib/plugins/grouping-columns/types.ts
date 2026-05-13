/**
 * Column Groups Plugin Types
 *
 * Type definitions for multi-level column header grouping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ColumnConfig as CoreColumnConfig } from '../../core/types';

// ============================================================================
// Module Augmentation - Extends core types with grouping-specific properties
// ============================================================================

declare module '../../core/types' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TRow must match the original ColumnConfig<TRow> declaration for module augmentation to merge (TS2428).
  interface ColumnConfig<TRow = any> {
    /**
     * Column group assignment for the GroupingColumnsPlugin.
     * Columns with the same group.id are rendered under a shared header.
     */
    group?: { id: string; label?: string } | string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TRow must match the original GridConfig<TRow> declaration for module augmentation to merge (TS2428).
  interface GridConfig<TRow = any> {
    /**
     * Declarative column group definitions for the GroupingColumnsPlugin.
     * Each group specifies an id, header label, and array of column field names.
     * The plugin will automatically assign the `group` property to matching columns.
     *
     * @example
     * ```ts
     * columnGroups: [
     *   { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName', 'email'] },
     *   { id: 'work', header: 'Work Info', children: ['department', 'title', 'salary'] },
     * ]
     * ```
     */
    columnGroups?: ColumnGroupDefinition[];
  }

  interface PluginNameMap {
    groupingColumns: import('./GroupingColumnsPlugin').GroupingColumnsPlugin;
  }
}

// ============================================================================
// Plugin Configuration Types
// ============================================================================

/** Configuration options for the column groups plugin * @since 0.1.1
 */
export interface GroupingColumnsConfig {
  /**
   * Declarative column group definitions.
   * When provided here, takes precedence over `gridConfig.columnGroups`.
   *
   * @example
   * ```ts
   * features: {
   *   groupingColumns: {
   *     columnGroups: [
   *       { header: 'Personal Info', children: ['firstName', 'lastName', 'email'] },
   *       { header: 'Work Info', children: ['department', 'title', 'salary'] },
   *     ],
   *   }
   * }
   * ```
   */
  columnGroups?: ColumnGroupDefinition[];
  /**
   * Group header renderer called for each column group.
   * Receives the group's `id`, `label`, and `columns` in the params,
   * so a single function can handle all groups or differentiate per group via `params.id`.
   *
   * When a {@link ColumnGroupDefinition.renderer | per-group renderer} is also defined,
   * the per-group renderer takes precedence for that specific group.
   *
   * @example Uniform rendering for all groups:
   * ```ts
   * groupHeaderRenderer: (params) => {
   *   return `<strong>${params.label}</strong> (${params.columns.length} cols)`;
   * }
   * ```
   *
   * @example Per-group rendering via switch on params.id
   * ```ts
   * groupHeaderRenderer: (params) => {
   *   const icons: Record<string, string> = { personal: '👤', work: '💼' };
   *   return `${icons[params.id] ?? '📁'} <strong>${params.label}</strong>`;
   * }
   * ```
   *
   * @example Return an HTMLElement for full control:
   * ```ts
   * groupHeaderRenderer: (params) => {
   *   const el = document.createElement('span');
   *   el.style.cssText = 'display: flex; align-items: center; gap: 0.4em;';
   *   el.textContent = `${params.label} — ${params.columns.length} columns`;
   *   return el;
   * }
   * ```
   *
   * @example Return void to keep the default text label:
   * ```ts
   * groupHeaderRenderer: (params) => {
   *   if (params.id === 'misc') return; // default label for this group
   *   return `<em>${params.label}</em>`;
   * }
   * ```
   */
  groupHeaderRenderer?: (params: GroupHeaderRenderParams) => HTMLElement | string | void;
  /** Whether to show group borders (default: true) */
  showGroupBorders?: boolean;
  /**
   * Prevent columns from being reordered outside their group.
   * When enabled, column moves that would break group contiguity are blocked.
   * Works with both header drag-and-drop and visibility panel drag-and-drop.
   * @default false
   */
  lockGroupOrder?: boolean;
}

/**
 * Parameters passed to the {@link GroupingColumnsConfig.groupHeaderRenderer | groupHeaderRenderer}
 * and {@link ColumnGroupDefinition.renderer | per-group renderer} callbacks.
 *
 * @example Render all groups with a shared function, differentiated by id:
 * ```ts
 * groupHeaderRenderer: (params) => {
 *   const icons = { personal: '👤', work: '💼' };
 *   return `${icons[params.id] ?? '📁'} <strong>${params.label}</strong>`;
 * }
 * ```
 *
 * @example Return an HTMLElement for full control:
 * ```ts
 * groupHeaderRenderer: (params) => {
 *   const el = document.createElement('span');
 *   el.style.cssText = 'display: flex; align-items: center; gap: 0.4em;';
 *   el.textContent = `${params.label} — ${params.columns.length} columns`;
 *   return el;
 * }
 * ```
 *
 * @example Return void to keep the default label:
 * ```ts
 * groupHeaderRenderer: (params) => {
 *   if (params.isImplicit) return; // keep default for implicit groups
 *   return `<em>${params.label}</em>`;
 * }
 * ```
 * @since 0.1.1
 */
export interface GroupHeaderRenderParams {
  /** The group ID (e.g. `'personal'`, `'work'`). */
  id: string;
  /** The group display label. Falls back to {@link id} if no label was provided. */
  label: string;
  /** The column configurations belonging to this group. */
  columns: CoreColumnConfig[];
  /** Zero-based index of the first column in this group within the visible columns array. */
  firstIndex: number;
  /** `true` for auto-generated groups that cover ungrouped columns. Always `false` when called from the renderer (implicit groups are skipped). */
  isImplicit: boolean;
}

/** Internal state managed by the column groups plugin */
export interface GroupingColumnsState {
  /** Computed column groups */
  groups: ColumnGroup[];
  /** Whether groups are currently active */
  isActive: boolean;
}

/**
 * Declarative column group definition for GridConfig.columnGroups or
 * {@link GroupingColumnsConfig.columnGroups}.
 *
 * @example Minimal (id auto-generated from header)
 * ```ts
 * { header: 'Personal Info', children: ['firstName', 'lastName'] }
 * ```
 *
 * @example With explicit id and per-group renderer
 * ```ts
 * {
 *   id: 'personal',
 *   header: 'Personal Info',
 *   children: ['firstName', 'lastName'],
 *   renderer: (params) => `<strong>${params.label}</strong>`,
 * }
 * ```
 * @since 0.2.9
 */
export interface ColumnGroupDefinition {
  /**
   * Unique group identifier.
   * When omitted, auto-generated as a slug of {@link header}
   * (e.g. `'Personal Info'` → `'personal-info'`).
   *
   * Required when {@link renderer} is provided without a {@link header}.
   */
  id?: string;
  /** Display label for the group header */
  header: string;
  /** Array of column field names belonging to this group */
  children: string[];
  /**
   * Custom renderer for this specific group's header cell.
   * Takes precedence over {@link GroupingColumnsConfig.groupHeaderRenderer}.
   */
  renderer?: (params: GroupHeaderRenderParams) => HTMLElement | string | void;
}

/** Column group definition (computed at runtime) * @since 0.1.1
 */
export interface ColumnGroup<T = any> {
  /** Unique group identifier */
  id: string;
  /** Display label for the group header */
  label?: string;
  /** Columns belonging to this group */
  columns: CoreColumnConfig<T>[];
  /** Index of first column in this group */
  firstIndex: number;
  /**
   * Per-group renderer. Resolved from the originating
   * {@link ColumnGroupDefinition.renderer} when present.
   */
  renderer?: (params: GroupHeaderRenderParams) => HTMLElement | string | void;
}

/** Extended column group with implicit flag */
export interface ColumnGroupInternal<T = any> extends ColumnGroup<T> {
  /** Whether this group was auto-generated for ungrouped columns */
  implicit?: boolean;
}
