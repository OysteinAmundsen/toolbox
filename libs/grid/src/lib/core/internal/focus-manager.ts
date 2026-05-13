/**
 * FocusManager — encapsulates focus/navigation state and external focus
 * container tracking that were previously inline in the DataGridElement class.
 *
 * Owns:
 * - External focus container registry (register/unregister/containsFocus)
 * - Focus cell navigation (focusCell, focusedCell getter)
 * - Scroll-to-row logic (scrollToRow, scrollToRowById)
 * - Last user focus tracking + always-on restore-on-bounce focus trap
 *
 * Takes the grid reference directly (tightly coupled — this manager
 * can never live outside the grid).
 */
import type { GridHost, ScrollToRowOptions } from '../types';
import { ensureCellVisible } from './keyboard';

// #region FocusManager

export class FocusManager<T = any> {
  readonly #grid: GridHost<T>;

  // External focus containers — overlay panels (datepickers, dropdowns)
  // that render at <body> level but should be treated as "inside" the grid.
  #externalFocusContainers = new Set<Element>();
  #externalFocusCleanups = new Map<Element, () => void>();

  // Last "real" element the user explicitly focused inside the grid host's
  // light-DOM subtree. Intentionally NOT tracked: the grid host itself
  // (artificial tabindex=0 focus from the keyboard handler), bare .cell
  // elements (cell focus is virtual, owned by _focusRow/_focusCol), and
  // descendants of registered external containers (overlay closes →
  // restore should land INSIDE the grid proper, not back into the about-
  // to-be-removed overlay). Editor inputs INSIDE a .cell.editing ARE
  // tracked so editing can resume after an overlay bounce.
  #lastFocused: HTMLElement | null = null;

  // Always-on trap listener cleanup
  #trapCleanup: (() => void) | null = null;

  constructor(grid: GridHost<T>) {
    this.#grid = grid;
    this.#installFocusTrap();
  }

  // #region Focus & Navigation

  /**
   * Move focus to a specific cell.
   * Accepts a column index or field name.
   */
  focusCell(rowIndex: number, column: number | string): void {
    const grid = this.#grid;
    const maxRow = grid._rows.length - 1;
    if (maxRow < 0) return;

    let colIdx: number;
    if (typeof column === 'string') {
      colIdx = grid._visibleColumns.findIndex((c) => c.field === column);
      if (colIdx < 0) return;
    } else {
      colIdx = column;
    }

    const maxCol = grid._visibleColumns.length - 1;
    if (maxCol < 0) return;

    grid._focusRow = Math.max(0, Math.min(rowIndex, maxRow));
    grid._focusCol = Math.max(0, Math.min(colIdx, maxCol));
    ensureCellVisible(grid);
  }

  /**
   * The currently focused cell position, or `null` if no rows are loaded.
   */
  get focusedCell(): { rowIndex: number; colIndex: number; field: string } | null {
    const grid = this.#grid;
    if (grid._rows.length === 0 || grid._visibleColumns.length === 0) return null;
    const col = grid._visibleColumns[grid._focusCol];
    return {
      rowIndex: grid._focusRow,
      colIndex: grid._focusCol,
      field: col?.field ?? '',
    };
  }

