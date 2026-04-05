/**
 * Column Groups Core Logic
 *
 * Pure functions for computing and managing column header groups.
 */

// Import types to enable module augmentation
import { COLUMN_GROUP_NO_ID, throwDiagnostic } from '../../core/internal/diagnostics';
import type { ColumnConfig } from '../../core/types';
import './types';
import type {
  ColumnGroup,
  ColumnGroupDefinition,
  ColumnGroupInternal,
  GroupHeaderRenderParams,
  GroupingColumnsConfig,
} from './types';

/**
 * Generate a stable slug from a header string for use as auto-generated group id.
 * E.g. `'Personal Info'` → `'personal-info'`
 */
export function slugifyHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate column group definitions and resolve auto-generated ids.
 * Throws if a group has neither `id` nor `header`.
 *
 * @returns A new array with `id` resolved on every definition.
 */
export function resolveColumnGroupDefs(defs: ColumnGroupDefinition[]): (ColumnGroupDefinition & { id: string })[] {
  return defs.map((def) => {
    if (def.id) return def as ColumnGroupDefinition & { id: string };
    if (!def.header) {
      throwDiagnostic(
        COLUMN_GROUP_NO_ID,
        'ColumnGroupDefinition requires either an "id" or a "header" to generate an id from.',
      );
    }
    return { ...def, id: slugifyHeader(def.header) };
  });
}

/**
 * Compute column groups from column configuration.
 * Handles explicit groups (via column.group) and creates implicit groups for ungrouped columns.
 *
 * @param columns - Array of column configurations
 * @returns Array of column groups, or empty if no meaningful groups
 */
export function computeColumnGroups<T>(columns: ColumnConfig<T>[]): ColumnGroup<T>[] {
  if (!columns.length) return [];

  const groupsOrdered: ColumnGroupInternal<T>[] = [];
  /** Track first-seen label for each explicit group id so fragments share the label. */
  const labelMap = new Map<string, string | undefined>();

  // Helper to push unnamed implicit group for a run of ungrouped columns
  const pushImplicit = (startIdx: number, cols: ColumnConfig<T>[]) => {
    if (!cols.length) return;
    // Merge with previous implicit group if adjacent to reduce noise
    const prev = groupsOrdered[groupsOrdered.length - 1];
    if (prev && prev.implicit && prev.firstIndex + prev.columns.length === startIdx) {
      prev.columns.push(...cols);
      return;
    }
    groupsOrdered.push({
      id: '__implicit__' + startIdx,
      label: undefined,
      columns: cols,
      firstIndex: startIdx,
      implicit: true,
    });
  };

  let run: ColumnConfig<T>[] = [];
  let runStart = 0;

  columns.forEach((col, idx) => {
    const g = col.group;
    if (!g) {
      if (run.length === 0) runStart = idx;
      run.push(col);
      return;
    }
    // Close any pending implicit run
    if (run.length) {
      pushImplicit(runStart, run.slice());
      run = [];
    }
    const id = typeof g === 'string' ? g : g.id;
    const rawLabel = typeof g === 'string' ? undefined : g.label;

    // Track labels: first column to define a label for this group id wins
    if (rawLabel && !labelMap.has(id)) {
      labelMap.set(id, rawLabel);
    }
    const label = labelMap.get(id) ?? rawLabel;

    // Extend the last group if it has the same id (contiguous run)
    const last = groupsOrdered[groupsOrdered.length - 1];
    if (last && !last.implicit && last.id === id) {
      last.columns.push(col);
    } else {
      // New group or new fragment (same id but non-contiguous)
      groupsOrdered.push({
        id,
        label,
        columns: [col],
        firstIndex: idx,
      });
    }
  });

  // Trailing implicit run
  if (run.length) pushImplicit(runStart, run);

  // If we only have a single implicit group covering all columns, treat as no groups
  if (groupsOrdered.length === 1 && groupsOrdered[0].implicit && groupsOrdered[0].columns.length === columns.length) {
    return [];
  }

  return groupsOrdered as ColumnGroup<T>[];
}

/**
 * Merge column groups into their final form for rendering:
 * identifies embedded implicit groups and collapses adjacent same-ID fragments.
 *
 * Call once per render and pass the result to both `buildGroupHeaderRow` and
 * `applyGroupedHeaderCellClasses` to avoid redundant computation.
 */
