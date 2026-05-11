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

import type { HeaderContentDefinition, InternalGrid, ToolbarContentDefinition, ToolPanelDefinition } from '../types';
import {
  HEADER_CONTENT_DUPLICATE,
  NO_TOOL_PANELS,
  TOOL_PANEL_DUPLICATE,
  TOOL_PANEL_NOT_FOUND,
  TOOLBAR_CONTENT_DUPLICATE,
  warnDiagnostic,
} from './diagnostics';
import {
  renderHeaderContent,
  renderPanelContent,
  updatePanelState,
  updateToolbarActiveStates,
  type ShellState,
} from './shell';

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
  /** Open the tool panel */
  openToolPanel(): void;
  /** Close the tool panel */
  closeToolPanel(): void;
  /** Toggle the tool panel */
  toggleToolPanel(): void;
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

    openToolPanel() {
      if (state.isPanelOpen) return;
      if (state.toolPanels.size === 0) {
        warnDiagnostic(NO_TOOL_PANELS, 'No tool panels registered', grid.id);
        return;
      }

      state.isPanelOpen = true;

      // Auto-expand a section if none expanded.
      // Prefer toolPanel.defaultOpen when it matches a registered panel;
      // otherwise pick the first panel by `order`.
      if (state.expandedSections.size === 0 && state.toolPanels.size > 0) {
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

      // Update UI
      const shadow = grid._renderRoot;
      updateToolbarActiveStates(shadow, state);
      updatePanelState(shadow, state);

      // Render accordion sections
      renderPanelContent(shadow, state, grid._accordionIcons);

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

      // Emit event
      grid._emit('tool-panel-close', {});
    },

    toggleToolPanel() {
      if (state.isPanelOpen) {
        controller.closeToolPanel();
      } else {
        controller.openToolPanel();
      }
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
