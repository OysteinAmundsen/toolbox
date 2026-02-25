import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { BaseGridEditor } from './base-grid-editor';

// #region Overlay Position Types

/**
 * Position of the overlay panel relative to its anchor cell.
 *
 * - `'below'` — panel appears below the cell, left-aligned (default)
 * - `'above'` — panel appears above the cell, left-aligned
 * - `'below-right'` — panel appears below the cell, right-aligned
 * - `'over-top-left'` — panel top-left corner aligns with cell top-left corner (opens downward)
 * - `'over-bottom-left'` — panel bottom-left corner aligns with cell bottom-left corner (opens upward)
 */
export type OverlayPosition = 'below' | 'above' | 'below-right' | 'over-top-left' | 'over-bottom-left';

// #endregion

// #region Global Styles

/** Tracks whether the global overlay stylesheet has been injected. */
let overlayStylesInjected = false;

/**
 * CSS for the overlay panel base layer.
 * Injected once into `<head>` on first `BaseOverlayEditor` use.
 *
 * Uses CSS Anchor Positioning as primary strategy with a JS fallback
 * for browsers that don't support it (Firefox, Safari as of late 2025).
 */
const OVERLAY_STYLES = /* css */ `
.tbw-overlay-panel {
  position: fixed;
  z-index: 10000;
  background: var(--tbw-overlay-bg, #fff);
  border: 1px solid var(--tbw-overlay-border, #ccc);
  border-radius: var(--tbw-overlay-radius, 4px);
  box-shadow: var(--tbw-overlay-shadow, 0 4px 12px rgba(0, 0, 0, 0.15));
  box-sizing: border-box;
  overflow: auto;
}

.tbw-overlay-panel:popover-open {
  display: block;
}

@supports (anchor-name: --a) {
  .tbw-overlay-panel[data-anchor-id] {
    position: fixed;
    position-anchor: var(--tbw-overlay-anchor);
    inset: unset;
  }
  .tbw-overlay-panel[data-pos="below"] {
    top: anchor(bottom);
    left: anchor(left);
    position-try-fallbacks: flip-block;
  }
  .tbw-overlay-panel[data-pos="above"] {
    bottom: anchor(top);
    left: anchor(left);
    position-try-fallbacks: flip-block;
  }
  .tbw-overlay-panel[data-pos="below-right"] {
    top: anchor(bottom);
    right: anchor(right);
    position-try-fallbacks: flip-block;
  }
  .tbw-overlay-panel[data-pos="over-top-left"] {
    top: anchor(top);
    left: anchor(left);
  }
  .tbw-overlay-panel[data-pos="over-bottom-left"] {
    bottom: anchor(bottom);
    left: anchor(left);
  }
}
`;

function ensureOverlayStyles(): void {
  if (overlayStylesInjected) return;
  overlayStylesInjected = true;

  const style = document.createElement('style');
  style.setAttribute('data-tbw-overlay', '');
  style.textContent = OVERLAY_STYLES;
  document.head.appendChild(style);
}

// #endregion

// #region Anchor ID Counter
let anchorCounter = 0;
// #endregion

/**
 * Base class for grid editors that display a floating overlay panel.
 *
 * Provides infrastructure for:
 * - **Overlay positioning** — CSS Anchor Positioning with JS fallback
 * - **Focus gating** — in row editing mode, the panel only opens for the focused cell
 * - **Click-outside detection** — closes the panel when clicking outside
 * - **MutationObserver** — detects cell focus changes (row editing mode)
 * - **Escape handling** — closes the panel and returns focus to the inline input
 * - **Synthetic Tab dispatch** — advances grid focus after overlay close
 * - **Automatic teardown** — removes the panel from `<body>` and cleans up listeners
 * - **External focus registration** — auto-registers the panel via `grid.registerExternalFocusContainer()` so the grid keeps `data-has-focus` and editors stay open while the overlay has focus
 *
 * ## Usage
 *
 * ```typescript
 * import { Component, ViewChild, ElementRef } from '@angular/core';
 * import { BaseOverlayEditor } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-date-editor',
 *   template: `
 *     <input
 *       #inlineInput
 *       readonly
 *       [value]="currentValue()"
 *       (click)="onInlineClick()"
 *       (keydown)="onInlineKeydown($event)"
 *     />
 *     <div #panel class="tbw-overlay-panel" style="width: 280px;">
 *       <!-- your date picker UI here -->
 *       <div class="actions">
 *         <button (click)="selectAndClose(selectedDate)">OK</button>
 *         <button (click)="hideOverlay()">Cancel</button>
 *       </div>
 *     </div>
 *   `
 * })
 * export class DateEditorComponent extends BaseOverlayEditor<MyRow, string> {
 *   @ViewChild('panel') panelRef!: ElementRef<HTMLElement>;
 *   @ViewChild('inlineInput') inputRef!: ElementRef<HTMLInputElement>;
 *
 *   protected override overlayPosition = 'below' as const;
 *
 *   ngAfterViewInit(): void {
 *     this.initOverlay(this.panelRef.nativeElement);
 *     if (this.isCellFocused()) this.showOverlay();
 *   }
 *
 *   protected getInlineInput(): HTMLInputElement | null {
 *     return this.inputRef?.nativeElement ?? null;
 *   }
 *
 *   protected onOverlayOutsideClick(): void {
 *     this.hideOverlay();
 *   }
 *
 *   selectAndClose(date: string): void {
 *     this.commitValue(date);
 *     this.hideOverlay();
 *   }
 * }
 * ```
 *
 * @typeParam TRow - The row data type
 * @typeParam TValue - The cell value type
 */
