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
import type { ResponsiveChangeDetail, ResponsivePluginConfig } from './types';

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
  #hiddenColumnSet: Set<string> = new Set();

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
   * Get current grid width.
   * @returns Width of the grid element in pixels
   */
  getWidth(): number {
    return this.#currentWidth;
  }

  override attach(grid: GridElement): void {
    super.attach(grid);

    // Build set of hidden columns for quick lookup
    this.#hiddenColumnSet = new Set(this.config.hiddenColumns ?? []);

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
   * Apply hidden columns in responsive mode.
   * Called after render to mark cells that should be hidden.
   */
  override afterRender(): void {
    if (!this.#isResponsive || this.#hiddenColumnSet.size === 0) {
      return;
    }

    // Mark cells for hidden columns
    const cells = this.gridElement.querySelectorAll('.cell[data-field]');
    for (const cell of cells) {
      const field = cell.getAttribute('data-field');
      if (field && this.#hiddenColumnSet.has(field)) {
        cell.setAttribute('data-responsive-hidden', '');
      }
    }
  }

  /**
   * Check if width has crossed the breakpoint threshold.
   */
  #checkBreakpoint(width: number): void {
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
   * Apply the responsive state to the grid element.
   */
  #applyResponsiveState(): void {
    this.gridElement.toggleAttribute('data-responsive', this.#isResponsive);
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