export function mergeGroups<T>(groups: ColumnGroup<T>[]): { merged: ColumnGroup<T>[]; embedded: Set<string> } {
  const embedded = findEmbeddedImplicitGroups(groups);
  const merged = mergeAdjacentSameIdGroups(groups, embedded);
  return { merged, embedded };
}

/**
 * Apply CSS classes to header cells based on their group membership.
 *
 * @param headerRowEl - The header row element
 * @param groups - The computed column groups (raw, before merging)
 * @param columns - The column configurations
 * @param precomputed - Optional pre-computed merged groups (avoids redundant merge)
 */
export function applyGroupedHeaderCellClasses(
  headerRowEl: HTMLElement | null,
  groups: ColumnGroup[],
  columns: ColumnConfig[],
  precomputed?: { merged: ColumnGroup[]; embedded: Set<string> },
): void {
  if (!groups.length || !headerRowEl) return;

  const { merged: mergedGroups, embedded } = precomputed ?? mergeGroups(groups);

  const fieldToGroup = new Map<string, string>();
  for (const g of mergedGroups) {
    if (String(g.id).startsWith('__implicit__')) continue;
    for (const c of g.columns) {
      if (c.field) {
        fieldToGroup.set(c.field, g.id);
      }
    }
  }

  // Also map embedded implicit columns to their enclosing explicit group
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (!String(g.id).startsWith('__implicit__') || !embedded.has(String(g.id))) continue;
    // Find nearest explicit group before this implicit — that's the enclosing group
    for (let b = i - 1; b >= 0; b--) {
      if (!String(groups[b].id).startsWith('__implicit__')) {
        for (const c of g.columns) {
          if (c.field) fieldToGroup.set(c.field, groups[b].id);
        }
        break;
      }
    }
  }

  const headerCells = Array.from(headerRowEl.querySelectorAll('.cell[data-field]')) as HTMLElement[];
  headerCells.forEach((cell) => {
    const f = cell.getAttribute('data-field') || '';
    const gid = fieldToGroup.get(f);
    if (gid) {
      cell.classList.add('grouped');
      if (!cell.getAttribute('data-group')) {
        cell.setAttribute('data-group', gid);
      }
    }
  });

  // Mark group end cells for styling using merged groups (including implicit groups).
  // CSS :last-child rules suppress the border on the very last cell, so we mark all groups.
  for (const g of mergedGroups) {
    const last = g.columns[g.columns.length - 1];
    const cell = headerCells.find((c) => c.getAttribute('data-field') === last.field);
    if (cell) cell.classList.add('group-end');
  }
}

/**
 * Compute the grid range [start, end] for a group based on its first and last
 * column positions in the final columns array.
 */
function computeGroupGridRange(group: ColumnGroup, columns: ColumnConfig[]): [number, number] | null {
  const first = group.columns[0];
  const last = group.columns[group.columns.length - 1];
  const start = first ? columns.findIndex((c) => c.field === first.field) : -1;
  const end = last ? columns.findIndex((c) => c.field === last.field) : -1;
  return start !== -1 && end !== -1 ? [start, end] : null;
}

/**
 * Find implicit groups that are sandwiched between two fragments of the same
 * explicit group (e.g. a utility column inserted between members of the same group).
 *
 * Only implicit groups whose columns are **all** internal/utility fields (prefixed
 * with `__tbw_`) qualify.  When a regular data column sits between two fragments
 * of the same group it represents a genuine break introduced by column reordering
 * and must NOT be absorbed.
 *
 * @returns Set of implicit group IDs that are visually embedded.
 */
export function findEmbeddedImplicitGroups(groups: ColumnGroup[]): Set<string> {
  const embedded = new Set<string>();

  for (let i = 0; i < groups.length; i++) {
    if (!String(groups[i].id).startsWith('__implicit__')) continue;

    // Only absorb implicit groups that contain exclusively utility columns.
    // Data columns (user-visible fields) must always get their own header space.
    const allUtility = groups[i].columns.every((c) => c.field?.startsWith('__tbw_'));
    if (!allUtility) continue;

    // Find nearest explicit group before this implicit group
    let beforeId: string | null = null;
    for (let b = i - 1; b >= 0; b--) {
      if (!String(groups[b].id).startsWith('__implicit__')) {
        beforeId = groups[b].id;
        break;
      }
    }

    // Find nearest explicit group after this implicit group
    let afterId: string | null = null;
    for (let a = i + 1; a < groups.length; a++) {
      if (!String(groups[a].id).startsWith('__implicit__')) {
        afterId = groups[a].id;
        break;
      }
    }

    // Embedded if sandwiched between two fragments of the same group
    if (beforeId && afterId && beforeId === afterId) {
      embedded.add(String(groups[i].id));
    }
  }

  return embedded;
}

