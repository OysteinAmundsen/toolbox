/**
 * Column Visibility Plugin (Class-based)
 *
 * Provides a UI for column visibility control via the shell's tool panel system.
 * Column visibility is a core grid feature - this plugin provides:
 * - A tool panel for column visibility management (registered with the shell)
 * - Backward-compatible API methods that delegate to grid.setColumnVisible(), etc.
 *
 * The grid emits 'column-visibility' events when columns are shown/hidden,
 * allowing consumers to save user preferences.
 *
 * When a reorder plugin is present, column rows become draggable for reordering.
 * Drag-drop emits 'column-reorder-request' events that the ReorderPlugin can listen for.
 */

import { GridClasses } from '../../core/constants';
import {
  BaseGridPlugin,
  type PluginDependency,
  type PluginManifest,
  type PluginQuery,
} from '../../core/plugin/base-plugin';
import type { ColumnConfig, ToolPanelDefinition } from '../../core/types';
import type { ContextMenuParams, HeaderContextMenuItem } from '../context-menu/types';
import type { ColumnGroupInfo, VisibilityConfig } from './types';
import styles from './visibility.css?inline';

/** Column metadata shape returned by `grid.getAllColumns()`. */
type ColumnEntry = { field: string; header: string; visible: boolean; lockVisible?: boolean; utility?: boolean };

/**
 * Detail for column-reorder-request events emitted when users drag-drop in the visibility panel.
 */
export interface ColumnReorderRequestDetail {
  /** The field name of the column to move */
  field: string;
  /** The source index (before move) */
  fromIndex: number;
  /** The target index (after move) */
  toIndex: number;
}

/**
 * Check if a column can be moved (respects lockPosition/suppressMovable).
 * Inlined to avoid importing from reorder plugin.
 */
function canMoveColumn(column: ColumnConfig): boolean {
  const meta = column.meta ?? {};
  return meta.lockPosition !== true && meta.suppressMovable !== true;
}

/**
 * Column Visibility Plugin for tbw-grid
 *
 * Gives users control over which columns are displayed. Hide less important columns
 * by default, let users toggle them via a column chooser UI, or programmatically
 * show/hide columns based on user preferences or screen size.
 *
 * > **Optional Enhancement:** When ReorderPlugin is also loaded, columns in the
 * > visibility panel become draggable for reordering.
 *
 * ## Installation
 *
 * ```ts
 * import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
 * ```
 *
 * ## Column Configuration
 *
 * | Property | Type | Default | Description |
 * |----------|------|---------|-------------|
 * | `visible` | `boolean` | `true` | Initial visibility state |
 * | `meta.lockVisibility` | `boolean` | `false` | Prevent user from toggling |
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-visibility-hover` | `var(--tbw-color-row-hover)` | Row hover background |
 * | `--tbw-panel-padding` | `0.75em` | Panel content padding |
 * | `--tbw-panel-gap` | `0.5em` | Gap between items |
 *
 * @example Columns Hidden by Default
 * ```ts
 * import { queryGrid } from '@toolbox-web/grid';
 * import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
 *
 * const grid = queryGrid('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'id', header: 'ID' },
 *     { field: 'name', header: 'Name' },
 *     { field: 'phone', header: 'Phone', visible: false }, // Hidden by default
 *     { field: 'address', header: 'Address', visible: false },
 *   ],
 *   plugins: [new VisibilityPlugin()],
 * };
 *
 * // Toggle programmatically
 * const plugin = grid.getPluginByName('visibility');
 * plugin.showColumn('phone');
 * ```
 *
 * @example With Drag-to-Reorder
 * ```ts
 * import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
 * import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder-columns';
 *
 * grid.gridConfig = {
 *   plugins: [
 *     new ReorderPlugin(),      // Enables drag-drop in visibility panel
 *     new VisibilityPlugin(),
 *   ],
 * };
 * ```
 *
 * @see {@link VisibilityConfig} for configuration options
 * @see ReorderPlugin for drag-to-reorder integration
 *
 * @internal Extends BaseGridPlugin
 */
