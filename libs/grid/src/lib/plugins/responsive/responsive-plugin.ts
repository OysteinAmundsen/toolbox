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

import { MISSING_BREAKPOINT } from '../../core/internal/diagnostics';
import { ensureCellVisible } from '../../core/internal/keyboard';
import { evalTemplateString, setSanitizedHTML } from '../../core/internal/sanitize';
import { BaseGridPlugin, type GridElement, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import type { GridHost } from '../../core/types';
import styles from './responsive.css?inline';
import type {
  BreakpointConfig,
  HiddenColumnConfig,
  ResponsiveAnimation,
  ResponsiveChangeDetail,
  ResponsivePluginConfig,
} from './types';

/**
 * The subset of the View Transition API this plugin depends on.
 *
 * `Element.startViewTransition()` is not yet in the TypeScript DOM lib, so the
 * shape is declared locally rather than widening the global `Element`.
 */
type ViewTransitionStarter = (update: () => Promise<void>) => {
  readonly finished: Promise<void>;
  /** Rejects when the UA skips the transition — routine while dragging a resize. */
  readonly ready?: Promise<void>;
};
type ViewTransitionCapableElement = HTMLElement & { startViewTransition?: ViewTransitionStarter };

/** How finely the layout switch is broken up for the compositor. */
type MorphGranularity = 'cells' | 'rows' | 'none';

/** Disambiguates row morph names when several grids transition at once. */
let morphInstanceCounter = 0;

/**
 * Above this, per-cell morphing costs more in compositor layers than it buys.
 * Each named cell is 3 animations and 2 snapshot textures, and rows are
 * virtualized — so this bounds the switch by viewport size, not by dataset size.
 */
const MAX_MORPH_CELLS = 150;

/** Stands in for a column set that is not currently applied, without allocating. */
const EMPTY_FIELD_SET: ReadonlySet<string> = new Set<string>();

/** Tags the column fade so a re-render can cancel its own leftovers and nothing else. */
const COLUMN_FADE_ID = 'tbw-responsive-column-fade';

/** Present only while columns are collapsing, so column resizing stays instant. */
const COLUMN_FADE_ATTR = 'data-responsive-column-fade';

/** Split a grid track list on top-level spaces, keeping `minmax(a, b)` intact. */
function splitTrackList(template: string): string[] {
  const tracks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < template.length; i++) {
    const char = template[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ' ' && depth === 0) {
      if (i > start) tracks.push(template.slice(start, i));
      start = i + 1;
    }
  }
  if (start < template.length) tracks.push(template.slice(start));
  return tracks;
}

/**
 * The zero-width form of `track`. A track list only interpolates pairwise, so the
 * collapsed track has to keep the same unit family — `1fr` has to become `0fr`,
 * not `0px`. Keywords (`auto`, `max-content`) have no interpolable zero and snap.
 */
function collapsedTrack(track: string): string {
  if (track.startsWith('minmax(')) return track.includes('fr') ? 'minmax(0px, 0fr)' : 'minmax(0px, 0px)';
  if (track.endsWith('fr')) return '0fr';
  if (track.endsWith('%')) return '0%';
  return '0px';
}

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
 * @since 1.1.0
 */
export class ResponsivePlugin<T = unknown> extends BaseGridPlugin<ResponsivePluginConfig<T>> {
  readonly name = 'responsive';
  override readonly version = '1.0.0';
  override readonly styles = styles;

  /**
   * Plugin manifest declaring queries this plugin handles.
   */
  static override readonly manifest: PluginManifest = {
    queries: [
      {
        type: 'isCardMode',
        description: 'Returns whether the grid is currently in responsive card mode',
      },
    ],
  };

  #resizeObserver?: ResizeObserver;
  #isResponsive = false;
  #debounceTimer?: ReturnType<typeof setTimeout>;
  #warnedAboutMissingBreakpoint = false;
  #currentWidth = 0;
  /** Width the last `#checkBreakpoint()` ran against — guards height-only resizes. */
  #lastCheckedWidth?: number;
  /** Timestamp of the last applied layout switch, for the post-switch cooldown. */
  #lastSwitchAt = Number.NEGATIVE_INFINITY;
  /** Unique `view-transition-name` prefixes for this instance's rows and cells. */
  readonly #morphInstance = ++morphInstanceCounter;
  readonly #morphPrefix = `tbw-responsive-row-${this.#morphInstance}-`;
  readonly #cellMorphPrefix = `tbw-responsive-cell-${this.#morphInstance}-`;
  /** Identifies the newest view transition, so superseded ones skip their cleanup. */
  #transitionToken = 0;
  /** Set of column fields to completely hide */
  #hiddenColumnSet: Set<string> = new Set();
  /** The subset of the above that the last render actually hid. */
  #appliedHiddenFields: ReadonlySet<string> = EMPTY_FIELD_SET;
  /** Set of column fields to show value only (no header label) */
  #valueOnlyColumnSet: Set<string> = new Set();
  /** The subset of the above that the last render actually stripped labels from. */
  #appliedValueOnlyFields: ReadonlySet<string> = EMPTY_FIELD_SET;
  /** Fields currently fading out of the table, and the ones fading in. */
  #fadeOutFields: Set<string> = new Set();
  #fadeInFields: Set<string> = new Set();
  /** When the in-flight column fade ends, so a mid-fade re-render can resume it. */
  #fadeEndsAt = 0;
  #fadeTimer?: ReturnType<typeof setTimeout>;
  /** Whether the grid template currently carries this plugin's collapsed tracks. */
  #templateOverridden = false;
  /** Currently active breakpoint, or null if none */
  #activeBreakpoint: BreakpointConfig | null = null;
  /** Sorted breakpoints from largest to smallest */
  #sortedBreakpoints: BreakpointConfig[] = [];

