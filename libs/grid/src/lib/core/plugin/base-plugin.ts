/**
 * Base Grid Plugin Class
 *
 * All plugins extend this abstract class.
 * Plugins are instantiated per-grid and manage their own state.
 */

// Injected by Vite at build time from package.json (same as grid.ts)
declare const __GRID_VERSION__: string;

import type {
  ColumnConfig,
  ColumnState,
  GridPlugin,
  HeaderContentDefinition,
  IconValue,
  ToolPanelDefinition,
} from '../types';
import { DEFAULT_GRID_ICONS } from '../types';

// Re-export shared plugin types for convenience
export { PLUGIN_QUERIES } from './types';
export type {
  AfterCellRenderContext,
  AfterRowRenderContext,
  CellClickEvent,
  CellCoords,
  CellEditor,
  CellMouseEvent,
  CellRenderer,
  ContextMenuItem,
  ContextMenuParams,
  GridElementRef,
  HeaderClickEvent,
  HeaderRenderer,
  KeyboardModifiers,
  PluginCellRenderContext,
  PluginQuery,
  RowClickEvent,
  ScrollEvent,
} from './types';

import type {
  AfterCellRenderContext,
  AfterRowRenderContext,
  CellClickEvent,
  CellEditor,
  CellMouseEvent,
  CellRenderer,
  GridElementRef,
  HeaderClickEvent,
  HeaderRenderer,
  PluginQuery,
  RowClickEvent,
  ScrollEvent,
} from './types';

/**
 * Grid element interface for plugins.
 * Extends GridElementRef with plugin-specific methods.
 * Note: effectiveConfig is already available from GridElementRef.
 */
export interface GridElement extends GridElementRef {
  getPlugin<T extends BaseGridPlugin>(PluginClass: new (...args: any[]) => T): T | undefined;
  getPluginByName(name: string): BaseGridPlugin | undefined;
  /**
   * Get a plugin's state by plugin name.
   * This is a loose-coupling method for plugins to access other plugins' state
   * without importing the plugin class directly.
   * @internal Plugin API
   */
  getPluginState?(name: string): unknown;
}

/**
 * Header render context for plugin header renderers.
 */
export interface PluginHeaderRenderContext {
  /** Column configuration */
  column: ColumnConfig;
  /** Column index */
  colIndex: number;
}

// ============================================================================
// Plugin Dependency Types
// ============================================================================

/**
 * Declares a dependency on another plugin.
 *
 * @category Plugin Development
 * @example
 * ```typescript
 * export class UndoRedoPlugin extends BaseGridPlugin {
 *   static readonly dependencies: PluginDependency[] = [
 *     { name: 'editing', required: true },
 *   ];
 * }
 * ```
 */
export interface PluginDependency {
  /**
   * The name of the required plugin (matches the plugin's `name` property).
   * Use string names for loose coupling - avoids static imports.
   */
  name: string;

  /**
   * Whether this dependency is required (hard) or optional (soft).
   * - `true`: Plugin cannot function without it. Throws error if missing.
   * - `false`: Plugin works with reduced functionality. Logs info if missing.
   * @default true
   */
  required?: boolean;

  /**
   * Human-readable reason for this dependency.
   * Shown in error/info messages to help users understand why.
   * @example "UndoRedoPlugin needs EditingPlugin to track cell edits"
   */
  reason?: string;
}

/**
 * Declares an incompatibility between plugins.
 * When both plugins are loaded, a warning is logged to help users understand the conflict.
 *
 * @category Plugin Development
 */
export interface PluginIncompatibility {
  /**
   * The name of the incompatible plugin (matches the plugin's `name` property).
   */
  name: string;

  /**
   * Human-readable reason for the incompatibility.
   * Should explain why the plugins conflict and any workarounds.
   * @example "Responsive card layout does not support row grouping yet"
   */
  reason: string;
}

// ============================================================================
// Plugin Query & Event Definitions
// ============================================================================

/**
 * Defines a query that a plugin can handle.
 * Other plugins or the grid can send this query type to retrieve data.
 *
 * @category Plugin Development
 *
 * @example
 * ```typescript
 * // In manifest
 * queries: [
 *   {
 *     type: 'canMoveColumn',
 *     description: 'Check if a column can be moved/reordered',
 *   },
 * ]
 *
 * // In plugin class
 * handleQuery(query: PluginQuery): unknown {
 *   if (query.type === 'canMoveColumn') {
 *     return this.canMoveColumn(query.context);
 *   }
 * }
 * ```
 */
export interface QueryDefinition {
  /**
   * The query type identifier (e.g., 'canMoveColumn', 'getContextMenuItems').
   * Should be unique across all plugins.
   */
  type: string;

  /**
   * Human-readable description of what the query does.
   */
  description?: string;
}

/**
 * Defines an event that a plugin can emit.
 * Other plugins can subscribe to these events via the Event Bus.
 *
 * @category Plugin Development
 *
 * @example
 * ```typescript
 * // In manifest
 * events: [
 *   {
 *     type: 'filter-change',
 *     description: 'Emitted when filter criteria change',
 *   },
 * ]
 *
 * // In plugin class - emit
 * this.emitPluginEvent('filter-change', { field: 'name', value: 'Alice' });
 *
 * // In another plugin - subscribe
 * this.on('filter-change', (detail) => console.log('Filter changed:', detail));
 * ```
 */
