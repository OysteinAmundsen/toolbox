/**
 * Shell Plugin Types
 *
 * Extraction #370, Phase 1a (Task 1a.2): this file is now the **canonical**
 * home for the shell configuration types (`ShellConfig`, `ShellHeaderConfig`,
 * `ToolPanelConfig`, `ToolbarContentDefinition`, `ToolPanelDefinition`,
 * `HeaderContentDefinition`). `core/types.ts` keeps `@deprecated` `export type`
 * re-aliases so deep importers keep working; those aliases are dropped at v3.
 *
 * The core `GridConfig.shell` field is provided here via module augmentation
 * (mirroring how feature plugins augment `FeatureConfig`) so core has no
 * intrinsic knowledge of the shell.
 *
 * @module Plugins/Shell
 */

// #region Shell Configuration

/**
 * Shell configuration for the grid's optional header bar and tool panels.
 *
 * The shell provides a wrapper around the grid with:
 * - Header bar with title, toolbar buttons, and custom content
 * - Collapsible side panel for filters, column visibility, settings, etc.
 *
 * @example
 * ```typescript
 * grid.gridConfig = {
 *   // `shell` is augmented onto gridConfig by the built-in ShellPlugin
 *   shell: {
 *     header: { title: 'Employee Directory' },
 *     toolPanel: {
 *       position: 'right',
 *       initialState: 'open', // Sidebar open on load
 *     },
 *   },
 *   plugins: [new VisibilityPlugin()], // Adds the "Columns" tool panel
 * };
 *
 * // Register custom tool panels via the shell plugin
 * grid.getPluginByName('shell')?.registerToolPanel({
 *   id: 'filters',
 *   title: 'Filters',
 *   icon: '🔍',
 *   render: (container) => {
 *     container.innerHTML = '<div>Filter controls...</div>';
 *   },
 * });
 * ```
 *
 * @see {@link ShellHeaderConfig} for header options
 * @see {@link ToolPanelConfig} for tool panel options
 * @since 0.1.1
 */
export interface ShellConfig {
  /** Shell header bar configuration */
  header?: ShellHeaderConfig;
  /** Tool panel configuration */
  toolPanel?: ToolPanelConfig;
  /**
   * Registered tool panels (from plugins, API, or Light DOM).
   * These are the actual panel definitions that can be opened.
   * @internal Set by ConfigManager during merge
   */
  toolPanels?: ToolPanelDefinition[];
  /**
   * Registered header content sections (from plugins or API).
   * Content rendered in the center of the shell header.
   * @internal Set by ConfigManager during merge
   */
  headerContents?: HeaderContentDefinition[];
}

/**
 * Shell header bar configuration
 * @since 0.1.1
 */
export interface ShellHeaderConfig {
  /** Grid title displayed on the left (optional) */
  title?: string;
  /** Custom toolbar content (rendered before tool panel toggle) */
  toolbarContents?: ToolbarContentDefinition[];
  /**
   * Whether the shell header bar element (`.tbw-shell-header`) is rendered.
   *
   * Set to `false` to drive tool panels entirely from your own UI — for
   * example, a utility-column header icon whose click handler calls
   * {@link ShellPlugin.openToolPanel}. The header bar (title, toolbar
   * contents, built-in toggle) is fully suppressed, but the shell body and
   * any registered tool panels still render and remain openable via the API.
   *
   * When `false`, a close (✕) button is rendered in the open tool panel
   * (unless `toolPanel.locked` is `true`, or `toolPanel.mode` is `'dropdown'`,
   * which already light-dismisses) so the panel can always be dismissed
   * without the header toggle. With a single panel the ✕ shares the first
   * accordion header row; with multiple panels it gets its own row at the top.
   * Overlay panels also close on <kbd>Esc</kbd>; window-wide click-outside
   * dismissal additionally requires `toolPanel.closeOnClickOutside: true`.
   *
   * Unlike `toolPanelToggle: false` (which only removes the built-in toggle
   * button while keeping the bar), this removes the entire bar element — no
   * CSS override needed.
   *
   * @default true
   * @since 2.16.0
   */
  visible?: boolean;
  /**
   * Whether the grid renders its built-in tool panel toggle button
   * (`button.tbw-toolbar-btn[data-panel-toggle]`) and the auto-inserted
   * `.tbw-toolbar-separator` between custom toolbar contents and the toggle.
   *
   * Set to `false` when you want to provide your own toggle button (e.g. a
   * design-system button styled to match your application). Wire your button
   * to call {@link ShellPlugin.toggleToolPanel} (or `toggleToolPanelSection(id)` for
   * a specific section). All tool panels remain functional; only the
   * built-in toggle button and adjacent separator are suppressed.
   *
   * @default true
   */
  toolPanelToggle?: boolean;
  /**
   * Light DOM header content elements (parsed from <tbw-grid-header> children).
   * @internal Set by ConfigManager during merge
   */
  lightDomContent?: HTMLElement[];
  /**
   * Whether a tool buttons container was found in light DOM.
   * @internal Set by ConfigManager during merge
   */
  hasToolButtonsContainer?: boolean;
}

