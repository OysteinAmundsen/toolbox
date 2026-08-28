/**
 * Non-drag alternative for resizing — WCAG 2.2 SC 2.5.7 "Dragging Movements".
 *
 * Dragging a splitter is the primary gesture, but a single-pointer user
 * (trackball, head pointer, eye-gaze, speech mouse emulator) cannot reliably
 * press-hold-move-release. Tapping the splitter instead opens this popover,
 * which offers the same functionality through plain clicks: step buttons, a
 * numeric input, and a reset. A keyboard alternative alone would **not**
 * satisfy the criterion — it is specifically about pointer input.
 *
 * Target-agnostic on purpose: core column resizing and the shell's tool-panel
 * splitter share it, so every resizable thing in the grid presents the same
 * control instead of one-off menus.
 *
 * This module is **internal only** — NOT exported from `src/public.ts`.
 *
 * @since 3.6.0
 * @internal
 */

/** Default size change per click of the − / + buttons, in px. */
const DEFAULT_STEP_PX = 16;

/** Gap between the anchor handle and the popover, in px. */
const ANCHOR_GAP_PX = 6;

/** Runtime check — happy-dom and older browsers may lack the Popover API. */
function supportsPopover(): boolean {
  return typeof HTMLElement.prototype?.showPopover === 'function';
}

/**
 * How the popover reads and writes whatever it is sizing. `T` identifies the
 * target — a column index for the header, the panel element for the shell.
 *
 * Supplied by the owning controller so the drag and the click path share one
 * clamping/commit implementation.
 */
export interface SizePopoverOptions<T> {
  /** DOM id for the popover element, unique per owning controller. */
  id: string;
  /** Size change per click of the − / + buttons. Defaults to 16px. */
  step?: number;
  /** Current rendered size of the target, in px. */
  getSize(target: T): number;
  /** Commit an explicit size (implementation clamps to its own limits). */
  setSize(target: T, size: number): void;
  /** Restore the target's configured size. */
  reset(target: T): void;
  /** Accessible name for the popover, e.g. `"Width of column Name"`. */
  getLabel(target: T): string;
  /**
   * The grid host. The popover is mounted INSIDE it (the grid renders in light
   * DOM) so it inherits the theme's custom properties and `color-scheme`; the
   * top layer keeps it clear of ancestor overflow. `buildBareGridDOMIntoElement`
   * preserves foreign direct children, so it survives re-renders.
   */
  getHost(target: T): HTMLElement | null;
}

export interface SizePopover<T> {
  /** Show the popover for `target`, positioned against `anchor`. */
  open(target: T, anchor: HTMLElement): void;
  /** Hide the popover. Safe to call when already closed. */
  close(): void;
  /** Remove the popover element and every document-level listener. */
  dispose(): void;
  /** The popover element, or `null` before the first {@link SizePopover.open}. */
  readonly element: HTMLElement | null;
}

function button(label: string, text: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tbw-size-popover-btn';
  el.setAttribute('aria-label', label);
  el.textContent = text;
  return el;
}

export function createSizePopover<T>(options: SizePopoverOptions<T>): SizePopover<T> {
  const step = options.step ?? DEFAULT_STEP_PX;
  let root: HTMLDivElement | null = null;
  let input: HTMLInputElement | null = null;
  let anchorEl: HTMLElement | null = null;
  let target: T;
  let opened = false;
  let disposed = false;
  const abort = new AbortController();

  function close(): void {
    if (!opened || !root) return;
    opened = false;
    if (supportsPopover()) root.hidePopover();
    root.hidden = true;
    anchorEl?.removeAttribute('data-tbw-size-open');
    anchorEl = null;
  }

  function sync(): void {
    if (input) input.value = String(Math.round(options.getSize(target)));
  }

  function apply(size: number): void {
    if (!Number.isFinite(size)) return;
    options.setSize(target, size);
    sync();
  }

  function build(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = options.id;
    el.className = 'tbw-size-popover';
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'group');
    // Without the Popover API there is no UA `display: none`, so hide it here.
    el.hidden = true;

    const minus = button('Narrower', '\u2212');
    const plus = button('Wider', '+');
    const reset = button('Reset size', 'Reset');

    const field = document.createElement('input');
    field.type = 'number';
    field.className = 'tbw-size-popover-input';
    field.min = '0';
    // `step` belongs to the − / + buttons, not the field: a measured size is
    // rarely a multiple of it, and a step mismatch would mark the field
    // `:invalid` and expose `aria-invalid="true"` for a perfectly valid width.
    field.step = 'any';
    field.setAttribute('aria-label', 'Size in pixels');

    minus.addEventListener('click', () => apply(options.getSize(target) - step), { signal: abort.signal });
    plus.addEventListener('click', () => apply(options.getSize(target) + step), { signal: abort.signal });
    reset.addEventListener(
      'click',
      () => {
        options.reset(target);
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
   * anchor, and following it would slide the button out from under the pointer
   * of the very users this control exists for. The anchor keeps its indicator
   * lit instead (`data-tbw-size-open`) to show which edge is being sized.
   */
  function place(anchor: HTMLElement): void {
    if (!root) return;
    const a = anchor.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.max(4, Math.min(v, max - 4));
    const left = clamp(a.left + a.width / 2 - box.width / 2, window.innerWidth - box.width);

    // A full-height anchor (the tool-panel splitter) has no meaningful "below":
    // it would land past the bottom of the grid. Sit against its middle instead.
    const below = a.bottom + ANCHOR_GAP_PX;
    const above = a.top - ANCHOR_GAP_PX - box.height;
    const tall = a.height > box.height * 3;
    let top: number;
    if (!tall && below + box.height <= window.innerHeight) top = below;
    else if (!tall && above >= 4) top = above;
    else top = clamp(a.top + a.height / 2 - box.height / 2, window.innerHeight - box.height);

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
    open(next, anchor) {
      if (disposed) return;
      target = next;
      anchorEl?.removeAttribute('data-tbw-size-open');
      anchorEl = anchor;
      anchor.setAttribute('data-tbw-size-open', '');
      if (!root) root = build();
      const host = options.getHost(next) ?? document.body;
      if (root.parentNode !== host) host.appendChild(root);
      root.setAttribute('aria-label', options.getLabel(next));
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