  /**
   * Scroll the viewport so a row is visible.
   */
  scrollToRow(rowIndex: number, options?: ScrollToRowOptions): void {
    const virt = this.#grid._virtualization;
    if (!virt.enabled) return;

    const scrollEl = virt.container as HTMLElement | undefined;
    if (!scrollEl) return;

    const totalRows = this.#grid._rows.length;
    if (totalRows === 0) return;

    const idx = Math.max(0, Math.min(rowIndex, totalRows - 1));
    const align = options?.align ?? 'nearest';
    const behavior = options?.behavior ?? 'instant';

    // Calculate row offset and height, accounting for variable row heights
    let rowTop: number;
    let rowH: number;
    const pc = virt.positionCache;
    if (virt.variableHeights && pc && pc.length > idx) {
      rowTop = pc[idx].offset;
      rowH = pc[idx].height;
    } else {
      rowTop = idx * virt.rowHeight;
      rowH = virt.rowHeight;
    }

    const viewportH = virt.viewportEl?.clientHeight ?? scrollEl.clientHeight ?? 0;
    if (viewportH <= 0) return;

    const currentTop = scrollEl.scrollTop;
    const rowBottom = rowTop + rowH;
    const viewBottom = currentTop + viewportH;

    let target: number;
    switch (align) {
      case 'start':
        target = rowTop;
        break;
      case 'center':
        target = rowTop - viewportH / 2 + rowH / 2;
        break;
      case 'end':
        target = rowBottom - viewportH;
        break;
      case 'nearest':
      default:
        // Already fully visible — no scroll needed
        if (rowTop >= currentTop && rowBottom <= viewBottom) return;
        // Scroll up or down to bring row into view (minimum movement)
        target = rowTop < currentTop ? rowTop : rowBottom - viewportH;
        break;
    }

    target = Math.max(0, target);

    if (behavior === 'smooth') {
      scrollEl.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      scrollEl.scrollTop = target;
    }
  }

  /**
   * Scroll the viewport so a row is visible, identified by its unique ID.
   */
  scrollToRowById(rowId: string, options?: ScrollToRowOptions): void {
    const entry = this.#grid._getRowEntry(rowId);
    if (!entry) return;
    this.scrollToRow(entry.index, options);
  }

  // #endregion

  // #region External Focus Containers