/**
 * Tool panel configuration
 * @since 0.1.1
 */
export interface ToolPanelConfig {
  /** Panel position: 'left' | 'right' (default: 'right') */
  position?: 'left' | 'right';
  /** Default panel width in pixels (default: 280) */
  width?: number;
  /**
   * Accordion section to auto-expand the first time the tool panel opens.
   *
   * @deprecated **Behavior change planned for v3.0.0** — see [issue #259](https://github.com/OysteinAmundsen/toolbox/issues/259).
   *
   * Today (v2.x, kept for backward compatibility): setting `defaultOpen` also
   * **opens the sidebar** on grid load. This conflates "which section is
   * pre-selected" with "is the sidebar open", and there is no way to
   * pre-select a section without also forcing the sidebar open.
   *
   * In v3.0.0 (#259): `defaultOpen` will only pre-select which accordion
   * section auto-expands the first time the sidebar opens, and will no
   * longer open the sidebar by itself. Migrate by combining `defaultOpen`
   * with `initialState: 'open'` (or `locked: true`) when you want both
   * effects.
   *
   * Callers that want forward-compatible behavior today: prefer
   * `initialState` / `locked` for sidebar open state, and use `defaultOpen`
   * purely for section selection.
   *
   * @since 0.1.1
   */
  defaultOpen?: string;
  /**
   * Initial open state of the tool panel sidebar on grid load.
   *
   * - `'closed'` (default) — sidebar starts collapsed; user opens it via the
   *   built-in toggle button or `grid.getPluginByName('shell')?.openToolPanel()`.
   * - `'open'` — sidebar starts open; the section named by {@link defaultOpen}
   *   (or the first registered panel) is expanded.
   *
   * Takes precedence over the legacy v2 behavior of {@link defaultOpen}: if
   * `initialState` is set explicitly, it wins.
   *
   * @default 'closed'
   * @since 2.9.0
   */
  initialState?: 'open' | 'closed';
  /**
   * When `true`, lock the tool panel sidebar in its open state.
   *
   * Effects:
   * - Implies `initialState: 'open'` — the sidebar is forced open on load.
   * - `grid.getPluginByName('shell')?.closeToolPanel()` / `toggleToolPanel()` become no-ops while
   *   locked (the panel cannot be closed by user or programmatic actions).
   * - Suppresses the built-in toolbar toggle button (same effect as
   *   `shell.header.toolPanelToggle: false`) since toggling is disabled.
   * - Accordion sections inside the panel can still be expanded/collapsed.
   *
   * @default false
   * @since 2.9.0
   */
  locked?: boolean;
  /** Whether to persist open/closed state (requires Column State Events) */
  persistState?: boolean;
  /**
   * Close the tool panel when clicking outside of it.
   * When `true`, clicking anywhere outside the tool panel (but inside the grid)
   * will close the panel automatically.
   *
   * Ignored in `mode: 'push'` (the panel does not overlap grid content,
   * so there is no meaningful "outside" to dismiss against).
   * @default false
   */
  closeOnClickOutside?: boolean;
  /**
   * Layout mode for the tool panel.
   *
   * - `'overlay'` (default) — panel is positioned over the grid content;
   *   opening/closing the panel does not change the grid's available width.
   *   Best for narrow viewports.
   * - `'push'` — panel participates in the shell's flex layout as a sibling
   *   of the grid content; opening the panel shrinks the grid's available
   *   width and triggers a normal column-virtualization re-layout via
   *   ResizeObserver. Best for desktop layouts where users want to keep
   *   all cells visible while the panel is open.
   * - `'dropdown'` — the whole tool-panel sidebar (the full accordion) is
   *   shown as an anchored popover floating above the grid, dismissed on
   *   Escape or click-outside. The popover anchors to (in priority order)
   *   the `anchor` passed to {@link ShellController.openToolPanel}, the
   *   built-in toolbar toggle button, or the top corner of the grid. Best
   *   for compact toolbars and custom column-header "columns" buttons.
   *
   * @default 'overlay'
   * @since 2.8.0
   */
  mode?: 'overlay' | 'push' | 'dropdown';
}

/**
 * Options for {@link ShellController.openToolPanel} (and the
 * `ShellPlugin.openToolPanel` / grid-level wrappers).
 *
 * @since 2.16.0
 */
