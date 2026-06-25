/**
 * Shell Plugin (Class-based)
 *
 * Owns the grid shell: header bar, toolbar content, and tool panels.
 *
 * **Extraction #370 — Phase 1b (ownership inversion):** this plugin now owns
 * the shell **state** for the grid's lifetime (Approach A: state created once,
 * survives plugin re-inits, torn down on disconnect). Light-DOM parsing,
 * per-render work, and DOM construction move here in the following increments;
 * until each lands, core still drives that part via the resolved plugin
 * instance.
 *
 * @module Plugins/Shell
 */

import { BaseGridPlugin, type GridElement } from '../../core/plugin/base-plugin';
import { HEADER_CONTENT_DUPLICATE, TOOL_PANEL_DUPLICATE, warnDiagnostic } from '../../core/internal/diagnostics';
import type { GridConfig, InternalGrid } from '../../core/types';
import {
  cleanupShellState,
  createShellState,
  parseLightDomShell,
  parseLightDomToolButtons,
  parseLightDomToolPanels,
  prepareForRerender,
  rebuildShellDOM,
  renderCustomToolbarContents,
  renderHeaderContent,
  renderPanelContent,
  setupClickOutsideDismiss,
  setupEscapeDismiss,
  setupShellEventListeners,
  setupToolPanelResize,
  shouldRenderShellHeader,
  updatePanelState,
  updateToolbarActiveStates,
  type ShellState,
} from './shell';
import { createShellController, type ShellController } from './shell-controller';
import styles from './shell.css?inline';
import './types';
import type {
  HeaderContentDefinition,
  OpenToolPanelOptions,
  ShellConfig,
  ToolbarContentDefinition,
  ToolPanelDefinition,
} from './types';

/**
 * Shell plugin for `<tbw-grid>`.
 *
 * @see {@link ShellConfig} for all configuration options.
 *
 * @internal Extends BaseGridPlugin.
 * @since 2.x (extraction #370)
 */
export class ShellPlugin extends BaseGridPlugin<ShellConfig> {
  /** @internal */
  readonly name = 'shell';
  /** @internal */
  override readonly styles = styles;

  // Extraction #370 — Approach A: the plugin owns the shell state for the
  // grid's lifetime. State is created once (via `ensureState`, lazily on first
  // access) and survives plugin re-inits (idempotent attach / non-destructive
  // detach); it is torn down only on grid disconnect via `disposeShellState()`.
  #state?: ShellState;
  #controller?: ShellController;

  // Document-level listeners the plugin owns for the shell's interactive
  // affordances. Each `#setupListeners` call cleans the previous registration
  // before re-adding (idempotent across re-wraps); torn down on disconnect.
  #resizeCleanup?: () => void;
  #clickOutsideCleanup?: () => void;
  #escapeDismissCleanup?: () => void;

  // The light-DOM shell-change handler (re-parses <tbw-grid-header> /
  // <tbw-grid-tool-buttons> / <tbw-grid-tool-panel> when the framework projects
  // them asynchronously). Registered in `attach` via the generic
  // `_registerLightDomHandler` seam; unregistered on disconnect.
  #shellChangeHandler?: () => void;

  // While a dropdown tool panel is open, this observer watches the render root
  // for the trigger being recreated by an outer framework (e.g. a React column
  // `headerRenderer` re-running on a column toggle) and re-pairs the popover's
  // anchor. MutationObserver callbacks run as a pre-paint microtask, so the
  // re-pair lands BEFORE the browser paints the dangling-anchor frame — no
  // flash. It also fires for every toggle (not a coalesced single rAF), so the
  // dropdown no longer intermittently disappears. Connected lazily while a
  // dropdown is open; disconnected on close and on grid disconnect.
  #reanchorObserver?: MutationObserver;
  #reanchorObserving = false;

  /** @internal Whether shell state has been created yet. */
  get hasState(): boolean {
    return this.#state !== undefined;
  }

