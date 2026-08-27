/**
 * Generic click-only action menu — the shared building block for WCAG 2.2
 * SC 2.5.7 "Dragging Movements" alternatives in plugins.
 *
 * Every drag affordance in the grid needs a path that works with plain clicks
 * or taps. A keyboard equivalent is **not** enough: SC 2.5.7 is specifically
 * about pointer input, and the W3C Understanding text calls out "a pop-up menu
 * after tap" as a conforming alternative. This module is that pop-up.
 *
 * Lives under `plugins/shared/` on purpose: each plugin bundle is built
 * self-contained, so this code is duplicated into the plugins that use it and
 * never lands in the core `index.js` budget.
 *
 * @since 3.6.0
 * @internal
 */

/** Gap between the anchor element and the menu, in px. */
const ANCHOR_GAP_PX = 6;

/** Runtime check — happy-dom and older browsers may lack the Popover API. */
function supportsPopover(): boolean {
  return typeof HTMLElement.prototype?.showPopover === 'function';
}

let hoverlessQuery: MediaQueryList | null | undefined;

/** Whether the primary pointer cannot hover (touch, most switch devices). */
function isHoverless(): boolean {
  if (hoverlessQuery === undefined) hoverlessQuery = globalThis.matchMedia?.('(hover: none)') ?? null;
  return hoverlessQuery?.matches ?? false;
}

/**
 * Whether a plugin should also expose its drag alternative as a dedicated
 * inline control, on top of the menu that is always available.
 *
 * Hover-less pointers get one unconditionally — a control revealed on hover is
 * unreachable when nothing can hover, and long-press is the wrong fallback for
 * the tremor and low-dexterity users SC 2.5.7 exists for.
 *
 * Driven by `a11y.dragAlternatives` on the grid config.
 */
export function prefersInlineDragAlternative(grid: {
  effectiveConfig?: { a11y?: { dragAlternatives?: 'menu' | 'inline' } };
}): boolean {
  return grid.effectiveConfig?.a11y?.dragAlternatives === 'inline' || isHoverless();
}

/** One clickable entry in the menu. */
export interface DragAlternativeAction {
  /** Visible text, also the accessible name. */
  label: string;
  /** Render the entry but refuse the click (e.g. "Move up" on the first row). */
  disabled?: boolean;
  /** Invoked on click; the menu closes first so focus handling is predictable. */
  run(): void;
}

export interface DragAlternativeMenu {
  /**
   * Show `actions` anchored to `anchor`, with `label` as the group's accessible
   * name. Mounted inside the anchor's grid host so it inherits theme tokens.
   */
  open(anchor: HTMLElement, label: string, actions: readonly DragAlternativeAction[]): void;
  /** Hide the menu. Safe to call when already closed. */
  close(): void;
  /** Remove the element and every document-level listener. */
  dispose(): void;
  /** The menu element, or `null` before the first {@link DragAlternativeMenu.open}. */
  readonly element: HTMLElement | null;
}

/**
 * Create a menu instance.
 *
 * @param id - DOM id for the menu element, unique per owning plugin.
 * @param className - Root class name, so each plugin can style its own menu.
 */
export function createDragAlternativeMenu(id: string, className: string): DragAlternativeMenu {
  let root: HTMLDivElement | null = null;
  let opened = false;
  let disposed = false;
  const abort = new AbortController();

  function close(): void {
    if (!opened || !root) return;
    opened = false;
    if (supportsPopover()) root.hidePopover();
    root.hidden = true;
  }

  function build(): HTMLDivElement {
    const el = document.createElement('div');
    el.id = id;
    el.className = className;
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'group');
    // Without the Popover API there is no UA `display: none`, so hide it here.
    el.hidden = true;
    // Tabbing past either end dismisses instead of stranding the user — the
    // menu has no visible trigger to tab back to. A null `relatedTarget` (click
    // focus in Firefox/Safari, focus leaving the document) is ignored.
    el.addEventListener(
      'focusout',
      (e) => {
        const next = (e as FocusEvent).relatedTarget;
        if (next instanceof Node && !el.contains(next)) close();
      },
      { signal: abort.signal },
    );
    return el;
  }

  /**
   * Position against the anchor in viewport coordinates. The menu lives in the
   * top layer, so its containing block is the viewport regardless of where the
   * anchor sits in the DOM.
   */
  function place(anchor: HTMLElement): void {
    if (!root) return;
    const a = anchor.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const left = Math.max(4, Math.min(a.left, window.innerWidth - box.width - 4));
    const below = a.bottom + ANCHOR_GAP_PX;
    const top = below + box.height <= window.innerHeight ? below : Math.max(4, a.top - ANCHOR_GAP_PX - box.height);
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  // Any pointer press outside the menu dismisses it. Capture phase so the press
  // that lands on a grid cell still reaches its own handler afterwards.
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
    open(anchor, label, actions) {
      if (disposed || actions.length === 0) return;
      if (!root) root = build();
      // Mount inside the grid host (light DOM) so theme custom properties and
      // `color-scheme` cascade in; the top layer keeps it out of overflow.
      const host = anchor.closest<HTMLElement>('tbw-grid, [data-tbw-grid]') ?? document.body;
      if (root.parentNode !== host) host.appendChild(root);
      root.setAttribute('aria-label', label);
      root.replaceChildren();
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `${className}-item`;
        btn.textContent = action.label;
        btn.disabled = action.disabled === true;
        btn.addEventListener('click', () => {
          close();
          action.run();
        });
        root.appendChild(btn);
      }
      root.hidden = false;
      if (!opened && supportsPopover()) root.showPopover();
      opened = true;
      place(anchor);
      root.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
    },
    close,
    dispose() {
      disposed = true;
      close();
      abort.abort();
      root?.remove();
      root = null;
    },
  };
}