export interface EventDefinition {
  /**
   * The event type identifier (e.g., 'filter-change', 'selection-change').
   * Used when emitting and subscribing to events.
   */
  type: string;

  /**
   * Human-readable description of what the event represents.
   */
  description?: string;

  /**
   * Whether this event is cancelable via `event.preventDefault()`.
   * @default false
   */
  cancelable?: boolean;
}

// ============================================================================
// Plugin Manifest Types
// ============================================================================

/**
 * Defines a property that a plugin "owns" - used for configuration validation.
 * When this property is used without the owning plugin loaded, an error is thrown.
 *
 * @category Plugin Development
 */
export interface PluginPropertyDefinition {
  /** The property name on column or grid config */
  property: string;
  /** Whether this is a column-level or config-level property */
  level: 'column' | 'config';
  /** Human-readable description for error messages (e.g., 'the "editable" column property') */
  description: string;
  /** Import path hint for error messages (e.g., "import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';") */
  importHint?: string;
  /** Custom check for whether property is considered "used" (default: truthy value check) */
  isUsed?: (value: unknown) => boolean;
}

/**
 * A configuration validation rule for detecting invalid/conflicting settings.
 * Plugins declare rules in their manifest; the validator executes them during grid initialization.
 *
 * @category Plugin Development
 * @template TConfig - The plugin's configuration type
 */
export interface PluginConfigRule<TConfig = unknown> {
  /** Rule identifier for debugging (e.g., 'selection/range-dblclick') */
  id: string;
  /** Severity: 'error' throws, 'warn' logs warning */
  severity: 'error' | 'warn';
  /** Human-readable message shown when rule is violated */
  message: string;
  /** Predicate returning true if the rule is VIOLATED (i.e., config is invalid) */
  check: (pluginConfig: TConfig) => boolean;
}

/**
 * Hook names that can have execution priority configured.
 *
 * @category Plugin Development
 */
export type HookName =
  | 'processColumns'
  | 'processRows'
  | 'afterRender'
  | 'afterCellRender'
  | 'afterRowRender'
  | 'onCellClick'
  | 'onCellMouseDown'
  | 'onCellMouseMove'
  | 'onCellMouseUp'
  | 'onKeyDown'
  | 'onScroll'
  | 'onScrollRender';

/**
 * Static metadata about a plugin's capabilities and requirements.
 * Declared as a static property on plugin classes.
 *
 * @category Plugin Development
 * @template TConfig - The plugin's configuration type
 *
 * @example
 * ```typescript
 * export class MyPlugin extends BaseGridPlugin<MyConfig> {
 *   static override readonly manifest: PluginManifest<MyConfig> = {
 *     ownedProperties: [
 *       { property: 'myProp', level: 'column', description: 'the "myProp" column property' },
 *     ],
 *     configRules: [
 *       { id: 'my-plugin/invalid-combo', severity: 'warn', message: '...', check: (c) => c.a && c.b },
 *     ],
 *   };
 *   readonly name = 'myPlugin';
 * }
 * ```
 */
export interface PluginManifest<TConfig = unknown> {
  /**
   * Properties this plugin owns - validated by validate-config.ts.
   * If a user uses one of these properties without loading the plugin, an error is thrown.
   */
  ownedProperties?: PluginPropertyDefinition[];

  /**
   * Hook execution priority (higher = later, default 0).
   * Use negative values to run earlier, positive to run later.
   */
  hookPriority?: Partial<Record<HookName, number>>;

  /**
   * Configuration validation rules - checked during grid initialization.
   * Rules with severity 'error' throw, 'warn' logs to console.
   */
  configRules?: PluginConfigRule<TConfig>[];

  /**
   * Plugins that are incompatible with this plugin.
   * When both plugins are loaded together, a warning is shown.
   *
   * @example
   * ```typescript
   * incompatibleWith: [
   *   { name: 'groupingRows', reason: 'Responsive card layout does not support row grouping yet' },
   * ],
   * ```
   */
  incompatibleWith?: PluginIncompatibility[];

  /**
   * Queries this plugin can handle.
   * Declares what query types this plugin responds to via `handleQuery()`.
   * This replaces the centralized PLUGIN_QUERIES approach with manifest-declared queries.
   *
   * @example
   * ```typescript
   * queries: [
   *   { type: 'canMoveColumn', description: 'Check if a column can be moved' },
   * ],
   * ```
   */
  queries?: QueryDefinition[];

  /**
   * Events this plugin can emit.
   * Declares what event types other plugins can subscribe to via `on()`.
   *
   * @example
   * ```typescript
   * events: [
   *   { type: 'filter-change', description: 'Emitted when filter criteria change' },
   * ],
   * ```
   */
  events?: EventDefinition[];
}

/**
 * Abstract base class for all grid plugins.
 *
 * @category Plugin Development
 * @template TConfig - Configuration type for the plugin
 */
export abstract class BaseGridPlugin<TConfig = unknown> implements GridPlugin {
  /**
   * Plugin dependencies - declare other plugins this one requires.
   *
   * Dependencies are validated when the plugin is attached.
   * Required dependencies throw an error if missing.
   * Optional dependencies log an info message if missing.
   *
   * @example
   * ```typescript
   * static readonly dependencies: PluginDependency[] = [
   *   { name: 'editing', required: true, reason: 'Tracks cell edits for undo/redo' },
   *   { name: 'selection', required: false, reason: 'Enables selection-based undo' },
   * ];
   * ```
   */
  static readonly dependencies?: PluginDependency[];

