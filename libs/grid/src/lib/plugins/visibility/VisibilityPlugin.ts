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

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig, ToolPanelDefinition } from '../../core/types';
import type { VisibilityConfig } from './types';

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

/** Extended grid interface with visibility methods */
interface GridWithVisibility {
  shadowRoot: ShadowRoot | null;
  getAllColumns(): Array<{ field: string; header: string; visible: boolean; lockVisible?: boolean }>;
  setColumnVisible(field: string, visible: boolean): void;
  toggleColumnVisibility(field: string): void;
  showAllColumns(): void;
  isColumnVisible(field: string): boolean;
  requestRender(): void;
  openToolPanel(id: string): void;
  closeToolPanel(): void;
  toggleToolPanel(id: string): void;
  activeToolPanel: string | undefined;
}

/**
 * Column Visibility Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new VisibilityPlugin({ enabled: true, allowHideAll: false })
 * ```
 */
export class VisibilityPlugin extends BaseGridPlugin<VisibilityConfig> {
  readonly name = 'visibility';
  override readonly version = '1.0.0';

  /** Tool panel ID for shell integration */
  static readonly PANEL_ID = 'columns';

  protected override get defaultConfig(): Partial<VisibilityConfig> {
    return {
      enabled: true,
      allowHideAll: false,
    };
  }

  // ===== Internal State =====
  private columnListElement: HTMLElement | null = null;

  // Drag state for reorder integration
  private isDragging = false;
  private draggedField: string | null = null;
  private draggedIndex: number | null = null;
  private dropIndex: number | null = null;

  // ===== Lifecycle =====

  override detach(): void {
    this.columnListElement = null;
    this.isDragging = false;
    this.draggedField = null;
    this.draggedIndex = null;
    this.dropIndex = null;
  }

  // ===== Shell Integration =====

  /**
   * Register the column visibility tool panel with the shell.
   */
  override getToolPanel(): ToolPanelDefinition | undefined {
    if (!this.config.enabled) return undefined;

    return {
      id: VisibilityPlugin.PANEL_ID,
      title: 'Columns',
      icon: '☰',
      tooltip: 'Column visibility',
      order: 100, // High order so it appears last
      render: (container) => this.renderPanelContent(container),
    };
  }

  // ===== Public API =====

