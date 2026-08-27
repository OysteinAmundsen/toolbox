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

/** Keys that move the virtual cell focus and should therefore re-target the tooltip. */
const NAVIGATION_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Tab',
]);

/** Default grace period (ms) allowing the pointer to travel onto the tooltip. */
const DEFAULT_HIDE_DELAY_MS = 120;

/** Gap (px) between the anchor cell and the popover, leaving room for the arrow. */
const ARROW_GAP_PX = 11;

/** `id` of the shared popover, referenced by `aria-describedby` on the anchor. */
const POPOVER_ID = 'tbw-tooltip-popover';
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
 * ## Accessibility
 *
 * Conforms to WCAG 2.2 SC 1.4.13 (Content on Hover or Focus) out of the box:
 * the tooltip is **dismissible** with `Escape`, **hoverable** (the pointer can
 * rest on it to read or copy the text), **persistent** (never hidden on a
 * timer), and appears on **keyboard focus** as cell focus moves. Pointer
 * interaction never triggers the focus path, so mouse behaviour is unchanged.
 * See {@link TooltipConfig.focus} and {@link TooltipConfig.hideDelay} to tune it.
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

  /** Pending grace-period hide, cancelled when the pointer enters the tooltip. */
  #hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** Pending focus-driven retarget, so rapid arrow-key repeats coalesce. */
  #focusFrame: number | null = null;

  /** Whether header tooltips are enabled globally. */
  get #headerEnabled(): boolean {
    return this.config.header !== false;
  }

  /** Whether cell tooltips are enabled globally. */
  get #cellEnabled(): boolean {
    return this.config.cell !== false;
  }

  /** Whether keyboard focus shows a tooltip (WCAG 2.2 SC 1.4.13). */
  get #focusEnabled(): boolean {
    return this.config.focus !== false;
  }

  /** Grace period before hiding, allowing the pointer to reach the tooltip. */
  get #hideDelay(): number {
    return this.config.hideDelay ?? DEFAULT_HIDE_DELAY_MS;
  }

  override attach(grid: GridElement): void {
    super.attach(grid);
  }

  override detach(): void {
    this.#cancelPendingHide();
    if (this.#focusFrame !== null) {
      cancelAnimationFrame(this.#focusFrame);
      this.#focusFrame = null;
    }
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
    el.id = POPOVER_ID;
    el.setAttribute('role', 'tooltip');
    // Override UA popover defaults that @layer CSS cannot beat
    el.style.overflow = 'visible';
    el.style.margin = '0';
    document.body.appendChild(el);
    this.#popoverEl = el;

    // SC 1.4.13 "Hoverable" — the pointer must be able to rest on the tooltip
    // without dismissing it, so its content can be read, magnified, or copied.
    el.addEventListener('mouseenter', () => this.#cancelPendingHide(), { signal: this.disconnectSignal });
    el.addEventListener('mouseleave', () => this.#scheduleHide(), { signal: this.disconnectSignal });
  }

  /** Show the popover anchored to `cell` with the given `text`. */
  #showTooltip(cell: HTMLElement, text: string): void {
    if (!this.#popoverEl) return;
    this.#cancelPendingHide();

    // Move the CSS anchor to the hovered cell
    this.#clearAnchor();
    cell.style.setProperty('anchor-name', '--tbw-tooltip-anchor');
    cell.setAttribute('aria-describedby', POPOVER_ID);
    this.#anchorCell = cell;

    // Set content (always textContent — safe, no XSS).
    // Multi-line content uses `white-space: pre` so author-supplied line
    // breaks survive verbatim and the popover grows to fit; single-line
    // content keeps `pre-wrap` so long values wrap inside `max-width`.
    this.#popoverEl.textContent = text;
    this.#popoverEl.classList.toggle('tbw-tooltip-multiline', text.includes('\n'));

    // Show via Popover API
    if (supportsPopover()) {
      try {
        this.#popoverEl.showPopover();
      } catch {
        /* already shown */
      }
    }

    if (supportsAnchor()) {
      this.#popoverEl.classList.toggle('tbw-tooltip-above', this.#prefersAbove(cell));
    } else {
      this.#positionFallback(cell);
    }
  }

  /** Hide the popover and clear the anchor reference. */
  #hideTooltip(): void {
    this.#cancelPendingHide();
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

  /** Whether the popover is currently anchored to a cell (i.e. visible). */
  get #isVisible(): boolean {
    return this.#anchorCell !== null;
  }

  /**
   * Hide after the configured grace period rather than immediately, so the
   * pointer can travel from the cell onto the tooltip (SC 1.4.13 Hoverable).
   */
  #scheduleHide(): void {
    this.#cancelPendingHide();
    if (this.#hideDelay <= 0) {
      this.#hideTooltip();
      return;
    }
    this.#hideTimer = setTimeout(() => {
      this.#hideTimer = null;
      this.#hideTooltip();
    }, this.#hideDelay);
  }

  #cancelPendingHide(): void {
    if (this.#hideTimer !== null) {
      clearTimeout(this.#hideTimer);
      this.#hideTimer = null;
    }
  }

  /** Remove the CSS anchor-name from the previous cell, but only if it's still our tooltip anchor. */
  #clearAnchor(): void {
    if (this.#anchorCell) {
      if (this.#anchorCell.style.getPropertyValue('anchor-name') === '--tbw-tooltip-anchor') {
        this.#anchorCell.style.removeProperty('anchor-name');
      }
      if (this.#anchorCell.getAttribute('aria-describedby') === POPOVER_ID) {
        this.#anchorCell.removeAttribute('aria-describedby');
      }
      this.#anchorCell = null;
    }
  }

  /**
   * Decide whether the popover sits above the cell. Above is preferred so the
   * tooltip never covers the rows the pointer is heading toward; it drops below
   * only when the popover does not fit in the space above the cell.
   *
   * Placement is resolved here rather than left to `position-try-fallbacks` so
   * the arrow-direction class can never disagree with where the browser
   * actually painted the popover.
   */
  #prefersAbove(cell: HTMLElement): boolean {
    if (!this.#popoverEl) return false;
    const cellRect = cell.getBoundingClientRect();
    const spaceAbove = cellRect.top - ARROW_GAP_PX;
    const spaceBelow = window.innerHeight - cellRect.bottom - ARROW_GAP_PX;
    // Popover is already shown and filled, so its box is measurable.
    const height = this.#popoverEl.offsetHeight;
    return height <= spaceAbove || spaceAbove >= spaceBelow;
  }

  /**
   * Fallback positioning for browsers without CSS anchor support.
   * Places the popover above or below the cell using fixed coordinates.
   */
  #positionFallback(cell: HTMLElement): void {
    if (!this.#popoverEl) return;
    const cellRect = cell.getBoundingClientRect();
    const above = this.#prefersAbove(cell);

    this.#popoverEl.style.position = 'fixed';
    this.#popoverEl.style.left = `${cellRect.left}px`;

    if (above) {
      this.#popoverEl.style.top = '';
      this.#popoverEl.style.bottom = `${window.innerHeight - cellRect.top + ARROW_GAP_PX}px`;
    } else {
      this.#popoverEl.style.top = `${cellRect.bottom + ARROW_GAP_PX}px`;
      this.#popoverEl.style.bottom = '';
    }
    this.#popoverEl.classList.toggle('tbw-tooltip-above', above);
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

    // SC 1.4.13 "Dismissible" — Escape must hide the tooltip without moving the
    // pointer. Bound on `document` because a hover-triggered tooltip can be
    // visible while focus sits entirely outside the grid, where the grid's own
    // key handling never runs. The event is deliberately NOT consumed: Escape
    // also cancels an in-progress edit, and swallowing it here would break that.
    document.addEventListener('keydown', (e: Event) => this.#onKeyDownGlobal(e as KeyboardEvent), {
      capture: true,
      signal: this.disconnectSignal,
    });

    // Keyboard navigation keeps DOM focus on the grid HOST (`tabindex=0`), so
    // keydown never travels through `.tbw-grid-root` — a child of the host.
    // Bind on the host, exactly where `setupRootEventDelegation` binds the
    // grid's own navigation handler.
    this.gridElement.addEventListener('keydown', (e: Event) => this.#onKeyDownGrid(e as KeyboardEvent), {
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

    // Grace period, not an immediate hide, so the pointer can reach the tooltip.
    this.#scheduleHide();
  }

  /** Escape dismisses a visible tooltip from anywhere on the page. */
  #onKeyDownGlobal(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.#isVisible) {
      this.#hideTooltip();
    }
  }

  /**
   * Retarget the tooltip after keyboard navigation moves the virtual cell
   * focus (SC 1.4.13 "focus" trigger). Only key-driven focus qualifies —
   * pointer interaction never reaches here, so mouse users are unaffected.
   */
  #onKeyDownGrid(e: KeyboardEvent): void {
    if (!this.#focusEnabled || !this.#cellEnabled) return;
    if (e.key === 'Escape') return;
    if (!NAVIGATION_KEYS.has(e.key)) {
      // Any other key (typing, Enter to edit) means the user has moved on.
      this.#hideTooltip();
      return;
    }
    // Cell focus is virtual and moves in the grid's own keydown handler, which
    // runs after this one — read the resulting `.cell-focus` on the next frame.
    if (this.#focusFrame !== null) cancelAnimationFrame(this.#focusFrame);
    this.#focusFrame = requestAnimationFrame(() => {
      this.#focusFrame = null;
      this.#syncTooltipToFocusedCell();
    });
  }

  /** Show (or clear) the tooltip for the cell that currently holds focus. */
  #syncTooltipToFocusedCell(): void {
    const cell = this.gridElement?.querySelector('.cell-focus') as HTMLElement | null;
    if (!cell || !cell.hasAttribute('data-row')) {
      this.#hideTooltip();
      return;
    }
    // Focus was clamped rather than moved (ArrowUp on the first row, ArrowDown
    // on the last, …) — the tooltip already describes this cell.
    if (cell === this.#anchorCell) return;
    // A foreign anchor means an overlay editor owns this cell's positioning, so
    // we cannot re-anchor here; drop the previous cell's tooltip rather than
    // leave it pointing somewhere focus has left.
    if (cell.style.getPropertyValue('anchor-name')) {
      this.#hideTooltip();
      return;
    }
    const before = this.#anchorCell;
    this.#showCellTooltip(cell);
    // No tooltip text for this cell — drop whatever the previous cell showed.
    if (this.#anchorCell === before) this.#hideTooltip();
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
