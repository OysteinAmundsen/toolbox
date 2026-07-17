/**
 * Shell infrastructure for grid header bar and tool panels.
 *
 * The shell is an optional wrapper layer that provides:
 * - Header bar with title, plugin content, and toolbar buttons
 * - Tool panels that plugins can register content into
 * - Light DOM parsing for framework-friendly configuration
 */

import { TOOL_PANEL_DUPLICATE, TOOL_PANEL_MISSING_ATTR, warnDiagnostic } from '../../core/internal/diagnostics';
import { escapeHtml, sanitizeHTML } from '../../core/internal/sanitize';
import type { IconValue } from '../../core/types';
import type { HeaderContentDefinition, ShellConfig, ToolbarContentDefinition, ToolPanelDefinition } from './types';

// #region Types & State
/**
 * Convert an IconValue to a string for rendering in HTML.
 */
function iconToString(icon: IconValue | undefined): string {
  if (!icon) return '';
  if (typeof icon === 'string') return sanitizeHTML(icon);
  // For HTMLElement, get the outerHTML
  return icon.outerHTML;
}

/**
 * State for managing shell UI.
 *
 * This interface holds both configuration-like properties (toolPanels, headerContents)
 * and runtime state (isPanelOpen, expandedSections). The Maps allow for efficient
 * registration/unregistration of panels and content.
 */
export interface ShellState {
  /** Registered tool panels (from plugins + consumer API) */
  toolPanels: Map<string, ToolPanelDefinition>;
  /** Registered header content (from plugins + consumer API) */
  headerContents: Map<string, HeaderContentDefinition>;
  /** Toolbar content registered via API or light DOM */
  toolbarContents: Map<string, ToolbarContentDefinition>;
  /** Whether a <tbw-grid-tool-buttons> container was found in light DOM */
  hasToolButtonsContainer: boolean;
  /** Light DOM header content elements */
  lightDomHeaderContent: HTMLElement[];
  /** Light DOM header title from <tbw-grid-header title="..."> */
  lightDomTitle: string | null;
  /** IDs of tool panels registered from light DOM (to avoid re-parsing) */
  lightDomToolPanelIds: Set<string>;
  /**
   * IDs of light DOM tool panels whose `render` has already been bound to a
   * framework-adapter renderer. Used by `parseLightDomToolPanels` to detect
   * the FIRST adapter attach (which legitimately needs to swap the vanilla
   * fallback for the real adapter renderer and tear down any in-progress
   * render) vs. subsequent re-parses (which must NOT tear down — doing so
   * unmounts the user's React/Vue/Angular component, losing local state and
   * resetting scroll position inside the panel).
   */
  adapterBoundToolPanelIds: Set<string>;
  /** IDs of toolbar content registered from light DOM (to avoid re-parsing) */
  lightDomToolbarContentIds: Set<string>;
  /** IDs of tool panels registered via registerToolPanel API */
  apiToolPanelIds: Set<string>;
  /** IDs of header content registered via registerHeaderContent API */
  apiHeaderContentIds: Set<string>;
  /** Whether the tool panel sidebar is open */
  isPanelOpen: boolean;
  /** Which accordion sections are expanded (by panel ID) */
  expandedSections: Set<string>;
  /** Whether light DOM header content has been moved to placeholder (perf optimization) */
  lightDomContentMoved: boolean;
  /** Cleanup functions for header content render returns */
  headerContentCleanups: Map<string, () => void>;
  /** Cleanup functions for each panel section's render return */
  panelCleanups: Map<string, () => void>;
  /** Cleanup functions for toolbar content render returns */
  toolbarContentCleanups: Map<string, () => void>;
  /**
   * Element the dropdown popover is currently anchored to (mode: 'dropdown').
   * Tracked so dismissal logic can ignore clicks on the anchor and the
   * `anchor-name` it set can be cleared on close. `null` when no dropdown is open.
   */
  dropdownAnchorEl?: HTMLElement | null;
  /**
   * Unique `anchor-name` assigned to the current dropdown's trigger (and
   * mirrored as `position-anchor` on the popover). Minted per show so multiple
   * grids on one page never collide on a shared anchor name — a collision would
   * position one grid's popover against another grid's trigger. `null` when no
   * dropdown is open.
   */
  dropdownAnchorName?: string | null;
}

/**
 * Create initial shell state.
 */
export function createShellState(): ShellState {
  return {
    toolPanels: new Map(),
    headerContents: new Map(),
    toolbarContents: new Map(),
    hasToolButtonsContainer: false,
    lightDomHeaderContent: [],
    lightDomTitle: null,
    lightDomToolPanelIds: new Set(),
    adapterBoundToolPanelIds: new Set(),
    lightDomToolbarContentIds: new Set(),
    apiToolPanelIds: new Set(),
    apiHeaderContentIds: new Set(),
    isPanelOpen: false,
    expandedSections: new Set(),
    headerContentCleanups: new Map(),
    panelCleanups: new Map(),
    toolbarContentCleanups: new Map(),
    lightDomContentMoved: false,
    dropdownAnchorEl: null,
    dropdownAnchorName: null,
  };
}
// #endregion

// #region Render Functions
/**
 * Determine if shell header should be rendered.
 * Reads only from effectiveConfig.shell (single source of truth).
 */
export function shouldRenderShellHeader(config: ShellConfig | undefined): boolean {
  // Check if title is configured
  if (config?.header?.title) return true;

  // Check if config has toolbar contents
  if (config?.header?.toolbarContents?.length) return true;

  // Check if any tool panels are registered
  if (config?.toolPanels?.length) return true;

  // Check if any header content is registered
  if (config?.headerContents?.length) return true;

  // Check if light DOM has header elements
  if (config?.header?.lightDomContent?.length) return true;

  // Check if a toolbar buttons container was found
  if (config?.header?.hasToolButtonsContainer) return true;

  return false;
}

/**
 * Determine whether the visible shell header bar (`.tbw-shell-header`) should
 * be rendered.
 *
 * Distinct from {@link shouldRenderShellHeader}, which decides whether the
 * shell *wrapper* (including the body that hosts the tool panel) exists at
 * all. The header bar can be suppressed via `header.visible: false` while the
 * shell body and tool panels still render — letting consumers drive panels
 * from their own UI (e.g. a utility-column header icon).
 */
export function shouldRenderHeaderBar(config: ShellConfig | undefined): boolean {
  return config?.header?.visible !== false;
}