  /**
   * Plugin manifest - declares owned properties, config rules, and hook priorities.
   *
   * This is read by the configuration validator to:
   * - Validate that required plugins are loaded when their properties are used
   * - Execute configRules to detect invalid/conflicting settings
   * - Order hook execution based on priority
   *
   * @example
   * ```typescript
   * static override readonly manifest: PluginManifest<MyConfig> = {
   *   ownedProperties: [
   *     { property: 'myProp', level: 'column', description: 'the "myProp" column property' },
   *   ],
   *   configRules: [
   *     { id: 'myPlugin/conflict', severity: 'warn', message: '...', check: (c) => c.a && c.b },
   *   ],
   * };
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static readonly manifest?: PluginManifest<any>;

  /** Unique plugin identifier (derived from class name by default) */
  abstract readonly name: string;

  /**
   * Plugin version - defaults to grid version for built-in plugins.
   * Third-party plugins can override with their own semver.
   */
  readonly version: string = typeof __GRID_VERSION__ !== 'undefined' ? __GRID_VERSION__ : 'dev';

  /** CSS styles to inject into the grid's shadow DOM */
  readonly styles?: string;

  /** Custom cell renderers keyed by type name */
  readonly cellRenderers?: Record<string, CellRenderer>;

  /** Custom header renderers keyed by type name */
  readonly headerRenderers?: Record<string, HeaderRenderer>;

  /** Custom cell editors keyed by type name */
  readonly cellEditors?: Record<string, CellEditor>;

  /** The grid instance this plugin is attached to */
  protected grid!: GridElement;

  /** Plugin configuration - merged with defaults in attach() */
  protected config!: TConfig;

  /** User-provided configuration from constructor */
  protected readonly userConfig: Partial<TConfig>;

  /**
   * Plugin-level AbortController for event listener cleanup.
   * Created fresh in attach(), aborted in detach().
   * This ensures event listeners are properly cleaned up when plugins are re-attached.
   */
  #abortController?: AbortController;

  /**
   * Default configuration - subclasses should override this getter.
   * Note: This must be a getter (not property initializer) for proper inheritance
   * since property initializers run after parent constructor.
   */
  protected get defaultConfig(): Partial<TConfig> {
    return {};
  }

  constructor(config: Partial<TConfig> = {}) {
    this.userConfig = config;
  }

  /**
   * Called when the plugin is attached to a grid.
   * Override to set up event listeners, initialize state, etc.
   *
   * @example
   * ```ts
   * attach(grid: GridElement): void {
   *   super.attach(grid);
   *   // Set up document-level listeners with auto-cleanup
   *   document.addEventListener('keydown', this.handleEscape, {
   *     signal: this.disconnectSignal
   *   });
   * }
   * ```
   */
  attach(grid: GridElement): void {
    // Abort any previous abort controller (in case of re-attach without detach)
    this.#abortController?.abort();
    // Create fresh abort controller for this attachment
    this.#abortController = new AbortController();

    this.grid = grid;
    // Merge config here (after subclass construction is complete)
    this.config = { ...this.defaultConfig, ...this.userConfig } as TConfig;
  }

  /**
   * Called when the plugin is detached from a grid.
   * Override to clean up event listeners, timers, etc.
   *
   * @example
   * ```ts
   * detach(): void {
   *   // Clean up any state not handled by disconnectSignal
   *   this.selectedRows.clear();
   *   this.cache = null;
   * }
   * ```
   */
  detach(): void {
    // Abort the plugin's abort controller to clean up all event listeners
    // registered with { signal: this.disconnectSignal }
    this.#abortController?.abort();
    this.#abortController = undefined;
    // Override in subclass for additional cleanup
  }

  /**
   * Called when another plugin is attached to the same grid.
   * Use for inter-plugin coordination, e.g., to integrate with new plugins.
   *
   * @param name - The name of the plugin that was attached
   * @param plugin - The plugin instance (for direct access if needed)
   *
   * @example
   * ```ts
   * onPluginAttached(name: string, plugin: BaseGridPlugin): void {
   *   if (name === 'selection') {
   *     // Integrate with selection plugin
   *     this.selectionPlugin = plugin as SelectionPlugin;
   *   }
   * }
   * ```
   */
  onPluginAttached?(name: string, plugin: BaseGridPlugin): void;

  /**
   * Called when another plugin is detached from the same grid.
   * Use to clean up inter-plugin references.
   *
   * @param name - The name of the plugin that was detached
   *
   * @example
   * ```ts
   * onPluginDetached(name: string): void {
   *   if (name === 'selection') {
   *     this.selectionPlugin = undefined;
   *   }
   * }
   * ```
   */
  onPluginDetached?(name: string): void;

  /**
   * Get another plugin instance from the same grid.
   * Use for inter-plugin communication.
   *
   * @example
   * ```ts
   * const selection = this.getPlugin(SelectionPlugin);
   * if (selection) {
   *   const selectedRows = selection.getSelectedRows();
   * }
   * ```
   */
  protected getPlugin<T extends BaseGridPlugin>(PluginClass: new (...args: any[]) => T): T | undefined {
    return this.grid?.getPlugin(PluginClass);
  }

  /**
   * Emit a custom event from the grid.
   */
  protected emit<T>(eventName: string, detail: T): void {
    this.grid?.dispatchEvent?.(new CustomEvent(eventName, { detail, bubbles: true }));
  }

