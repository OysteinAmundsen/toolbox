/**
 * Shell Controller - Tool panel and header content orchestration.
 *
 * Extracted from shell.ts to isolate the stateful controller logic
 * from the rendering/parsing infrastructure.
 *
 * The ShellController manages:
 * - Tool panel open/close/toggle state
 * - Accordion section expand/collapse
 * - Registration of tool panels, header content, and toolbar content
 */

import {
  HEADER_CONTENT_DUPLICATE,
  NO_TOOL_PANELS,
  TOOL_PANEL_DUPLICATE,
  TOOL_PANEL_NOT_FOUND,
  TOOLBAR_CONTENT_DUPLICATE,
  warnDiagnostic,
} from '../../core/internal/diagnostics';
import type { InternalGrid } from '../../core/types';
import {
  hideToolPanelDropdown,
  renderHeaderContent,
  renderPanelContent,
  repairDropdownAnchor,
  showToolPanelDropdown,
  supportsAnchorPositioning,
  updatePanelState,
  updateToolbarActiveStates,
  type ShellState,
} from './shell';
import type {
  HeaderContentDefinition,
  OpenToolPanelOptions,
  ToolbarContentDefinition,
  ToolPanelDefinition,
} from './types';

// #region ShellController
/**
 * Controller interface for managing shell/tool panel behavior.
 */
export interface ShellController {
  /** Whether the shell has been initialized */
  readonly isInitialized: boolean;
  /** Set the initialized state */
  setInitialized(value: boolean): void;
  /** Whether the tool panel is currently open */
  readonly isPanelOpen: boolean;
  /** Get IDs of expanded accordion sections */
  readonly expandedSections: string[];
  /**
   * Open the tool panel.
   * @param panelId - Optional ID of the section to expand on open. When provided,
   *   takes precedence over `shell.toolPanel.defaultOpen`. If the panel is already
   *   open with a different section expanded, switches to the requested section.
   *   If the panel ID is not registered, a `TBW072` warning is emitted and the
   *   call falls back to default behavior (auto-expand `defaultOpen` or first by order).
   * @param options - Optional open options. In `mode: 'dropdown'`, `options.anchor`
   *   sets the element the popover anchors to (see {@link OpenToolPanelOptions}).
   */
  openToolPanel(panelId?: string, options?: OpenToolPanelOptions): void;
  /** Close the tool panel */
  closeToolPanel(): void;
  /**
   * Toggle the tool panel.
   * @param options - Optional open options forwarded to {@link openToolPanel}
   *   when the panel is currently closed (e.g. `anchor` for dropdown mode).
   */
  toggleToolPanel(options?: OpenToolPanelOptions): void;
  /**
   * Re-pair an open dropdown popover onto its (possibly recreated) trigger
   * after a re-render (`mode: 'dropdown'` only). A column toggle / reorder may
   * recreate the custom column-header button the popover was anchored to,
   * leaving the popover's `position-anchor` dangling so the browser drops it to
   * the corner.
   *
   * Behaviour:
   * - intact pairing → no-op (cheap fast-path, safe to call every render);
   * - a live `[data-panel-toggle]` exists → re-pair the existing anchor onto it
   *   IN PLACE (no popover re-show → no flash), or a fixed-coord re-show when
   *   CSS anchor positioning is unavailable;
   * - corner-origin dropdown with no trigger → keep it pinned to the corner;
   * - trigger-origin dropdown whose trigger is transiently absent → leave the
   *   popover at its last position (the shell's MutationObserver re-pairs it
   *   before paint once the trigger reappears), rather than flashing to corner.
   *
   * No-op when the panel is closed or the mode is not `'dropdown'`.
   */
  reanchorOpenDropdown(): void;
  /** Toggle an accordion section */
  toggleToolPanelSection(sectionId: string): void;
  /** Get registered tool panels */
  getToolPanels(): ToolPanelDefinition[];
  /** Register a tool panel */
  registerToolPanel(panel: ToolPanelDefinition): void;
  /** Unregister a tool panel */
  unregisterToolPanel(panelId: string): void;
  /** Get registered header contents */
  getHeaderContents(): HeaderContentDefinition[];
  /** Register header content */
  registerHeaderContent(content: HeaderContentDefinition): void;
  /** Unregister header content */
  unregisterHeaderContent(contentId: string): void;
  /** Get all registered toolbar contents */
  getToolbarContents(): ToolbarContentDefinition[];
  /** Register toolbar content */
  registerToolbarContent(content: ToolbarContentDefinition): void;
  /** Unregister toolbar content */
  unregisterToolbarContent(contentId: string): void;
}