/**
 * Render the shell header HTML.
 *
 * Toolbar contents come from two sources:
 * 1. Light DOM slot (users provide their own HTML in <tbw-grid-tool-buttons>)
 * 2. Config/API with render function (programmatic insertion)
 *
 * Users have full control over toolbar HTML, styling, and behavior.
 * The only button the grid creates is the tool panel toggle.
 *
 * @param toolPanelIcon - Icon for the tool panel toggle (from grid icon config)
 */
export function renderShellHeader(
  config: ShellConfig | undefined,
  state: ShellState,
  toolPanelIcon?: IconValue,
): string {
  const title = config?.header?.title ?? state.lightDomTitle ?? '';
  const hasTitle = !!title;

  // Build tool panel button content: use data-icon for CSS, inject content only for JS overrides
  let toolPanelBtnContent = '';
  if (toolPanelIcon !== undefined) {
    // JS override: inject content but still set data-icon
    toolPanelBtnContent = typeof toolPanelIcon === 'string' ? sanitizeHTML(toolPanelIcon) : toolPanelIcon.outerHTML;
  }

  // Get all toolbar contents from effectiveConfig (already merged: config + API + light DOM)
  // The config-manager merges state.toolbarContents into effectiveConfig.shell.header.toolbarContents
  // Also include state.toolbarContents directly for cases where renderShellHeader is called
  // before config-manager has merged (e.g., unit tests, initial render)
  const configContents = config?.header?.toolbarContents ?? [];
  const stateContents = [...state.toolbarContents.values()];

  // Merge: use config contents, add state contents that aren't in config
  const configIds = new Set(configContents.map((c) => c.id));
  const allContents = [...configContents];
  for (const content of stateContents) {
    if (!configIds.has(content.id)) {
      allContents.push(content);
    }
  }

  const hasCustomContent = allContents.length > 0;
  const hasPanels = state.toolPanels.size > 0;
  // Allow consumers to suppress the built-in toggle (and the separator that
  // only exists to space it from custom toolbar contents) so they can render
  // their own design-system button and wire it to `grid.toggleToolPanel()`.
  // Also suppress when the tool panel is locked open — toggling is disabled.
  // Default true preserves existing behavior.
  const isLocked = config?.toolPanel?.locked === true;
  const showToggle = hasPanels && config?.header?.toolPanelToggle !== false && !isLocked;
  const showSeparator = hasCustomContent && showToggle;

  // Sort contents by order for slot placement
  const sortedContents = [...allContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Build toolbar HTML
  let toolbarHtml = '';

  // Create slots for all contents (unified: config + API + light DOM)
  for (const content of sortedContents) {
    toolbarHtml += `<div class="tbw-toolbar-content-slot" data-toolbar-content="${content.id}"></div>`;
  }

  // Separator between custom content and panel toggle
  if (showSeparator) {
    toolbarHtml += '<div class="tbw-toolbar-separator"></div>';
  }

  // Single panel toggle button (the ONLY button the grid creates).
  // Suppressed when `shell.header.toolPanelToggle === false` so consumers can
  // BYO toggle button without hiding library DOM via CSS.
  if (showToggle) {
    const isOpen = state.isPanelOpen;
    const toggleClass = isOpen ? 'tbw-toolbar-btn active' : 'tbw-toolbar-btn';
    // type="button" is required: without it a <button> inside a <form>
    // defaults to type="submit" and clicking the toggle would submit the
    // surrounding form. Internal grid buttons must never trigger form
    // submission. See issue #296.
    toolbarHtml += `<button type="button" class="${toggleClass}" data-panel-toggle data-icon="tool-panel" title="Settings" aria-label="Toggle settings panel" aria-pressed="${isOpen}" aria-controls="tbw-tool-panel">${toolPanelBtnContent}</button>`;
  }

  return `
    <div class="tbw-shell-header" part="shell-header" role="presentation">
      ${hasTitle ? `<div class="tbw-shell-title">${escapeHtml(title)}</div>` : ''}
      <div class="tbw-shell-content" part="shell-content" role="presentation" data-light-dom-header-content></div>
      <div class="tbw-shell-toolbar" part="shell-toolbar" role="presentation">
        ${toolbarHtml}
      </div>
    </div>
  `;
}

/**
 * Render the shell body wrapper HTML (contains grid content + accordion-style tool panel).
 * @param icons - Optional icons for expand/collapse chevrons (from grid config)
 */
export function renderShellBody(
  config: ShellConfig | undefined,
  state: ShellState,
  gridContentHtml: string,
  icons?: { expand?: IconValue; collapse?: IconValue },
): string {
  const position = config?.toolPanel?.position ?? 'right';
  const mode = config?.toolPanel?.mode ?? 'overlay';
  const hasPanel = state.toolPanels.size > 0;
  const isOpen = state.isPanelOpen;
  const hasJsExpandIcon = icons?.expand !== undefined;
  const expandIcon = hasJsExpandIcon ? iconToString(icons.expand) : '';

  // Sort panels by order for accordion sections
  const sortedPanels = [...state.toolPanels.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  const isSinglePanel = sortedPanels.length === 1;

  // Build accordion sections HTML
  let accordionHtml = '';
  for (const panel of sortedPanels) {
    const isExpanded = state.expandedSections.has(panel.id);
    const iconHtml = panel.icon ? `<span class="tbw-accordion-icon">${panel.icon}</span>` : '';
    // Hide chevron for single panel (no toggling needed)
    // Always use expandIcon (▶) — CSS rotation handles the expanded state
    const chevronHtml = isSinglePanel
      ? ''
      : `<span class="tbw-accordion-chevron" data-icon="expand">${expandIcon}</span>`;
    // Disable accordion toggle for single panel
    const sectionClasses = `tbw-accordion-section${isExpanded ? ' expanded' : ''}${isSinglePanel ? ' single' : ''}`;
    // Skip the header row only for a single title-less panel. With multiple
    // panels a title-less header still renders (empty title span) so the
    // expand/collapse chevron and toggle button remain available.
    const renderHeader = !!panel.title || !isSinglePanel;
    const headerHtml = renderHeader
      ? `<button type="button" class="tbw-accordion-header" aria-expanded="${isExpanded}" aria-controls="tbw-section-${panel.id}"${isSinglePanel ? ' aria-disabled="true"' : ''}>
          ${iconHtml}
          <span class="tbw-accordion-title">${escapeHtml(panel.title ?? '')}</span>
          ${chevronHtml}
        </button>`
      : '';
    accordionHtml += `
      <div class="${sectionClasses}" data-section="${panel.id}">
        ${headerHtml}
        <div class="tbw-accordion-content" id="tbw-section-${panel.id}" role="presentation"></div>
      </div>
    `;
  }

  // Resize handle position depends on panel position
  const resizeHandlePosition = position === 'left' ? 'right' : 'left';

  const panelHtml = hasPanel
    ? `
    <aside class="tbw-tool-panel${isOpen ? ' open' : ''}" part="tool-panel" data-position="${position}" role="presentation" id="tbw-tool-panel"${mode === 'dropdown' ? ' popover="manual"' : ''}>
      <div class="tbw-tool-panel-resize" data-resize-handle data-handle-position="${resizeHandlePosition}" aria-hidden="true"></div>
      <div class="tbw-tool-panel-content" role="presentation">
        <div class="tbw-accordion">
          ${accordionHtml}
        </div>
      </div>
    </aside>
  `
    : '';

  // For left position, panel comes before content in DOM order
  if (position === 'left') {
    return `
      <div class="tbw-shell-body" data-mode="${mode}">
        ${panelHtml}
        <div class="tbw-grid-content">
          ${gridContentHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="tbw-shell-body" data-mode="${mode}">
      <div class="tbw-grid-content">
        ${gridContentHtml}
      </div>
      ${panelHtml}
    </div>
  `;
}
// #endregion

// #region Light DOM Parsing
/**
 * Parse light DOM shell elements (tbw-grid-header, etc.).
 * Safe to call multiple times - will only parse once when elements are available.
 */
export function parseLightDomShell(host: HTMLElement, state: ShellState): void {
  const headerEl = host.querySelector('tbw-grid-header');
  if (!headerEl) return;

  // Parse title attribute (only if not already parsed)
  if (!state.lightDomTitle) {
    const title = headerEl.getAttribute('title');
    if (title) {
      state.lightDomTitle = title;
    }
  }

  // Parse header content elements - store references but don't set slot (light DOM doesn't use slots)
  const headerContents = headerEl.querySelectorAll('tbw-grid-header-content');
  if (headerContents.length > 0 && state.lightDomHeaderContent.length === 0) {
    state.lightDomHeaderContent = Array.from(headerContents) as HTMLElement[];
  }

  // Hide the light DOM header container (it was just for declarative config)
  (headerEl as HTMLElement).style.display = 'none';
}

/**
 * Callback type for creating a toolbar content renderer from a light DOM container.
 * This is used by framework adapters (Angular, React, etc.) to create renderers
 * from their template syntax.
 */
export type ToolbarContentRendererFactory = (
  container: HTMLElement,
) => ((target: HTMLElement) => void | (() => void)) | undefined;

/**
 * Parse toolbar buttons container element (<tbw-grid-tool-buttons>).
 * This is a content container - we don't parse individual children.
 * The entire container content is registered as a single toolbar content entry.
 *
 * Example:
 * ```html
 * <tbw-grid>
 *   <tbw-grid-tool-buttons>
 *     <button>My button</button>
 *     <button>My other button</button>
 *   </tbw-grid-tool-buttons>
 * </tbw-grid>
 * ```
 *
 * The container's children are moved to the toolbar area during render.
 * We treat this as opaque content - users control what goes inside.
 *
 * @param host - The grid host element
 * @param state - Shell state to update
 * @param rendererFactory - Optional factory for creating renderers (used by framework adapters)
 */
export function parseLightDomToolButtons(
  host: HTMLElement,
  state: ShellState,
  rendererFactory?: ToolbarContentRendererFactory,
): void {
  // Look for the toolbar buttons container element
  const toolButtonsContainer = host.querySelector(':scope > tbw-grid-tool-buttons') as HTMLElement | null;
  if (!toolButtonsContainer) return;

  // Mark that we found the container (for shouldRenderShellHeader)
  state.hasToolButtonsContainer = true;

  // Skip if already registered
  const id = 'light-dom-toolbar-content';
  if (state.lightDomToolbarContentIds.has(id)) return;

  // Register as a single content entry with a render function
  const adapterRenderer = rendererFactory?.(toolButtonsContainer);

  const contentDef: ToolbarContentDefinition = {
    id,
    order: 0, // Light DOM content comes first
    render:
      adapterRenderer ??
      ((target: HTMLElement) => {
        // Move all children from the light DOM container to the target
        while (toolButtonsContainer.firstChild) {
          target.appendChild(toolButtonsContainer.firstChild);
        }
        // Return cleanup that moves children back to original container
        // This preserves them across full re-renders that destroy the slot
        return () => {
          while (target.firstChild) {
            toolButtonsContainer.appendChild(target.firstChild);
          }
        };
      }),
  };

  state.toolbarContents.set(id, contentDef);
  state.lightDomToolbarContentIds.add(id);

  // Hide the original container
  toolButtonsContainer.style.display = 'none';
}

/**
 * Callback type for creating a tool panel renderer from a light DOM element.
 * This is used by framework adapters (Angular, React, etc.) to create renderers
 * from their template syntax.
 */
export type ToolPanelRendererFactory = (
  element: HTMLElement,
) => ((container: HTMLElement) => void | (() => void)) | undefined;

/**
 * Parse light DOM tool panel elements (<tbw-grid-tool-panel>).
 * These can appear as direct children of <tbw-grid> for declarative tool panel configuration.
 *
 * Attributes:
 * - `id` (required): Unique panel identifier
 * - `title` (required): Panel title shown in accordion header
 * - `icon`: Icon for accordion section header (emoji or text)
 * - `tooltip`: Tooltip for accordion section header
 * - `order`: Panel order priority (lower = first, default: 100)
 *
 * For vanilla JS, the element's innerHTML is used as the panel content.
 * For framework adapters, the adapter can provide a custom renderer factory.
 *
 * @param host - The grid host element
 * @param state - Shell state to update
 * @param rendererFactory - Optional factory for creating renderers (used by framework adapters)
 */
export function parseLightDomToolPanels(
  host: HTMLElement,
  state: ShellState,
  rendererFactory?: ToolPanelRendererFactory,
): void {
  const toolPanelElements = host.querySelectorAll(':scope > tbw-grid-tool-panel');

  toolPanelElements.forEach((element) => {
    const panelEl = element as HTMLElement;
    const id = panelEl.getAttribute('id');
    const title = panelEl.getAttribute('title');

    // Skip if required attributes are missing
    if (!id || !title) {
      warnDiagnostic(
        TOOL_PANEL_MISSING_ATTR,
        `Tool panel missing required id or title attribute: id="${id ?? ''}", title="${title ?? ''}"`,
      );
      return;
    }

    const icon = panelEl.getAttribute('icon') ?? undefined;
    const tooltip = panelEl.getAttribute('tooltip') ?? undefined;
    const order = parseInt(panelEl.getAttribute('order') ?? '100', 10);

    // Try framework adapter first, then fall back to innerHTML
    let render: (container: HTMLElement) => void | (() => void);

    const adapterRenderer = rendererFactory?.(panelEl);
    if (adapterRenderer) {
      render = adapterRenderer;
    } else {
      // Vanilla fallback: use sanitized innerHTML as static content.
      // Light DOM authored markup is generally trusted, but we sanitize
      // defensively in case the panel content was server-rendered from data.
      const content = sanitizeHTML(panelEl.innerHTML.trim());
      render = (container: HTMLElement) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = content;
        container.appendChild(wrapper);
        return () => wrapper.remove();
      };
    }

    // Check if panel was already parsed
    const existingPanel = state.toolPanels.get(id);

    // Precedence (#370): a panel contributed by a plugin (or registered via the
    // grid API) owns its id. A light-DOM <tbw-grid-tool-panel> with the same id
    // is ignored so the owner can rely on its own DOM existing. We detect a
    // foreign owner by the id being present in toolPanels but NOT tracked as a
    // light-DOM id (which would mean this is just a re-parse of our own panel).
    if (existingPanel && !state.lightDomToolPanelIds.has(id)) {
      warnDiagnostic(
        TOOL_PANEL_DUPLICATE,
        `Tool panel "${id}" is already provided by a plugin or the grid API; ignoring the matching light-DOM <tbw-grid-tool-panel>.`,
      );
      panelEl.style.display = 'none';
      return;
    }

    // If already parsed and we have an adapter renderer, refresh the render
    // function and (potentially) re-read attributes from DOM (Angular may have
    // updated them after the initial parse). However, **only tear down the
    // already-rendered panel content** when something the user can observe has
    // actually changed:
    //   - First time the adapter renderer attaches (we may have been using
    //     the vanilla innerHTML fallback up to now)
    //   - Any attribute the panel header renders from changed
    //
    // Otherwise the user's React/Vue/Angular component is already mounted in
    // the panel and is happily managing its own state. A teardown here unmounts
    // it (losing local state) and re-mounts it on next renderPanelContent —
    // which, for a scrollable panel, resets `scrollTop` to 0. This was the
    // cause of the "tool panel scroll jumps to top on column visibility toggle"
    // bug: every `grid.gridConfig = …` setter in the adapter eventually calls
    // back into parseLightDomToolPanels (via #applyGridConfigUpdate), and the
    // previous unconditional `cleanup()` here threw away the user's component
    // tree on every config sync.
    if (existingPanel) {
      if (adapterRenderer) {
        const firstAdapterAttach = !state.adapterBoundToolPanelIds.has(id);
        const attrsChanged =
          existingPanel.order !== order || existingPanel.icon !== icon || existingPanel.tooltip !== tooltip;

        // Always keep the render function fresh — adapter renderers capture
        // the current grid element / portal context and the most recent
        // children, so a stale reference would render against an old closure.
        existingPanel.render = render;
        existingPanel.order = order;
        existingPanel.icon = icon;
        existingPanel.tooltip = tooltip;
        state.adapterBoundToolPanelIds.add(id);

        if (firstAdapterAttach || attrsChanged) {
          const cleanup = state.panelCleanups.get(id);
          if (cleanup) {
            cleanup();
            state.panelCleanups.delete(id);
          }
        }
      }
      return;
    }

    // Register the tool panel
    const panel: ToolPanelDefinition = {
      id,
      title,
      icon,
      tooltip,
      order,
      render,
    };

    state.toolPanels.set(id, panel);
    state.lightDomToolPanelIds.add(id);
    if (adapterRenderer) {
      state.adapterBoundToolPanelIds.add(id);
    }

    // Hide the light DOM element
    panelEl.style.display = 'none';
  });
}
// #endregion

// #region Event Handlers
/**
 * Set up event listeners for shell toolbar buttons and accordion.
 */
export function setupShellEventListeners(
  renderRoot: Element,
  config: ShellConfig | undefined,
  state: ShellState,
  callbacks: {
    onPanelToggle: () => void;
    onSectionToggle: (sectionId: string) => void;
    /** Invoked when the in-panel close (✕) button is clicked. */
    onPanelClose?: () => void;
  },
): void {
  const toolbar = renderRoot.querySelector('.tbw-shell-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle single panel toggle button
      const panelToggle = target.closest('[data-panel-toggle]') as HTMLElement | null;
      if (panelToggle) {
        callbacks.onPanelToggle();
        return;
      }
    });
  }

  // In-panel close (✕) button — only present when the header bar is hidden.
  const panel = renderRoot.querySelector('.tbw-tool-panel');
  if (panel && callbacks.onPanelClose) {
    panel.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-panel-close]')) {
        callbacks.onPanelClose!();
      }
    });
  }

  // Accordion header clicks
  const accordion = renderRoot.querySelector('.tbw-accordion');
  if (accordion) {
    accordion.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const header = target.closest('.tbw-accordion-header') as HTMLElement | null;
      if (header) {
        const section = header.closest('[data-section]') as HTMLElement | null;
        const sectionId = section?.getAttribute('data-section');
        if (sectionId) {
          callbacks.onSectionToggle(sectionId);
        }
      }
    });
  }
}

