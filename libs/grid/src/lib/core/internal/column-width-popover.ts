/**
 * Non-drag alternative for column resizing — WCAG 2.2 SC 2.5.7 "Dragging Movements".
 *
 * Dragging the resize handle is the primary gesture, but a single-pointer user
 * (trackball, head pointer, eye-gaze, speech mouse emulator) cannot reliably
 * press-hold-move-release. Tapping the handle instead opens this popover, which
 * offers the same functionality through plain clicks: step buttons, a numeric
 * input, and a reset. A keyboard alternative alone would **not** satisfy the
 * criterion — it is specifically about pointer input.
 *
 * This module is **internal only** — NOT exported from `src/public.ts`.
 *
 * @since 3.6.0
 * @internal
 */

/** Width change per click of the − / + buttons, in px. */
const STEP_PX = 16;

/** Gap between the anchor handle and the popover, in px. */
const ANCHOR_GAP_PX = 6;

/** Runtime check — happy-dom and older browsers may lack the Popover API. */
function supportsPopover(): boolean {
  return typeof HTMLElement.prototype?.showPopover === 'function';
}

/**
 * Callbacks the popover needs to read and write the column it is editing.
 * Supplied by the resize controller so both the drag and the click path share
 * one clamping/commit implementation.
 */
export interface ColumnWidthPopoverCallbacks {
  /** Current rendered width of the column, in px. */
  getWidth(colIndex: number): number;
  /** Commit an explicit width (implementation clamps to the column's `minWidth`). */
  setWidth(colIndex: number, width: number): void;
  /** Restore the column's configured width. */
  reset(colIndex: number): void;
  /** Human-readable column name, for the popover's accessible name. */
  getLabel(colIndex: number): string;
  /**
   * The grid host. The popover is mounted INSIDE it (the grid renders in light
   * DOM) so it inherits the theme's custom properties and `color-scheme`; the
   * top layer keeps it clear of ancestor overflow. `buildBareGridDOMIntoElement`
   * preserves foreign direct children, so it survives re-renders.
   */
  getHost(): HTMLElement | null;
}

export interface ColumnWidthPopover {
  /** Show the popover for `colIndex`, positioned against `anchor`. */
  open(colIndex: number, anchor: HTMLElement): void;
  /** Hide the popover. Safe to call when already closed. */
  close(): void;
  /** Remove the popover element and every document-level listener. */
  dispose(): void;
  /** The popover element, or `null` before the first {@link ColumnWidthPopover.open}. */
  readonly element: HTMLElement | null;
}

function button(className: string, label: string, text: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.setAttribute('aria-label', label);
  el.textContent = text;
  return el;
}

export function createColumnWidthPopover(callbacks: ColumnWidthPopoverCallbacks): ColumnWidthPopover {
  let root: HTMLDivElement | null = null;
  let input: HTMLInputElement | null = null;
  let anchorEl: HTMLElement | null = null;
  let colIndex = -1;
  let opened = false;
  let disposed = false;
  const abort = new AbortController();

  function close(): void {
    if (!opened || !root) return;
    opened = false;
    if (supportsPopover()) root.hidePopover();
    root.hidden = true;
    anchorEl?.removeAttribute('data-tbw-width-open');
    anchorEl = null;
  }

  function sync(): void {
    if (input) input.value = String(Math.round(callbacks.getWidth(colIndex)));
  }

  function apply(width: number): void {
    if (!Number.isFinite(width)) return;
    callbacks.setWidth(colIndex, width);
    sync();
  }

  function build(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = 'tbw-column-width-popover';
    el.className = 'tbw-column-width-popover';
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'group');
    // Without the Popover API there is no UA `display: none`, so hide it here.
    el.hidden = true;

    const minus = button('tbw-column-width-step', 'Narrower', '\u2212');
    const plus = button('tbw-column-width-step', 'Wider', '+');
    const reset = button('tbw-column-width-reset', 'Reset column width', 'Reset');

    const field = document.createElement('input');
    field.type = 'number';
    field.className = 'tbw-column-width-input';
    field.min = '0';
    field.step = String(STEP_PX);
    field.setAttribute('aria-label', 'Column width in pixels');

    minus.addEventListener('click', () => apply(callbacks.getWidth(colIndex) - STEP_PX), { signal: abort.signal });
    plus.addEventListener('click', () => apply(callbacks.getWidth(colIndex) + STEP_PX), { signal: abort.signal });
    reset.addEventListener(
      'click',
      () => {
        callbacks.reset(colIndex);
        sync();
      },
      { signal: abort.signal },
    );
    field.addEventListener('change', () => apply(field.valueAsNumber), { signal: abort.signal });

    // Tabbing past either end dismisses instead of stranding the user — the
    // popover has no visible trigger to tab back to. A null `relatedTarget`
    // (click focus in Firefox/Safari, focus leaving the document) is ignored.
    el.addEventListener(
      'focusout',
      (e) => {
        const next = (e as FocusEvent).relatedTarget;
        if (next instanceof Node && !el.contains(next)) close();
      },
      { signal: abort.signal },
    );

    el.append(minus, field, plus, reset);
    input = field;
    return el;
  }

  /**
   * Position against the anchor in viewport coordinates. The popover lives in
   * the top layer, so its containing block is the viewport regardless of where
   * the anchor sits in the DOM.
   *
   * Called once per open and never again: repeatedly clicking − / + moves the
   * border, and following it would slide the button out from under the pointer
   * of the very users this control exists for. The handle keeps its indicator
   * line lit instead (`data-tbw-width-open`) to show which border is being sized.
   */
  function place(anchor: HTMLElement): void {
    if (!root) return;
    const a = anchor.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const left = Math.max(4, Math.min(a.left + a.width / 2 - box.width / 2, window.innerWidth - box.width - 4));
    const below = a.bottom + ANCHOR_GAP_PX;
    const top = below + box.height <= window.innerHeight ? below : Math.max(4, a.top - ANCHOR_GAP_PX - box.height);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  // Any pointer press outside the popover dismisses it. Capture phase so the
  // press that lands on a grid cell still reaches its own handler afterwards.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (opened && root && !e.composedPath().includes(root)) close();
    },
    { capture: true, signal: abort.signal },
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e as KeyboardEvent).key === 'Escape') close();
    },
    { capture: true, signal: abort.signal },
  );

  return {
    get element() {
      return root;
    },
    open(index, anchor) {
      if (disposed) return;
      colIndex = index;
      anchorEl?.removeAttribute('data-tbw-width-open');
      anchorEl = anchor;
      anchor.setAttribute('data-tbw-width-open', '');
      if (!root) root = build();
      const host = callbacks.getHost() ?? document.body;
      if (root.parentNode !== host) host.appendChild(root);
      root.setAttribute('aria-label', `Width of column ${callbacks.getLabel(index)}`);
      sync();
      root.hidden = false;
      if (!opened && supportsPopover()) root.showPopover();
      opened = true;
      place(anchor);
      input?.focus();
    },
    close,
    dispose() {
      disposed = true;
      close();
      abort.abort();
      root?.remove();
      root = null;
      input = null;
    },
  };
}
