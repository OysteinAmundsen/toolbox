/**
 * Touch selection mode — long-press to enter, tap to toggle, tap "Done" to exit.
 *
 * This module owns the *presentation* half of the touch selection idiom
 * (#304): the selection-mode toolbar and the cell-range corner handles.
 * The state machine itself lives in `SelectionPlugin`, which drives these two
 * classes from its `afterRender()` hook.
 *
 * @module
 * @since 3.5.0
 */

import { startPointerDrag } from '../../core/internal/pointer-drag';

// #region Types

/**
 * What happens to the selection when touch selection mode is exited.
 *
 * - `'transient'` (default) — leaving selection mode clears the selection, the
 *   Gmail / Google Photos behaviour. The mode *is* the selection.
 * - `'sticky'` — the selection survives, so a subsequent tap-to-toggle round
 *   can start from what was already selected.
 *
 * @since 3.5.0
 */
export type TouchSelectionMode = 'sticky' | 'transient';

/** Callbacks the toolbar invokes; all are supplied by `SelectionPlugin`. */
export interface SelectionToolbarCallbacks {
  /** "Select all" pressed. */
  selectAll(): void;
  /** "Clear" pressed. */
  clear(): void;
  /** "Done" pressed — exit selection mode. */
  done(): void;
  /** "More…" pressed. Receives the button so a menu can be anchored to it. */
  more(anchor: HTMLElement): void;
}

/** A normalized rectangle in (row, visible-column) space. */
export interface RangeRect {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Which corner of the range rectangle a handle controls. */
export type RangeCorner = 'start' | 'end';

/** Callbacks the corner handles invoke while being dragged. */
export interface RangeHandleCallbacks {
  /** Resolve the cell under a viewport coordinate, or `null` if there is none. */
  cellAt(clientX: number, clientY: number): { row: number; col: number } | null;
  /** The dragged corner moved to a new cell. */
  resize(corner: RangeCorner, row: number, col: number): void;
  /** The drag finished (pointerup) or was aborted (Escape / pointercancel). */
  commit(): void;
  /**
   * The handle was pressed and released without moving — a tap, not a drag.
   * The non-dragging path required by WCAG 2.2 SC 2.5.7: the plugin arms this
   * corner and the next cell tap places it.
   */
  arm(corner: RangeCorner): void;
}

// #endregion

// #region Selection-mode toolbar

/** CSS class of the toolbar root. Also used by `selection.css`. */
const TOOLBAR_CLASS = 'tbw-selection-toolbar';

/**
 * The sticky "N selected · Select all · Clear · More… · Done" bar shown while
 * touch selection mode is active.
 *
 * Mounted lazily on first {@link SelectionToolbar.show} and torn down by
 * {@link SelectionToolbar.destroy}. Buttons are `type="button"` so the bar can
 * safely live inside a host form.
 */
export class SelectionToolbar {
  #root: HTMLElement | null = null;
  #count: HTMLElement | null = null;
  #more: HTMLButtonElement | null = null;
  #callbacks: SelectionToolbarCallbacks | null = null;

  /** True while the toolbar is in the DOM. */
  get mounted(): boolean {
    return this.#root !== null;
  }

  /** The toolbar root element, or `null` when not mounted. Test seam. */
  get element(): HTMLElement | null {
    return this.#root;
  }

  /**
   * Mount (if needed) and update the toolbar.
   *
   * @param container Element the toolbar is prepended to — normally `.tbw-grid-root`.
   * @param selectedCount Number of selected items, rendered as "N selected".
   * @param showMore Whether the "More…" overflow button is rendered. Only true
   *   when a `ContextMenuPlugin` is registered, so touch users keep parity with
   *   the right-click menu.
   */
  show(container: HTMLElement, selectedCount: number, showMore: boolean, callbacks: SelectionToolbarCallbacks): void {
    this.#callbacks = callbacks;
    if (!this.#root) this.#mount(container);
    if (this.#count) {
      this.#count.textContent = `${selectedCount} selected`;
    }
    this.#root?.setAttribute('data-selected-count', String(selectedCount));
    if (this.#more) this.#more.hidden = !showMore;
  }

  /** Remove the toolbar from the DOM. Safe to call when not mounted. */
  destroy(): void {
    this.#root?.remove();
    this.#root = null;
    this.#count = null;
    this.#more = null;
    this.#callbacks = null;
  }

  #mount(container: HTMLElement): void {
    const root = container.ownerDocument.createElement('div');
    root.className = TOOLBAR_CLASS;
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Selection');

    const count = container.ownerDocument.createElement('span');
    count.className = `${TOOLBAR_CLASS}-count`;
    count.setAttribute('aria-live', 'polite');
    root.appendChild(count);

    const actions = container.ownerDocument.createElement('div');
    actions.className = `${TOOLBAR_CLASS}-actions`;
    root.appendChild(actions);

    actions.appendChild(this.#button(container, 'select-all', 'Select all', () => this.#callbacks?.selectAll()));
    actions.appendChild(this.#button(container, 'clear', 'Clear', () => this.#callbacks?.clear()));
    const more = this.#button(container, 'more', 'More…', (btn) => this.#callbacks?.more(btn));
    more.setAttribute('aria-haspopup', 'menu');
    actions.appendChild(more);
    actions.appendChild(this.#button(container, 'done', 'Done', () => this.#callbacks?.done()));

    container.prepend(root);
    this.#root = root;
    this.#count = count;
    this.#more = more;
  }

  #button(
    container: HTMLElement,
    action: string,
    label: string,
    onClick: (btn: HTMLButtonElement) => void,
  ): HTMLButtonElement {
    const btn = container.ownerDocument.createElement('button');
    btn.type = 'button';
    btn.className = `${TOOLBAR_CLASS}-btn`;
    btn.dataset.action = action;
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(btn);
    });
    return btn;
  }
}

// #endregion

// #region Cell-range corner handles

/** CSS class of a corner handle. Also used by `selection.css`. */
const HANDLE_CLASS = 'tbw-range-handle';

/**
 * The two draggable dots at the top-left and bottom-right corners of an active
 * cell range (the iOS Numbers / Google Sheets idiom).
 *
 * They are additive rather than touch-only: a mouse user can drag them too.
 * Whether they are rendered at all is decided by `SelectionPlugin`, which only
 * asks for them when the range was started by a coarse pointer.
 * Positioning is recomputed on every render because the grid recycles row DOM
 * during virtualization, so a handle's anchor cell may not exist at all after
 * a scroll — in that case the handle is simply hidden.
 */
export class RangeCornerHandles {
  #start: HTMLElement | null = null;
  #end: HTMLElement | null = null;
  #callbacks: RangeHandleCallbacks | null = null;
  #armed: RangeCorner | null = null;

