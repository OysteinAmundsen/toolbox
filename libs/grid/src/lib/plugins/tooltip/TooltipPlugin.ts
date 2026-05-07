/**
 * Tooltip Plugin
 *
 * Shows styled popover tooltips on header and data cells when text
 * overflows (ellipsis). Uses the Popover API (`popover="hint"`) with
 * CSS anchor positioning for consistent, themed placement.
 *
 * Supports per-column overrides via `cellTooltip` and `headerTooltip`
 * on column config.
 */

import type { GridElement, PluginManifest } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { CellRenderContext, ColumnConfig, HeaderLabelContext } from '../../core/types';
import tooltipStyles from './tooltip.css?inline';
import type { TooltipConfig } from './types';

// #region Helpers

/** Check if an element's text content overflows its visible width. */
function isOverflowing(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth;
}

/**
 * Resolve the tooltip text for a cell.
 * Returns the text to show, or `null` to suppress.
 */
function resolveCellTooltip(
  column: ColumnConfig,
  cell: HTMLElement,
  row: unknown,
  value: unknown,
  grid?: GridElement,
): string | null {
  const spec = column.cellTooltip;

  if (spec === false) return null;
  if (typeof spec === 'string') return spec;
  if (typeof spec === 'function') {
    const ctx: CellRenderContext = { value, row, column, field: column.field, grid: grid as any };
    return spec(ctx);
  }

  // Default: show textContent only when overflowing
  if (isOverflowing(cell)) {
    return cell.textContent?.trim() || null;
  }

  return null;
}

/**
 * Resolve the tooltip text for a header cell.
 * Returns the text to show, or `null` to suppress.
 */
function resolveHeaderTooltip(column: ColumnConfig, headerCell: HTMLElement): string | null {
  const spec = column.headerTooltip;

  if (spec === false) return null;
  if (typeof spec === 'string') return spec;
  if (typeof spec === 'function') {
    const ctx: HeaderLabelContext = {
      column,
      value: column.header ?? column.field,
    };
    return spec(ctx);
  }

  // Default: show header text only when overflowing
  const labelSpan = headerCell.querySelector('span:first-child') as HTMLElement | null;
  const target = labelSpan ?? headerCell;

  if (isOverflowing(target)) {
    return target.textContent?.trim() || null;
  }

  return null;
}

/** Runtime check — happy-dom and older browsers may lack Popover API. */
function supportsPopover(): boolean {
  return typeof HTMLElement.prototype?.showPopover === 'function';
}

/** Runtime check for CSS anchor positioning. */
function supportsAnchor(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports?.('anchor-name', '--test') === true;
}
// #endregion

// #region TooltipPlugin
/**
 * Tooltip Plugin for tbw-grid
 *
 * Shows styled popover tooltips when header or cell text overflows its
 * container. Uses the Popover API with CSS anchor positioning for
 * consistent themed appearance across light and dark modes.
 *
 * ## Installation
 *
 * ```ts
 * import { TooltipPlugin } from '@toolbox-web/grid/plugins/tooltip';
 * ```
 *
 * @example Default — auto-tooltip on overflow
 * ```ts
 * grid.gridConfig = {
 *   plugins: [new TooltipPlugin()],
 * };
 * ```
 *
 * @example Header-only tooltips
 * ```ts
 * grid.gridConfig = {
 *   plugins: [new TooltipPlugin({ cell: false })],
 * };
 * ```
 *
 * @example Per-column overrides
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', cellTooltip: (ctx) => `${ctx.row.first} ${ctx.row.last}` },
 *     { field: 'actions', cellTooltip: false },
 *     { field: 'revenue', headerTooltip: 'Total revenue in USD (before tax)' },
 *   ],
 *   plugins: [new TooltipPlugin()],
 * };
 * ```
 *
 * @category Plugins
 * @since 1.28.0
 */
export class TooltipPlugin extends BaseGridPlugin<TooltipConfig> {
  readonly name = 'tooltip';
  override readonly styles = tooltipStyles;

  static override readonly manifest: PluginManifest<TooltipConfig> = {
    ownedProperties: [
      { property: 'cellTooltip', level: 'column', description: 'the "cellTooltip" column property' },
      { property: 'headerTooltip', level: 'column', description: 'the "headerTooltip" column property' },
    ],
    configRules: [],
  };

  /** The shared popover element for all tooltips. */
  #popoverEl: HTMLElement | null = null;

  /** The cell currently acting as CSS anchor. */
  #anchorCell: HTMLElement | null = null;

  /** Whether delegated listeners are bound. */
  #bound = false;

