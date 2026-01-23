/**
 * Responsive Plugin
 *
 * Transforms the grid from tabular layout to a card/list layout when the grid
 * width falls below a configurable breakpoint. This enables grids to work in
 * narrow containers (split-pane UIs, mobile viewports, dashboard widgets).
 *
 * ## Installation
 *
 * ```ts
 * import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';
 *
 * const config: GridConfig = {
 *   plugins: [new ResponsivePlugin({ breakpoint: 500 })],
 * };
 * ```
 *
 * ## How It Works
 *
 * 1. ResizeObserver monitors the grid element's width
 * 2. When `width < breakpoint`, adds `data-responsive` attribute to grid
 * 3. CSS transforms cells from horizontal to vertical layout
 * 4. Each cell displays "Header: Value" using CSS `::before` pseudo-element
 *
 * @see [Responsive Demo](?path=/story/grid-plugins-responsive--default)
 */

import { ensureCellVisible } from '../../core/internal/keyboard';
import { BaseGridPlugin, type GridElement } from '../../core/plugin/base-plugin';
import type { InternalGrid } from '../../core/types';
import styles from './responsive.css?inline';
import type { BreakpointConfig, HiddenColumnConfig, ResponsiveChangeDetail, ResponsivePluginConfig } from './types';

/**
 * Responsive Plugin for tbw-grid
 *
 * Adds automatic card layout mode when the grid width falls below a configurable
 * breakpoint. Perfect for responsive designs, split-pane UIs, and mobile viewports.
 *
 * @template T The row data type
 *
 * @example
 * ```ts
 * // Basic usage - switch to card layout below 500px
 * const config: GridConfig = {
 *   plugins: [new ResponsivePlugin({ breakpoint: 500 })],
 * };
 * ```
 *
 * @example
 * ```ts
 * // Hide less important columns in card mode
 * const config: GridConfig = {
 *   plugins: [
 *     new ResponsivePlugin({
 *       breakpoint: 600,
 *       hiddenColumns: ['createdAt', 'updatedAt'],
 *     }),
 *   ],
 * };
 * ```
 *
 * @example
 * ```ts
 * // Custom card renderer for advanced layouts
 * const config: GridConfig = {
 *   plugins: [
 *     new ResponsivePlugin({
 *       breakpoint: 400,
 *       cardRenderer: (row) => {
 *         const card = document.createElement('div');
 *         card.className = 'custom-card';
 *         card.innerHTML = `<strong>${row.name}</strong><br>${row.email}`;
 *         return card;
 *       },
 *     }),
 *   ],
 * };
 * ```
 */
export class ResponsivePlugin<T = unknown> extends BaseGridPlugin<ResponsivePluginConfig<T>> {
  readonly name = 'responsive';
  override readonly version = '1.0.0';
  override readonly styles = styles;

  #resizeObserver?: ResizeObserver;
  #isResponsive = false;
  #debounceTimer?: ReturnType<typeof setTimeout>;
  #warnedAboutMissingBreakpoint = false;
  #currentWidth = 0;
  /** Set of column fields to completely hide */
  #hiddenColumnSet: Set<string> = new Set();
  /** Set of column fields to show value only (no header label) */
  #valueOnlyColumnSet: Set<string> = new Set();
  /** Currently active breakpoint, or null if none */
  #activeBreakpoint: BreakpointConfig | null = null;
  /** Sorted breakpoints from largest to smallest */
  #sortedBreakpoints: BreakpointConfig[] = [];

  /**
   * Check if currently in responsive mode.
   * @returns `true` if the grid is in card layout mode
   */
  isResponsive(): boolean {
    return this.#isResponsive;
  }

  /**
   * Force responsive mode regardless of width.
   * Useful for testing or manual control.
   * @param enabled - Whether to enable responsive mode
   */
  setResponsive(enabled: boolean): void {
    if (enabled !== this.#isResponsive) {
      this.#isResponsive = enabled;
      this.#applyResponsiveState();
      this.emit('responsive-change', {
        isResponsive: enabled,
        width: this.#currentWidth,
        breakpoint: this.config.breakpoint ?? 0,
      } satisfies ResponsiveChangeDetail);
    }
  }

  /**
   * Update breakpoint dynamically.
   * @param width - New breakpoint width in pixels
   */
  setBreakpoint(width: number): void {
    this.config.breakpoint = width;
    this.#checkBreakpoint(this.#currentWidth);
  }