export class VisibilityPlugin extends BaseGridPlugin<VisibilityConfig> {
  /**
   * Plugin dependencies - VisibilityPlugin optionally uses ReorderPlugin for drag-drop reordering.
   *
   * When ReorderPlugin is present, columns in the visibility panel become draggable.
   * @internal
   */
  static override readonly dependencies: PluginDependency[] = [
    { name: 'reorder', required: false, reason: 'Enables drag-to-reorder columns in visibility panel' },
  ];

  /**
   * Plugin manifest - declares handled queries.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    queries: [
      {
        type: 'getContextMenuItems',
        description: 'Contributes "Hide column" item to the header context menu',
      },
    ],
  };

  /** @internal */
  readonly name = 'visibility';

  /** Tool panel ID for shell integration */
  static readonly PANEL_ID = 'columns';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<VisibilityConfig> {
    return {
      allowHideAll: false,
    };
  }

  // #region Internal State
  private columnListElement: HTMLElement | null = null;

  // Drag state for reorder integration
  private isDragging = false;
  private draggedField: string | null = null;
  private draggedIndex: number | null = null;
  private dropIndex: number | null = null;
  /** When dragging a group, holds the group ID; null for individual column drags. */
  private draggedGroupId: string | null = null;
  /** Fields belonging to the group currently being dragged. */
  private draggedGroupFields: string[] = [];

  /** Clear drag-related classes from all rows and group headers in a list. */
  private clearDragClasses(container: HTMLElement): void {
    container.querySelectorAll('.tbw-visibility-row, .tbw-visibility-group-header').forEach((r) => {
      r.classList.remove(GridClasses.DRAGGING, 'drop-target', 'drop-before', 'drop-after');
    });
  }
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Listen for column-move events (emitted by ReorderPlugin after any reorder,
    // including header drag-drop and visibility panel drag-drop) to keep the
    // panel list in sync with the grid's column order.
    this.gridElement.addEventListener(
      'column-move',
      () => {
        if (this.columnListElement) {
          // column-move fires BEFORE setColumnOrder runs. Defer the rebuild
          // to allow the full reorder cycle (setColumnOrder + renderHeader +
          // refreshVirtualWindow) to complete before reading the new order.
          // Use RAF to run after the current synchronous work and any
          // animation frames queued by the animation system.
          requestAnimationFrame(() => {
            if (this.columnListElement) {
              this.rebuildToggles(this.columnListElement);
            }
          });
        }
      },
      { signal: this.disconnectSignal },
    );
  }

  /** @internal */
  override detach(): void {
    this.columnListElement = null;
    this.isDragging = false;
    this.draggedField = null;
    this.draggedIndex = null;
    this.dropIndex = null;
  }
  // #endregion

  // #region Query Handlers

  /**
   * Handle inter-plugin queries.
   * Contributes a "Hide column" item to the header context menu.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'getContextMenuItems') {
      const params = query.context as ContextMenuParams;
      if (!params.isHeader) return undefined;

      const column = params.column as ColumnConfig;
      if (!column?.field) return undefined;

      // Don't offer "Hide" for locked-visibility columns
      if (column.meta?.lockVisibility) return undefined;

      const items: HeaderContextMenuItem[] = [
        {
          id: 'visibility/hide-column',
          label: 'Hide Column',
          icon: '👁',
          order: 30,
          action: () => this.hideColumn(column.field),
        },
      ];

      return items;
    }
    return undefined;
  }
  // #endregion

  // #region Shell Integration

  /**
   * Register the column visibility tool panel with the shell.
   * @internal
   */
  override getToolPanel(): ToolPanelDefinition | undefined {
    return {
      id: VisibilityPlugin.PANEL_ID,
      title: 'Columns',
      icon: '☰',
      tooltip: 'Column visibility',
      order: 100, // High order so it appears last
      render: (container) => this.renderPanelContent(container),
    };
  }
  // #endregion

  // #region Public API

  /**
   * Show the visibility sidebar panel.
   * Opens the tool panel and ensures this section is expanded.
   */
  show(): void {
    this.grid.openToolPanel();
    // Ensure our section is expanded
    if (!this.grid.expandedToolPanelSections.includes(VisibilityPlugin.PANEL_ID)) {
      this.grid.toggleToolPanelSection(VisibilityPlugin.PANEL_ID);
    }
  }

  /**
   * Hide the visibility sidebar panel.
   */
  hide(): void {
    this.grid.closeToolPanel();
  }