  /** Whether header tooltips are enabled globally. */
  get #headerEnabled(): boolean {
    return this.config.header !== false;
  }

  /** Whether cell tooltips are enabled globally. */
  get #cellEnabled(): boolean {
    return this.config.cell !== false;
  }

  override attach(grid: GridElement): void {
    super.attach(grid);
  }

  override detach(): void {
    this.#hideTooltip();
    this.#popoverEl?.remove();
    this.#popoverEl = null;
    this.#bound = false;
    super.detach();
  }

  override afterRender(): void {
    this.#ensurePopover();
    this.#bindEvents();
  }

  // #region Popover Lifecycle

  /** Create the shared popover element (once). */
  #ensurePopover(): void {
    if (this.#popoverEl) return;
    const el = document.createElement('div');
    el.className = 'tbw-tooltip-popover';
    el.setAttribute('popover', 'hint');
    // Override UA popover defaults that @layer CSS cannot beat
    el.style.overflow = 'visible';
    el.style.margin = '0';
    document.body.appendChild(el);
    this.#popoverEl = el;
  }

  /** Show the popover anchored to `cell` with the given `text`. */
  #showTooltip(cell: HTMLElement, text: string): void {
    if (!this.#popoverEl) return;

    // Move the CSS anchor to the hovered cell
    this.#clearAnchor();
    cell.style.setProperty('anchor-name', '--tbw-tooltip-anchor');
    this.#anchorCell = cell;

    // Set content (always textContent — safe, no XSS)
    this.#popoverEl.textContent = text;

    // Show via Popover API
    if (supportsPopover()) {
      try {
        this.#popoverEl.showPopover();
      } catch {
        /* already shown */
      }
    }

    if (supportsAnchor()) {
      // Detect flip after the browser resolves position-try-fallbacks
      requestAnimationFrame(() => this.#detectFlip(cell));
    } else {
      this.#positionFallback(cell);
    }
  }

  /** Hide the popover and clear the anchor reference. */
  #hideTooltip(): void {
    if (this.#popoverEl) {
      if (supportsPopover()) {
        try {
          this.#popoverEl.hidePopover();
        } catch {
          /* already hidden */
        }
      }
      this.#popoverEl.classList.remove('tbw-tooltip-above');
    }
    this.#clearAnchor();
  }

  /** Remove the CSS anchor-name from the previous cell, but only if it's still our tooltip anchor. */
  #clearAnchor(): void {
    if (this.#anchorCell) {
      if (this.#anchorCell.style.getPropertyValue('anchor-name') === '--tbw-tooltip-anchor') {
        this.#anchorCell.style.removeProperty('anchor-name');
      }
      this.#anchorCell = null;
    }
  }

  /**
   * Fallback positioning for browsers without CSS anchor support.
   * Places the popover below or above the cell using fixed coordinates.
   */
  #positionFallback(cell: HTMLElement): void {
    if (!this.#popoverEl) return;
    const cellRect = cell.getBoundingClientRect();
    const arrowGap = 11;

    this.#popoverEl.style.position = 'fixed';
    this.#popoverEl.style.left = `${cellRect.left}px`;

    // Check if there's space below
    const spaceBelow = window.innerHeight - cellRect.bottom;
    if (spaceBelow < 80) {
      // Place above the cell
      this.#popoverEl.style.top = '';
      this.#popoverEl.style.bottom = `${window.innerHeight - cellRect.top + arrowGap}px`;
      this.#popoverEl.classList.add('tbw-tooltip-above');
    } else {
      this.#popoverEl.style.top = `${cellRect.bottom + arrowGap}px`;
      this.#popoverEl.style.bottom = '';
      this.#popoverEl.classList.remove('tbw-tooltip-above');
    }
  }

  /** Toggle the arrow direction class after CSS anchor positioning resolves. */
  #detectFlip(cell: HTMLElement): void {
    if (!this.#popoverEl) return;
    const cellRect = cell.getBoundingClientRect();
    const popoverRect = this.#popoverEl.getBoundingClientRect();
    // If the popover's bottom edge is above the cell's top, it flipped
    this.#popoverEl.classList.toggle('tbw-tooltip-above', popoverRect.bottom <= cellRect.top);
  }
  // #endregion

  // #region Event Delegation

  /** Bind delegated mouseover/mouseout once. */
  #bindEvents(): void {
    if (this.#bound) return;
    const container = this.gridElement?.querySelector('.tbw-grid-root');
    if (!container) return;

    this.#bound = true;

    container.addEventListener('mouseover', (e: Event) => this.#onMouseOver(e as MouseEvent), {
      signal: this.disconnectSignal,
    });

    container.addEventListener('mouseout', (e: Event) => this.#onMouseOut(e as MouseEvent), {
      signal: this.disconnectSignal,
    });
  }

  #onMouseOver(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target?.closest) return;

    // Check for header cell
    const headerCell = target.closest('[part~="header-cell"]') as HTMLElement | null;
    if (headerCell && this.#headerEnabled) {
      this.#showHeaderTooltip(headerCell);
      return;
    }

    // Check for data cell — skip cells that already have a CSS anchor (e.g. overlay editors)
    // to avoid overwriting their anchor-name and breaking their positioning.
    const dataCell = target.closest('[data-row][data-col]') as HTMLElement | null;
    if (dataCell && this.#cellEnabled && !dataCell.style.getPropertyValue('anchor-name')) {
      this.#showCellTooltip(dataCell);
    }
  }

  #onMouseOut(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target?.closest) return;

    const cell = target.closest('[part~="header-cell"], [data-row][data-col]') as HTMLElement | null;
    if (!cell) return;

    // Keep tooltip if pointer moved to a child still inside the same cell
    const related = e.relatedTarget as HTMLElement | null;
    if (related && cell.contains(related)) return;

    this.#hideTooltip();
  }
  // #endregion

  // #region Tooltip Resolution

  #showHeaderTooltip(headerCell: HTMLElement): void {
    const colIndex = parseInt(headerCell.getAttribute('data-col') ?? '-1', 10);
    if (colIndex < 0) return;

    const column = this.visibleColumns[colIndex];
    if (!column) return;

    const text = resolveHeaderTooltip(column, headerCell);
    if (text) {
      this.#showTooltip(headerCell, text);
    }
  }

  #showCellTooltip(cell: HTMLElement): void {
    const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
    const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
    if (rowIndex < 0 || colIndex < 0) return;

    const column = this.visibleColumns[colIndex];
    if (!column) return;

    const row = this.rows[rowIndex];
    const value = row?.[column.field as keyof typeof row];

    const text = resolveCellTooltip(column, cell, row, value, this.grid);
    if (text) {
      this.#showTooltip(cell, text);
    }
  }
  // #endregion
}
// #endregion