  /**
   * @internal Create the canonical shell state + controller (idempotent).
   * The plugin owns shell-state construction; core only supplies the grid
   * reference (the controller binds to it for UI updates). No-op once state
   * exists, so it is safe to call on every resolve — including before the
   * plugin formally attaches, which keeps pre-connect API calls working.
   */
  ensureState(grid: InternalGrid): void {
    if (this.#state) return;
    const state = createShellState();
    this.#state = state;
    this.#controller = createShellController(state, grid);
  }

  /** @internal Canonical shell state. */
  get shellState(): ShellState {
    return this.#state as ShellState;
  }

  /** @internal Shell controller. */
  get shellController(): ShellController {
    return this.#controller as ShellController;
  }

  // #region Public Shell API
  // The shell plugin's public, programmatic API. Obtain the instance via
  // `grid.getPluginByName('shell')`. These mirror the (now `@deprecated`)
  // `<tbw-grid>` delegate methods, which forward here for the v2.x window and
  // are removed in v3 (extraction #370). Each guards on `hasState` so a call
  // before the shell has initialized is a safe no-op.

  /** Whether the tool panel sidebar is currently open. */
  get isToolPanelOpen(): boolean {
    return this.hasState ? this.shellController.isPanelOpen : false;
  }

  /** IDs of the currently expanded accordion sections in the tool panel. */
  get expandedToolPanelSections(): string[] {
    return this.hasState ? this.shellController.expandedSections : [];
  }

  /**
   * Open the tool panel sidebar.
   * @param panelId - Optional section to expand on open (see {@link ShellController.openToolPanel}).
   * @param options - Optional open options. In `mode: 'dropdown'`, `options.anchor`
   *   sets the element the popover anchors to (see {@link OpenToolPanelOptions}).
   */
  openToolPanel(panelId?: string, options?: OpenToolPanelOptions): void {
    this.shellController?.openToolPanel(panelId, options);
  }

  /** Close the tool panel sidebar. */
  closeToolPanel(): void {
    this.shellController?.closeToolPanel();
  }

  /**
   * Toggle the tool panel sidebar open or closed.
   * @param options - Optional open options forwarded when opening (e.g. `anchor`
   *   for dropdown mode; see {@link OpenToolPanelOptions}).
   */
  toggleToolPanel(options?: OpenToolPanelOptions): void {
    this.shellController?.toggleToolPanel(options);
  }

  /** Toggle an accordion section expanded or collapsed within the tool panel. */
  toggleToolPanelSection(sectionId: string): void {
    this.shellController?.toggleToolPanelSection(sectionId);
  }

  /** Get all registered tool panel definitions. */
  getToolPanels(): ToolPanelDefinition[] {
    return this.hasState ? this.shellController.getToolPanels() : [];
  }

  /** Register a custom tool panel section. */
  registerToolPanel(panel: ToolPanelDefinition): void {
    if (!this.hasState) return;
    this.shellState.apiToolPanelIds.add(panel.id);
    this.shellController.registerToolPanel(panel);
  }

  /** Unregister a custom tool panel section. */
  unregisterToolPanel(panelId: string): void {
    if (!this.hasState) return;
    this.shellState.apiToolPanelIds.delete(panelId);
    this.shellController.unregisterToolPanel(panelId);
  }

  /** Get all registered header content definitions. */
  getHeaderContents(): HeaderContentDefinition[] {
    return this.hasState ? this.shellController.getHeaderContents() : [];
  }

  /** Register custom header content (rendered in the shell header bar). */
  registerHeaderContent(content: HeaderContentDefinition): void {
    if (!this.hasState) return;
    this.shellState.apiHeaderContentIds.add(content.id);
    this.shellController.registerHeaderContent(content);
  }

  /** Unregister custom header content. */
  unregisterHeaderContent(contentId: string): void {
    if (!this.hasState) return;
    this.shellState.apiHeaderContentIds.delete(contentId);
    this.shellController.unregisterHeaderContent(contentId);
  }

  /** Get all registered toolbar content definitions. */
  getToolbarContents(): ToolbarContentDefinition[] {
    return this.hasState ? this.shellController.getToolbarContents() : [];
  }

  /** Register custom toolbar content (rendered in the shell toolbar). */
  registerToolbarContent(content: ToolbarContentDefinition): void {
    this.shellController?.registerToolbarContent(content);
  }

  /** Unregister custom toolbar content. */
  unregisterToolbarContent(contentId: string): void {
    this.shellController?.unregisterToolbarContent(contentId);
  }
  // #endregion

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);
    // Register the light-DOM shell handlers via the generic seam. Core holds no
    // shell tag knowledge (extraction #370). `registerLightDomHandler` is keyed
    // by tag name, so re-attach simply overwrites — idempotent. Torn down on
    // grid disconnect in `disposeShellState` (Approach A: survives re-inits).
    const handler = (): void => this.#handleLightDomShellChange(grid);
    this.#shellChangeHandler = handler;
    grid._registerLightDomHandler('tbw-grid-header', handler);
    grid._registerLightDomHandler('tbw-grid-tool-buttons', handler);
    grid._registerLightDomHandler('tbw-grid-tool-panel', handler);
  }

  /** @internal Parse all light-DOM shell elements into the plugin's state. */
  #parseLightDom(grid: GridElement): void {
    const host = grid._hostElement;
    parseLightDomShell(host, this.shellState);
    parseLightDomToolButtons(host, this.shellState);
    parseLightDomToolPanels(host, this.shellState, grid._getToolPanelRendererFactory());
  }

  /**
   * @internal React to a light-DOM shell element being added/removed/mutated
   * (e.g. a framework projecting `<tbw-grid-header title>` asynchronously).
   * Re-parses, and if a title or tool-buttons container newly appeared, re-merges
   * the config (so `processConfig` folds it in) and re-wraps the shell header.
   */
  #handleLightDomShellChange(grid: GridElement): void {
    if (!this.hasState) return;
    const state = this.shellState;
    const hadTitle = state.lightDomTitle;
    const hadToolButtons = state.hasToolButtonsContainer;
    this.#parseLightDom(grid);
    const hasTitle = state.lightDomTitle;
    const hasToolButtons = state.hasToolButtonsContainer;

    if ((hasTitle && !hadTitle) || (hasToolButtons && !hadToolButtons)) {
      grid._requestConfigMerge();
      // Re-wrap the shell header to reflect the new title / tool buttons.
      // `afterStructuralRender` rebuilds the chrome AND re-renders all shell
      // contents (header content, toolbar slots, panel), so no manual render is
      // needed here.
      if (grid._renderRoot.querySelector('.tbw-shell-header')) {
        prepareForRerender(state);
        this.afterStructuralRender();
      }
    }
  }

  // #region Generic structural hooks (extraction #370)
  // Core calls these via the plugin manager (parseLightDom /
  // beforeStructuralRender / needsStructuralRerender) — it holds no
  // shell-specific orchestration. The shell self-parses, self-prepares, and
  // self-decides re-render needs from its own state + DOM signature.

  /** @internal Generic hook: re-parse all light-DOM shell elements into state. */
  override parseLightDom(): void {
    const grid = this.grid;
    if (!grid || !this.hasState) return;
    this.#parseLightDom(grid);
  }

  /** @internal Generic hook: move toolbar buttons back ahead of a structural rebuild. */
  override beforeStructuralRender(): void {
    if (!this.hasState) return;
    prepareForRerender(this.shellState);
  }

  /**
   * @internal Generic hook: whether the shell's rendered DOM signature no longer
   * matches the new effective config (header appearing/disappearing, tool-panel
   * count/position/mode change) and therefore needs a structural re-render.
   * Reads the still-current (old) DOM vs the freshly merged config.
   */
  override needsStructuralRerender(): boolean {
    const grid = this.grid;
    if (!grid || !this.hasState) return false;
    const root = grid._renderRoot;
    const hadShell = !!root.querySelector('.has-shell');
    const hadToolPanel = !!root.querySelector('.tbw-tool-panel');
    const accordionSectionsBefore = root.querySelectorAll('.tbw-accordion-section').length;
    const prevPosition = (root.querySelector('.tbw-tool-panel') as HTMLElement | null)?.dataset.position ?? 'right';
    const prevMode = (root.querySelector('.tbw-shell-body') as HTMLElement | null)?.dataset.mode ?? 'overlay';

    const shell = grid.effectiveConfig?.shell;
    const nowNeedsShell = shouldRenderShellHeader(shell);
    const nowHasToolPanels = (shell?.toolPanels?.length ?? 0) > 0;
    const toolPanelCount = shell?.toolPanels?.length ?? 0;
    const newPosition = shell?.toolPanel?.position ?? 'right';
    const newMode = shell?.toolPanel?.mode ?? 'overlay';

    return (
      hadShell !== nowNeedsShell ||
      (!hadToolPanel && nowHasToolPanels) ||
      (hadToolPanel && toolPanelCount !== accordionSectionsBefore) ||
      (hadToolPanel && prevPosition !== newPosition) ||
      (hadToolPanel && prevMode !== newMode)
    );
  }
  // #endregion

  /**
   * @internal Fold the plugin's shell state into the effective config.
   *
   * Called by core's config merge ({@link ConfigManager.merge}) via the neutral
   * `processConfig` plugin hook \u2014 core holds no shell-config knowledge. Mutates
   * `config.shell` in place from light-DOM-parsed + API-registered shell state
   * (title, header content, tool buttons, tool panels, header/toolbar contents).
   *
   * Extraction #370, Task 1b \u2014 config ownership inversion: replaces core's old
   * `ConfigManager.#mergeShellConfig`.
   */
  /**
   * @internal Self-collect plugin tool panels + header contents into shell
   * state. Clears stale plugin-contributed entries (preserving light-DOM +
   * API-registered) then re-collects fresh from all attached plugins via the
   * neutral `grid._pluginShellContributions()` seam. Idempotent — safe to run on
   * every config merge, which is how plugin re-inits are picked up.
   *
   * Extraction #370: replaces core's `#collectPluginShellContributions` plus the
   * plugin-reinit cleanup block in core's `#updatePluginConfigs`.
   */
  #syncPluginContributions(grid: GridElement): void {
    const state = this.shellState;
    const gridId = grid._hostElement.id;

    // Drop stale plugin-contributed tool panels (keep light-DOM + API panels).
    for (const panelId of [...state.toolPanels.keys()]) {
      if (state.lightDomToolPanelIds.has(panelId) || state.apiToolPanelIds.has(panelId)) continue;
      state.panelCleanups.get(panelId)?.();
      state.panelCleanups.delete(panelId);
      state.toolPanels.delete(panelId);
    }
    // Drop stale plugin-contributed header contents (keep API-registered).
    for (const contentId of [...state.headerContents.keys()]) {
      if (state.apiHeaderContentIds.has(contentId)) continue;
      state.headerContentCleanups.get(contentId)?.();
      state.headerContentCleanups.delete(contentId);
      state.headerContents.delete(contentId);
    }

    const { toolPanels, headerContents } = grid._pluginShellContributions();

    for (const panel of toolPanels) {
      // Precedence (#370): an API-registered panel wins over a plugin; a plugin
      // wins over a colliding light-DOM panel (the plugin owns its own DOM, so
      // it must own the id).
      if (state.apiToolPanelIds.has(panel.id)) continue;
      if (state.lightDomToolPanelIds.has(panel.id)) {
        warnDiagnostic(
          TOOL_PANEL_DUPLICATE,
          `Tool panel "${panel.id}" is provided by a plugin; ignoring the matching light-DOM <tbw-grid-tool-panel>.`,
          gridId,
        );
        state.panelCleanups.get(panel.id)?.();
        state.panelCleanups.delete(panel.id);
        state.lightDomToolPanelIds.delete(panel.id);
        state.adapterBoundToolPanelIds.delete(panel.id);
      }
      state.toolPanels.set(panel.id, panel);
    }

    for (const content of headerContents) {
      if (state.apiHeaderContentIds.has(content.id)) continue;
      if (state.headerContents.has(content.id)) {
        warnDiagnostic(
          HEADER_CONTENT_DUPLICATE,
          `Header content "${content.id}" is provided by a plugin; ignoring the matching light-DOM definition.`,
          gridId,
        );
        state.headerContentCleanups.get(content.id)?.();
        state.headerContentCleanups.delete(content.id);
      }
      state.headerContents.set(content.id, content);
    }
  }

  override processConfig(config: GridConfig): void {
    if (!this.hasState) return;
    const state = this.shellState;

    // Self-parse light-DOM shell elements + self-collect plugin shell
    // contributions before folding state into config (extraction #370 —
    // replaces core's `#parseLightDom` + `#collectPluginShellContributions`).
    const grid = this.grid;
    if (grid) {
      this.#parseLightDom(grid);
      this.#syncPluginContributions(grid);
    }

    // Constructor-supplied shell config is the base layer: the canonical
    // `features: { shell: ... }` opt-in passes the config value here (and an
    // explicit `plugins: [new ShellPlugin(cfg)]` does too). An explicit
    // top-level `gridConfig.shell` overrides it; parsed light-DOM / API state
    // folds on top below. Empty for the auto-registered instance
    // (`new ShellPlugin()`), so existing default-on behavior is unchanged.
    const ctor = this.resolvedConfig;

    // Clone shell hierarchy to avoid mutating the original gridConfig.
    config.shell = { ...ctor, ...config.shell };
    config.shell.header = { ...ctor.header, ...config.shell.header };

    // Light DOM title (does not override an explicit config title).
    if (state.lightDomTitle && !config.shell.header.title) {
      config.shell.header.title = state.lightDomTitle;
    }

    // Light DOM header content elements.
    if (state.lightDomHeaderContent?.length > 0) {
      config.shell.header.lightDomContent = state.lightDomHeaderContent;
    }

    // Tool-buttons container presence.
    if (state.hasToolButtonsContainer) {
      config.shell.header.hasToolButtonsContainer = true;
    }

    // Tool panels (from plugins + API + Light DOM), sorted by order.
    if (state.toolPanels.size > 0) {
      const panels = Array.from(state.toolPanels.values());
      panels.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
      config.shell.toolPanels = panels;
    }

    // Header contents (from plugins + API), sorted by order.
    if (state.headerContents.size > 0) {
      const contents = Array.from(state.headerContents.values());
      contents.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
      config.shell.headerContents = contents;
    }

    // Toolbar contents: merge ORIGINAL config contents (from the source
    // gridConfig, not a previous merge) with API-registered contents so stale
    // API entries never accumulate. Config takes precedence by id.
    const apiContents = Array.from(state.toolbarContents.values());
    const originalConfigContents = this.grid?._sourceConfig?.shell?.header?.toolbarContents ?? [];
    const configIds = new Set(originalConfigContents.map((c) => c.id));
    const mergedContents = [...originalConfigContents];
    for (const content of apiContents) {
      if (!configIds.has(content.id)) {
        mergedContents.push(content);
      }
    }
    mergedContents.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    config.shell.header.toolbarContents = mergedContents;
  }

  /**
   * @internal Wrap the freshly built (bare) grid DOM in shell chrome.
   *
   * Fired synchronously by core at the end of every structural (re)build, before
   * paint. Core builds a BARE grid; this hook relocates the existing
   * `.tbw-grid-content` node into shell chrome (header bar, toolbar, tool panel)
   * via {@link rebuildShellDOM}, which preserves the content subtree (and all its
   * listeners / cached refs) intact. No-op when no shell is configured.
   *
   * Extraction #370, Task 1b — DOM ownership inversion: the shell DOM is now
   * constructed by the plugin, not core.
   */
  override afterStructuralRender(): void {
    const grid = this.grid;
    if (!grid || !this.hasState) return;
    const state = this.shellState;
    const hasShell = rebuildShellDOM(
      grid._renderRoot,
      grid.effectiveConfig?.shell,
      { isPanelOpen: state.isPanelOpen, expandedSections: state.expandedSections },
      grid.effectiveConfig?.icons,
    );
    if (hasShell) {
      this.#setupListeners(grid);
      this.shellController.setInitialized(true);
      this.#renderShellContents(grid);
    }
  }

  /**
   * @internal Re-anchor an open dropdown tool panel after a NON-structural
   * render.
   *
   * A column-visibility toggle (or reorder) re-renders the grid header WITHOUT
   * a full structural rebuild — it fires `afterRender`, not
   * `afterStructuralRender`. When the column-chooser trigger lives in the grid
   * header (e.g. a custom `[data-panel-toggle]` button in a column
   * `headerRenderer`), that re-render recreates the trigger node, so it loses
   * the `anchor-name` that paired it with the open popover. The popover then
   * collapses to the viewport / grid corner.
   *
   * Two cooperating mechanisms keep the popover anchored with NO flash:
   * 1. A synchronous {@link ShellController.reanchorOpenDropdown} here catches
   *    the case where the trigger was recreated synchronously during this
   *    render (in-place re-pair, before paint).
   * 2. A {@link MutationObserver} (started here, kept running while the panel is
   *    open) catches the case where an outer framework commits the replacement
   *    trigger on a LATER task. Its callback runs as a pre-paint microtask, so
   *    the re-pair lands before the dangling-anchor frame is painted.
   *
   * `reanchorOpenDropdown()` is idempotent and cheap (early-returns unless a
   * dropdown is open with a broken anchor), so running it on every render and
   * every mutation is safe.
   */
  override afterRender(): void {
    const grid = this.grid;
    if (!grid || !this.hasState) return;
    const state = this.shellState;

    // In-place shell header title sync (extraction #370 — replaces core's
    // `#updateShellHeaderInPlace`). Idempotent: only touches the existing
    // `.tbw-shell-header`, no-op when no shell is rendered.
    this.#syncShellHeaderTitle(grid);

    // Re-render any open tool-panel sections whose content was cleared during a
    // plugin re-init (extraction #370 — replaces core's `_renderOpenPanelContent`).
    // `renderPanelContent` is idempotent — it only fills empty sections.
    if (state.isPanelOpen) {
      renderPanelContent(grid._renderRoot, state);
    }

    // Dropdown re-anchor after a NON-structural render (see method docs below).
    if (!state.isPanelOpen) {
      this.#stopReanchorObserver();
      return;
    }
    this.shellController.reanchorOpenDropdown();
    this.#startReanchorObserver(grid);
  }

  /**
   * @internal Sync the shell header title element in place from the effective
   * config (or parsed light-DOM title) without a full re-render. Extracted from
   * core's former `#updateShellHeaderInPlace` (#370).
   */
  #syncShellHeaderTitle(grid: GridElement): void {
    const shellHeader = grid._renderRoot.querySelector('.tbw-shell-header');
    if (!shellHeader) return;

    const title = grid.effectiveConfig?.shell?.header?.title ?? this.shellState.lightDomTitle;

    let titleEl = shellHeader.querySelector('.tbw-shell-title') as HTMLElement | null;
    if (title) {
      if (!titleEl) {
        titleEl = document.createElement('h2');
        titleEl.className = 'tbw-shell-title';
        titleEl.setAttribute('part', 'shell-title');
        shellHeader.insertBefore(titleEl, shellHeader.firstChild);
      }
      titleEl.textContent = title;
    } else if (titleEl) {
      titleEl.remove();
    }
  }

  /** @internal Start (idempotently) the dropdown re-anchor observer. */
  #startReanchorObserver(grid: GridElement): void {
    // Only dropdown mode needs the observer. If the mode changed away from
    // 'dropdown' while the panel is still open, tear down any observer started
    // by an earlier render instead of leaving it watching the render root.
    if (grid.effectiveConfig?.shell?.toolPanel?.mode !== 'dropdown') {
      this.#stopReanchorObserver();
      return;
    }
    if (typeof MutationObserver === 'undefined') return;
    if (!this.#reanchorObserver) {
      this.#reanchorObserver = new MutationObserver(() => {
        if (!this.grid || !this.hasState || !this.shellState.isPanelOpen) {
          this.#stopReanchorObserver();
          return;
        }
        this.shellController.reanchorOpenDropdown();
      });
    }
    if (!this.#reanchorObserving) {
      this.#reanchorObserver.observe(grid._renderRoot, { childList: true, subtree: true });
      this.#reanchorObserving = true;
    }
  }

  /** @internal Stop the dropdown re-anchor observer if running. */
  #stopReanchorObserver(): void {
    if (this.#reanchorObserver && this.#reanchorObserving) {
      this.#reanchorObserver.disconnect();
      this.#reanchorObserving = false;
    }
  }

  /**
   * @internal Render all shell contents into the freshly built shell chrome.
   *
   * Runs from {@link afterStructuralRender} after the chrome is wrapped and
   * listeners are attached. Renders plugin header content + custom toolbar
   * slots, applies the configured default-open / legacy open-on-load behavior,
   * and restores an already-open panel's content. All render functions operate
   * on the shell DOM (queried from `_renderRoot`), not on the grid-body refs,
   * so they are safe to run before `#afterConnect` caches those.
   *
   * Extraction #370, Task 1b (Step 1b.1.3) — replaces core's per-render shell
   * content block in `#afterConnect` / `#afterShellRefresh`.
   */
  #renderShellContents(grid: GridElement): void {
    const state = this.shellState;
    const renderRoot = grid._renderRoot;
    const shellConfig = grid.effectiveConfig?.shell;

    // Render plugin header content + custom toolbar contents (render modes).
    renderHeaderContent(renderRoot, state);
    renderCustomToolbarContents(renderRoot, shellConfig, state);

    // Pre-expand the configured default section.
    const toolPanelCfg = shellConfig?.toolPanel;
    const defaultOpen = toolPanelCfg?.defaultOpen;
    if (defaultOpen && state.toolPanels.has(defaultOpen)) {
      state.expandedSections.add(defaultOpen);
    }

    // Decide whether the sidebar should be open on load.
    // NOTE: In v2.x `defaultOpen` alone also opens the sidebar (legacy
    // behavior). v3.0.0 will drop that — see issue #259 and the
    // @deprecated note on ToolPanelConfig.defaultOpen.
    // Search marker: TOOLPANEL-OPEN-LEGACY-259
    const shouldOpenOnLoad =
      toolPanelCfg?.locked === true ||
      toolPanelCfg?.initialState === 'open' ||
      // Legacy v2 path — remove in v3.0.0 (#259)
      (toolPanelCfg?.initialState === undefined && defaultOpen !== undefined && state.toolPanels.has(defaultOpen));
    if (!state.isPanelOpen && state.toolPanels.size > 0 && shouldOpenOnLoad) {
      this.openToolPanel();
    }

    // Restore panel content if the panel was already open (e.g. after a position
    // change re-render or a plugin re-init that triggered a shell refresh).
    if (state.isPanelOpen) {
      updatePanelState(renderRoot, state);
      renderPanelContent(renderRoot, state, {
        expand: grid.effectiveConfig?.icons?.expand,
        collapse: grid.effectiveConfig?.icons?.collapse,
      });
      updateToolbarActiveStates(renderRoot, state);
      // In dropdown mode `rebuildShellDOM` created a fresh `.tbw-tool-panel`, so
      // the popover must be re-shown in the top layer and re-anchored — the
      // trigger may have been recreated by the same re-render (e.g. a custom
      // column-header button after a column toggle/reorder). Otherwise the
      // popover loses its anchor and collapses to the viewport corner.
      this.shellController.reanchorOpenDropdown();
    }
  }

  /**
   * @internal Attach shell event + dismiss/resize listeners.
   *
   * Cleans any prior document-level registrations before re-adding, so it is
   * safe to call on every re-wrap (initial render, shell refresh, plugin
   * re-init) without leaking or double-attaching listeners.
   */
  #setupListeners(grid: GridElement): void {
    const renderRoot = grid._renderRoot;
    const shellConfig = grid.effectiveConfig?.shell;
    const state = this.shellState;

    setupShellEventListeners(renderRoot, shellConfig, state, {
      onPanelToggle: () => this.toggleToolPanel(),
      onSectionToggle: (sectionId: string) => this.toggleToolPanelSection(sectionId),
      onPanelClose: () => this.closeToolPanel(),
    });

    // Tool panel resize handle — persists the new width as a CSS variable on
    // the host element.
    this.#resizeCleanup?.();
    this.#resizeCleanup = setupToolPanelResize(renderRoot, shellConfig, (width: number) => {
      grid._hostElement.style.setProperty('--tbw-tool-panel-width', `${width}px`);
    });

    // Click-outside dismiss for an open overlay tool panel.
    this.#clickOutsideCleanup?.();
    this.#clickOutsideCleanup = setupClickOutsideDismiss(grid._hostElement, shellConfig, state, () =>
      this.closeToolPanel(),
    );

    // Escape-to-close dismiss for overlay tool panels.
    this.#escapeDismissCleanup?.();
    this.#escapeDismissCleanup = setupEscapeDismiss(shellConfig, state, () => this.closeToolPanel());
  }

  /** @internal Remove the document-level shell listeners. */
  #teardownListeners(): void {
    this.#resizeCleanup?.();
    this.#resizeCleanup = undefined;
    this.#clickOutsideCleanup?.();
    this.#clickOutsideCleanup = undefined;
    this.#escapeDismissCleanup?.();
    this.#escapeDismissCleanup = undefined;
  }

  /** @internal */
  override detach(): void {
    // Non-destructive detach (Approach A): shell state and document listeners
    // survive plugin re-inits. `#setupListeners` cleans-before-add on the next
    // re-wrap, so there is nothing to tear down here. Real teardown happens in
    // `disposeShellState()` on grid disconnect.
    super.detach();
  }

  /**
   * @internal Tear down shell state on grid disconnect (Approach A).
   * Idempotent and harmless when no state exists.
   */
  disposeShellState(): void {
    this.#teardownListeners();
    this.#stopReanchorObserver();
    this.#reanchorObserver = undefined;
    // Unregister the light-DOM shell handlers (registered in `attach`). `detach`
    // does not clear `this.grid`, so the reference is still valid here.
    const grid = this.grid as GridElement | undefined;
    if (grid && this.#shellChangeHandler) {
      grid._unregisterLightDomHandler('tbw-grid-header');
      grid._unregisterLightDomHandler('tbw-grid-tool-buttons');
      grid._unregisterLightDomHandler('tbw-grid-tool-panel');
      this.#shellChangeHandler = undefined;
    }
    if (this.#state) {
      cleanupShellState(this.#state);
      this.#controller?.setInitialized(false);
    }
  }
}