  /**
   * Register an external DOM element as a logical focus container of this grid.
   * Focus moving into a registered container is treated as if it stayed inside the grid.
   */
  registerExternalFocusContainer(el: Element): void {
    if (this.#externalFocusContainers.has(el)) return;
    this.#externalFocusContainers.add(el);

    const ac = new AbortController();
    const signal = ac.signal;
    const gridEl = this.#grid;

    el.addEventListener(
      'focusin',
      (e) => {
        gridEl.dataset.hasFocus = '';
        this.#noteFocus((e as FocusEvent).target);
      },
      { signal },
    );

    el.addEventListener(
      'focusout',
      (e) => {
        const newFocus = (e as FocusEvent).relatedTarget as Node | null;
        if (!newFocus || !this.containsFocus(newFocus)) {
          delete gridEl.dataset.hasFocus;
        }
        // Bounce-to-body: relatedTarget === null usually means the focused
        // element was removed from the DOM (overlay closed) and focus reverted
        // to <body>. Restore the last user focus so keyboard interaction can
        // resume where the user left off.
        if (newFocus === null) this.#scheduleRestore();
      },
      { signal },
    );

    this.#externalFocusCleanups.set(el, () => ac.abort());
  }

  /**
   * Unregister a previously registered external focus container.
   */
  unregisterExternalFocusContainer(el: Element): void {
    this.#externalFocusContainers.delete(el);
    const cleanup = this.#externalFocusCleanups.get(el);
    if (cleanup) {
      cleanup();
      this.#externalFocusCleanups.delete(el);
    }
  }

  /**
   * Check whether focus is logically inside this grid.
   * Returns `true` when the node is inside the grid's DOM or any external container.
   */
  containsFocus(node?: Node | null): boolean {
    const target = node ?? document.activeElement;
    if (!target) return false;
    if (this.#grid.contains(target)) return true;
    return this.isInExternalFocusContainer(target);
  }

  /**
   * Check whether a node is inside any registered external focus container.
   */
  isInExternalFocusContainer(node: Node): boolean {
    for (const container of this.#externalFocusContainers) {
      if (container.contains(node)) return true;
    }
    return false;
  }

  // #endregion

  // #region Last User Focus & Always-On Trap

  /**
   * Install the always-on focus trap. Tracks user focus inside the grid and
   * restores it when focus is unintentionally bounced to `<body>` (e.g. an
   * overlay child of `<body>` is removed while focused).
   *
   * Intentional focus movement (Tab to a button outside the grid, click on an
   * outside element) is detected via `relatedTarget !== null` and respected.
   */
  #installFocusTrap(): void {
    const grid = this.#grid;
    const ac = new AbortController();
    const signal = ac.signal;

    grid.addEventListener('focusin', (e) => this.#noteFocus(e.target), { signal, capture: true });

    grid.addEventListener(
      'focusout',
      (e) => {
        const newFocus = (e as FocusEvent).relatedTarget as Node | null;
        // Intentional movement (browser told us where focus is going) — don't fight it.
        if (newFocus !== null) return;
        this.#scheduleRestore();
      },
      { signal },
    );

    this.#trapCleanup = () => ac.abort();
  }

  /**
   * Record `target` as the last meaningful user focus, if eligible.
   *
   * Eligible: any HTMLElement inside the grid logical area EXCEPT
   *   - the grid host itself (artificial tabindex=0 focus),
   *   - bare `.cell` elements (cell focus is virtual; restoring a stale
   *     pooled cell after virtualization recycles it is meaningless).
   *
   * Editor inputs inside `.cell.editing` ARE tracked: they are the user's
   * real point of interaction during a row edit, and restoring them after
   * an overlay close is exactly what `EditingPlugin` used to do via its
   * own focusTrap option.
   */
  #noteFocus(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    if (target === this.#grid) return;

    const cell = target.closest?.('.cell') as HTMLElement | null;
    if (cell && !cell.classList.contains('editing')) {
      // Bare cell focus — virtual, don't track.
      return;
    }
    // Focus inside a registered external container (datepicker, dropdown,
    // body-level overlay) is intentionally NOT tracked. When the overlay
    // closes, the user expects focus to return to the last element they
    // were on INSIDE the grid proper, not back into the (about-to-be-
    // removed) overlay.
    if (this.isInExternalFocusContainer(target)) return;
    this.#lastFocused = target;
  }

  #scheduleRestore(): void {
    queueMicrotask(() => {
      // Bail if grid was disconnected between schedule and execution (e.g.
      // a test removed it from the DOM); restoring focus into an orphan
      // element is a no-op and just wastes work.
      if (!this.#grid.isConnected) return;
      const active = document.activeElement;
      // Only restore on a true bounce-to-body. If focus already landed on
      // the grid host or on any meaningful descendant, leave it alone —
      // re-focusing #lastFocused in that case can race the host's own
      // synthetic focus (`ensureCellVisible` calls `grid.focus()`) and
      // produce a focusin/focusout ping-pong: input.focus() → focusout
      // bounces to grid → schedule restore → input.focus() … repeat,
      // hanging the test runner.
      if (active !== document.body) return;
      this.restoreLastFocus();
    });
  }

  /**
   * Restore focus to the last tracked user-focused element if it is still
   * connected and focusable. Returns `true` on success.
   *
   * Stale references (element removed from DOM during a re-render) are
   * silently dropped so callers can fall back to their own restoration logic.
   */
  restoreLastFocus(): boolean {
    const el = this.#lastFocused;
    if (!el) return false;
    if (!el.isConnected) {
      this.#lastFocused = null;
      return false;
    }
    if (el === document.activeElement) return true;
    try {
      el.focus({ preventScroll: true });
    } catch {
      return false;
    }
    return document.activeElement === el;
  }

  /**
   * Currently tracked last-user-focused element inside the grid host's
   * light-DOM subtree, if any. Excludes the grid host itself, bare `.cell`
   * elements, and descendants of registered external focus containers.
   * Exposed so plugins (notably EditingPlugin) can defer to the unified
   * trap before falling back to plugin-specific restoration logic.
   * @internal
   */
  get lastFocusedElement(): HTMLElement | null {
    return this.#lastFocused?.isConnected ? this.#lastFocused : null;
  }

  // #endregion

  // #region Cleanup

  /**
   * Clean up all external focus container listeners.
   * Called when the grid disconnects.
   */
  destroy(): void {
    for (const cleanup of this.#externalFocusCleanups.values()) {
      cleanup();
    }
    this.#externalFocusCleanups.clear();
    this.#externalFocusContainers.clear();
    this.#trapCleanup?.();
    this.#trapCleanup = null;
    this.#lastFocused = null;
  }

  // #endregion
}

// #endregion