  /**
   * Emit a cancelable custom event from the grid.
   * @returns `true` if the event was cancelled (preventDefault called), `false` otherwise
   */
  protected emitCancelable<T>(eventName: string, detail: T): boolean {
    const event = new CustomEvent(eventName, { detail, bubbles: true, cancelable: true });
    this.grid?.dispatchEvent?.(event);
    return event.defaultPrevented;
  }

  // =========================================================================
  // Event Bus - Plugin-to-Plugin Communication
  // =========================================================================

  /**
   * Subscribe to an event from another plugin.
   * The subscription is automatically cleaned up when this plugin is detached.
   *
   * @param eventType - The event type to listen for (e.g., 'filter-change')
   * @param callback - The callback to invoke when the event is emitted
   *
   * @example
   * ```typescript
   * // In attach() or other initialization
   * this.on('filter-change', (detail) => {
   *   console.log('Filter changed:', detail);
   * });
   * ```
   */
  protected on<T = unknown>(eventType: string, callback: (detail: T) => void): void {
    this.grid?._pluginManager?.subscribe(this, eventType, callback as (detail: unknown) => void);
  }

  /**
   * Unsubscribe from a plugin event.
   *
   * @param eventType - The event type to stop listening for
   *
   * @example
   * ```typescript
   * this.off('filter-change');
   * ```
   */
  protected off(eventType: string): void {
    this.grid?._pluginManager?.unsubscribe(this, eventType);
  }

  /**
   * Emit an event to other plugins via the Event Bus.
   * This is for inter-plugin communication only; it does NOT dispatch DOM events.
   * Use `emit()` to dispatch DOM events that external consumers can listen to.
   *
   * @param eventType - The event type to emit (should be declared in manifest.events)
   * @param detail - The event payload
   *
   * @example
   * ```typescript
   * // Emit to other plugins (not DOM)
   * this.emitPluginEvent('filter-change', { field: 'name', value: 'Alice' });
   *
   * // For DOM events that consumers can addEventListener to:
   * this.emit('filter-change', { field: 'name', value: 'Alice' });
   * ```
   */
  protected emitPluginEvent<T>(eventType: string, detail: T): void {
    this.grid?._pluginManager?.emitPluginEvent(eventType, detail);
  }

  /**
   * Request a re-render of the grid.
   */
  protected requestRender(): void {
    this.grid?.requestRender?.();
  }

  /**
   * Request a re-render and restore focus styling afterward.
   * Use this when a plugin action (like expand/collapse) triggers a render
   * but needs to maintain keyboard navigation focus.
   */
  protected requestRenderWithFocus(): void {
    this.grid?.requestRenderWithFocus?.();
  }

  /**
   * Request a lightweight style update without rebuilding DOM.
   * Use this instead of requestRender() when only CSS classes need updating.
   */
  protected requestAfterRender(): void {
    this.grid?.requestAfterRender?.();
  }

  /**
   * Get the current rows from the grid.
   */
  protected get rows(): any[] {
    return this.grid?.rows ?? [];
  }

  /**
   * Get the original unfiltered/unprocessed rows from the grid.
   * Use this when you need all source data regardless of active filters.
   */
  protected get sourceRows(): any[] {
    return this.grid?.sourceRows ?? [];
  }

  /**
   * Get the current columns from the grid.
   */
  protected get columns(): ColumnConfig[] {
    return this.grid?.columns ?? [];
  }

  /**
   * Get only visible columns from the grid (excludes hidden).
   * Use this for rendering that needs to match the grid template.
   */
  protected get visibleColumns(): ColumnConfig[] {
    return this.grid?._visibleColumns ?? [];
  }

  /**
   * Get the grid as an HTMLElement for direct DOM operations.
   * Use sparingly - prefer the typed GridElementRef API when possible.
   *
   * @example
   * ```ts
   * const width = this.gridElement.clientWidth;
   * this.gridElement.classList.add('my-plugin-active');
   * ```
   */
  protected get gridElement(): HTMLElement {
    return this.grid as unknown as HTMLElement;
  }

  /**
   * Get the disconnect signal for event listener cleanup.
   * This signal is aborted when the grid disconnects from the DOM.
   * Use this when adding event listeners that should be cleaned up automatically.
   *
   * Best for:
   * - Document/window-level listeners added in attach()
   * - Listeners on the grid element itself
   * - Any listener that should persist across renders
   *
   * Not needed for:
   * - Listeners on elements created in afterRender() (removed with element)
   *
   * @example
   * element.addEventListener('click', handler, { signal: this.disconnectSignal });
   * document.addEventListener('keydown', handler, { signal: this.disconnectSignal });
   */
  protected get disconnectSignal(): AbortSignal {
    // Return the plugin's own abort signal for proper cleanup on detach/re-attach
    // Falls back to grid's signal if plugin's controller not yet created
    return this.#abortController?.signal ?? this.grid?.disconnectSignal;
  }

  /**
   * Get the grid-level icons configuration.
   * Returns merged icons (user config + defaults).
   */
  protected get gridIcons(): typeof DEFAULT_GRID_ICONS {
    const userIcons = this.grid?.gridConfig?.icons ?? {};
    return { ...DEFAULT_GRID_ICONS, ...userIcons };
  }

  // #region Animation Helpers