/**
 * Create a ShellController instance.
 * The controller encapsulates all tool panel orchestration logic.
 */
export function createShellController(state: ShellState, grid: InternalGrid): ShellController {
  let initialized = false;

  /**
   * Resolve the element a dropdown popover should anchor to. Priority:
   * explicit `anchor` option → built-in toolbar toggle button → grid host
   * corner fallback.
   */
  function resolveDropdownAnchor(explicit?: HTMLElement): { el: HTMLElement; corner: boolean } {
    if (explicit) return { el: explicit, corner: false };
    const toggle = grid._renderRoot.querySelector('[data-panel-toggle]') as HTMLElement | null;
    if (toggle) return { el: toggle, corner: false };
    return { el: grid._hostElement, corner: true };
  }

  const controller: ShellController = {
    get isInitialized() {
      return initialized;
    },
    setInitialized(value: boolean) {
      initialized = value;
    },

    get isPanelOpen() {
      return state.isPanelOpen;
    },

    get expandedSections() {
      return [...state.expandedSections];
    },

    openToolPanel(panelId?: string, options?: OpenToolPanelOptions) {
      if (state.toolPanels.size === 0) {
        warnDiagnostic(NO_TOOL_PANELS, 'No tool panels registered', grid.id);
        return;
      }

      // Validate explicit panelId; on unknown id, warn and fall back to default behavior.
      let targetSectionId: string | undefined;
      if (panelId !== undefined) {
        if (state.toolPanels.has(panelId)) {
          targetSectionId = panelId;
        } else {
          warnDiagnostic(TOOL_PANEL_NOT_FOUND, `Tool panel "${panelId}" not found`, grid.id);
        }
      }

      // Fast path: panel already open and requested section already expanded → no-op.
      if (state.isPanelOpen && targetSectionId && state.expandedSections.has(targetSectionId)) {
        return;
      }

      // Panel already open but a different section is expanded → switch sections
      // (delegate to toggleToolPanelSection for accordion exclusivity + event emission).
      if (state.isPanelOpen && targetSectionId && !state.expandedSections.has(targetSectionId)) {
        controller.toggleToolPanelSection(targetSectionId);
        return;
      }

      if (state.isPanelOpen) return;

      state.isPanelOpen = true;

      // Decide initial expanded section:
      // 1. Explicit panelId argument (already validated above).
      // 2. shell.toolPanel.defaultOpen if it matches a registered panel.
      // 3. First panel by `order`.
      if (state.expandedSections.size === 0 && state.toolPanels.size > 0) {
        if (targetSectionId) {
          state.expandedSections.add(targetSectionId);
        } else {
          const defaultOpenId = grid.effectiveConfig?.shell?.toolPanel?.defaultOpen;
          if (defaultOpenId && state.toolPanels.has(defaultOpenId)) {
            state.expandedSections.add(defaultOpenId);
          } else {
            const sortedPanels = [...state.toolPanels.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
            const firstPanel = sortedPanels[0];
            if (firstPanel) {
              state.expandedSections.add(firstPanel.id);
            }
          }
        }
      } else if (targetSectionId && !state.expandedSections.has(targetSectionId)) {
        // Some other section was already pre-expanded (e.g. via config); switch to requested.
        for (const id of [...state.expandedSections]) {
          state.expandedSections.delete(id);
        }
        state.expandedSections.add(targetSectionId);
      }

      // Update UI
      const shadow = grid._renderRoot;
      updateToolbarActiveStates(shadow, state);
      updatePanelState(shadow, state);

      // Render accordion sections
      renderPanelContent(shadow, state, grid._accordionIcons);

      // In dropdown mode, show the panel as an anchored popover in the top layer.
      if (grid.effectiveConfig?.shell?.toolPanel?.mode === 'dropdown') {
        const { el, corner } = resolveDropdownAnchor(options?.anchor);
        showToolPanelDropdown(shadow, state, el, corner);
      }

      // Emit event
      grid._emit('tool-panel-open', { sections: controller.expandedSections });
    },

    closeToolPanel() {
      if (!state.isPanelOpen) return;
      // When the tool panel is locked open, programmatic and user close
      // requests become no-ops. Accordion sections can still toggle.
      if (grid.effectiveConfig?.shell?.toolPanel?.locked) return;

      // Clean up all panel content
      for (const cleanup of state.panelCleanups.values()) {
        cleanup();
      }
      state.panelCleanups.clear();

      // Call onClose for all panels
      for (const panel of state.toolPanels.values()) {
        panel.onClose?.();
      }

      state.isPanelOpen = false;

      // Update UI
      const shadow = grid._renderRoot;
      updateToolbarActiveStates(shadow, state);
      updatePanelState(shadow, state);

      // In dropdown mode, hide the popover and clear anchor wiring.
      if (grid.effectiveConfig?.shell?.toolPanel?.mode === 'dropdown') {
        hideToolPanelDropdown(shadow, state);
      }

      // Emit event
      grid._emit('tool-panel-close', {});
    },

    toggleToolPanel(options?: OpenToolPanelOptions) {
      if (state.isPanelOpen) {
        controller.closeToolPanel();
      } else {
        controller.openToolPanel(undefined, options);
      }
    },

    reanchorOpenDropdown() {
      if (!state.isPanelOpen) return;
      if (grid.effectiveConfig?.shell?.toolPanel?.mode !== 'dropdown') return;
      const stored = state.dropdownAnchorEl;
      // Idempotent fast-path: the anchor element is still connected AND still
      // carries the minted `anchor-name`, so the pairing is intact — nothing to
      // do. This keeps the hook cheap when it runs on the `afterRender` path
      // (which fires on every render, e.g. a column toggle), only doing real
      // work when the trigger was actually recreated/detached.
      if (
        stored &&
        stored.isConnected &&
        state.dropdownAnchorName &&
        stored.style.getPropertyValue('anchor-name') === state.dropdownAnchorName
      ) {
        return;
      }
      // Re-pair to a LIVE custom trigger (`[data-panel-toggle]`) whenever one
      // exists. Prefer the cheap in-place repair: it reuses the already-minted
      // `anchor-name`, keeps the popover shown, and never re-enters the Popover
      // API — so the popover stays visually anchored with NO flash. Falls back
      // to a fixed-coordinate re-show only when CSS anchor positioning is
      // unavailable.
      const fresh = grid._renderRoot.querySelector('[data-panel-toggle]') as HTMLElement | null;
      if (fresh && fresh !== grid._hostElement) {
        if (
          state.dropdownAnchorName &&
          supportsAnchorPositioning() &&
          repairDropdownAnchor(grid._renderRoot, state, fresh)
        ) {
          return;
        }
        showToolPanelDropdown(grid._renderRoot, state, fresh, false);
        return;
      }
      // No live trigger.
      if (stored === grid._hostElement) {
        // Corner-origin dropdown (opened without a custom trigger): keep it
        // pinned to the grid corner across re-renders.
        showToolPanelDropdown(grid._renderRoot, state, grid._hostElement, true);
        return;
      }
      // Trigger-origin dropdown whose trigger is transiently absent (an outer
      // framework, e.g. React, recreates it on a separate commit) — or was
      // permanently removed. Do NOT flash the popover to the corner: leave it
      // at its last position. When the trigger reappears, the shell's
      // MutationObserver re-pairs it before paint (see ShellPlugin).
    },

    toggleToolPanelSection(sectionId: string) {
      const panel = state.toolPanels.get(sectionId);
      if (!panel) {
        warnDiagnostic(TOOL_PANEL_NOT_FOUND, `Tool panel section "${sectionId}" not found`, grid.id);
        return;
      }

      // Don't allow toggling when there's only one panel (it should stay expanded)
      if (state.toolPanels.size === 1) {
        return;
      }

      const shadow = grid._renderRoot;
      const isExpanded = state.expandedSections.has(sectionId);

      if (isExpanded) {
        // Collapsing current section
        const cleanup = state.panelCleanups.get(sectionId);
        if (cleanup) {
          cleanup();
          state.panelCleanups.delete(sectionId);
        }
        panel.onClose?.();
        state.expandedSections.delete(sectionId);
        updateAccordionSectionState(shadow, sectionId, false);
      } else {
        // Expanding - first collapse all others (exclusive accordion)
        for (const [otherId, otherPanel] of state.toolPanels) {
          if (otherId !== sectionId && state.expandedSections.has(otherId)) {
            const cleanup = state.panelCleanups.get(otherId);
            if (cleanup) {
              cleanup();
              state.panelCleanups.delete(otherId);
            }
            otherPanel.onClose?.();
            state.expandedSections.delete(otherId);
            updateAccordionSectionState(shadow, otherId, false);
            // Clear content of collapsed section
            const contentEl = shadow.querySelector(`[data-section="${otherId}"] .tbw-accordion-content`);
            if (contentEl) contentEl.innerHTML = '';
          }
        }
        // Now expand the target section
        state.expandedSections.add(sectionId);
        updateAccordionSectionState(shadow, sectionId, true);
        renderAccordionSectionContent(shadow, state, sectionId);
      }

      // Emit event
      grid._emit('tool-panel-section-toggle', { id: sectionId, expanded: !isExpanded });
    },

    getToolPanels() {
      return [...state.toolPanels.values()];
    },

    registerToolPanel(panel: ToolPanelDefinition) {
      if (state.toolPanels.has(panel.id)) {
        warnDiagnostic(TOOL_PANEL_DUPLICATE, `Tool panel "${panel.id}" already registered`, grid.id);
        return;
      }
      state.toolPanels.set(panel.id, panel);

      if (initialized) {
        grid.refreshShellHeader?.();
      }
    },

    unregisterToolPanel(panelId: string) {
      // Close panel if open and this section is expanded
      if (state.expandedSections.has(panelId)) {
        const cleanup = state.panelCleanups.get(panelId);
        if (cleanup) {
          cleanup();
          state.panelCleanups.delete(panelId);
        }
        state.expandedSections.delete(panelId);
      }

      state.toolPanels.delete(panelId);

      if (initialized) {
        grid.refreshShellHeader?.();
      }
    },

    getHeaderContents() {
      return [...state.headerContents.values()];
    },

    registerHeaderContent(content: HeaderContentDefinition) {
      if (state.headerContents.has(content.id)) {
        warnDiagnostic(HEADER_CONTENT_DUPLICATE, `Header content "${content.id}" already registered`, grid.id);
        return;
      }
      state.headerContents.set(content.id, content);

      if (initialized) {
        renderHeaderContent(grid._renderRoot, state);
      }
    },

    unregisterHeaderContent(contentId: string) {
      // Clean up
      const cleanup = state.headerContentCleanups.get(contentId);
      if (cleanup) {
        cleanup();
        state.headerContentCleanups.delete(contentId);
      }

      // Call onDestroy
      const content = state.headerContents.get(contentId);
      content?.onDestroy?.();

      state.headerContents.delete(contentId);

      // Remove DOM element
      const el = grid._renderRoot.querySelector(`[data-header-content="${contentId}"]`);
      el?.remove();
    },

    getToolbarContents() {
      return [...state.toolbarContents.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },

    registerToolbarContent(content: ToolbarContentDefinition) {
      if (state.toolbarContents.has(content.id)) {
        warnDiagnostic(TOOLBAR_CONTENT_DUPLICATE, `Toolbar content "${content.id}" already registered`, grid.id);
        return;
      }
      state.toolbarContents.set(content.id, content);

      if (initialized) {
        grid.refreshShellHeader?.();
      }
    },

    unregisterToolbarContent(contentId: string) {
      // Clean up
      const cleanup = state.toolbarContentCleanups.get(contentId);
      if (cleanup) {
        cleanup();
        state.toolbarContentCleanups.delete(contentId);
      }

      // Call onDestroy if defined
      const content = state.toolbarContents.get(contentId);
      if (content?.onDestroy) {
        content.onDestroy();
      }

      state.toolbarContents.delete(contentId);

      if (initialized) {
        grid.refreshShellHeader?.();
      }
    },
  };

  return controller;
}

/**
 * Update accordion section visual state.
 */
function updateAccordionSectionState(renderRoot: Element, sectionId: string, expanded: boolean): void {
  const section = renderRoot.querySelector(`[data-section="${sectionId}"]`);
  if (section) {
    section.classList.toggle('expanded', expanded);
  }
}

/**
 * Render content for a single accordion section.
 */
function renderAccordionSectionContent(renderRoot: Element, state: ShellState, sectionId: string): void {
  const panel = state.toolPanels.get(sectionId);
  if (!panel?.render) return;

  const contentEl = renderRoot.querySelector(`[data-section="${sectionId}"] .tbw-accordion-content`);
  if (!contentEl) return;

  const cleanup = panel.render(contentEl as HTMLElement);
  if (cleanup) {
    state.panelCleanups.set(sectionId, cleanup);
  }
}
// #endregion