  /** Typed internal grid accessor — centralizes the single required cast. */
  get #internalGrid(): GridHost {
    return this.grid;
  }

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
      this.#commitLayoutSwitch();
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
    // The guard keys off width alone, so a config change must invalidate it.
    this.#lastCheckedWidth = undefined;
    this.#checkBreakpoint(this.#currentWidth);
  }

  /**
   * Set a custom card renderer.
   * This allows framework adapters to provide template-based renderers at runtime.
   * @param renderer - The card renderer function, or undefined to use default
   */
  setCardRenderer(renderer: ResponsivePluginConfig<T>['cardRenderer']): void {
    this.config.cardRenderer = renderer;
    // If already in responsive mode, trigger a re-render to apply the new renderer
    if (this.#isResponsive) {
      this.requestRender();
    }
  }

  /**
   * Get current grid width.
   * @returns Width of the grid element in pixels
   */
  getWidth(): number {
    return this.#currentWidth;
  }

  /**
   * Get the currently active breakpoint config (multi-breakpoint mode only).
   * @returns The active BreakpointConfig, or null if no breakpoint is active
   */
  getActiveBreakpoint(): BreakpointConfig | null {
    return this.#activeBreakpoint;
  }

  override attach(grid: GridElement): void {
    super.attach(grid);

    // Parse light DOM configuration first (may update this.config)
    this.#parseLightDomCard();

    // Build hidden column sets from config
    this.#buildHiddenColumnSets(this.config.hiddenColumns);

    // Sort breakpoints from largest to smallest for evaluation
    if (this.config.breakpoints?.length) {
      this.#sortedBreakpoints = [...this.config.breakpoints].sort((a, b) => b.maxWidth - a.maxWidth);
    }

    this.#syncMotionDuration();

    // A `gridConfig` rebuild detaches and re-attaches this same instance, which
    // strips the attributes but keeps the layout state — so re-assert them here or
    // the grid sits in card mode with none of the card CSS until the next resize.
    this.#syncLayoutAttributes();

    // Card height is measured from the DOM and outranks the config, so a rebuild
    // carrying a new `cardRowHeight` would keep serving the previous measurement.
    this.#measuredCardHeight = undefined;
    this.#measuredGroupRowHeight = undefined;

    // The cards on screen were rendered under the previous config.
    if (this.#isResponsive) this.requestRender();

    // Observe the grid element itself (not internal viewport)
    // This captures the container width including when shell panels open/close
    this.#resizeObserver = new ResizeObserver((entries) => {
      this.#onResize(entries[0]?.contentRect.width ?? 0);
    });

    this.#resizeObserver.observe(this.gridElement);
  }

  /**
   * React to an observed size change.
   *
   * ResizeObserver also fires for HEIGHT changes, and host apps commonly animate
   * a container's height (or load content into it) while the width is already
   * final. A trailing-only debounce is reset by every one of those, delaying the
   * layout switch long past the moment the final width was known. So:
   *
   * 1. Height-only notifications are dropped — they cannot change the outcome.
   * 2. A width change switches on the LEADING edge when no switch happened in
   *    the last `debounceMs`, so a settled width applies within one frame.
   * 3. Further width changes inside that window are deferred to a single
   *    trailing evaluation, which rate-limits thrash during a resize drag.
   */
  #onResize(width: number): void {
    this.#currentWidth = width;

    // Height-only resize — nothing the breakpoint logic reads has changed.
    if (width === this.#lastCheckedWidth) return;

    const debounceMs = this.config.debounceMs ?? 100;
    const sinceLastSwitch = performance.now() - this.#lastSwitchAt;

    clearTimeout(this.#debounceTimer);

    if (sinceLastSwitch >= debounceMs) {
      this.#lastCheckedWidth = width;
      this.#checkBreakpoint(width);
      return;
    }

    this.#debounceTimer = setTimeout(() => {
      this.#lastCheckedWidth = this.#currentWidth;
      this.#checkBreakpoint(this.#currentWidth);
    }, debounceMs - sinceLastSwitch);
  }

  // #region Light DOM Parsing

  /**
   * Parse `<tbw-grid-responsive-card>` elements from the grid's light DOM.
   *
   * Allows declarative configuration:
   * ```html
   * <tbw-grid [rows]="data">
   *   <tbw-grid-responsive-card breakpoint="500" card-row-height="80">
   *     <div class="custom-card">
   *       <strong>{{ row.name }}</strong>
   *       <span>{{ row.email }}</span>
   *     </div>
   *   </tbw-grid-responsive-card>
   * </tbw-grid>
   * ```
   *
   * Attributes:
   * - `breakpoint`: number - Width threshold for responsive mode
   * - `card-row-height`: number | 'auto' - Card height (default: 'auto')
   * - `hidden-columns`: string - Comma-separated fields to hide
   * - `hide-header`: 'true' | 'false' - Hide per-card field labels (default: 'false')
   * - `debounce-ms`: number - Resize debounce delay (default: 100)
   */
  #parseLightDomCard(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const cardEl = gridEl.querySelector('tbw-grid-responsive-card');
    if (!cardEl) return;

    // Check if a framework adapter wants to handle this element
    // (e.g., React adapter intercepts for JSX rendering)
    const adapter = this.#internalGrid.__frameworkAdapter;
    if (adapter?.parseResponsiveCardElement) {
      const adapterRenderer = adapter.parseResponsiveCardElement(cardEl);
      if (adapterRenderer) {
        this.config = { ...this.config, cardRenderer: adapterRenderer };
        // Continue to parse attributes even if adapter provides renderer
      }
    }

    // Parse attributes for configuration
    const breakpointAttr = cardEl.getAttribute('breakpoint');
    const cardRowHeightAttr = cardEl.getAttribute('card-row-height');
    const hiddenColumnsAttr = cardEl.getAttribute('hidden-columns');
    const hideHeaderAttr = cardEl.getAttribute('hide-header');
    const debounceMsAttr = cardEl.getAttribute('debounce-ms');

    const configUpdates: Partial<ResponsivePluginConfig<T>> = {};

    if (breakpointAttr !== null) {
      const breakpoint = parseInt(breakpointAttr, 10);
      if (!isNaN(breakpoint)) {
        configUpdates.breakpoint = breakpoint;
      }
    }

    if (cardRowHeightAttr !== null) {
      configUpdates.cardRowHeight = cardRowHeightAttr === 'auto' ? 'auto' : parseInt(cardRowHeightAttr, 10);
    }

    if (hiddenColumnsAttr !== null) {
      // Parse comma-separated field names
      configUpdates.hiddenColumns = hiddenColumnsAttr
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if (hideHeaderAttr !== null) {
      configUpdates.hideHeader = hideHeaderAttr !== 'false';
    }

    if (debounceMsAttr !== null) {
      const debounceMs = parseInt(debounceMsAttr, 10);
      if (!isNaN(debounceMs)) {
        configUpdates.debounceMs = debounceMs;
      }
    }

    // Get template content from innerHTML (only if no renderer already set)
    const templateHTML = cardEl.innerHTML.trim();
    if (templateHTML && !this.config.cardRenderer && !adapter?.parseResponsiveCardElement) {
      // Create a template-based renderer using the inner HTML
      configUpdates.cardRenderer = (row: T): HTMLElement => {
        // Evaluate template expressions like {{ row.field }}
        const evaluated = evalTemplateString(templateHTML, { value: row, row: row as Record<string, unknown> });
        const container = document.createElement('div');
        container.className = 'tbw-responsive-card-content';
        // Sanitize the result to prevent XSS
        setSanitizedHTML(container, evaluated);
        return container;
      };
    }

    // Merge updates into config (light DOM values override constructor config)
    if (Object.keys(configUpdates).length > 0) {
      this.config = { ...this.config, ...configUpdates };
    }
  }

  // #endregion

  /**
   * Build the hidden and value-only column sets from config.
   */
  #buildHiddenColumnSets(hiddenColumns?: HiddenColumnConfig[]): void {
    this.#hiddenColumnSet = new Set();
    this.#valueOnlyColumnSet.clear();

    for (const col of hiddenColumns ?? []) {
      if (typeof col === 'string') {
        this.#hiddenColumnSet.add(col);
      } else if (col.showValue) {
        this.#valueOnlyColumnSet.add(col.field);
      } else {
        this.#hiddenColumnSet.add(col.field);
      }
    }

    this.#queueHiddenColumnFades();
  }

  /**
   * Whether `hiddenColumns` is in effect right now: card mode drops the column
   * from the card, and in progressive degradation a matched breakpoint drops it
   * from the table. A plain table with no matching breakpoint shows everything.
   */
  get #hiddenColumnsApply(): boolean {
    return this.#sortedBreakpoints.length > 0 ? this.#activeBreakpoint !== null : this.#isResponsive;
  }

  /**
   * Queue a fade for every column whose visibility actually changed. The diff is
   * against what the last render hid rather than against the previous config,
   * because `hiddenColumns` is inert in a plain table — fading a column out there
   * would strand it invisible in a track that is never collapsed.
   */
  #queueHiddenColumnFades(): void {
    const applied = this.#hiddenColumnsApply ? this.#hiddenColumnSet : EMPTY_FIELD_SET;

    for (const field of this.#appliedHiddenFields) {
      if (!applied.has(field)) this.#markColumnFade(field, false);
    }
    for (const field of applied) {
      if (!this.#appliedHiddenFields.has(field)) this.#markColumnFade(field, true);
    }
    this.#openFadeWindow();
  }

  /** Queue `field` for the next fade, dropping any opposite direction still pending for it. */
  #markColumnFade(field: string, out: boolean): void {
    (out ? this.#fadeInFields : this.#fadeOutFields).delete(field);
    (out ? this.#fadeOutFields : this.#fadeInFields).add(field);
  }

  /**
   * Start the window during which queued columns animate. The track collapse is a
   * CSS transition on the row, which survives a render, but the opacity fade is
   * not: cells are rebuilt on every render, so a hidden column's cell would be
   * re-inserted visible and transition to hidden all over again — exactly the
   * flash of every hidden column reappearing. Cells are animated explicitly
   * instead, and only the fields that actually changed are queued.
   */
  #openFadeWindow(): void {
    const duration = this.#motionDurationMs;
    if (duration <= 0 || (this.#fadeOutFields.size === 0 && this.#fadeInFields.size === 0)) {
      this.#endFadeWindow();
      return;
    }

    this.#fadeEndsAt = performance.now() + duration;
    this.gridElement?.setAttribute(COLUMN_FADE_ATTR, '');
    clearTimeout(this.#fadeTimer);
    this.#fadeTimer = setTimeout(() => this.#endFadeWindow(), duration);
  }

  #endFadeWindow(): void {
    clearTimeout(this.#fadeTimer);
    this.#fadeTimer = undefined;
    this.#fadeEndsAt = 0;
    this.#fadeOutFields.clear();
    this.#fadeInFields.clear();
    this.gridElement?.removeAttribute(COLUMN_FADE_ATTR);

    // The fade-out fills forwards to hold the cell at zero until the render that
    // hides it lands. Past the window CSS owns visibility, so releasing the fill
    // is what stops an abandoned fade from stranding a visible column invisible.
    for (const cell of this.gridElement?.querySelectorAll<HTMLElement>('.cell[data-field]') ?? []) {
      for (const animation of cell.getAnimations?.() ?? []) {
        if (animation.id === COLUMN_FADE_ID) animation.cancel();
      }
    }
  }

  /** Animate one cell, seeking to `elapsed` so a cell created mid-fade joins in progress. */
  #playColumnFade(cell: HTMLElement, out: boolean, duration: number, elapsed: number): void {
    for (const animation of cell.getAnimations?.() ?? []) {
      if (animation.id === COLUMN_FADE_ID) animation.cancel();
    }
    const frames = out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }];
    // A fade-out has to hold at zero until the closing render hides the cell for real.
    const animation = cell.animate?.(frames, { duration, easing: 'ease-out', fill: out ? 'forwards' : 'none' });
    if (!animation) return;
    animation.id = COLUMN_FADE_ID;
    animation.currentTime = elapsed;
  }

  /**
   * Collapse the tracks of hidden columns to zero width. Cells are auto-placed, so
   * a hidden cell has to stay in layout — dropping it would pull every later cell
   * into the wrong track. Collapsing the track instead is what lets the row, and
   * therefore the horizontal scroll width, shrink to the visible columns.
   *
   * Core rewrites `--tbw-column-template` from the full column list on every
   * template update, so this override is re-applied after each render.
   */
  #applyColumnTemplate(hidden: ReadonlySet<string>): void {
    const base = this.#internalGrid?._gridTemplate ?? '';
    if (!base) return;

    const columns = this.visibleColumns;
    const tracks = splitTrackList(base);
    let collapsed = false;

    if (hidden.size > 0 && tracks.length === columns.length) {
      for (let i = 0; i < columns.length; i++) {
        const field = columns[i]?.field;
        if (field && hidden.has(field)) {
          tracks[i] = collapsedTrack(tracks[i]);
          collapsed = true;
        }
      }
    }

    if (!collapsed && !this.#templateOverridden) return;
    this.gridElement.style.setProperty('--tbw-column-template', collapsed ? tracks.join(' ') : base);
    this.#templateOverridden = collapsed;
  }

  override detach(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#endFadeWindow();
    clearTimeout(this.#debounceTimer);
    this.#debounceTimer = undefined;
    this.#lastCheckedWidth = undefined;
    this.#lastSwitchAt = Number.NEGATIVE_INFINITY;

    // Every attribute `#syncLayoutAttributes()` writes styles the grid on its own
    // — `[data-responsive-animate]` transitions rows even in table mode — so a
    // detached plugin that leaves one behind keeps styling a grid it no longer owns.
    if (this.gridElement) {
      this.gridElement.removeAttribute('data-responsive');
      this.gridElement.removeAttribute('data-responsive-animate');
      this.gridElement.removeAttribute('data-responsive-hide-header');
      this.gridElement.removeAttribute('data-responsive-transition');
      for (const cell of this.gridElement.querySelectorAll(
        '.cell[data-responsive-hidden], .cell[data-responsive-value-only]',
      )) {
        cell.removeAttribute('data-responsive-hidden');
        cell.removeAttribute('data-responsive-value-only');
        cell.removeAttribute('aria-hidden');
      }
      this.#clearMorphNames();
    }
    this.#appliedHiddenFields = EMPTY_FIELD_SET;
    this.#appliedValueOnlyFields = EMPTY_FIELD_SET;

    super.detach();
  }

  /**
   * Handle plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'isCardMode') {
      return this.#isResponsive;
    }
    return undefined;
  }

  /**
   * Apply hidden and value-only columns.
   * In legacy mode (single breakpoint), only applies when in responsive mode.
   * In multi-breakpoint mode, applies whenever there's an active breakpoint.
   */
  override afterRender(): void {
    // Measure card height for virtualization calculations
    this.#measureCardHeightFromDOM();

    // In single breakpoint mode, only apply when responsive
    // In multi-breakpoint mode, apply when there's an active breakpoint
    const shouldApply = this.#sortedBreakpoints.length > 0 ? this.#activeBreakpoint !== null : this.#isResponsive;

    const hidden = shouldApply ? this.#hiddenColumnSet : EMPTY_FIELD_SET;
    const valueOnly = shouldApply ? this.#valueOnlyColumnSet : EMPTY_FIELD_SET;
    const fading = this.#fadeOutFields.size > 0 || this.#fadeInFields.size > 0;

    // Cells live in a recycled row pool, so an attribute written in card mode
    // outlives the switch back to table — one clearing pass is still owed.
    const stale = this.#appliedHiddenFields.size > 0 || this.#appliedValueOnlyFields.size > 0;

    // A layout switch changes which columns are hidden without going through the
    // config, and the switch animation already covers it — so record the new
    // truth here rather than letting the next config change diff against a stale set.
    this.#appliedHiddenFields = hidden;
    this.#appliedValueOnlyFields = valueOnly;

    // Card mode stacks cells vertically, so the track list is meaningless there.
    this.#applyColumnTemplate(this.#isResponsive ? EMPTY_FIELD_SET : hidden);

    if (hidden.size === 0 && valueOnly.size === 0 && !fading && !stale) {
      return;
    }

    const duration = this.#motionDurationMs;
    const elapsed = fading ? Math.min(duration, Math.max(0, duration - (this.#fadeEndsAt - performance.now()))) : 0;

    // Mark cells for hidden columns and value-only columns
    const cells = this.gridElement.querySelectorAll<HTMLElement>('.cell[data-field]');
    for (const cell of cells) {
      const field = cell.getAttribute('data-field');
      if (!field) continue;

      const fadingOut = this.#fadeOutFields.has(field);
      if (fadingOut || this.#fadeInFields.has(field)) this.#playColumnFade(cell, fadingOut, duration, elapsed);

      // The cell keeps its box and collapses with its track, so it stays out of
      // the accessibility tree the way `display: none` used to keep it.
      if (hidden.has(field)) {
        cell.setAttribute('data-responsive-hidden', '');
        cell.setAttribute('aria-hidden', 'true');
        cell.removeAttribute('data-responsive-value-only');
      }
      // Apply value-only attribute (shows value without header label)
      else if (valueOnly.has(field)) {
        cell.setAttribute('data-responsive-value-only', '');
        cell.removeAttribute('data-responsive-hidden');
        cell.removeAttribute('aria-hidden');
      }
      // Clear any previous responsive attributes
      else {
        cell.removeAttribute('data-responsive-hidden');
        cell.removeAttribute('data-responsive-value-only');
        cell.removeAttribute('aria-hidden');
      }
    }
  }

  /**
   * Check if width has crossed any breakpoint threshold.
   * Handles both single breakpoint (legacy) and multi-breakpoint modes.
   */
  #checkBreakpoint(width: number): void {
    // Multi-breakpoint mode
    if (this.#sortedBreakpoints.length > 0) {
      this.#checkMultiBreakpoint(width);
      return;
    }

    // Legacy single breakpoint mode
    const breakpoint = this.config.breakpoint ?? 0;

    // Warn once if breakpoint not configured (0 means never responsive)
    if (breakpoint === 0 && !this.#warnedAboutMissingBreakpoint) {
      this.#warnedAboutMissingBreakpoint = true;
      this.warn(
        MISSING_BREAKPOINT,
        "No breakpoint configured. Responsive mode is disabled. Set a breakpoint based on your grid's column count.",
      );
    }

    const shouldBeResponsive = breakpoint > 0 && width < breakpoint;

    if (shouldBeResponsive !== this.#isResponsive) {
      this.#isResponsive = shouldBeResponsive;
      this.#lastSwitchAt = performance.now();
      this.#commitLayoutSwitch();
      this.emit('responsive-change', {
        isResponsive: shouldBeResponsive,
        width,
        breakpoint,
      } satisfies ResponsiveChangeDetail);
    }
  }

  /**
   * Check breakpoints in multi-breakpoint mode.
   * Evaluates breakpoints from largest to smallest, applying the first match.
   */
  #checkMultiBreakpoint(width: number): void {
    // Find the active breakpoint (first one where width <= maxWidth)
    // Since sorted largest to smallest, we find the largest matching breakpoint
    let newActiveBreakpoint: BreakpointConfig | null = null;

    for (const bp of this.#sortedBreakpoints) {
      if (width <= bp.maxWidth) {
        newActiveBreakpoint = bp;
        // Continue to find the most specific (smallest) matching breakpoint
      }
    }

    // Check if breakpoint changed
    const breakpointChanged = newActiveBreakpoint !== this.#activeBreakpoint;

    if (breakpointChanged) {
      this.#activeBreakpoint = newActiveBreakpoint;
      this.#lastSwitchAt = performance.now();

      // Update hidden column sets from active breakpoint
      if (newActiveBreakpoint?.hiddenColumns) {
        this.#buildHiddenColumnSets(newActiveBreakpoint.hiddenColumns);
      } else {
        // Fall back to top-level hiddenColumns config
        this.#buildHiddenColumnSets(this.config.hiddenColumns);
      }

      // Determine if we should be in card layout
      const shouldBeResponsive = newActiveBreakpoint?.cardLayout === true;
      const layoutChanged = shouldBeResponsive !== this.#isResponsive;

      if (layoutChanged) {
        this.#isResponsive = shouldBeResponsive;
      }

      // A hidden-column change still needs a re-render even when the card
      // layout itself did not flip, so always commit through the same path.
      this.#commitLayoutSwitch(layoutChanged);

      // Emit event for any breakpoint change
      this.emit('responsive-change', {
        isResponsive: this.#isResponsive,
        width,
        breakpoint: newActiveBreakpoint?.maxWidth ?? 0,
      } satisfies ResponsiveChangeDetail);
    }
  }

  /**
   * Commit a layout switch, driving it through a view transition when the
   * browser supports element-scoped transitions.
   *
   * The switch is a wholesale layout change (table rows become cards), so the
   * compositor cross-fade is both cheaper and more legible than animating the
   * DOM. Where `Element.startViewTransition()` is unavailable the grid falls
   * back to the CSS keyframe fade driven by `data-responsive-animate`.
   *
   * A hidden-column change is deliberately excluded from the transition. Only the
   * affected column moves in that case — its grid track collapses to zero width
   * while every other track keeps its size — so the leaving cell can fade and
   * shrink in place. Snapshotting the whole grid for it makes all columns shimmer,
   * and because the change is driven by a resize the frozen snapshot is scaled
   * against a container that is still being dragged.
   * @param layoutChanged - Whether the table/card layout itself flipped. `false`
   *   when only the hidden-column set changed.
   */
  #commitLayoutSwitch(layoutChanged = true): void {
    this.#syncMotionDuration();

    // The view transition already cross-fades everything, so per-column fades
    // would only fight it.
    if (layoutChanged) this.#endFadeWindow();

    const startViewTransition = layoutChanged ? this.#viewTransitionStarter() : null;
    if (!startViewTransition) {
      if (layoutChanged) this.#applyResponsiveState();
      this.requestRender();
      return;
    }

    const host = this.gridElement;
    const morph = this.#resolveMorphGranularity();
    const token = ++this.#transitionToken;

    // Names must exist on the outgoing rows before the snapshot is taken.
    if (morph !== 'none') this.#setMorphNames(morph);
    host.setAttribute('data-responsive-transition', '');

    const transition = startViewTransition(async () => {
      this.#applyResponsiveState();
      // The render scheduler batches into rAF, which still runs inside the
      // update callback — so awaiting here captures the finished new layout.
      await this.#internalGrid.forceLayout?.();
      if (morph !== 'none') this.#setMorphNames(morph);
    });

    const cleanup = (): void => {
      // A superseded transition still settles, and tearing down the names and
      // attribute its successor is mid-flight on would abort that successor.
      if (token !== this.#transitionToken) return;
      host.removeAttribute('data-responsive-transition');
      if (morph !== 'none') this.#clearMorphNames();
    };
    transition.finished.then(cleanup, cleanup);
    // A drag across the breakpoint supersedes the transition in flight; the UA
    // skips it and rejects `ready`, which is expected rather than an error.
    transition.ready?.catch(() => undefined);
  }

  /** Animation style in effect, resolving the deprecated `animate` flag. */
  get #animation(): ResponsiveAnimation {
    const { animation, animate } = this.config;
    if (animation !== undefined) return animation;
    return animate === false ? false : 'fade';
  }

  /** Duration every responsive animation runs at; `0` when motion is suppressed. */
  get #motionDurationMs(): number {
    const enabled = this.#animation !== false && this.isAnimationEnabled;
    return enabled ? (this.config.animationDuration ?? 200) : 0;
  }

  /**
   * Publish the single duration every responsive animation reads. Collapsing it
   * to `0ms` is how `animation: false` and `prefers-reduced-motion` silence the
   * CSS-driven paths (the column fade, the card-enter keyframe, and the view
   * transition groups), none of which can see the plugin config.
   */
  #syncMotionDuration(): void {
    this.gridElement.style.setProperty('--tbw-responsive-duration', `${this.#motionDurationMs}ms`);
  }

  /**
   * Resolve the element-scoped view transition entry point, or `null` when
   * animation is disabled or the browser does not support it.
   */
  #viewTransitionStarter(): ViewTransitionStarter | null {
    if (this.#animation === false || !this.isAnimationEnabled) return null;

    const host: ViewTransitionCapableElement = this.gridElement;
    const start = host.startViewTransition;
    return typeof start === 'function' ? start.bind(host) : null;
  }

  /** Whether the browser can drive the layout switch on the compositor. */
  get #supportsViewTransition(): boolean {
    const host: ViewTransitionCapableElement | undefined = this.gridElement;
    return typeof host?.startViewTransition === 'function';
  }

  /**
   * Give every rendered row a stable `view-transition-name` so the compositor
   * animates each row from its table position to its card position.
   */
  #setMorphNames(granularity: MorphGranularity): void {
    const rows = this.gridElement.querySelectorAll<HTMLElement>('.data-grid-row[aria-rowindex]');
    for (const row of rows) {
      const rowIndex = row.getAttribute('aria-rowindex');
      if (granularity === 'rows') {
        row.style.setProperty('view-transition-name', `${this.#morphPrefix}${rowIndex}`);
        continue;
      }
      // Only the leaves are named — naming the row too would lift its cells out
      // of the row's own snapshot and animate both against each other.
      for (const cell of row.querySelectorAll<HTMLElement>(':scope > .cell[aria-colindex]')) {
        const name = `${this.#cellMorphPrefix}${rowIndex}-${cell.getAttribute('aria-colindex')}`;
        cell.style.setProperty('view-transition-name', name);
      }
    }
  }

  /**
   * Pick the morph granularity for this switch.
   *
   * Cell identity is NOT stable across a layout switch (the row renderer
   * rebuilds cells whenever the visible column set changes), so names are
   * authored rather than left to `view-transition-name: match-element`.
   */
  #resolveMorphGranularity(): MorphGranularity {
    const animation = this.#animation;
    if (animation === 'morph-cells') {
      const cells = this.gridElement.querySelectorAll('.data-grid-row > .cell[aria-colindex]').length;
      if (cells > 0 && cells <= MAX_MORPH_CELLS) return 'cells';
      return 'rows';
    }
    return animation === 'morph-rows' ? 'rows' : 'none';
  }

  /** Remove morph names so recycled rows and cells do not carry stale identities. */
  #clearMorphNames(): void {
    const named = this.gridElement.querySelectorAll<HTMLElement>('.data-grid-row, .data-grid-row > .cell');
    for (const el of named) {
      el.style.removeProperty('view-transition-name');
    }
  }

  /** Original row height before entering responsive mode, for restoration on exit */
  #originalRowHeight?: number;

  /** The host attributes every responsive CSS rule keys off. */
  #syncLayoutAttributes(): void {
    this.gridElement.toggleAttribute('data-responsive', this.#isResponsive);

    // The keyframe fade is the no-view-transition path only. Leaving it on
    // would replay the card-enter animation the moment the transition ends.
    this.gridElement.toggleAttribute(
      'data-responsive-animate',
      this.#animation !== false && !this.#supportsViewTransition,
    );

    // Attribute only meaningful while in card mode; clear it otherwise so
    // the CSS rule cannot accidentally apply to non-responsive layouts.
    this.gridElement.toggleAttribute(
      'data-responsive-hide-header',
      this.#isResponsive && this.config.hideHeader === true,
    );
  }

  /**
   * Apply the responsive state to the grid element.
   * Handles scroll reset when entering responsive mode and row height restoration on exit.
   */
  #applyResponsiveState(): void {
    this.#syncLayoutAttributes();

    // Cast to internal type for virtualization access
    const internalGrid = this.#internalGrid;

    if (this.#isResponsive) {
      // Store original row height before responsive mode changes it
      if (internalGrid._virtualization) {
        this.#originalRowHeight = internalGrid._virtualization.rowHeight;
      }

      // Reset horizontal scroll position when entering responsive mode
      // The CSS hides overflow but doesn't reset the scroll position
      const scrollArea = this.gridElement.querySelector('.tbw-scroll-area') as HTMLElement | null;
      if (scrollArea) {
        scrollArea.scrollLeft = 0;
      }
    } else {
      // Exiting responsive mode - clean up inline styles set by renderRow
      // The rows are reused from the pool, so we need to remove the card-specific styles
      const rows = this.gridElement.querySelectorAll('.data-grid-row');
      for (const row of rows) {
        (row as HTMLElement).style.height = '';
        row.classList.remove('responsive-card');
      }

      // Restore original row height
      if (this.#originalRowHeight && this.#originalRowHeight > 0 && internalGrid._virtualization) {
        internalGrid._virtualization.rowHeight = this.#originalRowHeight;
        this.#originalRowHeight = undefined;
      }

      // Clear cached measurements so they're remeasured fresh when re-entering responsive mode
      // Without this, stale measurements cause incorrect height calculations after scrolling
      this.#measuredCardHeight = undefined;
      this.#measuredGroupRowHeight = undefined;
      this.#lastCardRowCount = undefined;
    }
  }

  /**
   * Custom row rendering when cardRenderer is provided and in responsive mode.
   *
   * When a cardRenderer is configured, this hook takes over row rendering to display
   * the custom card layout instead of the default cell structure.
   *
   * @param row - The row data object
   * @param rowEl - The row DOM element to render into
   * @param rowIndex - The index of the row in the data array
   * @returns `true` if rendered (prevents default), `void` for default rendering
   */
  override renderRow(row: unknown, rowEl: HTMLElement, rowIndex: number): boolean | void {
    // Only override when in responsive mode AND cardRenderer is provided
    if (!this.#isResponsive || !this.config.cardRenderer) {
      return; // Let default rendering proceed
    }

    // Skip group rows from GroupingRowsPlugin - they have special structure
    // and should use their own renderer
    if ((row as { __isGroupRow?: boolean }).__isGroupRow) {
      return; // Let GroupingRowsPlugin handle group row rendering
    }

    // Clear existing content
    rowEl.replaceChildren();

    // Call user's cardRenderer to get custom content
    const cardContent = this.config.cardRenderer(row as T, rowIndex);

    // Reset className - clears any stale classes from previous use (e.g., 'group-row' from recycled element)
    // This follows the same pattern as GroupingRowsPlugin which sets className explicitly
    rowEl.className = 'data-grid-row responsive-card';

    // Handle card row height — when a numeric height is configured, use the effective
    // height from #getCardHeight() which incorporates DOM measurement after first render.
    // This keeps inline height in sync with the position cache used for virtualization.
    const configuredHeight = this.config.cardRowHeight;
    if (configuredHeight === 'auto' || configuredHeight === undefined) {
      rowEl.style.height = 'auto';
    } else {
      rowEl.style.height = `${this.#getCardHeight()}px`;
    }

    // Append the custom card content
    // The row keeps `role="row"`, which may only own cell-ish children (WCAG
    // 1.3.1 / axe `aria-required-children`). A card collapses the whole record
    // into one box, so it is exposed as a single spanning gridcell — unless the
    // renderer already assigned its own role.
    if (!cardContent.hasAttribute('role')) {
      cardContent.setAttribute('role', 'gridcell');
      cardContent.setAttribute('aria-colindex', '1');
    }
    rowEl.appendChild(cardContent);

    return true; // We handled rendering
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
          ensureCellVisible(this.#internalGrid);
          return true;
        }
        // At bottom of card - optionally move to next card's first field
        if (this.grid._focusRow < maxRow) {
          this.grid._focusRow += 1;
          this.grid._focusCol = 0;
          e.preventDefault();
          ensureCellVisible(this.#internalGrid);
          return true;
        }
        break;

      case 'ArrowUp':
        // Move up WITHIN card (to previous field/column)
        if (this.grid._focusCol > 0) {
          this.grid._focusCol -= 1;
          e.preventDefault();
          ensureCellVisible(this.#internalGrid);
          return true;
        }
        // At top of card - optionally move to previous card's last field
        if (this.grid._focusRow > 0) {
          this.grid._focusRow -= 1;
          this.grid._focusCol = maxCol;
          e.preventDefault();
          ensureCellVisible(this.#internalGrid);
          return true;
        }
        break;

      case 'ArrowRight':
        // Move to NEXT card (same field)
        if (this.grid._focusRow < maxRow) {
          this.grid._focusRow += 1;
          e.preventDefault();
          ensureCellVisible(this.#internalGrid);
          return true;
        }
        break;

      case 'ArrowLeft':
        // Move to PREVIOUS card (same field)
        if (this.grid._focusRow > 0) {
          this.grid._focusRow -= 1;
          e.preventDefault();
          ensureCellVisible(this.#internalGrid);
          return true;
        }
        break;
    }

    return false;
  }

  // ============================================
  // Variable Height Support for Mixed Row Types
  // ============================================

  /** Measured card height from DOM for virtualization calculations */
  #measuredCardHeight?: number;

  /** Measured group row height from DOM for virtualization calculations */
  #measuredGroupRowHeight?: number;

  /** Last known card row count for detecting changes (e.g., group expand/collapse) */
  #lastCardRowCount?: number;

  /**
   * Get the effective card height for virtualization calculations.
   */
  #getCardHeight(): number {
    const configHeight = this.config.cardRowHeight;
    const measured = this.#measuredCardHeight;

    // A fixed height is the answer unless the content overflows it; only `auto`
    // hands the decision to the measurement outright.
    if (typeof configHeight === 'number' && configHeight > 0) {
      return measured && measured > configHeight ? measured : configHeight;
    }
    if (measured && measured > 0) {
      return measured;
    }
    return 80;
  }

  /**
   * Get the effective group row height for virtualization calculations.
   * Uses DOM-measured height, falling back to original row height.
   */
  #getGroupRowHeight(): number {
    if (this.#measuredGroupRowHeight && this.#measuredGroupRowHeight > 0) {
      return this.#measuredGroupRowHeight;
    }
    // Fall back to original row height (before responsive mode)
    return this.#originalRowHeight ?? 28;
  }

  /**
   * Check if there are any group rows in the current dataset.
   * Used to determine if we have mixed row heights.
   */
  #hasGroupRows(): boolean {
    for (const row of this.rows) {
      if ((row as { __isGroupRow?: boolean }).__isGroupRow) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the height of a specific row based on its type (group row vs card row).
   * Returns undefined if not in responsive mode.
   *
   * @param row - The row data
   * @param _index - The row index (unused, but part of the interface)
   * @returns The row height in pixels, or undefined if not in responsive mode
   */
  override getRowHeight(row: unknown, _index: number): number | undefined {
    // Only applies when in responsive mode with cardRenderer
    if (!this.#isResponsive || !this.config.cardRenderer) {
      return undefined;
    }

    // Check if this is a group row
    if ((row as { __isGroupRow?: boolean }).__isGroupRow) {
      return this.#getGroupRowHeight();
    }

    // Regular card row
    return this.#getCardHeight();
  }

  /**
   * Count the number of card rows (non-group rows) in the current dataset.
   */
  #countCardRows(): number {
    let count = 0;
    for (const row of this.rows) {
      if (!(row as { __isGroupRow?: boolean }).__isGroupRow) {
        count++;
      }
    }
    return count;
  }

  /** Pending refresh scheduled via microtask */
  #pendingRefresh = false;

  /**
   * Measure card height from DOM after render and detect row count changes.
   * Called in afterRender to ensure scroll calculations are accurate.
   *
   * This handles two scenarios:
   * 1. Card height changes (content overflow, dynamic sizing)
   * 2. Card row count changes (group expand/collapse)
   * 3. Group row height changes
   *
   * For uniform card layouts (no groups), we update the virtualization row height
   * directly to the card height. For mixed layouts (groups + cards), we use the
   * getExtraHeight mechanism to report height differences.
   *
   * The refresh is deferred via microtask to avoid nested render cycles.
   */
  #measureCardHeightFromDOM(): void {
    if (!this.#isResponsive) {
      return;
    }

    let needsRefresh = false;
    const internalGrid = this.#internalGrid;
    const hasGroups = this.#hasGroupRows();

    // Check if card row count changed (e.g., group expanded/collapsed)
    const currentCardRowCount = this.#countCardRows();
    if (currentCardRowCount !== this.#lastCardRowCount) {
      this.#lastCardRowCount = currentCardRowCount;
      needsRefresh = true;
    }

    // Measure actual group row height from DOM (for mixed layouts)
    if (hasGroups) {
      const groupRow = this.gridElement.querySelector('.data-grid-row.group-row') as HTMLElement | null;
      if (groupRow) {
        const height = groupRow.getBoundingClientRect().height;
        if (height > 0 && height !== this.#measuredGroupRowHeight) {
          this.#measuredGroupRowHeight = height;
          needsRefresh = true;
        }
      }
    }

    // Measure actual card height from DOM.
    // With cardRenderer, rows have the `.responsive-card` class.
    // Without cardRenderer (CSS-only card mode), rows are plain `.data-grid-row`
    // elements whose CSS height is `auto` — we need to measure their actual
    // rendered height so the faux scrollbar spacer is sized correctly.
    const cardSelector = this.config.cardRenderer ? '.data-grid-row.responsive-card' : '.data-grid-row:not(.group-row)';
    const cardRow = this.gridElement.querySelector(cardSelector) as HTMLElement | null;
    if (cardRow) {
      const height = cardRow.getBoundingClientRect().height;
      if (height > 0 && height !== this.#measuredCardHeight) {
        this.#measuredCardHeight = height;
        needsRefresh = true;

        // For uniform card layouts (no groups), update virtualization row height directly
        // This ensures proper row recycling and translateY calculations
        if (!hasGroups && internalGrid._virtualization) {
          internalGrid._virtualization.rowHeight = height;
        }
      }
    }

    // Defer virtualization refresh to avoid nested render cycles
    // This is called from afterRender, so we can't call refreshVirtualWindow synchronously
    // Use scheduler's VIRTUALIZATION phase to batch properly and avoid duplicate afterRender calls
    if (needsRefresh && !this.#pendingRefresh) {
      this.#pendingRefresh = true;
      queueMicrotask(() => {
        this.#pendingRefresh = false;
        // Only refresh if still attached and in responsive mode
        if (this.grid && this.#isResponsive) {
          // Request virtualization phase through grid's public API
          // This goes through the scheduler which batches and handles afterRender properly
          this.#internalGrid.refreshVirtualWindow?.(true, true);
        }
      });
    }
  }
}