  /**
   * Check if animations are enabled at the grid level.
   * Respects gridConfig.animation.mode and the CSS variable set by the grid.
   *
   * Plugins should use this to skip animations when:
   * - Animation mode is 'off' or `false`
   * - User prefers reduced motion and mode is 'reduced-motion' (default)
   *
   * @example
   * ```ts
   * private get animationStyle(): 'slide' | 'fade' | false {
   *   if (!this.isAnimationEnabled) return false;
   *   return this.config.animation ?? 'slide';
   * }
   * ```
   */
  protected get isAnimationEnabled(): boolean {
    const mode = this.grid?.effectiveConfig?.animation?.mode ?? 'reduced-motion';

    // Explicit off = disabled
    if (mode === false || mode === 'off') return false;

    // Explicit on = always enabled
    if (mode === true || mode === 'on') return true;

    // reduced-motion: check CSS variable (set by grid based on media query)
    const host = this.gridElement;
    if (host) {
      const enabled = getComputedStyle(host).getPropertyValue('--tbw-animation-enabled').trim();
      return enabled !== '0';
    }

    return true; // Default to enabled
  }

  /**
   * Get the animation duration in milliseconds from CSS variable.
   * Falls back to 200ms if not set.
   *
   * Plugins can use this for their animation timing to stay consistent
   * with the grid-level animation.duration setting.
   *
   * @example
   * ```ts
   * element.animate(keyframes, { duration: this.animationDuration });
   * ```
   */
  protected get animationDuration(): number {
    const host = this.gridElement;
    if (host) {
      const durationStr = getComputedStyle(host).getPropertyValue('--tbw-animation-duration').trim();
      const parsed = parseInt(durationStr, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 200; // Default
  }

  // #endregion

  /**
   * Resolve an icon value to string or HTMLElement.
   * Checks plugin config first, then grid-level icons, then defaults.
   *
   * @param iconKey - The icon key in GridIcons (e.g., 'expand', 'collapse')
   * @param pluginOverride - Optional plugin-level override
   * @returns The resolved icon value
   */
  protected resolveIcon(iconKey: keyof typeof DEFAULT_GRID_ICONS, pluginOverride?: IconValue): IconValue {
    // Plugin override takes precedence
    if (pluginOverride !== undefined) {
      return pluginOverride;
    }
    // Then grid-level config
    return this.gridIcons[iconKey];
  }

  /**
   * Set an icon value on an element.
   * Handles both string (text/HTML) and HTMLElement values.
   *
   * @param element - The element to set the icon on
   * @param icon - The icon value (string or HTMLElement)
   */
  protected setIcon(element: HTMLElement, icon: IconValue): void {
    if (typeof icon === 'string') {
      element.innerHTML = icon;
    } else if (icon instanceof HTMLElement) {
      element.innerHTML = '';
      element.appendChild(icon.cloneNode(true));
    }
  }

  /**
   * Log a warning message.
   */
  protected warn(message: string): void {
    console.warn(`[tbw-grid:${this.name}] ${message}`);
  }

  // #region Lifecycle Hooks

  /**
   * Transform rows before rendering.
   * Called during each render cycle before rows are rendered to the DOM.
   * Use this to filter, sort, or add computed properties to rows.
   *
   * @param rows - The current rows array (readonly to encourage returning a new array)
   * @returns The modified rows array to render
   *
   * @example
   * ```ts
   * processRows(rows: readonly any[]): any[] {
   *   // Filter out hidden rows
   *   return rows.filter(row => !row._hidden);
   * }
   * ```
   *
   * @example
   * ```ts
   * processRows(rows: readonly any[]): any[] {
   *   // Add computed properties
   *   return rows.map(row => ({
   *     ...row,
   *     _fullName: `${row.firstName} ${row.lastName}`
   *   }));
   * }
   * ```
   */
  processRows?(rows: readonly any[]): any[];

  /**
   * Transform columns before rendering.
   * Called during each render cycle before column headers and cells are rendered.
   * Use this to add, remove, or modify column definitions.
   *
   * @param columns - The current columns array (readonly to encourage returning a new array)
   * @returns The modified columns array to render
   *
   * @example
   * ```ts
   * processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
   *   // Add a selection checkbox column
   *   return [
   *     { field: '_select', header: '', width: 40 },
   *     ...columns
   *   ];
   * }
   * ```
   */
  processColumns?(columns: readonly ColumnConfig[]): ColumnConfig[];

  /**
   * Called before each render cycle begins.
   * Use this to prepare state or cache values needed during rendering.
   *
   * @example
   * ```ts
   * beforeRender(): void {
   *   this.visibleRowCount = this.calculateVisibleRows();
   * }
   * ```
   */
  beforeRender?(): void;

  /**
   * Called after each render cycle completes.
   * Use this for DOM manipulation, adding event listeners to rendered elements,
   * or applying visual effects like selection highlights.
   *
   * @example
   * ```ts
   * afterRender(): void {
   *   // Apply selection styling to rendered rows
   *   const rows = this.gridElement?.querySelectorAll('.data-row');
   *   rows?.forEach((row, i) => {
   *     row.classList.toggle('selected', this.selectedRows.has(i));
   *   });
   * }
   * ```
   */
  afterRender?(): void;

  /**
   * Called after each cell is rendered.
   * This hook is more efficient than `afterRender()` for cell-level modifications
   * because you receive the cell context directly - no DOM queries needed.
   *
   * Use cases:
   * - Adding selection/highlight classes to specific cells
   * - Injecting badges or decorations
   * - Applying conditional styling based on cell value
   *
   * Performance note: Called for every visible cell during render. Keep implementation fast.
   * This hook is also called during scroll when cells are recycled.
   *
   * @param context - The cell render context with row, column, value, and elements
   *
   * @example
   * ```ts
   * afterCellRender(context: AfterCellRenderContext): void {
   *   // Add selection class without DOM queries
   *   if (this.isSelected(context.rowIndex, context.colIndex)) {
   *     context.cellElement.classList.add('selected');
   *   }
   *
   *   // Add validation error styling
   *   if (this.hasError(context.row, context.column.field)) {
   *     context.cellElement.classList.add('has-error');
   *   }
   * }
   * ```
   */
  afterCellRender?(context: AfterCellRenderContext): void;

  /**
   * Called after a row is fully rendered (all cells complete).
   * Use this for row-level decorations, styling, or ARIA attributes.
   *
   * Common use cases:
   * - Adding selection classes to entire rows (row-focus, selected)
   * - Setting row-level ARIA attributes
   * - Applying row validation highlighting
   * - Tree indentation styling
   *
   * Performance note: Called for every visible row during render. Keep implementation fast.
   * This hook is also called during scroll when rows are recycled.
   *
   * @param context - The row render context with row data and element
   *
   * @example
   * ```ts
   * afterRowRender(context: AfterRowRenderContext): void {
   *   // Add row selection class without DOM queries
   *   if (this.isRowSelected(context.rowIndex)) {
   *     context.rowElement.classList.add('selected', 'row-focus');
   *   }
   *
   *   // Add validation error styling
   *   if (this.rowHasErrors(context.row)) {
   *     context.rowElement.classList.add('has-errors');
   *   }
   * }
   * ```
   */
  afterRowRender?(context: AfterRowRenderContext): void;

  /**
   * Called after scroll-triggered row rendering completes.
   * This is a lightweight hook for applying visual state to recycled DOM elements.
   * Use this instead of afterRender when you need to reapply styling during scroll.
   *
   * Performance note: This is called frequently during scroll. Keep implementation fast.
   *
   * @example
   * ```ts
   * onScrollRender(): void {
   *   // Reapply selection state to visible cells
   *   this.applySelectionToVisibleCells();
   * }
   * ```
   */
  onScrollRender?(): void;

  /**
   * Return extra height contributed by this plugin (e.g., expanded detail rows).
   * Used to adjust scrollbar height calculations for virtualization.
   *
   * @returns Total extra height in pixels
   *
   * @example
   * ```ts
   * getExtraHeight(): number {
   *   return this.expandedRows.size * this.detailHeight;
   * }
   * ```
   */
  getExtraHeight?(): number;

  /**
   * Return extra height that appears before a given row index.
   * Used by virtualization to correctly calculate scroll positions when
   * there's variable height content (like expanded detail rows) above the viewport.
   *
   * @param beforeRowIndex - The row index to calculate extra height before
   * @returns Extra height in pixels that appears before this row
   *
   * @example
   * ```ts
   * getExtraHeightBefore(beforeRowIndex: number): number {
   *   let height = 0;
   *   for (const expandedRowIndex of this.expandedRowIndices) {
   *     if (expandedRowIndex < beforeRowIndex) {
   *       height += this.getDetailHeight(expandedRowIndex);
   *     }
   *   }
   *   return height;
   * }
   * ```
   */
  getExtraHeightBefore?(beforeRowIndex: number): number;

  /**
   * Adjust the virtualization start index to render additional rows before the visible range.
   * Use this when expanded content (like detail rows) needs its parent row to remain rendered
   * even when the parent row itself has scrolled above the viewport.
   *
   * @param start - The calculated start row index
   * @param scrollTop - The current scroll position
   * @param rowHeight - The height of a single row
   * @returns The adjusted start index (lower than or equal to original start)
   *
   * @example
   * ```ts
   * adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
   *   // If row 5 is expanded and scrolled partially, keep it rendered
   *   for (const expandedRowIndex of this.expandedRowIndices) {
   *     const expandedRowTop = expandedRowIndex * rowHeight;
   *     const expandedRowBottom = expandedRowTop + rowHeight + this.detailHeight;
   *     if (expandedRowBottom > scrollTop && expandedRowIndex < start) {
   *       return expandedRowIndex;
   *     }
   *   }
   *   return start;
   * }
   * ```
   */
  adjustVirtualStart?(start: number, scrollTop: number, rowHeight: number): number;

  /**
   * Render a custom row, bypassing the default row rendering.
   * Use this for special row types like group headers, detail rows, or footers.
   *
   * @param row - The row data object
   * @param rowEl - The row DOM element to render into
   * @param rowIndex - The index of the row in the data array
   * @returns `true` if the plugin handled rendering (prevents default), `false`/`void` for default rendering
   *
   * @example
   * ```ts
   * renderRow(row: any, rowEl: HTMLElement, rowIndex: number): boolean | void {
   *   if (row._isGroupHeader) {
   *     rowEl.innerHTML = `<div class="group-header">${row._groupLabel}</div>`;
   *     return true; // Handled - skip default rendering
   *   }
   *   // Return void to let default rendering proceed
   * }
   * ```
   */
  renderRow?(row: any, rowEl: HTMLElement, rowIndex: number): boolean | void;

  // #endregion

  // #region Inter-Plugin Communication

  /**
   * Handle queries from other plugins.
   * This is the generic mechanism for inter-plugin communication.
   * Plugins can respond to well-known query types or define their own.
   *
   * **Prefer `handleQuery` for new plugins** - it has the same signature but
   * a clearer name. `onPluginQuery` is kept for backwards compatibility.
   *
   * @param query - The query object with type and context
   * @returns Query-specific response, or undefined if not handling this query
   *
   * @example
   * ```ts
   * onPluginQuery(query: PluginQuery): unknown {
   *   switch (query.type) {
   *     case PLUGIN_QUERIES.CAN_MOVE_COLUMN:
   *       // Prevent moving pinned columns
   *       const column = query.context as ColumnConfig;
   *       if (column.sticky === 'left' || column.sticky === 'right') {
   *         return false;
   *       }
   *       break;
   *     case PLUGIN_QUERIES.GET_CONTEXT_MENU_ITEMS:
   *       const params = query.context as ContextMenuParams;
   *       return [{ id: 'my-action', label: 'My Action', action: () => {} }];
   *   }
   * }
   * ```
   * @deprecated Use `handleQuery` instead for new plugins.
   */
  onPluginQuery?(query: PluginQuery): unknown;

  /**
   * Handle queries from other plugins or the grid.
   *
   * Queries are declared in `manifest.queries` and dispatched via `grid.query()`.
   * This enables type-safe, discoverable inter-plugin communication.
   *
   * @param query - The query object with type and context
   * @returns Query-specific response, or undefined if not handling this query
   *
   * @example
   * ```ts
   * // In manifest
   * static override readonly manifest: PluginManifest = {
   *   queries: [
   *     { type: 'canMoveColumn', description: 'Check if a column can be moved' },
   *   ],
   * };
   *
   * // In plugin class
   * handleQuery(query: PluginQuery): unknown {
   *   if (query.type === 'canMoveColumn') {
   *     const column = query.context as ColumnConfig;
   *     return !column.sticky; // Can't move sticky columns
   *   }
   * }
   * ```
   */
  handleQuery?(query: PluginQuery): unknown;

  // #endregion

  // #region Interaction Hooks

  /**
   * Handle keyboard events on the grid.
   * Called when a key is pressed while the grid or a cell has focus.
   *
   * @param event - The native KeyboardEvent
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onKeyDown(event: KeyboardEvent): boolean | void {
   *   // Handle Ctrl+A for select all
   *   if (event.ctrlKey && event.key === 'a') {
   *     this.selectAllRows();
   *     return true; // Prevent default browser select-all
   *   }
   * }
   * ```
   */
  onKeyDown?(event: KeyboardEvent): boolean | void;

  /**
   * Handle cell click events.
   * Called when a data cell is clicked (not headers).
   *
   * @param event - Cell click event with row/column context
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onCellClick(event: CellClickEvent): boolean | void {
   *   if (event.field === '_select') {
   *     this.toggleRowSelection(event.rowIndex);
   *     return true; // Handled
   *   }
   * }
   * ```
   */
  onCellClick?(event: CellClickEvent): boolean | void;

  /**
   * Handle row click events.
   * Called when any part of a data row is clicked.
   * Note: This is called in addition to onCellClick, not instead of.
   *
   * @param event - Row click event with row context
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onRowClick(event: RowClickEvent): boolean | void {
   *   if (this.config.mode === 'row') {
   *     this.selectRow(event.rowIndex, event.originalEvent);
   *     return true;
   *   }
   * }
   * ```
   */
  onRowClick?(event: RowClickEvent): boolean | void;

  /**
   * Handle header click events.
   * Called when a column header is clicked. Commonly used for sorting.
   *
   * @param event - Header click event with column context
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onHeaderClick(event: HeaderClickEvent): boolean | void {
   *   if (event.column.sortable !== false) {
   *     this.toggleSort(event.field);
   *     return true;
   *   }
   * }
   * ```
   */
  onHeaderClick?(event: HeaderClickEvent): boolean | void;

  /**
   * Handle scroll events on the grid viewport.
   * Called during scrolling. Note: This may be called frequently; debounce if needed.
   *
   * @param event - Scroll event with scroll position and viewport dimensions
   *
   * @example
   * ```ts
   * onScroll(event: ScrollEvent): void {
   *   // Update sticky column positions
   *   this.updateStickyPositions(event.scrollLeft);
   * }
   * ```
   */
  onScroll?(event: ScrollEvent): void;

  /**
   * Handle cell mousedown events.
   * Used for initiating drag operations like range selection or column resize.
   *
   * @param event - Mouse event with cell context
   * @returns `true` to indicate drag started (prevents text selection), `false`/`void` otherwise
   *
   * @example
   * ```ts
   * onCellMouseDown(event: CellMouseEvent): boolean | void {
   *   if (event.rowIndex !== undefined && this.config.mode === 'range') {
   *     this.startDragSelection(event.rowIndex, event.colIndex);
   *     return true; // Prevent text selection
   *   }
   * }
   * ```
   */
  onCellMouseDown?(event: CellMouseEvent): boolean | void;

  /**
   * Handle cell mousemove events during drag operations.
   * Only called when a drag is in progress (after mousedown returned true).
   *
   * @param event - Mouse event with current cell context
   * @returns `true` to continue handling the drag, `false`/`void` otherwise
   *
   * @example
   * ```ts
   * onCellMouseMove(event: CellMouseEvent): boolean | void {
   *   if (this.isDragging && event.rowIndex !== undefined) {
   *     this.extendSelection(event.rowIndex, event.colIndex);
   *     return true;
   *   }
   * }
   * ```
   */
  onCellMouseMove?(event: CellMouseEvent): boolean | void;

  /**
   * Handle cell mouseup events to end drag operations.
   *
   * @param event - Mouse event with final cell context
   * @returns `true` if drag was finalized, `false`/`void` otherwise
   *
   * @example
   * ```ts
   * onCellMouseUp(event: CellMouseEvent): boolean | void {
   *   if (this.isDragging) {
   *     this.finalizeDragSelection();
   *     this.isDragging = false;
   *     return true;
   *   }
   * }
   * ```
   */
  onCellMouseUp?(event: CellMouseEvent): boolean | void;

  // Note: Context menu items are provided via handleQuery('getContextMenuItems').
  // This keeps the core decoupled from the context-menu plugin specifics.

  // #endregion

  // #region Column State Hooks

  /**
   * Contribute plugin-specific state for a column.
   * Called by the grid when collecting column state for serialization.
   * Plugins can add their own properties to the column state.
   *
   * @param field - The field name of the column
   * @returns Partial column state with plugin-specific properties, or undefined if no state to contribute
   *
   * @example
   * ```ts
   * getColumnState(field: string): Partial<ColumnState> | undefined {
   *   const filterModel = this.filterModels.get(field);
   *   if (filterModel) {
   *     // Uses module augmentation to add filter property to ColumnState
   *     return { filter: filterModel } as Partial<ColumnState>;
   *   }
   *   return undefined;
   * }
   * ```
   */
  getColumnState?(field: string): Partial<ColumnState> | undefined;

  /**
   * Apply plugin-specific state to a column.
   * Called by the grid when restoring column state from serialized data.
   * Plugins should restore their internal state based on the provided state.
   *
   * @param field - The field name of the column
   * @param state - The column state to apply (may contain plugin-specific properties)
   *
   * @example
   * ```ts
   * applyColumnState(field: string, state: ColumnState): void {
   *   // Check for filter property added via module augmentation
   *   const filter = (state as any).filter;
   *   if (filter) {
   *     this.filterModels.set(field, filter);
   *     this.applyFilter();
   *   }
   * }
   * ```
   */
  applyColumnState?(field: string, state: ColumnState): void;

  // #endregion

  // #region Scroll Boundary Hooks

  /**
   * Report horizontal scroll boundary offsets for this plugin.
   * Plugins that obscure part of the scroll area (e.g., pinned/sticky columns)
   * should return how much space they occupy on each side.
   * The keyboard navigation uses this to ensure focused cells are fully visible.
   *
   * @param rowEl - The row element (optional, for calculating widths from rendered cells)
   * @param focusedCell - The currently focused cell element (optional, to determine if scrolling should be skipped)
   * @returns Object with left/right pixel offsets and optional skipScroll flag, or undefined if plugin has no offsets
   *
   * @example
   * ```ts
   * getHorizontalScrollOffsets(rowEl?: HTMLElement, focusedCell?: HTMLElement): { left: number; right: number; skipScroll?: boolean } | undefined {
   *   // Calculate total width of left-pinned columns
   *   const leftCells = rowEl?.querySelectorAll('.sticky-left') ?? [];
   *   let left = 0;
   *   leftCells.forEach(el => { left += (el as HTMLElement).offsetWidth; });
   *   // Skip scroll if focused cell is pinned (always visible)
   *   const skipScroll = focusedCell?.classList.contains('sticky-left');
   *   return { left, right: 0, skipScroll };
   * }
   * ```
   */
  getHorizontalScrollOffsets?(
    rowEl?: HTMLElement,
    focusedCell?: HTMLElement,
  ): { left: number; right: number; skipScroll?: boolean } | undefined;

  // #endregion

  // #region Shell Integration Hooks

  /**
   * Register a tool panel for this plugin.
   * Return undefined if plugin has no tool panel.
   * The shell will create a toolbar toggle button and render the panel content
   * when the user opens the panel.
   *
   * @returns Tool panel definition, or undefined if plugin has no panel
   *
   * @example
   * ```ts
   * getToolPanel(): ToolPanelDefinition | undefined {
   *   return {
   *     id: 'columns',
   *     title: 'Columns',
   *     icon: '☰',
   *     tooltip: 'Show/hide columns',
   *     order: 10,
   *     render: (container) => {
   *       this.renderColumnList(container);
   *       return () => this.cleanup();
   *     },
   *   };
   * }
   * ```
   */
  getToolPanel?(): ToolPanelDefinition | undefined;

  /**
   * Register content for the shell header center section.
   * Return undefined if plugin has no header content.
   * Examples: search input, selection summary, status indicators.
   *
   * @returns Header content definition, or undefined if plugin has no header content
   *
   * @example
   * ```ts
   * getHeaderContent(): HeaderContentDefinition | undefined {
   *   return {
   *     id: 'quick-filter',
   *     order: 10,
   *     render: (container) => {
   *       const input = document.createElement('input');
   *       input.type = 'text';
   *       input.placeholder = 'Search...';
   *       input.addEventListener('input', this.handleInput);
   *       container.appendChild(input);
   *       return () => input.removeEventListener('input', this.handleInput);
   *     },
   *   };
   * }
   * ```
   */
  getHeaderContent?(): HeaderContentDefinition | undefined;

  // #endregion
}