  /**
   * Toggle the visibility sidebar panel section.
   */
  toggle(): void {
    // If tool panel is closed, open it first
    if (!this.grid.isToolPanelOpen) {
      this.grid.openToolPanel();
    }
    this.grid.toggleToolPanelSection(VisibilityPlugin.PANEL_ID);
  }

  /**
   * Check if a specific column is visible.
   * Delegates to grid.isColumnVisible().
   * @param field - The field name to check
   * @returns True if the column is visible
   */
  isColumnVisible(field: string): boolean {
    return this.grid.isColumnVisible(field);
  }

  /**
   * Set visibility for a specific column.
   * Delegates to grid.setColumnVisible().
   * @param field - The field name of the column
   * @param visible - Whether the column should be visible
   */
  setColumnVisible(field: string, visible: boolean): void {
    this.grid.setColumnVisible(field, visible);
  }

  /**
   * Get list of all visible column fields.
   * @returns Array of visible field names
   */
  getVisibleColumns(): string[] {
    return this.grid
      .getAllColumns()
      .filter((c) => c.visible)
      .map((c) => c.field);
  }

  /**
   * Get list of all hidden column fields.
   * @returns Array of hidden field names
   */
  getHiddenColumns(): string[] {
    return this.grid
      .getAllColumns()
      .filter((c) => !c.visible)
      .map((c) => c.field);
  }

  /**
   * Show all columns.
   * Delegates to grid.showAllColumns().
   */
  showAll(): void {
    this.grid.showAllColumns();
  }

  /**
   * Toggle visibility for a specific column.
   * Delegates to grid.toggleColumnVisibility().
   * @param field - The field name of the column
   */
  toggleColumn(field: string): void {
    this.grid.toggleColumnVisibility(field);
  }

  /**
   * Show a specific column.
   * Delegates to grid.setColumnVisible().
   * @param field - The field name of the column to show
   */
  showColumn(field: string): void {
    this.setColumnVisible(field, true);
  }

  /**
   * Hide a specific column.
   * Delegates to grid.setColumnVisible().
   * @param field - The field name of the column to hide
   */
  hideColumn(field: string): void {
    this.setColumnVisible(field, false);
  }

  /**
   * Get all columns with their visibility status.
   * Useful for building visibility UI.
   * @returns Array of column info with visibility status
   */
  getAllColumns(): Array<{
    field: string;
    header: string;
    visible: boolean;
    lockVisible?: boolean;
    utility?: boolean;
  }> {
    return this.grid.getAllColumns();
  }

  /**
   * Check if the sidebar panel is currently open.
   * @returns True if the panel section is expanded
   */
  isPanelVisible(): boolean {
    return this.grid.isToolPanelOpen && this.grid.expandedToolPanelSections.includes(VisibilityPlugin.PANEL_ID);
  }
  // #endregion

  // #region Private Methods

  /**
   * Render the panel content into the shell's tool panel container.
   * Returns a cleanup function.
   */
  private renderPanelContent(container: HTMLElement): (() => void) | void {
    // Create content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'tbw-visibility-content';

    // Column list container
    const columnList = document.createElement('div');
    columnList.className = 'tbw-visibility-list';
    wrapper.appendChild(columnList);

    // Show all button
    const showAllBtn = document.createElement('button');
    showAllBtn.className = 'tbw-visibility-show-all';
    showAllBtn.textContent = 'Show All';
    showAllBtn.addEventListener('click', () => {
      this.grid.showAllColumns();
      this.rebuildToggles(columnList);
    });
    wrapper.appendChild(showAllBtn);

    // Store reference
    this.columnListElement = columnList;

    // Build initial toggles
    this.rebuildToggles(columnList);

    // Append to container
    container.appendChild(wrapper);

    // Return cleanup function
    return () => {
      this.columnListElement = null;
      wrapper.remove();
    };
  }

  /**
   * Check if a reorder plugin is present (by name to avoid static import).
   */
  private hasReorderPlugin(): boolean {
    const plugin = this.grid?.getPluginByName?.('reorder');
    // Duck-type check - just verify the plugin exists and has a moveColumn method
    return !!(plugin && typeof (plugin as { moveColumn?: unknown }).moveColumn === 'function');
  }