export interface OpenToolPanelOptions {
  /**
   * Element to anchor the dropdown popover to when `shell.toolPanel.mode` is
   * `'dropdown'`. The popover is positioned directly below this element (or at
   * its top corner for the grid-corner fallback). Ignored in `'overlay'` and
   * `'push'` modes.
   *
   * When omitted, the dropdown anchors to the built-in toolbar toggle button
   * if present, otherwise to the top corner of the grid (on the side given by
   * `shell.toolPanel.position`).
   *
   * @since 2.16.0
   */
  anchor?: HTMLElement;
}

/**
 * Toolbar content definition for the shell header toolbar area.
 * Register via the shell plugin's `registerToolbarContent()` or use light DOM `<tbw-grid-tool-buttons>`.
 *
 * @example
 * ```typescript
 * grid.getPluginByName('shell')?.registerToolbarContent({
 *   id: 'my-toolbar',
 *   order: 10,
 *   render: (container) => {
 *     const btn = document.createElement('button');
 *     btn.textContent = 'Refresh';
 *     btn.onclick = () => console.log('clicked');
 *     container.appendChild(btn);
 *     return () => btn.remove();
 *   },
 * });
 * ```
 * @since 1.0.0
 */
export interface ToolbarContentDefinition {
  /** Unique content ID */
  id: string;
  /** Content factory - called once when shell header renders */
  render: (container: HTMLElement) => void | (() => void);
  /** Called when content is removed (for cleanup) */
  onDestroy?: () => void;
  /** Order priority (lower = first, default: 100) */
  order?: number;
}

/**
 * Tool panel definition registered by plugins or consumers.
 *
 * Register via the shell plugin's `registerToolPanel()` to add panels to the sidebar.
 * Panels appear as collapsible sections with icons and titles.
 *
 * @example
 * ```typescript
 * grid.getPluginByName('shell')?.registerToolPanel({
 *   id: 'filters',
 *   title: 'Filters',
 *   icon: '🔍',
 *   tooltip: 'Filter grid data',
 *   order: 10, // Lower = appears first
 *   render: (container) => {
 *     container.innerHTML = `
 *       <div class="filter-panel">
 *         <input type="text" placeholder="Search..." />
 *       </div>
 *     `;
 *     // Return cleanup function
 *     return () => container.innerHTML = '';
 *   },
 *   onClose: () => {
 *     console.log('Filter panel closed');
 *   },
 * });
 * ```
 *
 * @see {@link ShellConfig} for shell configuration
 * @since 0.1.1
 */
export interface ToolPanelDefinition {
  /** Unique panel ID */
  id: string;
  /** Panel title shown in accordion header */
  title: string;
  /** Icon for accordion section header (optional, emoji or SVG) */
  icon?: string;
  /** Tooltip for accordion section header */
  tooltip?: string;
  /** Panel content factory - called when panel section opens */
  render: (container: HTMLElement) => void | (() => void);
  /** Called when panel closes (for cleanup) */
  onClose?: () => void;
  /** Panel order priority (lower = first, default: 100) */
  order?: number;
}

/**
 * Header content definition for plugins contributing to shell header center section.
 *
 * Register via the shell plugin's `registerHeaderContent()` to add content between
 * the title and toolbar buttons.
 *
 * @example
 * ```typescript
 * grid.getPluginByName('shell')?.registerHeaderContent({
 *   id: 'row-count',
 *   order: 10,
 *   render: (container) => {
 *     const span = document.createElement('span');
 *     span.className = 'row-count';
 *     span.textContent = `${grid.rows.length} rows`;
 *     container.appendChild(span);
 *
 *     // Update on data changes
 *     const unsub = grid.on('data-change', () => {
 *       span.textContent = `${grid.rows.length} rows`;
 *     });
 *
 *     return () => {
 *       unsub();
 *     };
 *   },
 * });
 * ```
 *
 * @see {@link ShellConfig} for shell configuration
 * @since 0.1.1
 */
export interface HeaderContentDefinition {
  /** Unique content ID */
  id: string;
  /** Content factory - called once when shell header renders */
  render: (container: HTMLElement) => void | (() => void);
  /** Called when content is removed (for cleanup) */
  onDestroy?: () => void;
  /** Order priority (lower = first, default: 100) */
  order?: number;
}
// #endregion

declare module '../../core/types' {
  interface PluginNameMap {
    shell: import('./ShellPlugin').ShellPlugin;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TRow matches the augmented GridConfig signature
  interface GridConfig<TRow = any> {
    /**
     * Shell configuration for header bar and tool panels.
     * When configured, adds an optional wrapper with title, toolbar, and collapsible side panels.
     *
     * Provided via module augmentation by the built-in `ShellPlugin` (#370), mirroring how
     * feature plugins augment `FeatureConfig`. Import the `ShellConfig` type from
     * `@toolbox-web/grid/plugins/shell`. This augmented path is the supported configuration
     * entry point — only the core delegate methods (`grid.registerToolPanel()`, etc.) and the
     * `core/types` re-aliases are deprecated and dropped at v3.
     */
    shell?: ShellConfig;
  }
}

export {};
