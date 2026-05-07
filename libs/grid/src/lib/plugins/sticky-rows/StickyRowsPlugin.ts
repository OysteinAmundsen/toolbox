/**
 * Sticky Rows Plugin (Class-based)
 *
 * Pins selected data rows below the header as the user scrolls past them.
 * See `types.ts` for configuration.
 *
 * @module Plugins/Sticky Rows
 */

import type { RowPosition } from '../../core/internal/virtualization';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ScrollEvent } from '../../core/plugin/types';
import styles from './sticky-rows.css?inline';
import type { StickyPredicate, StickyRowsConfig } from './types';

/** Internal shape of the virtualization state we read from the grid. */
interface VirtualStateLike {
  start?: number;
  end?: number;
  rowHeight?: number;
  positionCache?: RowPosition[] | null;
  /** The faux-scroll element — the source of truth for the live scroll
   *  position (per-pixel, unlike `start` which only updates when the
   *  rendered window shifts). */
  container?: HTMLElement | null;
}

/**
 * Sticky Rows plugin for `<tbw-grid>`.
 *
 * Marks specific rows as "sticky" so they pin below the grid header when their
 * natural scroll position would take them off-screen. Behavior when multiple
 * sticky rows would be stuck simultaneously is controlled by `mode`:
 *
 * - `'push'` (default) — only one stuck at a time; the next sticky row pushes
 *   the previous one out of view (iOS section-header behavior).
 * - `'stack'` — sticky rows stack below the header up to `maxStacked`.
 *
 * The plugin renders **clones** of the real rows; the originals continue to
 * exist in the data flow. Clones inherit the row's grid-template alignment so
 * they line up perfectly with the column boundaries below.
 *
 * @example
 * ```ts
 * import '@toolbox-web/grid/features/sticky-rows';
 *
 * grid.gridConfig = {
 *   features: { stickyRows: { isSticky: 'isSection', mode: 'stack' } },
 * };
 * ```
 *
 * @see {@link StickyRowsConfig} for all configuration options.
 *
 * @internal Extends BaseGridPlugin.
 * @since 2.7.0
 */
export class StickyRowsPlugin extends BaseGridPlugin<StickyRowsConfig> {
  /** @internal */
  readonly name = 'stickyRows';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<StickyRowsConfig> {
    return {
      mode: 'push',
      maxStacked: Infinity,
    };
  }

  // #region Internal State
  /** Container element that holds the stuck-row clones. */
  private container: HTMLElement | null = null;

  /** Indices in `grid.rows` whose rows are sticky, sorted ascending. */
  private stickyIndices: number[] = [];

  /** Cached clone DOM keyed by row index. Survives the row leaving the
   *  virtualization window so we can keep showing it while stuck. */
  private cloneCache: Map<number, HTMLElement> = new Map();

  /** Currently displayed indices (in DOM order). Used to skip work when the
   *  set hasn't changed between scroll ticks. */
  private displayedIndices: number[] = [];

  /** Last applied push-mode translation, to skip writes on no-op ticks. */
  private lastPushOffset = 0;
  // #endregion

  // #region Lifecycle
  /** @internal */
  override detach(): void {
    this.container?.remove();
    this.container = null;
    this.cloneCache.clear();
    this.stickyIndices = [];
    this.displayedIndices = [];
    this.lastPushOffset = 0;
  }
  // #endregion

  // #region Hooks

  /** @internal Recompute the sticky-index list and refresh display. */
  override afterRender(): void {
    this.recomputeStickyIndices();
    this.ensureContainer();
    // Pre-cache clones for any sticky row currently in the rendered window
    // BEFORE it scrolls out — otherwise findRenderedRow() returns null at
    // display time and we'd render an empty container.
    this.primeCloneCache();
    this.refreshDisplay();
  }

  /** @internal Re-render clones after a scroll-driven row pool refresh. */
  override onScrollRender(): void {
    // The pool may have repopulated rows we're tracking. Refresh clone DOM
    // for any displayed indices that are now back in the rendered window,
    // and pre-cache any sticky rows that just entered the window so we have
    // a clone ready when they scroll past.
    this.primeCloneCache();
    this.refreshClonesInWindow();
    this.refreshDisplay();
  }

  /** @internal Update which clones show / how they're positioned. */
  override onScroll(event: ScrollEvent): void {
    this.refreshDisplay(event.scrollTop);
  }

  // #endregion

  // #region Private — predicate + indices

  private resolvePredicate(): StickyPredicate {
    const cfg = this.config.isSticky;
    if (typeof cfg === 'function') return cfg;
    if (typeof cfg === 'string') {
      const field = cfg;
      return (row) => {
        if (row == null || typeof row !== 'object') return false;
        return Boolean((row as Record<string, unknown>)[field]);
      };
    }
    return () => false;
  }