/**
 * Whether `node` belongs to `gridElement` — directly (light DOM) or via the
 * grid's shadow root (the node's root-node host is the grid). Used to scope
 * click-outside checks so one grid's listener never treats another grid's
 * toggle or panel as "inside" itself.
 */
function isInGrid(node: Node, gridElement: Element): boolean {
  if (gridElement.contains(node)) return true;
  const root = node.getRootNode();
  return root instanceof ShadowRoot && root.host === gridElement;
}

/**
 * Set up a click-outside listener that closes the tool panel when the user
 * clicks anywhere in the document outside the tool panel itself.
 *
 * Only active when `config.toolPanel.closeOnClickOutside` is `true` AND the
 * panel is open. The listener is added on `document` `mousedown` (not `click`)
 * so it fires before focus changes and catches clicks anywhere in the window —
 * including outside the grid. Uses `composedPath()` so clicks inside the
 * grid's shadow DOM are correctly attributed (shadow-retargeted `event.target`
 * would otherwise always be the host element).
 *
 * @returns A cleanup function that removes the listener.
 */
export function setupClickOutsideDismiss(
  gridElement: Element,
  config: ShellConfig | undefined,
  state: ShellState,
  onClose: () => void,
): () => void {
  const mode = config?.toolPanel?.mode;

  // Dropdown popovers always light-dismiss on outside click (standard dropdown
  // behavior), regardless of the `closeOnClickOutside` flag. Other modes only
  // dismiss when the consumer opts in.
  if (mode !== 'dropdown' && !config?.toolPanel?.closeOnClickOutside) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  // In push mode the panel does not overlap grid content, so there is
  // no meaningful "outside" to click against. Treat the option as a no-op.
  if (mode === 'push') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  const handler = (e: Event) => {
    if (!state.isPanelOpen) return;

    // Ignore clicks inside the tool panel itself, on the toggle button, or on
    // the dropdown's resolved anchor element (so a consumer's BYO trigger can
    // toggle without the outside-click handler racing the button's own click).
    // composedPath() pierces shadow boundaries so this works for both the
    // light-DOM toggle and the shadow-DOM panel.
    //
    // CRITICAL: the panel/toggle match MUST be scoped to THIS grid via
    // `isInGrid`. With multiple grids on one page, a click on another grid's
    // toggle/panel is an "outside" click for us and must still dismiss \u2014
    // otherwise opening a dropdown in grid B leaves grid A's dropdown stuck
    // open (#375 follow-up).
    const anchorEl = state.dropdownAnchorEl;
    for (const node of e.composedPath()) {
      if (anchorEl != null && node === anchorEl) return;
      if (
        node instanceof Element &&
        (node.classList?.contains('tbw-tool-panel') || node.matches?.('[data-panel-toggle]')) &&
        isInGrid(node, gridElement)
      ) {
        return;
      }
    }

    onClose();
  };

  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}