@Directive()
export abstract class BaseOverlayEditor<TRow = unknown, TValue = unknown> extends BaseGridEditor<TRow, TValue> {
  private readonly _elementRef = inject(ElementRef);
  private readonly _overlayDestroyRef = inject(DestroyRef);

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Position of the overlay panel relative to the anchor cell.
   * Override in subclasses to change the default position.
   *
   * @default 'below'
   */
  protected overlayPosition: OverlayPosition = 'below';

  // ============================================================================
  // Internal State
  // ============================================================================

  /** The overlay panel element (set via `initOverlay()`). */
  private _panel: HTMLElement | null = null;

  /** Whether the overlay is currently visible. */
  protected _isOpen = false;

  /** Unique anchor ID for CSS Anchor Positioning. */
  private _anchorId = '';

  /** Whether the browser supports CSS Anchor Positioning. */
  private _supportsAnchor = false;

  /** AbortController for all overlay-related listeners. */
  private _abortCtrl: AbortController | null = null;

  /** MutationObserver watching cell focus class changes. */
  protected _focusObserver: MutationObserver | null = null;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  constructor() {
    super();
    this._supportsAnchor = typeof CSS !== 'undefined' && CSS.supports('anchor-name', '--a');
    ensureOverlayStyles();

    afterNextRender(() => this._setupFocusObserver());
    this._overlayDestroyRef.onDestroy(() => this.teardownOverlay());
  }

  // ============================================================================
  // Public API — Subclass Interface
  // ============================================================================

  /**
   * Initialise the overlay with the panel element.
   *
   * Call this in `ngAfterViewInit` with your `@ViewChild` panel reference.
   * The panel is moved to `<body>` and hidden until {@link showOverlay} is called.
   *
   * @param panel - The overlay panel DOM element
   */
  protected initOverlay(panel: HTMLElement): void {
    this._panel = panel;

    // Assign a unique anchor ID
    this._anchorId = `tbw-anchor-${++anchorCounter}`;
    panel.classList.add('tbw-overlay-panel');
    panel.setAttribute('data-pos', this.overlayPosition);
    panel.setAttribute('data-anchor-id', this._anchorId);
    panel.style.display = 'none';

    // Set up CSS Anchor Positioning on the cell
    if (this._supportsAnchor) {
      const cell = this._getCell();
      if (cell) {
        cell.style.setProperty('anchor-name', `--${this._anchorId}`);
        panel.style.setProperty('--tbw-overlay-anchor', `--${this._anchorId}`);
      }
    }

    // Move panel to body so it escapes grid overflow clipping
    document.body.appendChild(panel);

    // Register the panel as an external focus container on the grid
    // so focus moving into the overlay is treated as "still in the grid"
    this._getGridElement()?.registerExternalFocusContainer?.(panel);

    // Set up click-outside detection
    this._abortCtrl = new AbortController();
    document.addEventListener('pointerdown', (e) => this._onDocumentPointerDown(e), {
      signal: this._abortCtrl.signal,
    });
  }

  /**
   * Show the overlay panel.
   *
   * If CSS Anchor Positioning is not supported, falls back to JS-based
   * positioning using `getBoundingClientRect()`.
   */
  protected showOverlay(): void {
    if (!this._panel || this._isOpen) return;

    this._isOpen = true;
    this._panel.style.display = '';

    // JS fallback positioning for browsers without CSS Anchor Positioning
    if (!this._supportsAnchor) {
      this._positionWithJs();
    }
  }