  private recomputeStickyIndices(): void {
    const rows = this.rows;
    const predicate = this.resolvePredicate();
    const next: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (predicate(rows[i], i)) next.push(i);
    }
    // Drop cache entries whose indices are no longer sticky (e.g. data
    // shuffled, predicate flipped). Indices that remain may still point at a
    // different row after re-sort — drop those too so we re-clone from the
    // fresh DOM on the next render.
    if (next.length !== this.stickyIndices.length || next.some((v, i) => v !== this.stickyIndices[i])) {
      this.cloneCache.clear();
    }
    this.stickyIndices = next;
  }

  // #endregion

  // #region Private — DOM container

  private ensureContainer(): void {
    const grid = this.gridElement;
    if (!grid) return;

    // Container is an OVERLAY positioned at the top of the rows-viewport
    // (not a flex child of rows-body). Why: a flow-positioned container
    // takes vertical space, which pushes the rows-viewport down by the
    // sticky height. The rows are positioned in scroll coordinates that
    // are agnostic of that shift, so live-row geometry ends up partially
    // overlapping the sticky container — producing duplicate visible rows
    // during the push transition (#279 follow-up). Overlaying on top of
    // the row pool, with `overflow: clip` on rows-viewport hiding the
    // live row underneath, eliminates the overlap entirely.
    const rowsViewport = grid.querySelector('.rows-viewport');
    if (!rowsViewport) {
      // Grid hasn't built its DOM yet; bail and try again on next afterRender.
      this.container = null;
      return;
    }

    if (this.container && rowsViewport.contains(this.container)) return;

    // Container was either never created or got wiped out. Re-create.
    this.container = document.createElement('div');
    this.container.className = 'tbw-sticky-rows';
    this.container.setAttribute('role', 'presentation');
    this.container.dataset['mode'] = this.config.mode ?? 'push';
    if (this.config.className) this.container.classList.add(this.config.className);

    // Insert as the FIRST child of rows-viewport so it overlays on top of
    // the row pool. Z-index in CSS keeps it above `.rows`.
    rowsViewport.insertBefore(this.container, rowsViewport.firstChild);
  }

  // #endregion

  // #region Private — offsets + which-to-display

  /** Pixel offset of the top of `index` from the start of the scroll area. */
  private offsetOf(index: number): number {
    const v = this.getVirtualState();
    const cache = v?.positionCache;
    if (cache && cache[index]) return cache[index].offset;
    const h = v?.rowHeight ?? 28;
    return index * h;
  }

  /** Estimated height of `index` (used for push-mode displacement). */
  private heightOf(index: number): number {
    const v = this.getVirtualState();
    const cache = v?.positionCache;
    if (cache && cache[index]) return cache[index].height;
    return v?.rowHeight ?? 28;
  }

  private getVirtualState(): VirtualStateLike | undefined {
    return (this.grid as unknown as { _virtualization?: VirtualStateLike })?._virtualization;
  }

  private getCurrentScrollTop(): number {
    const v = this.getVirtualState();
    // PRIMARY source: the live `scrollTop` of the faux-scroll element. This
    // updates per-pixel as the user drags, unlike `_virtualization.start`
    // which only ticks over when the rendered window shifts (every
    // `rowHeight` px). Reading the stale start-derived value caused
    // `afterRender` to clobber the correct displayed-set that `onScroll`
    // had just computed (#279 follow-up).
    const liveScrollTop = v?.container?.scrollTop;
    if (typeof liveScrollTop === 'number') return liveScrollTop;
    // Fallbacks (unit tests / pre-mount): derive from window-start.
    if (
      typeof v?.start === 'number' &&
      typeof v?.rowHeight === 'number' &&
      (!v.positionCache || !v.positionCache.length)
    ) {
      return v.start * v.rowHeight;
    }
    if (v?.positionCache && typeof v.start === 'number' && v.positionCache[v.start]) {
      return v.positionCache[v.start].offset;
    }
    return 0;
  }

  /**
   * Compute the displayed sticky indices and any upward push offset, given
   * the current scroll offset.
   *
   * - `'push'` mode: a row qualifies once its top has scrolled past the
   *   viewport top (strict `<`); only the highest qualifying index is
   *   shown. As the next sticky approaches from below, the stuck clone
   *   slides upward by `heightOfStuck - distance` (iOS section-header
   *   behavior).
   * - `'stack'` mode: each subsequent sticky qualifies once its top
   *   reaches the bottom of the existing stack (`offsetOf(idx) < scrollTop
   *   + cumulativeHeightOfStuck`), so `— B —` latches when it meets
   *   `— A —`'s bottom — not after `— A —` covers it. When the stack is
   *   at `maxStacked` and the **live** next sticky row's top crosses the
   *   bottom of the stack (`distance <= 0`), the entire stack translates
   *   upward by `-distance`. Live rows above the stack (including the
   *   incoming sticky) scroll up naturally beneath the overlay; rows-
   *   viewport's `overflow: clip` hides anything above the top edge. When
   *   the oldest is fully off (pushOffset ≥ heightOf(oldest)), the next
   *   tick qualifies the new sticky and we slice to `last max` with
   *   transform reset — at that exact pixel the live new sticky is sitting
   *   precisely behind its slot in the new stack, producing a seamless
   *   swap with no duplicate row visible.
   *
   * Strict `<` keeps the qualification edge symmetric with push mode and
   * avoids briefly rendering both a clone and the live row at the swap
   * pixel.
   */
  private computeDisplay(scrollTop: number): { indices: number[]; pushOffset: number } {
    if (this.config.mode === 'stack') {
      const max = this.config.maxStacked ?? Infinity;
      const qualifying: number[] = [];
      let stuckHeight = 0;
      for (const idx of this.stickyIndices) {
        if (qualifying.length < max) {
          // Within the cap: a sticky qualifies once its top reaches the
          // bottom of the existing stack.
          if (this.offsetOf(idx) < scrollTop + stuckHeight) {
            qualifying.push(idx);
            stuckHeight += this.heightOf(idx);
          } else {
            break; // sorted ascending — anything after won't qualify either
          }
        } else {
          // At cap: evict-and-promote only after `idx` has fully crossed
          // the slot of the current oldest. WHY: while `idx` is mid-cross
          // (its top is past the stack bottom but the oldest isn't yet
          // off the top), we want to ANIMATE that transition by sliding
          // the existing stack upward — not snap to the post-evict state.
          // Without this clamp, qualification fires the instant the new
          // sticky crosses the stack bottom (same scrollTop where the
          // anticipation block would otherwise activate), and the
          // anticipation never gets a chance to render.
          const oldestH = this.heightOf(qualifying[0]);
          if (this.offsetOf(idx) < scrollTop + stuckHeight - oldestH) {
            qualifying.shift();
            stuckHeight -= oldestH;
            qualifying.push(idx);
            stuckHeight += this.heightOf(idx);
          } else {
            break;
          }
        }
      }

      // Anticipation: at-cap and the live next sticky has crossed the
      // stack bottom but not yet fully past the oldest's slot. Translate
      // the entire stack up by `-distance` so the user sees the live
      // next-sticky scrolling up against the bottom of the stack while
      // the oldest slides off the top — exactly mirroring iOS Contacts.
      // Do NOT add the new sticky to the displayed list during this
      // window: it's still in the row pool and visible there. Adding a
      // clone too would produce a visible duplicate AND would cover the
      // last regular row under the previous section while live-next is
      // still approaching.
      if (qualifying.length === max && qualifying.length > 0) {
        const next = this.findNextSticky(qualifying[qualifying.length - 1]);
        if (next != null) {
          const distance = this.offsetOf(next) - (scrollTop + stuckHeight);
          if (distance < 0) {
            const oldestH = this.heightOf(qualifying[0]);
            return { indices: qualifying, pushOffset: Math.min(-distance, oldestH) };
          }
        }
      }
      return { indices: qualifying, pushOffset: 0 };
    }

    // 'push' mode.
    const qualifying: number[] = [];
    for (const idx of this.stickyIndices) {
      if (this.offsetOf(idx) < scrollTop) qualifying.push(idx);
      else break;
    }
    if (qualifying.length === 0) return { indices: qualifying, pushOffset: 0 };
    const stuck = qualifying[qualifying.length - 1];
    const next = this.findNextSticky(stuck);
    let pushOffset = 0;
    if (next != null) {
      const stuckH = this.heightOf(stuck);
      const distance = this.offsetOf(next) - scrollTop;
      if (distance < stuckH) {
        pushOffset = stuckH - Math.max(0, distance);
      }
    }
    return { indices: [stuck], pushOffset };
  }

  // #endregion

  // #region Private — clone management

  /** Locate a rendered row in the viewport by its data index. */
  private findRenderedRow(index: number): HTMLElement | null {
    const grid = this.gridElement;
    if (!grid) return null;
    // Cells carry `data-row="<index>"`. The row element is the parent.
    const cell = grid.querySelector(`.rows .data-grid-row .cell[data-row="${index}"]`);
    return (cell?.parentElement as HTMLElement | null) ?? null;
  }

  /** Build (or refresh) a clone for `index`, using the live row when present. */
  private buildClone(index: number): HTMLElement | null {
    const live = this.findRenderedRow(index);
    if (!live) return this.cloneCache.get(index) ?? null;
    const clone = live.cloneNode(true) as HTMLElement;
    clone.classList.add('tbw-sticky-row');
    clone.removeAttribute('aria-rowindex');
    // Stuck clones are decorative — the original row is still present in the
    // accessibility tree below. Hide clones from AT to avoid double-reads.
    clone.setAttribute('aria-hidden', 'true');
    clone.dataset['stickyRow'] = String(index);
    // Drop any focus styling from the source — clones are non-interactive.
    clone.classList.remove('row-focus', 'cell-focus');
    clone.querySelectorAll('.cell-focus, .row-focus').forEach((el) => el.classList.remove('cell-focus', 'row-focus'));
    // Strip tabindex on cells so the clone isn't a tab target.
    clone.removeAttribute('tabindex');
    clone.querySelectorAll('[tabindex]').forEach((el) => el.removeAttribute('tabindex'));

    this.cloneCache.set(index, clone);
    return clone;
  }

  /** Refresh cached clones for any displayed indices that are now in-window.
   *  Pulls fresh DOM so edits / re-renders are reflected when the row swings
   *  back into view. */
  private refreshClonesInWindow(): void {
    if (!this.displayedIndices.length) return;
    for (const idx of this.displayedIndices) {
      const live = this.findRenderedRow(idx);
      if (live) {
        // Re-clone to pick up any post-render changes.
        const fresh = this.buildClone(idx);
        const existingClone = this.container?.querySelector(`[data-sticky-row="${idx}"]`);
        if (fresh && existingClone && existingClone !== fresh) {
          existingClone.replaceWith(fresh);
        }
      }
    }
  }

  /** Build clones for any sticky row currently rendered in the viewport so we
   *  have one ready when the row scrolls past. Without this, a sticky row
   *  that's never been displayed-as-stuck won't have a cache entry, and once
   *  the live row leaves the rendered window we have nothing to render. */
  private primeCloneCache(): void {
    if (!this.stickyIndices.length) return;
    for (const idx of this.stickyIndices) {
      if (this.findRenderedRow(idx)) {
        // buildClone() handles the live → cache path itself.
        this.buildClone(idx);
      }
    }
  }

  /** Reconcile the container DOM with the desired displayed indices. */
  private refreshDisplay(scrollTopOverride?: number): void {
    if (!this.container) return;

    const scrollTop = scrollTopOverride ?? this.getCurrentScrollTop();
    const { indices: desired, pushOffset } = this.computeDisplay(scrollTop);

    // Update the container's mode marker (in case config changed).
    if (this.container.dataset['mode'] !== this.config.mode) {
      this.container.dataset['mode'] = this.config.mode ?? 'push';
    }

    const sameSet =
      desired.length === this.displayedIndices.length && desired.every((v, i) => v === this.displayedIndices[i]);

    if (!sameSet) {
      // Rebuild the container's children. cloneCache survives between calls so
      // we re-use existing clones for indices that remain displayed.
      const fragment = document.createDocumentFragment();
      const appended: number[] = [];
      for (const idx of desired) {
        let clone = this.cloneCache.get(idx) ?? null;
        // Always try to refresh from live DOM if available.
        const fresh = this.buildClone(idx);
        clone = fresh ?? clone;
        if (clone) {
          fragment.appendChild(clone);
          appended.push(idx);
        }
      }
      this.container.replaceChildren(fragment);
      // Track only the indices we actually appended so a subsequent refresh
      // (after a missing index gets primed via onScrollRender) will detect a
      // diff and retry rather than incorrectly believing the set is settled.
      this.displayedIndices = appended;
    }

    // Apply the upward translation to the entire container so push-mode
    // (1 child) and stack-mode anticipation (max+1 children) both slide
    // uniformly. CSS `overflow: clip` on `.rows-viewport` hides anything
    // translated above its top edge.
    if (pushOffset !== this.lastPushOffset) {
      this.container.style.transform = pushOffset > 0 ? `translateY(${-pushOffset}px)` : '';
      this.lastPushOffset = pushOffset;
    }
  }

  /** Find the next sticky index strictly greater than `current`. */
  private findNextSticky(current: number): number | null {
    for (const idx of this.stickyIndices) {
      if (idx > current) return idx;
    }
    return null;
  }

  // #endregion
}