  /**
   * Build the column toggle checkboxes.
   * When GroupingColumnsPlugin is present, renders columns under collapsible group headers.
   * Groups that are fragmented (same group split across non-contiguous positions) are
   * shown as separate sections to match the grid's visual layout.
   * When a reorder plugin is present, adds drag handles for reordering.
   */
  private rebuildToggles(columnList: HTMLElement): void {
    const reorderEnabled = this.hasReorderPlugin();

    columnList.innerHTML = '';

    // getAllColumns() returns columns in their effective display order
    // Filter out utility columns (e.g., expander column) as they're internal
    const allColumns = this.grid.getAllColumns().filter((c) => !c.utility);

    // Query for column grouping info from GroupingColumnsPlugin (or any responder)
    const groupResults = this.grid.query<ColumnGroupInfo[]>('getColumnGrouping');
    const groups: ColumnGroupInfo[] = groupResults?.flat().filter((g) => g && g.fields.length > 0) ?? [];

    if (groups.length === 0) {
      // No grouping — render flat list (original behavior)
      this.renderFlatColumnList(allColumns, reorderEnabled, columnList);
      return;
    }

    // Build field → group lookup (field name → group membership info)
    const fieldToGroup = new Map<string, ColumnGroupInfo>();
    for (const group of groups) {
      for (const field of group.fields) fieldToGroup.set(field, group);
    }

    // Walk columns in display order and detect contiguous fragments.
    // A fragment is a run of consecutive columns belonging to the same group.
    // Fragmented groups (same group ID at non-contiguous positions) produce
    // separate sections so the panel matches the grid's visual layout.
    const fragments = this.computeFragments(allColumns, fieldToGroup);

    for (const fragment of fragments) {
      if (fragment.group) {
        this.renderGroupSection(fragment.group, fragment.columns, reorderEnabled, columnList);
      } else {
        // Ungrouped column — render as individual row
        const fullIndex = allColumns.indexOf(fragment.columns[0]);
        columnList.appendChild(this.createColumnRow(fragment.columns[0], fullIndex, reorderEnabled, columnList));
      }
    }
  }

  /**
   * Compute contiguous column fragments from display-order columns.
   * Each fragment is either a group section (contiguous run of same-group columns)
   * or a single ungrouped column.
   */
  private computeFragments(
    allColumns: ColumnEntry[],
    fieldToGroup: Map<string, ColumnGroupInfo>,
  ): Array<{ group: ColumnGroupInfo | null; columns: ColumnEntry[] }> {
    const fragments: Array<{ group: ColumnGroupInfo | null; columns: ColumnEntry[] }> = [];
    let currentGroup: ColumnGroupInfo | null = null;
    let currentCols: ColumnEntry[] = [];

    for (const col of allColumns) {
      const group = fieldToGroup.get(col.field) ?? null;

      if (group && currentGroup && group.id === currentGroup.id) {
        // Same group continues — extend fragment
        currentCols.push(col);
      } else {
        // Flush previous fragment
        if (currentCols.length > 0) {
          fragments.push({ group: currentGroup, columns: currentCols });
        }
        currentGroup = group;
        currentCols = [col];
      }
    }
    // Flush last fragment
    if (currentCols.length > 0) {
      fragments.push({ group: currentGroup, columns: currentCols });
    }

    return fragments;
  }