  /**
   * Hide the overlay panel.
   *
   * @param suppressTabAdvance - When `true`, skip synthetic Tab dispatch
   *   (useful when hiding is triggered by an external focus change).
   */
  protected hideOverlay(suppressTabAdvance?: boolean): void {
    if (!this._panel || !this._isOpen) return;

    this._isOpen = false;
    this._panel.style.display = 'none';

    if (!suppressTabAdvance) {
      this.getInlineInput()?.focus();
    }
  }

  /**
   * Close and immediately re-open the overlay.
   * Useful after the panel content changes size and needs repositioning.
   */
  protected reopenOverlay(): void {
    if (!this._panel) return;
    this._isOpen = false;
    this._panel.style.display = 'none';
    this.showOverlay();
  }

  /**
   * Remove the overlay from the DOM and clean up all listeners.
   *
   * Called automatically on `DestroyRef.onDestroy`. Can also be called
   * manually if the editor needs early cleanup.
   */
  protected teardownOverlay(): void {
    this._abortCtrl?.abort();
    this._abortCtrl = null;

    this._focusObserver?.disconnect();
    this._focusObserver = null;

    // Unregister the panel from the grid's external focus container registry
    if (this._panel) {
      this._getGridElement()?.unregisterExternalFocusContainer?.(this._panel);
    }

    if (this._panel?.parentNode) {
      this._panel.parentNode.removeChild(this._panel);
    }
    this._panel = null;
    this._isOpen = false;

    // Clean up anchor-name on the cell
    if (this._supportsAnchor) {
      const cell = this._getCell();
      if (cell) {
        cell.style.removeProperty('anchor-name');
      }
    }
  }

  /**
   * Override in `edit-close` handler to also hide the overlay.
   * This is called automatically by `BaseGridEditor` when the grid
   * ends the editing session.
   */
  protected override onEditClose(): void {
    this.hideOverlay(true);
  }

  // ============================================================================
  // Keyboard & Click Helpers
  // ============================================================================