/**
 * Set up an Escape-key listener that closes an open overlay tool panel.
 *
 * Active only in `overlay` mode (a push panel is a persistent sidebar, not a
 * transient overlay, so Esc does not dismiss it — the in-panel close button is
 * the affordance there). Yields to more specific handlers: if another listener
 * already called `preventDefault()` on the keydown (e.g. an active cell editor
 * cancelling an edit), the panel is left open.
 *
 * @returns A cleanup function that removes the listener.
 */
export function setupEscapeDismiss(
  config: ShellConfig | undefined,
  state: ShellState,
  onClose: () => void,
): () => void {
  // Push panels are persistent — Esc only dismisses overlay panels.
  if (config?.toolPanel?.mode === 'push') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (!state.isPanelOpen) return;
    onClose();
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

/**
 * Set up resize handle for tool panel.
 * Returns a cleanup function to remove event listeners.
 */
export function setupToolPanelResize(
  renderRoot: Element,
  config: ShellConfig | undefined,
  onResize: (width: number) => void,
): () => void {
  const panel = renderRoot.querySelector('.tbw-tool-panel') as HTMLElement | null;
  const handle = renderRoot.querySelector('[data-resize-handle]') as HTMLElement | null;
  const shellBody = renderRoot.querySelector('.tbw-shell-body') as HTMLElement | null;
  if (!panel || !handle || !shellBody) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  const position = config?.toolPanel?.position ?? 'right';
  const minWidth = 200;

  let startX = 0;
  let startWidth = 0;
  let maxWidth = 0;
  let isResizing = false;

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    e.preventDefault();

    // For right-positioned panel: dragging left (negative clientX change) should expand
    // For left-positioned panel: dragging right (positive clientX change) should expand
    const delta = position === 'left' ? e.clientX - startX : startX - e.clientX;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));

    panel.style.width = `${newWidth}px`;
  };

  const onMouseUp = () => {
    if (!isResizing) return;
    isResizing = false;
    handle.classList.remove('resizing');
    panel.style.transition = ''; // Re-enable transition
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Get final width and notify
    const finalWidth = panel.getBoundingClientRect().width;
    onResize(finalWidth);

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = panel.getBoundingClientRect().width;
    // Calculate max width dynamically based on grid container width
    maxWidth = shellBody.getBoundingClientRect().width - 20; // Leave 20px margin
    handle.classList.add('resizing');
    panel.style.transition = 'none'; // Disable transition for smooth resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', onMouseDown);

  // Return cleanup function
  return () => {
    handle.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}
// #endregion

// #region Content Rendering
/**
 * Render toolbar content (render functions) into toolbar slots.
 * All contents (config + API + light DOM) are now unified.
 */
export function renderCustomToolbarContents(
  renderRoot: Element,
  config: ShellConfig | undefined,
  state: ShellState,
): void {
  // Merge config contents with state contents (same logic as renderShellHeader)
  const configContents = config?.header?.toolbarContents ?? [];
  const stateContents = [...state.toolbarContents.values()];
  const configIds = new Set(configContents.map((c) => c.id));
  const allContents = [...configContents];
  for (const content of stateContents) {
    if (!configIds.has(content.id)) {
      allContents.push(content);
    }
  }

  // Only process contents that need rendering (have render and cleanup not already set)
  for (const content of allContents) {
    // Skip if already rendered (cleanup exists)
    if (state.toolbarContentCleanups.has(content.id)) continue;
    if (!content.render) continue;

    const slot = renderRoot.querySelector(`[data-toolbar-content="${content.id}"]`);
    if (!slot) continue;

    const cleanup = content.render(slot as HTMLElement);
    if (cleanup) {
      state.toolbarContentCleanups.set(content.id, cleanup);
    }
  }
}

/**
 * Render header content from plugins into the shell content area.
 * Also moves light DOM header content to the placeholder (once).
 */
export function renderHeaderContent(renderRoot: Element, state: ShellState): void {
  // Early exit if nothing to do (most common path after initial render)
  const hasLightDomContent = state.lightDomHeaderContent.length > 0 && !state.lightDomContentMoved;
  const hasPluginContent = state.headerContents.size > 0;
  if (!hasLightDomContent && !hasPluginContent) return;

  const contentArea = renderRoot.querySelector('.tbw-shell-content');
  if (!contentArea) return;

  // Move light DOM header content to placeholder - only once (perf optimization)
  if (hasLightDomContent) {
    for (const el of state.lightDomHeaderContent) {
      el.style.display = ''; // Show it (was hidden in the original container)
      contentArea.appendChild(el);
    }
    state.lightDomContentMoved = true;
  }

  // Sort by order
  const sortedContents = [...state.headerContents.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  for (const content of sortedContents) {
    // Clean up previous render if any
    const existingCleanup = state.headerContentCleanups.get(content.id);
    if (existingCleanup) {
      existingCleanup();
      state.headerContentCleanups.delete(content.id);
    }

    // Check if container already exists
    let container = contentArea.querySelector(`[data-header-content="${content.id}"]`) as HTMLElement | null;
    if (!container) {
      container = document.createElement('div');
      container.setAttribute('data-header-content', content.id);
      contentArea.appendChild(container);
    }

    const cleanup = content.render(container);
    if (cleanup) {
      state.headerContentCleanups.set(content.id, cleanup);
    }
  }
}

/**
 * Render content for expanded accordion sections.
 * @param icons - Optional icons for expand/collapse chevrons (from grid config)
 */
export function renderPanelContent(
  renderRoot: Element,
  state: ShellState,
  _icons?: { expand?: IconValue; collapse?: IconValue },
): void {
  if (!state.isPanelOpen) return;

  for (const [panelId, panel] of state.toolPanels) {
    const isExpanded = state.expandedSections.has(panelId);
    const section = renderRoot.querySelector(`[data-section="${panelId}"]`);
    const contentArea = section?.querySelector('.tbw-accordion-content') as HTMLElement | null;

    if (!section || !contentArea) continue;

    // Update expanded state
    section.classList.toggle('expanded', isExpanded);
    const header = section.querySelector('.tbw-accordion-header');
    if (header) {
      header.setAttribute('aria-expanded', String(isExpanded));
    }
    // Don't swap chevron icon — CSS rotation handles expanded/collapsed state

    if (isExpanded) {
      // Check if content is already rendered
      if (contentArea.children.length === 0) {
        // Render panel content
        const cleanup = panel.render(contentArea);
        if (cleanup) {
          state.panelCleanups.set(panelId, cleanup);
        }
      }
    } else {
      // Clean up and clear content when collapsed
      const cleanup = state.panelCleanups.get(panelId);
      if (cleanup) {
        cleanup();
        state.panelCleanups.delete(panelId);
      }
      contentArea.innerHTML = '';
    }
  }
}

/**
 * Update toolbar button active states.
 */
export function updateToolbarActiveStates(renderRoot: Element, state: ShellState): void {
  // Update single panel toggle button
  const panelToggle = renderRoot.querySelector('[data-panel-toggle]');
  if (panelToggle) {
    panelToggle.classList.toggle('active', state.isPanelOpen);
    panelToggle.setAttribute('aria-pressed', String(state.isPanelOpen));
  }
}

/**
 * Update tool panel open/close state.
 */
export function updatePanelState(renderRoot: Element, state: ShellState): void {
  const panel = renderRoot.querySelector('.tbw-tool-panel') as HTMLElement | null;
  if (!panel) return;

  panel.classList.toggle('open', state.isPanelOpen);

  // Clear inline width when closing (resize sets inline style that overrides CSS)
  if (!state.isPanelOpen) {
    panel.style.width = '';
  }
}

/** Base CSS anchor name used to feature-detect CSS anchor positioning support. */
const DROPDOWN_ANCHOR_NAME = '--tbw-tool-panel-anchor';

/**
 * Monotonic counter for minting unique per-grid dropdown anchor names. A shared
 * constant name collides when two grids on the same page each open a dropdown,
 * pairing one grid's popover with the other grid's trigger (#375 follow-up).
 */
let dropdownAnchorSeq = 0;

/** Whether the current environment supports CSS anchor positioning. */
export function supportsAnchorPositioning(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('anchor-name', DROPDOWN_ANCHOR_NAME)
  );
}

/**
 * Position the dropdown popover with fixed coordinates derived from the
 * anchor's bounding rect. Used only when CSS anchor positioning is
 * unsupported; otherwise placement is driven entirely by `shell.css`.
 */
function positionDropdownFallback(panel: HTMLElement, anchorEl: HTMLElement, corner: boolean): void {
  const rect = anchorEl.getBoundingClientRect();
  const position = panel.getAttribute('data-position') ?? 'right';
  panel.style.position = 'fixed';
  // `corner` anchors to the top of the grid (top corner); otherwise drop below
  // the trigger button.
  panel.style.top = `${Math.round((corner ? rect.top : rect.bottom) + 4)}px`;
  if (position === 'left') {
    panel.style.left = `${Math.round(rect.left)}px`;
    panel.style.right = 'auto';
  } else {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    panel.style.left = 'auto';
    panel.style.right = `${Math.round(viewportWidth - rect.right)}px`;
  }
}

/**
 * Show the tool panel as an anchored dropdown popover (`mode: 'dropdown'`).
 *
 * Reuses the existing `.tbw-tool-panel` aside (the full accordion) and shows it
 * in the top layer via the native Popover API. Placement is handled by CSS
 * anchor positioning when supported, with a JS bounding-rect fallback otherwise.
 *
 * @param anchorEl - Element the popover anchors to.
 * @param corner - When `true`, anchor to the top corner of `anchorEl` (grid
 *   corner fallback); otherwise drop directly below it (toggle / custom button).
 */
export function showToolPanelDropdown(
  renderRoot: Element,
  state: ShellState,
  anchorEl: HTMLElement,
  corner: boolean,
): void {
  const panel = renderRoot.querySelector('.tbw-tool-panel') as (HTMLElement & { showPopover?: () => void }) | null;
  if (!panel) return;

  state.dropdownAnchorEl = anchorEl;
  panel.dataset.anchor = corner ? 'corner' : 'below';

  // Show in the top layer. Guard for environments (older browsers / test DOM)
  // without the native Popover API.
  if (panel.hasAttribute('popover') && typeof panel.showPopover === 'function') {
    try {
      panel.showPopover();
    } catch {
      // Already open or not connected — ignore.
    }
  }

  if (supportsAnchorPositioning()) {
    // CSS drives placement; just wire up the anchor-name pairing. Mint a unique
    // name per show so multiple grids (or repeated opens) on one page never
    // collide on a shared anchor name — a collision positions this popover
    // against another grid's trigger instead of its own.
    const anchorName = `${DROPDOWN_ANCHOR_NAME}-${++dropdownAnchorSeq}`;
    state.dropdownAnchorName = anchorName;
    anchorEl.style.setProperty('anchor-name', anchorName);
    panel.style.setProperty('position-anchor', anchorName);
    panel.style.removeProperty('top');
    panel.style.removeProperty('left');
    panel.style.removeProperty('right');
  } else {
    positionDropdownFallback(panel, anchorEl, corner);
  }
}

/**
 * Hide the dropdown popover and clear all anchor wiring set by
 * {@link showToolPanelDropdown}.
 */
export function hideToolPanelDropdown(renderRoot: Element, state: ShellState): void {
  const panel = renderRoot.querySelector('.tbw-tool-panel') as (HTMLElement & { hidePopover?: () => void }) | null;
  if (panel) {
    if (panel.hasAttribute('popover') && typeof panel.hidePopover === 'function') {
      try {
        panel.hidePopover();
      } catch {
        // Not currently open — ignore.
      }
    }
    panel.style.removeProperty('position-anchor');
    panel.style.removeProperty('position');
    panel.style.removeProperty('top');
    panel.style.removeProperty('left');
    panel.style.removeProperty('right');
    delete panel.dataset.anchor;
  }
  if (state.dropdownAnchorEl) {
    state.dropdownAnchorEl.style.removeProperty('anchor-name');
    state.dropdownAnchorEl = null;
  }
  state.dropdownAnchorName = null;
}

/**
 * Re-pair an OPEN dropdown's existing anchor onto a freshly resolved trigger
 * IN PLACE — reusing the already-minted `anchor-name` and leaving the popover
 * shown — instead of hiding and re-showing it.
 *
 * WHY: when an outer framework (e.g. a React column `headerRenderer`) recreates
 * the `[data-panel-toggle]` trigger on a column toggle, the new node lacks the
 * `anchor-name`, so the popover's `position-anchor` no longer resolves and the
 * browser drops it to the corner. Hiding + re-showing (the heavier
 * {@link showToolPanelDropdown} path) mints a NEW name and re-enters the
 * Popover API, which flashes the popover to the corner for a frame. Moving the
 * SAME name to the new node keeps the popover visually anchored with no flash.
 *
 * Returns `true` when the re-pair was applied. The caller must ensure CSS
 * anchor positioning is supported (see {@link supportsAnchorPositioning});
 * otherwise the fixed-coordinate fallback in {@link showToolPanelDropdown} must
 * be used instead.
 */
export function repairDropdownAnchor(renderRoot: Element, state: ShellState, trigger: HTMLElement): boolean {
  const anchorName = state.dropdownAnchorName;
  if (!anchorName) return false;
  const panel = renderRoot.querySelector('.tbw-tool-panel') as (HTMLElement & { showPopover?: () => void }) | null;
  if (!panel) return false;
  const prev = state.dropdownAnchorEl;
  if (prev && prev !== trigger) prev.style.removeProperty('anchor-name');
  trigger.style.setProperty('anchor-name', anchorName);
  panel.style.setProperty('position-anchor', anchorName);
  panel.style.removeProperty('top');
  panel.style.removeProperty('left');
  panel.style.removeProperty('right');
  panel.dataset.anchor = 'below';
  state.dropdownAnchorEl = trigger;
  // A structural rebuild (`rebuildShellDOM`) creates a FRESH `.tbw-tool-panel`
  // that is not in the top layer — only its `.open` class arm renders it, which
  // can be clipped / mis-stacked. Re-assert the popover idempotently so both the
  // non-structural path (panel already open → no-op via the catch) and the
  // structural-rebuild path (fresh panel → shown) end up in the top layer.
  if (panel.hasAttribute('popover') && typeof panel.showPopover === 'function') {
    try {
      panel.showPopover();
    } catch {
      // Already open or not connected — ignore.
    }
  }
  return true;
}

/**
 * Prepare shell state for a full re-render.
 * Runs cleanup functions so content (toolbar buttons, panels, headers)
 * can be restored to their original containers and re-rendered into new DOM.
 */
export function prepareForRerender(state: ShellState): void {
  // Run cleanups for toolbar contents (moves elements back to original containers)
  for (const cleanup of state.toolbarContentCleanups.values()) {
    cleanup();
  }
  state.toolbarContentCleanups.clear();

  // Run cleanups for panel contents (old DOM will be destroyed)
  for (const cleanup of state.panelCleanups.values()) {
    cleanup();
  }
  state.panelCleanups.clear();

  // Run cleanups for header contents (old DOM will be destroyed)
  for (const cleanup of state.headerContentCleanups.values()) {
    cleanup();
  }
  state.headerContentCleanups.clear();

  // Allow light DOM content to be re-moved into new DOM
  state.lightDomContentMoved = false;
}

/**
 * Cleanup all shell state when grid disconnects.
 */
export function cleanupShellState(state: ShellState): void {
  // Clean up header content
  for (const cleanup of state.headerContentCleanups.values()) {
    cleanup();
  }
  state.headerContentCleanups.clear();

  // Clean up panel content
  for (const cleanup of state.panelCleanups.values()) {
    cleanup();
  }
  state.panelCleanups.clear();

  // Clean up toolbar contents
  for (const cleanup of state.toolbarContentCleanups.values()) {
    cleanup();
  }
  state.toolbarContentCleanups.clear();

  // Call onDestroy for all toolbar contents
  for (const content of state.toolbarContents.values()) {
    content.onDestroy?.();
  }

  // Invoke onClose for all open panels
  if (state.isPanelOpen) {
    for (const sectionId of state.expandedSections) {
      const panel = state.toolPanels.get(sectionId);
      panel?.onClose?.();
    }
  }

  // Reset panel state
  state.isPanelOpen = false;
  state.expandedSections.clear();

  // Clear registrations
  state.toolPanels.clear();
  state.headerContents.clear();
  state.toolbarContents.clear();
  state.lightDomHeaderContent = [];

  // Clear light DOM tracking sets (allow re-parsing)
  state.lightDomToolPanelIds.clear();
  state.adapterBoundToolPanelIds.clear();
  state.lightDomToolbarContentIds.clear();

  // Reset move tracking flag (allow re-initialization)
  state.lightDomContentMoved = false;
}
// #endregion

// #region DOM Construction
import { GridClasses } from '../../core/constants';
import {
  buildGridDOM,
  buildShellBody,
  buildShellHeader,
  type ShellBodyOptions,
  type ShellHeaderOptions,
} from '../../core/internal/dom-builder';

/**
 * Build ShellHeaderOptions and ShellBodyOptions from shell config and runtime state.
 * Shared by buildGridDOMIntoElement and rebuildShellDOM to avoid duplication.
 */
function buildShellOptions(
  shellConfig: ShellConfig,
  runtimeState: { isPanelOpen: boolean; expandedSections: Set<string> },
  icons?: { toolPanel?: IconValue; expand?: IconValue; collapse?: IconValue },
): { headerOptions: ShellHeaderOptions; bodyOptions: ShellBodyOptions } {
  const toolPanelIcon = icons?.toolPanel !== undefined ? iconToString(icons.toolPanel) : undefined;
  const expandIcon = icons?.expand !== undefined ? iconToString(icons.expand) : undefined;
  const collapseIcon = icons?.collapse !== undefined ? iconToString(icons.collapse) : undefined;

  const allContents = shellConfig.header?.toolbarContents ?? [];
  const sortedContents = [...allContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const allPanels = shellConfig.toolPanels ?? [];
  const sortedPanels = [...allPanels].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  return {
    headerOptions: {
      title: shellConfig.header?.title ?? undefined,
      hasPanels: sortedPanels.length > 0,
      isPanelOpen: runtimeState.isPanelOpen,
      toolPanelIcon,
      showToggle: shellConfig.header?.toolPanelToggle !== false && shellConfig.toolPanel?.locked !== true,
      configButtons: sortedContents.map((c) => ({
        id: c.id,
        hasElement: false,
        hasRender: !!c.render,
      })),
      apiButtons: [],
    },
    bodyOptions: {
      position: shellConfig.toolPanel?.position ?? 'right',
      mode: shellConfig.toolPanel?.mode ?? 'overlay',
      isPanelOpen: runtimeState.isPanelOpen,
      expandIcon,
      collapseIcon,
      // Render an in-panel close (✕) button when the header bar is hidden, so
      // the panel can be dismissed without the (absent) built-in toggle. A
      // locked panel cannot be closed, so no button in that case. Dropdown mode
      // is excluded: the popover light-dismisses on Esc / click-outside, so a
      // ✕ would be redundant clutter.
      showCloseButton:
        shellConfig.header?.visible === false &&
        shellConfig.toolPanel?.locked !== true &&
        (shellConfig.toolPanel?.mode ?? 'overlay') !== 'dropdown',
      panels: sortedPanels.map((p) => ({
        id: p.id,
        title: p.title,
        icon: iconToString(p.icon),
        isExpanded: runtimeState.expandedSections.has(p.id),
      })),
    },
  };
}

/**
 * Build the complete grid DOM structure using direct DOM construction.
 * This is 2-3x faster than innerHTML for initial render.
 *
 * @param renderRoot - The element to render into (will be cleared)
 * @param shellConfig - Shell configuration
 * @param runtimeState - Runtime shell state
 * @param icons - Optional icons
 * @returns Whether shell is active (for post-render setup)
 */
export function buildGridDOMIntoElement(
  renderRoot: Element,
  shellConfig: ShellConfig | undefined,
  runtimeState: { isPanelOpen: boolean; expandedSections: Set<string> },
  icons?: { toolPanel?: IconValue; expand?: IconValue; collapse?: IconValue },
): boolean {
  const hasShell = shouldRenderShellHeader(shellConfig);

  // Preserve all direct child nodes EXCEPT the grid's own `.tbw-grid-root`
  // (which we are about to rebuild). This keeps user/framework light-DOM
  // intact in its original order — including non-element nodes like comment
  // anchors that Angular's `@if`/`@for` and other structural directives use
  // as positional markers. Filtering by element-tag selectors would discard
  // those anchors and break re-renders of the conditional content.
  const preservedNodes: Node[] = [];
  for (let n: Node | null = renderRoot.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).classList.contains(GridClasses.ROOT)) continue;
    preservedNodes.push(n);
  }

  // Clear existing content (this would delete light DOM nodes, so we preserved them first)
  renderRoot.replaceChildren();

  // Re-append preserved nodes in original order (hidden elements are used for config).
  // IMPORTANT: These are prepended before .tbw-grid-root, so `renderRoot.children[0]`
  // is NOT the grid root. Use `querySelector('.tbw-grid-root')` instead.
  for (const n of preservedNodes) {
    renderRoot.appendChild(n);
  }

  if (hasShell) {
    const { headerOptions, bodyOptions } = buildShellOptions(shellConfig!, runtimeState, icons);
    const shellHeader = shouldRenderHeaderBar(shellConfig) ? buildShellHeader(headerOptions) : undefined;
    const shellBody = buildShellBody(bodyOptions);

    const fragment = buildGridDOM({
      hasShell: true,
      shellHeader,
      shellBody,
    });
    renderRoot.appendChild(fragment);
  } else {
    const fragment = buildGridDOM({ hasShell: false });
    renderRoot.appendChild(fragment);
  }

  return hasShell;
}