  /**
   * Render a group fragment section with header checkbox and indented column rows.
   * A fragment is a contiguous run of columns from the same group. When a group is
   * fragmented (split across non-contiguous positions), each fragment gets its own section.
   */
  private renderGroupSection(
    group: ColumnGroupInfo,
    columns: ColumnEntry[],
    reorderEnabled: boolean,
    container: HTMLElement,
  ): void {
    // The fragment's fields — only the columns in this contiguous section
    const fragmentFields = columns.map((c) => c.field);

    // Group header row
    const header = document.createElement('div');
    header.className = 'tbw-visibility-group-header';
    header.setAttribute('data-group-id', group.id);

    // Make group header draggable when reorder is enabled.
    // Pass only this fragment's fields so dragging moves just this
    // contiguous block, not all columns of the (possibly fragmented) group.
    if (reorderEnabled) {
      header.draggable = true;
      header.classList.add('reorderable');
      this.setupGroupDragListeners(header, group, fragmentFields, container);
    }

    const headerLabel = document.createElement('label');
    headerLabel.className = 'tbw-visibility-label';

    const groupCheckbox = document.createElement('input');
    groupCheckbox.type = 'checkbox';

    // Calculate tri-state: all visible, all hidden, or mixed
    const visibleCount = columns.filter((c) => c.visible).length;
    const allLocked = columns.every((c) => c.lockVisible);
    if (visibleCount === columns.length) {
      groupCheckbox.checked = true;
      groupCheckbox.indeterminate = false;
    } else if (visibleCount === 0) {
      groupCheckbox.checked = false;
      groupCheckbox.indeterminate = false;
    } else {
      groupCheckbox.checked = false;
      groupCheckbox.indeterminate = true;
    }
    groupCheckbox.disabled = allLocked;

    // Toggle all columns in group
    groupCheckbox.addEventListener('change', () => {
      const newVisible = groupCheckbox.checked;
      for (const col of columns) {
        if (col.lockVisible) continue;
        this.grid.setColumnVisible(col.field, newVisible);
      }
      setTimeout(() => this.rebuildToggles(container), 0);
    });

    const headerText = document.createElement('span');
    headerText.textContent = group.label;

    headerLabel.appendChild(groupCheckbox);
    headerLabel.appendChild(headerText);
    header.appendChild(headerLabel);

    // Add drag handle icon for group if reorderable
    if (reorderEnabled) {
      const handle = document.createElement('span');
      handle.className = 'tbw-visibility-handle';
      this.setIcon(handle, 'dragHandle');
      handle.title = 'Drag to reorder group';
      // Insert handle before the label
      header.insertBefore(handle, headerLabel);
    }

    container.appendChild(header);

    // Render indented column rows
    const allColumnsFullList = this.grid.getAllColumns().filter((c) => !c.utility);
    for (const col of columns) {
      const fullIndex = allColumnsFullList.findIndex((c) => c.field === col.field);
      const row = this.createColumnRow(col, fullIndex, reorderEnabled, container);
      row.classList.add('tbw-visibility-row--grouped');
      container.appendChild(row);
    }
  }

  /**
   * Render a flat (ungrouped) list of column rows.
   */
  private renderFlatColumnList(columns: ColumnEntry[], reorderEnabled: boolean, container: HTMLElement): void {
    const allColumnsFullList = this.grid.getAllColumns().filter((c) => !c.utility);
    for (const col of columns) {
      const fullIndex = allColumnsFullList.findIndex((c) => c.field === col.field);
      container.appendChild(this.createColumnRow(col, fullIndex, reorderEnabled, container));
    }
  }

  /**
   * Create a single column visibility row element.
   */
  private createColumnRow(
    col: ColumnEntry,
    index: number,
    reorderEnabled: boolean,
    columnList: HTMLElement,
  ): HTMLElement {
    const label = col.header || col.field;

    const row = document.createElement('div');
    row.className = col.lockVisible ? 'tbw-visibility-row locked' : 'tbw-visibility-row';
    row.setAttribute('data-field', col.field);
    row.setAttribute('data-index', String(index));

    // Add drag handle if reorder is enabled
    if (reorderEnabled && canMoveColumn(col)) {
      row.draggable = true;
      row.classList.add('reorderable');
      this.setupDragListeners(row, col.field, index, columnList);
    }

    const labelWrapper = document.createElement('label');
    labelWrapper.className = 'tbw-visibility-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = col.visible;
    checkbox.disabled = col.lockVisible ?? false;
    checkbox.addEventListener('change', () => {
      this.grid.toggleColumnVisibility(col.field);
      // Refresh after toggle (grid may re-render)
      setTimeout(() => this.rebuildToggles(columnList), 0);
    });

    const text = document.createElement('span');
    text.textContent = label;

    labelWrapper.appendChild(checkbox);
    labelWrapper.appendChild(text);

    // Add drag handle icon if reorderable
    if (reorderEnabled && canMoveColumn(col)) {
      const handle = document.createElement('span');
      handle.className = 'tbw-visibility-handle';
      this.setIcon(handle, 'dragHandle');
      handle.title = 'Drag to reorder';
      row.appendChild(handle);
    }

    row.appendChild(labelWrapper);
    return row;
  }

