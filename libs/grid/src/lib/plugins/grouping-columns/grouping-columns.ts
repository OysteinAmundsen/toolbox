/**
 * Column Groups Core Logic
 *
 * Pure functions for computing and managing column header groups.
 */

// Import types to enable module augmentation
import type { ColumnConfig } from '../../core/types';
import './types';
import type { ColumnGroup, ColumnGroupInternal } from './types';

/**
 * Compute column groups from column configuration.
 * Handles explicit groups (via column.group) and creates implicit groups for ungrouped columns.
 *
 * @param columns - Array of column configurations
 * @returns Array of column groups, or empty if no meaningful groups
 */
export function computeColumnGroups<T>(columns: ColumnConfig<T>[]): ColumnGroup<T>[] {
  if (!columns.length) return [];

  const explicitMap = new Map<string, ColumnGroupInternal<T>>();
  const groupsOrdered: ColumnGroupInternal<T>[] = [];

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
    let group = explicitMap.get(id);
    if (!group) {
      group = {
        id,
        label: typeof g === 'string' ? undefined : g.label,
        columns: [],
        firstIndex: idx,
      };
      explicitMap.set(id, group);
      groupsOrdered.push(group);
    }
    group.columns.push(col);
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
 * Apply CSS classes to header cells based on their group membership.
 *
 * @param headerRowEl - The header row element
 * @param groups - The computed column groups
 * @param columns - The column configurations
 */
export function applyGroupedHeaderCellClasses(
  headerRowEl: HTMLElement | null,
  groups: ColumnGroup[],
  columns: ColumnConfig[],
): void {
  if (!groups.length || !headerRowEl) return;

  const fieldToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const c of g.columns) {
      if (c.field) {
        fieldToGroup.set(c.field, g.id);
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

  // Mark group end cells for styling
  for (const g of groups) {
    const last = g.columns[g.columns.length - 1];
    const cell = headerCells.find((c) => c.getAttribute('data-field') === last.field);
    if (cell) cell.classList.add('group-end');
  }
}

/**
 * Build the group header row element.
 *
 * @param groups - The computed column groups
 * @param columns - The column configurations (final array including any plugin-added columns)
 * @returns The group header row element, or null if no groups
 */
export function buildGroupHeaderRow(groups: ColumnGroup[], columns: ColumnConfig[]): HTMLElement | null {
  if (groups.length === 0) return null;

  const groupRow = document.createElement('div');
  groupRow.className = 'header-group-row';
  groupRow.setAttribute('role', 'row');

  for (const g of groups) {
    // Always compute start index from the current columns array, not stored firstIndex.
    // This accounts for plugin-added columns (e.g., expander) that weren't present
    // when the groups were initially computed during processColumns.
    const firstGroupCol = g.columns[0];
    const startIndex = firstGroupCol ? columns.findIndex((c) => c.field === firstGroupCol.field) : -1;
    if (startIndex === -1) continue; // Group columns not in final column list

    const isImplicit = String(g.id).startsWith('__implicit__');
    const label = isImplicit ? '' : g.label || g.id;

    const cell = document.createElement('div');
    cell.className = 'cell header-group-cell';
    if (isImplicit) cell.classList.add('implicit-group');
    cell.setAttribute('data-group', String(g.id));
    cell.style.gridColumn = `${startIndex + 1} / span ${g.columns.length}`;
    cell.textContent = label;
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