/**
 * Merge adjacent same-ID group fragments after removing embedded implicit groups.
 * This produces the final group list for header rendering, where utility columns
 * (checkbox, expander) are absorbed into the surrounding group's span.
 *
 * @param groups - The computed column groups (potentially fragmented)
 * @param embedded - Set of embedded implicit group IDs to skip
 * @returns Merged group list where same-ID fragments separated by embedded implicits are combined
 */
export function mergeAdjacentSameIdGroups<T>(groups: ColumnGroup<T>[], embedded: Set<string>): ColumnGroup<T>[] {
  const result: ColumnGroup<T>[] = [];
  for (const g of groups) {
    // Skip embedded implicit groups — they get absorbed into the surrounding fragment
    if (String(g.id).startsWith('__implicit__') && embedded.has(String(g.id))) continue;

    const prev = result[result.length - 1];
    if (prev && !String(g.id).startsWith('__implicit__') && prev.id === g.id) {
      // Merge with previous same-ID group
      result[result.length - 1] = {
        ...prev,
        columns: [...prev.columns, ...g.columns],
      };
    } else {
      result.push({ ...g, columns: [...g.columns] });
    }
  }
  return result;
}

/**
 * Build the group header row element.
 *
 * @param groups - The computed column groups
 * @param columns - The column configurations (final array including any plugin-added columns)
 * @param renderer - Optional custom group header renderer
 * @param precomputed - Optional pre-computed merged groups (avoids redundant merge)
 * @returns The group header row element, or null if no groups
 */
export function buildGroupHeaderRow(
  groups: ColumnGroup[],
  columns: ColumnConfig[],
  renderer?: GroupingColumnsConfig['groupHeaderRenderer'],
  precomputed?: { merged: ColumnGroup[]; embedded: Set<string> },
): HTMLElement | null {
  if (groups.length === 0) return null;

  const groupRow = document.createElement('div');
  groupRow.className = 'header-group-row';
  groupRow.setAttribute('role', 'row');

  const { merged: mergedGroups } = precomputed ?? mergeGroups(groups);

  for (const g of mergedGroups) {
    const gid = String(g.id);
    const isImplicit = gid.startsWith('__implicit__');

    // Compute actual range from first to last member in the final columns array.
    // This correctly spans over any interleaved utility columns (e.g. checkbox).
    const range = computeGroupGridRange(g, columns);
    if (!range) continue;
    const [startIndex, endIndex] = range;
    const span = endIndex - startIndex + 1;

    const label = isImplicit ? '' : g.label || g.id;

    const cell = document.createElement('div');
    cell.className = 'cell header-group-cell';
    if (isImplicit) cell.classList.add('implicit-group');
    cell.setAttribute('data-group', gid);
    cell.style.gridColumn = `${startIndex + 1} / span ${span}`;

    // Apply per-group renderer → fallback renderer → plain text label
    const activeRenderer = (!isImplicit && (g.renderer || renderer)) || undefined;
    if (activeRenderer && !isImplicit) {
      const params: GroupHeaderRenderParams = {
        id: gid,
        label: String(label),
        columns: g.columns as ColumnConfig[],
        firstIndex: startIndex,
        isImplicit: false,
      };
      const result = activeRenderer(params);
      if (result instanceof HTMLElement) {
        cell.appendChild(result);
      } else if (typeof result === 'string') {
        cell.innerHTML = result;
      } else {
        cell.textContent = label;
      }
    } else {
      // Always use textContent for non-rendered labels to prevent HTML injection
      cell.textContent = label;
    }

    groupRow.appendChild(cell);
  }

  return groupRow;
}

/**
 * Check if any columns have group configuration.
 *
 * @param columns - The column configurations
 * @returns True if at least one column has a group
 */
export function hasColumnGroups(columns: ColumnConfig[]): boolean {
  return columns.some((col) => col.group != null);
}

/**
 * Get group ID for a specific column.
 *
 * @param column - The column configuration
 * @returns The group ID, or undefined if not grouped
 */
export function getColumnGroupId(column: ColumnConfig): string | undefined {
  const g = column.group;
  if (!g) return undefined;
  return typeof g === 'string' ? g : g.id;
}