  /**
   * Set a custom card renderer.
   * This allows framework adapters to provide template-based renderers at runtime.
   * @param renderer - The card renderer function, or undefined to use default
   */
  setCardRenderer(renderer: ResponsivePluginConfig<T>['cardRenderer']): void {
    this.config.cardRenderer = renderer;
    // If already in responsive mode, trigger a re-render to apply the new renderer
    if (this.#isResponsive) {
      this.requestRender();
    }
  }

  /**
   * Get current grid width.
   * @returns Width of the grid element in pixels
   */
  getWidth(): number {
    return this.#currentWidth;
  }

  /**
   * Get the currently active breakpoint config (multi-breakpoint mode only).
   * @returns The active BreakpointConfig, or null if no breakpoint is active
   */
  getActiveBreakpoint(): BreakpointConfig | null {
    return this.#activeBreakpoint;
  }

  override attach(grid: GridElement): void {
    super.attach(grid);

    // Build hidden column sets from config
    this.#buildHiddenColumnSets(this.config.hiddenColumns);

    // Sort breakpoints from largest to smallest for evaluation
    if (this.config.breakpoints?.length) {
      this.#sortedBreakpoints = [...this.config.breakpoints].sort((a, b) => b.maxWidth - a.maxWidth);
    }

    // Observe the grid element itself (not internal viewport)
    // This captures the container width including when shell panels open/close
    this.#resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      this.#currentWidth = width;

      // Debounce to avoid thrashing during resize drag
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = setTimeout(() => {
        this.#checkBreakpoint(width);
      }, this.config.debounceMs ?? 100);
    });

    this.#resizeObserver.observe(this.gridElement);
  }

  /**
   * Build the hidden and value-only column sets from config.
   */
  #buildHiddenColumnSets(hiddenColumns?: HiddenColumnConfig[]): void {
    this.#hiddenColumnSet.clear();
    this.#valueOnlyColumnSet.clear();

    if (!hiddenColumns) return;

    for (const col of hiddenColumns) {
      if (typeof col === 'string') {
        this.#hiddenColumnSet.add(col);
      } else if (col.showValue) {
        this.#valueOnlyColumnSet.add(col.field);
      } else {
        this.#hiddenColumnSet.add(col.field);
      }
    }
  }

  override detach(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = undefined;

    // Clean up attribute
    if (this.gridElement) {
      this.gridElement.removeAttribute('data-responsive');
    }

    super.detach();
  }

  /**
   * Apply hidden and value-only columns.
   * In legacy mode (single breakpoint), only applies when in responsive mode.
   * In multi-breakpoint mode, applies whenever there's an active breakpoint.
   */
  override afterRender(): void {
    // In single breakpoint mode, only apply when responsive
    // In multi-breakpoint mode, apply when there's an active breakpoint
    const shouldApply = this.#sortedBreakpoints.length > 0 ? this.#activeBreakpoint !== null : this.#isResponsive;

    if (!shouldApply) {
      return;
    }

    const hasHiddenColumns = this.#hiddenColumnSet.size > 0;
    const hasValueOnlyColumns = this.#valueOnlyColumnSet.size > 0;

    if (!hasHiddenColumns && !hasValueOnlyColumns) {
      return;
    }

    // Mark cells for hidden columns and value-only columns
    const cells = this.gridElement.querySelectorAll('.cell[data-field]');
    for (const cell of cells) {
      const field = cell.getAttribute('data-field');
      if (!field) continue;

      // Apply hidden attribute
      if (this.#hiddenColumnSet.has(field)) {
        cell.setAttribute('data-responsive-hidden', '');
        cell.removeAttribute('data-responsive-value-only');
      }
      // Apply value-only attribute (shows value without header label)
      else if (this.#valueOnlyColumnSet.has(field)) {
        cell.setAttribute('data-responsive-value-only', '');
        cell.removeAttribute('data-responsive-hidden');
      }
      // Clear any previous responsive attributes
      else {
        cell.removeAttribute('data-responsive-hidden');
        cell.removeAttribute('data-responsive-value-only');
      }
    }
  }

  /**
   * Check if width has crossed any breakpoint threshold.
   * Handles both single breakpoint (legacy) and multi-breakpoint modes.
   */
  #checkBreakpoint(width: number): void {
    // Multi-breakpoint mode
    if (this.#sortedBreakpoints.length > 0) {
      this.#checkMultiBreakpoint(width);
      return;
    }

    // Legacy single breakpoint mode
    const breakpoint = this.config.breakpoint ?? 0;

    // Warn once if breakpoint not configured (0 means never responsive)
    if (breakpoint === 0 && !this.#warnedAboutMissingBreakpoint) {
      this.#warnedAboutMissingBreakpoint = true;
      console.warn(
        "[tbw-grid:ResponsivePlugin] No breakpoint configured. Responsive mode is disabled. Set a breakpoint based on your grid's column count.",
      );
    }

    const shouldBeResponsive = breakpoint > 0 && width < breakpoint;

    if (shouldBeResponsive !== this.#isResponsive) {
      this.#isResponsive = shouldBeResponsive;
      this.#applyResponsiveState();
      this.emit('responsive-change', {
        isResponsive: shouldBeResponsive,
        width,
        breakpoint,
      } satisfies ResponsiveChangeDetail);
      this.requestRender();
    }
  }

  /**
   * Check breakpoints in multi-breakpoint mode.
   * Evaluates breakpoints from largest to smallest, applying the first match.
   */
  #checkMultiBreakpoint(width: number): void {
    // Find the active breakpoint (first one where width <= maxWidth)
    // Since sorted largest to smallest, we find the largest matching breakpoint
    let newActiveBreakpoint: BreakpointConfig | null = null;

    for (const bp of this.#sortedBreakpoints) {
      if (width <= bp.maxWidth) {
        newActiveBreakpoint = bp;
        // Continue to find the most specific (smallest) matching breakpoint
      }
    }

    // Check if breakpoint changed
    const breakpointChanged = newActiveBreakpoint !== this.#activeBreakpoint;

    if (breakpointChanged) {
      this.#activeBreakpoint = newActiveBreakpoint;

      // Update hidden column sets from active breakpoint
      if (newActiveBreakpoint?.hiddenColumns) {
        this.#buildHiddenColumnSets(newActiveBreakpoint.hiddenColumns);
      } else {
        // Fall back to top-level hiddenColumns config
        this.#buildHiddenColumnSets(this.config.hiddenColumns);
      }

      // Determine if we should be in card layout
      const shouldBeResponsive = newActiveBreakpoint?.cardLayout === true;

      if (shouldBeResponsive !== this.#isResponsive) {
        this.#isResponsive = shouldBeResponsive;
        this.#applyResponsiveState();
      }

      // Emit event for any breakpoint change
      this.emit('responsive-change', {
        isResponsive: this.#isResponsive,
        width,
        breakpoint: newActiveBreakpoint?.maxWidth ?? 0,
      } satisfies ResponsiveChangeDetail);

      this.requestRender();
    }
  }

  /** Original row height before entering responsive mode, for restoration on exit */
  #originalRowHeight?: number;

  /**
   * Apply the responsive state to the grid element.
   * Handles scroll reset when entering responsive mode and row height restoration on exit.
   */
  #applyResponsiveState(): void {
    this.gridElement.toggleAttribute('data-responsive', this.#isResponsive);

    // Apply animation attribute if enabled (default: true)
    const animate = this.config.animate !== false;
    this.gridElement.toggleAttribute('data-responsive-animate', animate);

    // Set custom animation duration if provided
    if (this.config.animationDuration) {
      this.gridElement.style.setProperty('--tbw-responsive-duration', `${this.config.animationDuration}ms`);
    }

    // Cast to internal type for virtualization access
    const internalGrid = this.grid as unknown as InternalGrid;

    if (this.#isResponsive) {
      // Store original row height before responsive mode changes it
      if (internalGrid._virtualization) {
        this.#originalRowHeight = internalGrid._virtualization.rowHeight;
      }

      // Reset horizontal scroll position when entering responsive mode
      // The CSS hides overflow but doesn't reset the scroll position
      const scrollArea = this.gridElement.querySelector('.tbw-scroll-area') as HTMLElement | null;
      if (scrollArea) {
        scrollArea.scrollLeft = 0;
      }
    } else {
      // Exiting responsive mode - clean up inline styles set by renderRow
      // The rows are reused from the pool, so we need to remove the card-specific styles
      const rows = this.gridElement.querySelectorAll('.data-grid-row');
      for (const row of rows) {
        (row as HTMLElement).style.height = '';
        row.classList.remove('responsive-card');
      }

      // Restore original row height
      if (this.#originalRowHeight && this.#originalRowHeight > 0 && internalGrid._virtualization) {
        internalGrid._virtualization.rowHeight = this.#originalRowHeight;
        this.#originalRowHeight = undefined;
      }
    }
  }

  /**
   * Custom row rendering when cardRenderer is provided and in responsive mode.
   *
   * When a cardRenderer is configured, this hook takes over row rendering to display
   * the custom card layout instead of the default cell structure.
   *
   * @param row - The row data object
   * @param rowEl - The row DOM element to render into
   * @param rowIndex - The index of the row in the data array
   * @returns `true` if rendered (prevents default), `void` for default rendering
   */
  override renderRow(row: unknown, rowEl: HTMLElement, rowIndex: number): boolean | void {
    // Only override when in responsive mode AND cardRenderer is provided
    if (!this.#isResponsive || !this.config.cardRenderer) {
      return; // Let default rendering proceed
    }

    // Skip group rows from GroupingRowsPlugin - they have special structure
    // and should use their own renderer
    if ((row as { __isGroupRow?: boolean }).__isGroupRow) {
      return; // Let GroupingRowsPlugin handle group row rendering
    }

    // Clear existing content
    rowEl.replaceChildren();

    // Call user's cardRenderer to get custom content
    const cardContent = this.config.cardRenderer(row as T, rowIndex);

    // Reset className - clears any stale classes from previous use (e.g., 'group-row' from recycled element)
    // This follows the same pattern as GroupingRowsPlugin which sets className explicitly
    rowEl.className = 'data-grid-row responsive-card';

    // Handle cardRowHeight
    const cardHeight = this.config.cardRowHeight ?? 'auto';
    if (cardHeight !== 'auto') {
      rowEl.style.height = `${cardHeight}px`;
    } else {
      // Remove any virtualization-set height for auto mode
      rowEl.style.height = 'auto';
    }

    // Append the custom card content
    rowEl.appendChild(cardContent);

    return true; // We handled rendering
  }

  /**
   * Handle keyboard navigation in responsive mode.
   *
   * In responsive mode, the visual layout is inverted:
   * - Cells are stacked vertically within each "card" (row)
   * - DOWN/UP visually moves within the card (between fields)
   * - Page Down/Page Up or Ctrl+Down/Up moves between cards
   *
   * For custom cardRenderers, keyboard navigation is disabled entirely
   * since the implementor controls the card content and should handle
   * navigation via their own event handlers.
   *
   * @returns `true` if the event was handled and default behavior should be prevented
   */
  override onKeyDown(e: KeyboardEvent): boolean {
    if (!this.#isResponsive) {
      return false;
    }

    // If custom cardRenderer is provided, disable grid's keyboard navigation
    // The implementor is responsible for their own navigation
    if (this.config.cardRenderer) {
      const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (navKeys.includes(e.key)) {
        // Let the event bubble - implementor can handle it
        return false;
      }
    }

    // Swap arrow key behavior for CSS-only responsive mode
    // In card layout, cells are stacked vertically:
    //   Card 1:       Card 2:
    //     ID: 1         ID: 2
    //     Name: Alice   Name: Bob  <- ArrowRight goes here
    //     Dept: Eng     Dept: Mkt
    //       ↓ ArrowDown goes here
    //
    // ArrowDown/Up = move within card (change column/field)
    // ArrowRight/Left = move between cards (change row)
    const maxRow = this.rows.length - 1;
    const maxCol = this.visibleColumns.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        // Move down WITHIN card (to next field/column)
        if (this.grid._focusCol < maxCol) {
          this.grid._focusCol += 1;
          e.preventDefault();
          ensureCellVisible(this.grid as unknown as InternalGrid);
          return true;
        }
        // At bottom of card - optionally move to next card's first field
        if (this.grid._focusRow < maxRow) {
          this.grid._focusRow += 1;
          this.grid._focusCol = 0;
          e.preventDefault();
          ensureCellVisible(this.grid as unknown as InternalGrid);
          return true;
        }
        break;

      case 'ArrowUp':
        // Move up WITHIN card (to previous field/column)
        if (this.grid._focusCol > 0) {
          this.grid._focusCol -= 1;
          e.preventDefault();
          ensureCellVisible(this.grid as unknown as InternalGrid);
          return true;
        }
        // At top of card - optionally move to previous card's last field
        if (this.grid._focusRow > 0) {
          this.grid._focusRow -= 1;
          this.grid._focusCol = maxCol;
          e.preventDefault();
          ensureCellVisible(this.grid as unknown as InternalGrid);
          return true;
        }
        break;

      case 'ArrowRight':
        // Move to NEXT card (same field)
        if (this.grid._focusRow < maxRow) {
          this.grid._focusRow += 1;
          e.preventDefault();
          ensureCellVisible(this.grid as unknown as InternalGrid);
          return true;
        }
        break;

      case 'ArrowLeft':
        // Move to PREVIOUS card (same field)
        if (this.grid._focusRow > 0) {
          this.grid._focusRow -= 1;
          e.preventDefault();
          ensureCellVisible(this.grid as unknown as InternalGrid);
          return true;
        }
        break;
    }

    return false;
  }
}