  /**
   * Keydown handler for the inline readonly input.
   *
   * - **Enter / Space / ArrowDown / F2** → open overlay
   * - **Escape** → calls {@link handleEscape}
   *
   * Bind this to `(keydown)` on your inline input element.
   */
  onInlineKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
      case 'F2':
        event.preventDefault();
        this.showOverlay();
        this.onOverlayOpened();
        break;
      case 'Escape':
        this.handleEscape(event);
        break;
    }
  }

  /**
   * Click handler for the inline input.
   * Opens the overlay and calls {@link onOverlayOpened}.
   *
   * Bind this to `(click)` on your inline input element.
   */
  onInlineClick(): void {
    if (this._isOpen) {
      this.hideOverlay();
    } else {
      this.showOverlay();
      this.onOverlayOpened();
    }
  }

  /**
   * Handle Escape key press.
   *
   * If the overlay is open, closes it and returns focus to the inline input.
   * If the overlay is already closed, cancels the edit entirely.
   */
  protected handleEscape(event: Event): void {
    if (this._isOpen) {
      event.stopPropagation();
      this.hideOverlay();
    } else {
      this.cancelEdit();
    }
  }

  /**
   * Dispatch a synthetic Tab key event to advance grid focus.
   *
   * Call this after committing a value and closing the overlay so the
   * grid moves focus to the next cell.
   *
   * @param backward - When `true`, dispatch Shift+Tab to move backwards.
   */
  protected advanceGridFocus(backward = false): void {
    const cell = this._getCell();
    if (!cell) return;

    cell.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: backward,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  // ============================================================================
  // Abstract / Hook Methods
  // ============================================================================

  /**
   * Return the inline input element, if any.
   *
   * Used by overlay infrastructure to return focus after hiding.
   * Return `null` if there is no inline input.
   */
  protected abstract getInlineInput(): HTMLInputElement | null;

  /**
   * Called when a pointerdown event occurs outside the overlay panel
   * and outside the editor's host element.
   *
   * Typically, subclasses call `hideOverlay()` here.
   */
  protected abstract onOverlayOutsideClick(): void;

  /**
   * Called after the overlay is shown.
   *
   * Override to focus an element inside the panel, start animations, etc.
   * Default implementation is a no-op.
   */
  protected onOverlayOpened(): void {
    // Default: no-op. Subclasses override.
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /** Find the parent cell element for this editor. */
  private _getCell(): HTMLElement | null {
    return this._elementRef.nativeElement.closest('[part="cell"]') ?? null;
  }

  /** Find the parent `<tbw-grid>` element for this editor. */
  private _getGridElement():
    | (HTMLElement & {
        registerExternalFocusContainer?(el: Element): void;
        unregisterExternalFocusContainer?(el: Element): void;
      })
    | null {
    return this._elementRef.nativeElement.closest('tbw-grid') ?? null;
  }

  /**
   * JS fallback positioning for browsers without CSS Anchor Positioning.
   * Uses `getBoundingClientRect()` with viewport overflow detection.
   */
  private _positionWithJs(): void {
    const cell = this._getCell();
    const panel = this._panel;
    if (!cell || !panel) return;

    const cellRect = cell.getBoundingClientRect();

    // Temporarily make visible to measure
    panel.style.visibility = 'hidden';
    panel.style.display = '';
    const panelRect = panel.getBoundingClientRect();
    panel.style.visibility = '';

    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    let top: number;
    let left: number;

    switch (this.overlayPosition) {
      case 'above': {
        top = cellRect.top - panelRect.height;
        left = cellRect.left;
        // Flip to below if off-screen
        if (top < 0) top = cellRect.bottom;
        break;
      }
      case 'below-right': {
        top = cellRect.bottom;
        left = cellRect.right - panelRect.width;
        // Flip to above if off-screen
        if (top + panelRect.height > viewportH) top = cellRect.top - panelRect.height;
        break;
      }
      case 'over-top-left': {
        top = cellRect.top;
        left = cellRect.left;
        break;
      }
      case 'over-bottom-left': {
        top = cellRect.bottom - panelRect.height;
        left = cellRect.left;
        break;
      }
      case 'below':
      default: {
        top = cellRect.bottom;
        left = cellRect.left;
        // Flip to above if off-screen
        if (top + panelRect.height > viewportH) top = cellRect.top - panelRect.height;
        break;
      }
    }

    // Clamp to viewport
    if (left + panelRect.width > viewportW) left = viewportW - panelRect.width - 4;
    if (left < 0) left = 4;
    if (top < 0) top = 4;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  /**
   * Document pointerdown handler for click-outside detection.
   * Fires `onOverlayOutsideClick()` if the click is outside the panel
   * and outside the editor's host element.
   */
  private _onDocumentPointerDown(event: PointerEvent): void {
    if (!this._isOpen || !this._panel) return;

    const target = event.target as Node;
    const hostEl = this._elementRef.nativeElement;

    // Click inside panel or host — ignore
    if (this._panel.contains(target) || hostEl.contains(target)) return;

    this.onOverlayOutsideClick();
  }

  /**
   * Set up a MutationObserver on the parent cell to watch for
   * `cell-focus` class changes. This handles row-editing mode where
   * all editors exist simultaneously but only the focused cell's
   * editor should have its overlay visible.
   *
   * A `justOpened` flash guard suppresses the observer from
   * immediately closing the overlay when `beginBulkEdit()` moves
   * focus to the first editable column. Without this guard,
   * double-click triggers a "flash open then close" effect.
   */
  protected _setupFocusObserver(): void {
    const cell = this._getCell();
    if (!cell) return;

    let justOpened = false;

    let pendingHideRaf = 0;

    this._focusObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;

        const isFocused = cell.classList.contains('cell-focus');
        if (isFocused && !this._isOpen) {
          // Cell just gained focus — cancel any pending hide and open overlay.
          if (pendingHideRaf) {
            cancelAnimationFrame(pendingHideRaf);
            pendingHideRaf = 0;
          }
          justOpened = true;
          this.showOverlay();
          this.onOverlayOpened();
          // Clear the guard after a macrotask so that an immediate
          // focus-away (e.g. beginBulkEdit focus adjustment) does
          // not close the overlay in the same event loop tick.
          setTimeout(() => {
            justOpened = false;
          }, 0);
        } else if (!isFocused && this._isOpen && !justOpened) {
          // Cell lost focus — defer hide to allow render cycles to settle.
          // Re-renders (e.g., from ResizeObserver after a footer appears)
          // may transiently toggle cell-focus within the same frame.
          // Deferring to the next animation frame lets the render pipeline
          // finish before we decide whether the overlay should actually close.
          if (pendingHideRaf) cancelAnimationFrame(pendingHideRaf);
          pendingHideRaf = requestAnimationFrame(() => {
            pendingHideRaf = 0;
            // Re-check settled state — cell-focus may have been re-applied
            if (!cell.classList.contains('cell-focus') && this._isOpen) {
              this.hideOverlay(true);
            }
          });
        }
      }
    });

    this._focusObserver.observe(cell, { attributes: true, attributeFilter: ['class'] });
  }
}