/**
 * Surgically rebuild only the shell wrapper (header + tool panel) while
 * preserving the existing `.tbw-grid-root` element and its `.tbw-grid-content`
 * child with all descendants and event listeners intact.
 *
 * This avoids the full `replaceChildren()` nuke that `buildGridDOMIntoElement`
 * performs, so event listeners bound to `.tbw-grid-root` or its grid content
 * descendants (e.g. tooltip's delegated mouseover) remain intact.
 *
 * If no existing `.tbw-grid-root` is found (first render), falls back to
 * `buildGridDOMIntoElement` for a full rebuild.
 */
export function rebuildShellDOM(
  renderRoot: Element,
  shellConfig: ShellConfig | undefined,
  runtimeState: { isPanelOpen: boolean; expandedSections: Set<string> },
  icons?: { toolPanel?: IconValue; expand?: IconValue; collapse?: IconValue },
): boolean {
  // Find the existing grid root and content to preserve
  const existingRoot = renderRoot.querySelector(`.${GridClasses.ROOT}`) as HTMLElement | null;
  const existingContent = existingRoot?.querySelector('.tbw-grid-content');

  // If there's no existing root, fall back to full rebuild (first render)
  if (!existingRoot || !existingContent) {
    return buildGridDOMIntoElement(renderRoot, shellConfig, runtimeState, icons);
  }

  // Detach grid content so it survives the child replacement
  existingContent.remove();

  const hasShell = shouldRenderShellHeader(shellConfig);

  // Clear the root's children (shell header, shell body, etc.) but keep the root element itself
  existingRoot.replaceChildren();

  if (hasShell) {
    existingRoot.className = `${GridClasses.ROOT} has-shell`;

    const { headerOptions, bodyOptions } = buildShellOptions(shellConfig!, runtimeState, icons);
    const shellHeader = shouldRenderHeaderBar(shellConfig) ? buildShellHeader(headerOptions) : undefined;
    const shellBody = buildShellBody(bodyOptions);

    // Replace the freshly cloned grid content with the preserved one
    const freshContent = shellBody.querySelector('.tbw-grid-content');
    if (freshContent) {
      freshContent.replaceWith(existingContent);
    }

    if (shellHeader) existingRoot.appendChild(shellHeader);
    existingRoot.appendChild(shellBody);
  } else {
    // No shell — place content directly in root
    existingRoot.className = GridClasses.ROOT;
    existingRoot.appendChild(existingContent);
  }

  return hasShell;
}
// #endregion