  /**
   * Show the visibility sidebar panel.
   */
  show(): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.openToolPanel(VisibilityPlugin.PANEL_ID);
  }

  /**
   * Hide the visibility sidebar panel.
   */
  hide(): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.closeToolPanel();
  }

  /**
   * Toggle the visibility sidebar panel.
   */
  toggle(): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.toggleToolPanel(VisibilityPlugin.PANEL_ID);
  }

  /**
   * Check if a specific column is visible.
   * Delegates to grid.isColumnVisible().
   * @param field - The field name to check
   * @returns True if the column is visible
   */
  isColumnVisible(field: string): boolean {
    const grid = this.grid as unknown as GridWithVisibility;
    return grid.isColumnVisible(field);
  }

  /**
   * Set visibility for a specific column.
   * Delegates to grid.setColumnVisible().
   * @param field - The field name of the column
   * @param visible - Whether the column should be visible
   */
  setColumnVisible(field: string, visible: boolean): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.setColumnVisible(field, visible);
  }

  /**
   * Get list of all visible column fields.
   * @returns Array of visible field names
   */
  getVisibleColumns(): string[] {
    const grid = this.grid as unknown as GridWithVisibility;
    return grid
      .getAllColumns()
      .filter((c) => c.visible)
      .map((c) => c.field);
  }

  /**
   * Get list of all hidden column fields.
   * @returns Array of hidden field names
   */
  getHiddenColumns(): string[] {
    const grid = this.grid as unknown as GridWithVisibility;
    return grid
      .getAllColumns()
      .filter((c) => !c.visible)
      .map((c) => c.field);
  }

  /**
   * Show all columns.
   * Delegates to grid.showAllColumns().
   */
  showAll(): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.showAllColumns();
  }

  /**
   * Toggle visibility for a specific column.
   * Delegates to grid.toggleColumnVisibility().
   * @param field - The field name of the column
   */
  toggleColumn(field: string): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.toggleColumnVisibility(field);
  }

  /**
   * Show a specific column.
   * Delegates to grid.setColumnVisible().
   * @param field - The field name of the column to show
   */
  showColumn(field: string): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.setColumnVisible(field, true);
  }

  /**
   * Hide a specific column.
   * Delegates to grid.setColumnVisible().
   * @param field - The field name of the column to hide
   */
  hideColumn(field: string): void {
    const grid = this.grid as unknown as GridWithVisibility;
    grid.setColumnVisible(field, false);
  }

  /**
   * Get all columns with their visibility status.
   * Useful for building visibility UI.
   * @returns Array of column info with visibility status
   */
  getAllColumns(): Array<{ field: string; header: string; visible: boolean; lockVisible?: boolean }> {
    const grid = this.grid as unknown as GridWithVisibility;
    return grid.getAllColumns();
  }

  /**
   * Check if the sidebar panel is currently open.
   * @returns True if the panel is open
   */
  isPanelVisible(): boolean {
    const grid = this.grid as unknown as GridWithVisibility;
    return grid.activeToolPanel === VisibilityPlugin.PANEL_ID;
  }

  // ===== Private Methods =====

  /**
   * Render the panel content into the shell's tool panel container.
   * Returns a cleanup function.
   */
  private renderPanelContent(container: HTMLElement): (() => void) | void {
    const grid = this.grid as unknown as GridWithVisibility;

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
      grid.showAllColumns();
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
   * When a reorder plugin is present, adds drag handles for reordering.
   */
  private rebuildToggles(columnList: HTMLElement): void {
    const grid = this.grid as unknown as GridWithVisibility;
    const reorderEnabled = this.hasReorderPlugin();

    columnList.innerHTML = '';

    // getAllColumns() now returns columns in their effective display order
    const allColumns = grid.getAllColumns();

    for (let i = 0; i < allColumns.length; i++) {
      const col = allColumns[i];
      const label = col.header || col.field;

      const row = document.createElement('div');
      row.className = col.lockVisible ? 'tbw-visibility-row locked' : 'tbw-visibility-row';
      row.setAttribute('data-field', col.field);
      row.setAttribute('data-index', String(i));

      // Add drag handle if reorder is enabled
      if (reorderEnabled && canMoveColumn(col as unknown as ColumnConfig)) {
        row.draggable = true;
        row.classList.add('reorderable');

        this.setupDragListeners(row, col.field, i, columnList);
      }

      const labelWrapper = document.createElement('label');
      labelWrapper.className = 'tbw-visibility-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = col.visible;
      checkbox.disabled = col.lockVisible ?? false;
      checkbox.addEventListener('change', () => {
        grid.toggleColumnVisibility(col.field);
        // Refresh after toggle (grid may re-render)
        setTimeout(() => this.rebuildToggles(columnList), 0);
      });

      const text = document.createElement('span');
      text.textContent = label;

      labelWrapper.appendChild(checkbox);
      labelWrapper.appendChild(text);

      // Add drag handle icon if reorderable
      if (reorderEnabled && canMoveColumn(col as unknown as ColumnConfig)) {
        const handle = document.createElement('span');
        handle.className = 'tbw-visibility-handle';
        handle.textContent = '⋮⋮';
        handle.title = 'Drag to reorder';
        row.appendChild(handle);
      }

      row.appendChild(labelWrapper);
      columnList.appendChild(row);
    }
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

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', field);
      }

      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      this.isDragging = false;
      this.draggedField = null;
      this.draggedIndex = null;
      this.dropIndex = null;

      columnList.querySelectorAll('.tbw-visibility-row').forEach((r) => {
        r.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after');
      });
    });

    row.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!this.isDragging || this.draggedField === field) return;

      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      this.dropIndex = e.clientY < midY ? index : index + 1;

      // Clear other row highlights
      columnList.querySelectorAll('.tbw-visibility-row').forEach((r) => {
        if (r !== row) r.classList.remove('drop-target', 'drop-before', 'drop-after');
      });

      row.classList.add('drop-target');
      row.classList.toggle('drop-before', e.clientY < midY);
      row.classList.toggle('drop-after', e.clientY >= midY);
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drop-target', 'drop-before', 'drop-after');
    });

    row.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const draggedField = this.draggedField;
      const draggedIndex = this.draggedIndex;
      const dropIndex = this.dropIndex;

      if (!this.isDragging || draggedField === null || draggedIndex === null || dropIndex === null) {
        return;
      }

      // Calculate the effective target index
      const effectiveToIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;

      if (effectiveToIndex !== draggedIndex) {
        // Emit a request event - other plugins (like ReorderPlugin) can listen and handle
        const detail: ColumnReorderRequestDetail = {
          field: draggedField,
          fromIndex: draggedIndex,
          toIndex: effectiveToIndex,
        };
        this.emit<ColumnReorderRequestDetail>('column-reorder-request', detail);

        // Rebuild the panel after reorder (deferred to allow re-render)
        setTimeout(() => {
          this.rebuildToggles(columnList);
        }, 0);
      }
    });
  }

  // ===== Styles =====

  override readonly styles = `
    .tbw-visibility-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .tbw-visibility-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .tbw-visibility-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 4px;
      cursor: pointer;
      font-size: 13px;
      border-radius: var(--tbw-border-radius, 4px);
      position: relative;
    }
    .tbw-visibility-row:hover {
      background: var(--tbw-visibility-hover, var(--tbw-color-row-hover, #f3f4f6));
    }
    .tbw-visibility-row input[type="checkbox"] {
      cursor: pointer;
    }
    .tbw-visibility-row.locked span {
      color: var(--tbw-color-fg-muted, #888);
    }

    /* Drag handle */
    .tbw-visibility-handle {
      cursor: grab;
      color: var(--tbw-color-fg-muted, #888);
      font-size: 10px;
      letter-spacing: -2px;
      user-select: none;
      flex-shrink: 0;
    }
    .tbw-visibility-row.reorderable:hover .tbw-visibility-handle {
      color: var(--tbw-color-fg, #1f2937);
    }

    /* Label wrapper for checkbox and text */
    .tbw-visibility-label {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      cursor: pointer;
    }

    /* Drag states */
    .tbw-visibility-row.dragging {
      opacity: 0.5;
      cursor: grabbing;
    }
    .tbw-visibility-row.drop-before::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 2px;
      background: var(--tbw-reorder-indicator, var(--tbw-color-accent, #3b82f6));
    }
    .tbw-visibility-row.drop-after::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: var(--tbw-reorder-indicator, var(--tbw-color-accent, #3b82f6));
    }

    .tbw-visibility-show-all {
      margin: 8px;
      padding: 8px 12px;
      border: 1px solid var(--tbw-visibility-border, var(--tbw-color-border, #e5e7eb));
      border-radius: var(--tbw-border-radius, 4px);
      background: var(--tbw-visibility-btn-bg, var(--tbw-color-header-bg, #f9fafb));
      color: var(--tbw-color-fg, #1f2937);
      cursor: pointer;
      font-size: 13px;
    }
    .tbw-visibility-show-all:hover {
      background: var(--tbw-visibility-hover, var(--tbw-color-row-hover, #f3f4f6));
    }
  `;
}