  /**
   * Render (or hide) the handles for `rect`.
   *
   * @param container Positioned ancestor the handles are absolutely placed in.
   * @param rect The normalized range, or `null` to hide the handles.
   * @param cellFor Resolves the DOM cell for a (row, col) pair, or `undefined`
   *   when that cell is outside the rendered window.
   */
  render(
    container: HTMLElement,
    rect: RangeRect | null,
    cellFor: (row: number, col: number) => HTMLElement | null,
    callbacks: RangeHandleCallbacks,
  ): void {
    this.#callbacks = callbacks;
    if (!rect) {
      this.#hide();
      return;
    }

    this.#start ??= this.#createHandle(container, 'start');
    this.#end ??= this.#createHandle(container, 'end');

    this.#place(container, this.#start, cellFor(rect.startRow, rect.startCol), 'start');
    this.#place(container, this.#end, cellFor(rect.endRow, rect.endCol), 'end');
    this.setArmed(this.#armed);
  }

  /**
   * Mark one corner as waiting for the tap that will place it, or clear the
   * marking with `null`. Purely presentational — the plugin owns the state.
   */
  setArmed(corner: RangeCorner | null): void {
    this.#armed = corner;
    for (const [handle, name] of [
      [this.#start, 'start'],
      [this.#end, 'end'],
    ] as const) {
      if (!handle) continue;
      const on = corner === name;
      handle.classList.toggle('armed', on);
      handle.setAttribute('aria-pressed', String(on));
    }
  }

  /** Remove both handles from the DOM. Safe to call when not rendered. */
  destroy(): void {
    this.#start?.remove();
    this.#end?.remove();
    this.#start = null;
    this.#end = null;
    this.#callbacks = null;
    this.#armed = null;
  }

  #hide(): void {
    if (this.#start) this.#start.hidden = true;
    if (this.#end) this.#end.hidden = true;
  }

  #place(container: HTMLElement, handle: HTMLElement | null, cell: HTMLElement | null, corner: RangeCorner): void {
    if (!handle) return;
    if (!cell) {
      handle.hidden = true;
      return;
    }
    handle.hidden = false;
    // getBoundingClientRect is unavailable/zeroed in some test environments;
    // the handle still renders (and is assertable) with a zero offset.
    const cellRect = cell.getBoundingClientRect?.();
    const hostRect = container.getBoundingClientRect?.();
    if (!cellRect || !hostRect) return;
    const x = corner === 'start' ? cellRect.left - hostRect.left : cellRect.right - hostRect.left;
    const y = corner === 'start' ? cellRect.top - hostRect.top : cellRect.bottom - hostRect.top;
    handle.style.left = `${x}px`;
    handle.style.top = `${y}px`;
  }

  #createHandle(container: HTMLElement, corner: RangeCorner): HTMLElement {
    const el = container.ownerDocument.createElement('div');
    el.className = `${HANDLE_CLASS} ${HANDLE_CLASS}-${corner}`;
    el.dataset.corner = corner;
    // A real button, not decoration: it is tappable as well as draggable, so it
    // needs a name and a pressed state for the armed (tap-to-place) mode.
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-pressed', 'false');
    el.setAttribute(
      'aria-label',
      corner === 'start'
        ? 'Selection start corner — drag, or activate to place it with a tap'
        : 'Selection end corner — drag, or activate to place it with a tap',
    );
    el.addEventListener('pointerdown', (e) => this.#onPointerDown(e as PointerEvent, el, corner));
    container.appendChild(el);
    return el;
  }

  #onPointerDown(e: PointerEvent, handle: HTMLElement, corner: RangeCorner): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    const callbacks = this.#callbacks;
    if (!callbacks) return;

    handle.classList.add('dragging');
    // `startPointerDrag` promotes immediately with these options, so `onMove`
    // firing at least once is the only reliable signal that this was a drag.
    let moved = false;
    const finish = (): void => {
      handle.classList.remove('dragging');
      callbacks.commit();
    };
    startPointerDrag(e, handle, {
      onMove: (moveEvent) => {
        moved = true;
        const target = callbacks.cellAt(moveEvent.clientX, moveEvent.clientY);
        if (target) callbacks.resize(corner, target.row, target.col);
      },
      onEnd: () => {
        handle.classList.remove('dragging');
        if (moved) callbacks.commit();
        else callbacks.arm(corner);
      },
      // An aborted drag still leaves the range wherever the last move put it,
      // so the plugin must re-render — but it is never a tap.
      onCancel: finish,
    });
  }
}

// #endregion