  /**
   * Set up drag-and-drop listeners for a group header row.
   * Dragging a group fragment moves only the columns in that fragment as a block.
   * When a group is fragmented, each fragment header drags independently.
   */
  private setupGroupDragListeners(
    header: HTMLElement,
    group: ColumnGroupInfo,
    fragmentFields: string[],
    columnList: HTMLElement,
  ): void {
    header.addEventListener('dragstart', (e: DragEvent) => {
      this.isDragging = true;
      this.draggedGroupId = group.id;
      this.draggedGroupFields = [...fragmentFields];
      // Use first field as representative for dataTransfer
      this.draggedField = null;
      this.draggedIndex = null;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `group:${group.id}`);
      }

      // Mark entire group (header + children) as dragging
      header.classList.add(GridClasses.DRAGGING);
      columnList.querySelectorAll(`.tbw-visibility-row--grouped`).forEach((row) => {
        const field = row.getAttribute('data-field');
        if (field && this.draggedGroupFields.includes(field)) {
          row.classList.add(GridClasses.DRAGGING);
        }
      });
    });

    header.addEventListener('dragend', () => {
      this.isDragging = false;
      this.draggedGroupId = null;
      this.draggedGroupFields = [];
      this.draggedField = null;
      this.draggedIndex = null;
      this.dropIndex = null;
      this.clearDragClasses(columnList);
    });

    // Group headers are also drop targets for other groups (or other fragments of the same group)
    header.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!this.isDragging) return;
      // Can't drop onto the same fragment (same exact fields)
      if (
        this.draggedGroupFields.length === fragmentFields.length &&
        this.draggedGroupFields.every((f) => fragmentFields.includes(f))
      )
        return;
      // Can't drop individual columns onto group headers
      if (!this.draggedGroupId) return;

      const rect = header.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const before = e.clientY < midY;

      this.clearDragClasses(columnList);
      header.classList.add('drop-target');
      header.classList.toggle('drop-before', before);
      header.classList.toggle('drop-after', !before);
    });

    header.addEventListener('dragleave', () => {
      header.classList.remove('drop-target', 'drop-before', 'drop-after');
    });

    header.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      if (!this.isDragging || !this.draggedGroupId) return;
      // Can't drop onto the same fragment
      if (
        this.draggedGroupFields.length === fragmentFields.length &&
        this.draggedGroupFields.every((f) => fragmentFields.includes(f))
      )
        return;

      const rect = header.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;

      this.executeGroupDrop(this.draggedGroupFields, fragmentFields, before);
    });
  }

  /**
   * Execute a group drop — move the dragged fragment's fields as a block
   * to the position relative to the target group/column.
   * Routes through the ReorderPlugin when available for proper animation and
   * full render cycle, otherwise falls back to direct grid.setColumnOrder().
   */
  private executeGroupDrop(draggedFields: string[], targetFields: string[], before: boolean): void {
    const allColumns = this.grid.getAllColumns();
    const currentOrder = allColumns.map((c) => c.field);

    // Remove dragged fields from current order
    const remaining = currentOrder.filter((f) => !draggedFields.includes(f));

    // Find insertion point relative to target
    // Use the first field of target group if inserting before, last if after
    const anchorField = before ? targetFields[0] : targetFields[targetFields.length - 1];
    const insertAt = remaining.indexOf(anchorField);
    if (insertAt === -1) return;

    // Insert the dragged group block at the correct position
    const insertIndex = before ? insertAt : insertAt + 1;

    // Preserve the dragged fields' original relative order
    const draggedInOrder = currentOrder.filter((f) => draggedFields.includes(f));
    remaining.splice(insertIndex, 0, ...draggedInOrder);

    // Route through ReorderPlugin.setColumnOrder when available and attached —
    // this calls updateColumnOrder which handles animation and forceLayout for
    // proper body cell rebuilds. Fall back to direct grid.setColumnOrder otherwise.
    const reorderPlugin = this.grid.getPluginByName?.('reorder') as
      | { setColumnOrder?: (o: string[]) => void; gridElement?: unknown }
      | undefined;
    if (reorderPlugin?.setColumnOrder && reorderPlugin.gridElement) {
      reorderPlugin.setColumnOrder(remaining);
    } else {
      this.grid.setColumnOrder(remaining);
    }

    // Panel rebuild is handled by the column-move listener when ReorderPlugin
    // emits the event. For the direct fallback path, trigger manually.
    requestAnimationFrame(() => {
      if (this.columnListElement) {
        this.rebuildToggles(this.columnListElement);
      }
    });
  }

  /**
   * Set up drag-and-drop event listeners for a row.
   * On drop, emits a 'column-reorder-request' event for other plugins to handle.
   */
  private setupDragListeners(row: HTMLElement, field: string, index: number, columnList: HTMLElement): void {
    row.addEventListener('dragstart', (e: DragEvent) => {
      this.isDragging = true;
      this.draggedField = field;
      this.draggedIndex = index;
      // Clear any stale group drag state
      this.draggedGroupId = null;
      this.draggedGroupFields = [];

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', field);
      }

      row.classList.add(GridClasses.DRAGGING);
    });

    row.addEventListener('dragend', () => {
      this.isDragging = false;
      this.draggedField = null;
      this.draggedIndex = null;
      this.dropIndex = null;
      this.clearDragClasses(columnList);
    });

    row.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!this.isDragging) return;

      // If dragging a group, only allow drop on ungrouped rows
      if (this.draggedGroupId) {
        if (row.classList.contains('tbw-visibility-row--grouped')) return;
      } else if (this.draggedField === field) {
        return;
      }

      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      this.dropIndex = e.clientY < midY ? index : index + 1;

      // Clear other highlights
      this.clearDragClasses(columnList);
      // Re-mark dragged elements
      if (this.draggedGroupId) {
        columnList
          .querySelector(`.tbw-visibility-group-header[data-group-id="${this.draggedGroupId}"]`)
          ?.classList.add(GridClasses.DRAGGING);
        columnList.querySelectorAll('.tbw-visibility-row--grouped').forEach((r) => {
          const f = r.getAttribute('data-field');
          if (f && this.draggedGroupFields.includes(f)) r.classList.add(GridClasses.DRAGGING);
        });
      } else if (this.draggedField) {
        columnList
          .querySelector(`.tbw-visibility-row[data-field="${this.draggedField}"]`)
          ?.classList.add(GridClasses.DRAGGING);
      }

      row.classList.add('drop-target');
      row.classList.toggle('drop-before', e.clientY < midY);
      row.classList.toggle('drop-after', e.clientY >= midY);
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drop-target', 'drop-before', 'drop-after');
    });

    row.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();

      if (!this.isDragging) return;

      // Group drop onto an ungrouped row
      if (this.draggedGroupId && this.draggedGroupFields.length > 0) {
        if (row.classList.contains('tbw-visibility-row--grouped')) return;
        const rect = row.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        this.executeGroupDrop(this.draggedGroupFields, [field], before);
        return;
      }

      // Individual column drop
      const draggedField = this.draggedField;
      const draggedIndex = this.draggedIndex;
      const dropIndex = this.dropIndex;

      if (draggedField === null || draggedIndex === null || dropIndex === null) {
        return;
      }

      // Calculate the effective target index (in the filtered non-utility list)
      const effectiveToIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;

      if (effectiveToIndex !== draggedIndex) {
        // Convert from non-utility index to full column order index
        // by counting how many utility columns come before the target position
        const allColumns = this.grid.getAllColumns();
        const nonUtilityColumns = allColumns.filter((c) => !c.utility);

        // Find the target field at effectiveToIndex in non-utility list
        const targetField = nonUtilityColumns[effectiveToIndex]?.field;
        // Find its actual index in the full column order
        const fullOrderToIndex = targetField ? allColumns.findIndex((c) => c.field === targetField) : allColumns.length;

        // Emit a request event - other plugins (like ReorderPlugin) can listen and handle
        const detail: ColumnReorderRequestDetail = {
          field: draggedField,
          fromIndex: draggedIndex, // Not used by ReorderPlugin, just for info
          toIndex: fullOrderToIndex,
        };
        this.emit<ColumnReorderRequestDetail>('column-reorder-request', detail);
        // Panel rebuild is handled by the column-move listener in attach()
      }
    });
  }
  // #endregion
}
