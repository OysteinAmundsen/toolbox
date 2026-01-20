/**
 * Shell infrastructure for grid header bar and tool panels.
 *
 * The shell is an optional wrapper layer that provides:
 * - Header bar with title, plugin content, and toolbar buttons
 * - Tool panels that plugins can register content into
 * - Light DOM parsing for framework-friendly configuration
 */

import type {
  HeaderContentDefinition,
  IconValue,
  ShellConfig,
  ToolbarContentDefinition,
  ToolPanelDefinition,
} from '../types';
import { DEFAULT_GRID_ICONS } from '../types';
import { escapeHtml } from './sanitize';

/**
 * Convert an IconValue to a string for rendering in HTML.
 */
function iconToString(icon: IconValue | undefined): string {
  if (!icon) return '';
  if (typeof icon === 'string') return icon;
  // For HTMLElement, get the outerHTML
  return icon.outerHTML;
}

/**
 * State for managing shell UI.
 *
 * NOTE: This interface is being refactored. Config-like properties are moving
 * to effectiveConfig.shell. Only runtime state should remain here.
 *
 * @deprecated Properties that are configuration (toolPanels, headerContents, etc.)
 * are moving to ShellConfig in types.ts. Use ShellRuntimeState for new code.
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
  /** IDs of toolbar content registered from light DOM (to avoid re-parsing) */
  lightDomToolbarContentIds: Set<string>;
  /** IDs of tool panels registered via registerToolPanel API */
  apiToolPanelIds: Set<string>;
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
}

/**
 * Runtime-only shell state (not configuration).
 *
 * Configuration (toolPanels, headerContents, toolbarContents, title) lives in
 * effectiveConfig.shell. This state holds runtime UI state and cleanup functions.
 */
export interface ShellRuntimeState {
  /** Whether the tool panel sidebar is currently open */
  isPanelOpen: boolean;
  /** Which accordion sections are currently expanded (by panel ID) */
  expandedSections: Set<string>;
  /** Cleanup functions for header content render returns */
  headerContentCleanups: Map<string, () => void>;
  /** Cleanup functions for each panel section's render return */
  panelCleanups: Map<string, () => void>;
  /** Cleanup functions for toolbar content render returns */
  toolbarContentCleanups: Map<string, () => void>;
  /** IDs of tool panels registered from light DOM (to avoid re-parsing) */
  lightDomToolPanelIds: Set<string>;
  /** IDs of tool panels registered via registerToolPanel API */
  apiToolPanelIds: Set<string>;
  /** Whether a <tbw-grid-tool-buttons> container was found in light DOM */
  hasToolButtonsContainer: boolean;
}

/**
 * Create initial shell runtime state.
 */
export function createShellRuntimeState(): ShellRuntimeState {
  return {
    isPanelOpen: false,
    expandedSections: new Set(),
    headerContentCleanups: new Map(),
    panelCleanups: new Map(),
    toolbarContentCleanups: new Map(),
    lightDomToolPanelIds: new Set(),
    apiToolPanelIds: new Set(),
    hasToolButtonsContainer: false,
  };
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
    lightDomToolbarContentIds: new Set(),
    apiToolPanelIds: new Set(),
    isPanelOpen: false,
    expandedSections: new Set(),
    headerContentCleanups: new Map(),
    panelCleanups: new Map(),
    toolbarContentCleanups: new Map(),
    lightDomContentMoved: false,
  };
}

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
  toolPanelIcon: IconValue = '☰',
): string {
  const title = config?.header?.title ?? state.lightDomTitle ?? '';
  const hasTitle = !!title;
  const iconStr = iconToString(toolPanelIcon);

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
  const showSeparator = hasCustomContent && hasPanels;

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

  // Single panel toggle button (the ONLY button the grid creates)
  if (hasPanels) {
    const isOpen = state.isPanelOpen;
    const toggleClass = isOpen ? 'tbw-toolbar-btn active' : 'tbw-toolbar-btn';
    toolbarHtml += `<button class="${toggleClass}" data-panel-toggle title="Settings" aria-label="Toggle settings panel" aria-pressed="${isOpen}" aria-controls="tbw-tool-panel">${iconStr}</button>`;
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
  const hasPanel = state.toolPanels.size > 0;
  const isOpen = state.isPanelOpen;
  const expandIcon = iconToString(icons?.expand ?? DEFAULT_GRID_ICONS.expand);
  const collapseIcon = iconToString(icons?.collapse ?? DEFAULT_GRID_ICONS.collapse);

  // Sort panels by order for accordion sections
  const sortedPanels = [...state.toolPanels.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  const isSinglePanel = sortedPanels.length === 1;

  // Build accordion sections HTML
  let accordionHtml = '';
  for (const panel of sortedPanels) {
    const isExpanded = state.expandedSections.has(panel.id);
    const iconHtml = panel.icon ? `<span class="tbw-accordion-icon">${panel.icon}</span>` : '';
    // Hide chevron for single panel (no toggling needed)
    const chevronHtml = isSinglePanel
      ? ''
      : `<span class="tbw-accordion-chevron">${isExpanded ? collapseIcon : expandIcon}</span>`;
    // Disable accordion toggle for single panel
    const sectionClasses = `tbw-accordion-section${isExpanded ? ' expanded' : ''}${isSinglePanel ? ' single' : ''}`;
    accordionHtml += `
      <div class="${sectionClasses}" data-section="${panel.id}">
        <button class="tbw-accordion-header" aria-expanded="${isExpanded}" aria-controls="tbw-section-${panel.id}"${isSinglePanel ? ' aria-disabled="true"' : ''}>
          ${iconHtml}
          <span class="tbw-accordion-title">${panel.title}</span>
          ${chevronHtml}
        </button>
        <div class="tbw-accordion-content" id="tbw-section-${panel.id}" role="presentation"></div>
      </div>
    `;
  }

  // Resize handle position depends on panel position
  const resizeHandlePosition = position === 'left' ? 'right' : 'left';

  const panelHtml = hasPanel
    ? `
    <aside class="tbw-tool-panel${isOpen ? ' open' : ''}" part="tool-panel" data-position="${position}" role="presentation" id="tbw-tool-panel">
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
      <div class="tbw-shell-body">
        ${panelHtml}
        <div class="tbw-grid-content">
          ${gridContentHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="tbw-shell-body">
      <div class="tbw-grid-content">
        ${gridContentHtml}
      </div>
      ${panelHtml}
    </div>
  `;
}

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
        // No cleanup needed - elements are just moved
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
      console.warn(
        `[parseLightDomToolPanels] Tool panel missing required id or title attribute: id="${id ?? ''}", title="${title ?? ''}"`,
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
      // Vanilla fallback: use innerHTML as static content
      const content = panelEl.innerHTML.trim();
      render = (container: HTMLElement) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = content;
        container.appendChild(wrapper);
        return () => wrapper.remove();
      };
    }

    // Check if panel was already parsed
    const existingPanel = state.toolPanels.get(id);

    // If already parsed and we have an adapter renderer, update the render function
    // and re-read attributes from DOM (Angular may have updated them after initial parse)
    // This handles the case where Angular templates register after initial parsing
    if (existingPanel) {
      if (adapterRenderer) {
        // Update render function with framework adapter renderer
        existingPanel.render = render;

        // Re-read attributes from DOM - framework may have set them after initial parse
        // (e.g., Angular directive sets attributes in an effect after template is available)
        existingPanel.order = order;
        existingPanel.icon = icon;
        existingPanel.tooltip = tooltip;
        // Note: title and id are required and shouldn't change

        // Clear existing cleanup to force re-render with new renderer
        const cleanup = state.panelCleanups.get(id);
        if (cleanup) {
          cleanup();
          state.panelCleanups.delete(id);
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

    // Hide the light DOM element
    panelEl.style.display = 'none';
  });
}

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
    onToolbarButtonClick: (buttonId: string) => void;
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

      // Handle custom toolbar buttons
      const customBtn = target.closest('[data-btn]') as HTMLElement | null;
      if (customBtn) {
        const btnId = customBtn.getAttribute('data-btn');
        if (btnId) {
          callbacks.onToolbarButtonClick(btnId);
        }
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
  icons?: { expand?: IconValue; collapse?: IconValue },
): void {
  if (!state.isPanelOpen) return;

  const expandIcon = iconToString(icons?.expand ?? DEFAULT_GRID_ICONS.expand);
  const collapseIcon = iconToString(icons?.collapse ?? DEFAULT_GRID_ICONS.collapse);

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
    const chevron = section.querySelector('.tbw-accordion-chevron');
    if (chevron) {
      chevron.innerHTML = isExpanded ? collapseIcon : expandIcon;
    }

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
  state.lightDomToolbarContentIds.clear();

  // Reset move tracking flag (allow re-initialization)
  state.lightDomContentMoved = false;
}

// ============================================================================
// ShellController - Encapsulates tool panel orchestration logic
// ============================================================================

/**
 * Callbacks for ShellController to communicate with the grid.
 * This interface decouples the controller from grid internals.
 */
export interface ShellControllerCallbacks {
  /** Get the render root for DOM queries (the grid element) */
  getShadow: () => Element;
  /** Get the current shell config */
  getShellConfig: () => ShellConfig | undefined;
  /** Get accordion expand/collapse icons */
  getAccordionIcons: () => { expand: IconValue; collapse: IconValue };
  /** Emit an event from the grid */
  emit: (eventName: string, detail: unknown) => void;
  /** Refresh the shell header (re-parse light DOM and re-render) */
  refreshShellHeader: () => void;
}

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
  /** Get the currently active panel ID (deprecated) */
  readonly activePanel: string | null;
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
export function createShellController(state: ShellState, callbacks: ShellControllerCallbacks): ShellController {
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

    get activePanel() {
      // For backward compatibility, return first expanded section if panel is open
      if (state.isPanelOpen && state.expandedSections.size > 0) {
        return [...state.expandedSections][0];
      }
      return null;
    },

    get expandedSections() {
      return [...state.expandedSections];
    },

    openToolPanel() {
      if (state.isPanelOpen) return;
      if (state.toolPanels.size === 0) {
        console.warn('[tbw-grid] No tool panels registered');
        return;
      }

      state.isPanelOpen = true;

      // Auto-expand first section if none expanded
      if (state.expandedSections.size === 0 && state.toolPanels.size > 0) {
        const sortedPanels = [...state.toolPanels.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
        const firstPanel = sortedPanels[0];
        if (firstPanel) {
          state.expandedSections.add(firstPanel.id);
        }
      }

      // Update UI
      const shadow = callbacks.getShadow();
      updateToolbarActiveStates(shadow, state);
      updatePanelState(shadow, state);

      // Render accordion sections
      renderPanelContent(shadow, state, callbacks.getAccordionIcons());

      // Emit event
      callbacks.emit('tool-panel-open', { sections: controller.expandedSections });
    },

    closeToolPanel() {
      if (!state.isPanelOpen) return;

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
      const shadow = callbacks.getShadow();
      updateToolbarActiveStates(shadow, state);
      updatePanelState(shadow, state);

      // Emit event
      callbacks.emit('tool-panel-close', {});
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
        console.warn(`[tbw-grid] Tool panel section "${sectionId}" not found`);
        return;
      }

      // Don't allow toggling when there's only one panel (it should stay expanded)
      if (state.toolPanels.size === 1) {
        return;
      }

      const shadow = callbacks.getShadow();
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
      callbacks.emit('tool-panel-section-toggle', { id: sectionId, expanded: !isExpanded });
    },

    getToolPanels() {
      return [...state.toolPanels.values()];
    },

    registerToolPanel(panel: ToolPanelDefinition) {
      if (state.toolPanels.has(panel.id)) {
        console.warn(`[tbw-grid] Tool panel "${panel.id}" already registered`);
        return;
      }
      state.toolPanels.set(panel.id, panel);

      if (initialized) {
        callbacks.refreshShellHeader();
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
        callbacks.refreshShellHeader();
      }
    },

    getHeaderContents() {
      return [...state.headerContents.values()];
    },

    registerHeaderContent(content: HeaderContentDefinition) {
      if (state.headerContents.has(content.id)) {
        console.warn(`[tbw-grid] Header content "${content.id}" already registered`);
        return;
      }
      state.headerContents.set(content.id, content);

      if (initialized) {
        renderHeaderContent(callbacks.getShadow(), state);
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
      const el = callbacks.getShadow().querySelector(`[data-header-content="${contentId}"]`);
      el?.remove();
    },

    getToolbarContents() {
      return [...state.toolbarContents.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },

    registerToolbarContent(content: ToolbarContentDefinition) {
      if (state.toolbarContents.has(content.id)) {
        console.warn(`[tbw-grid] Toolbar content "${content.id}" already registered`);
        return;
      }
      state.toolbarContents.set(content.id, content);

      if (initialized) {
        callbacks.refreshShellHeader();
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
        callbacks.refreshShellHeader();
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

// ============================================================================
// Grid Render HTML
// ============================================================================

/**
 * Core grid content HTML template.
 * Uses faux scrollbar pattern for smooth virtualized scrolling.
 */
export const GRID_CONTENT_HTML = `
  <div class="tbw-scroll-area">
    <div class="rows-body-wrapper">
      <div class="rows-body" role="grid">
        <div class="header" role="rowgroup">
          <div class="header-row" role="row" part="header-row"></div>
        </div>
        <div class="rows-container" role="presentation">
          <div class="rows-viewport" role="presentation">
            <div class="rows"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="faux-vscroll">
    <div class="faux-vscroll-spacer"></div>
  </div>
`;

// ============================================================================
// DOM-based Grid Rendering (Performance Optimized)
// ============================================================================

import {
  buildGridDOM,
  buildShellBody,
  buildShellHeader,
  type ShellBodyOptions,
  type ShellHeaderOptions,
} from './dom-builder';

/**
 * Build the complete grid DOM structure using direct DOM construction.
 * This is 2-3x faster than innerHTML for initial render.
 *
 * @param renderRoot - The element to render into (will be cleared)
 * @param shellConfig - Shell configuration
 * @param state - Shell state
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

  // Preserve light DOM elements before clearing (they contain user content)
  // These are custom elements used for declarative configuration
  const lightDomElements: Element[] = [];
  const lightDomSelectors = ['tbw-grid-header', 'tbw-grid-tool-buttons', 'tbw-grid-tool-panel', 'tbw-grid-column'];
  for (const selector of lightDomSelectors) {
    const elements = renderRoot.querySelectorAll(`:scope > ${selector}`);
    elements.forEach((el) => lightDomElements.push(el));
  }

  // Clear existing content (this would delete light DOM elements, so we preserved them first)
  renderRoot.replaceChildren();

  // Re-append preserved light DOM elements (hidden, they're used for config)
  for (const el of lightDomElements) {
    renderRoot.appendChild(el);
  }

  if (hasShell) {
    const toolPanelIcon = iconToString(icons?.toolPanel ?? DEFAULT_GRID_ICONS.toolPanel);
    const expandIcon = iconToString(icons?.expand ?? DEFAULT_GRID_ICONS.expand);
    const collapseIcon = iconToString(icons?.collapse ?? DEFAULT_GRID_ICONS.collapse);

    // All toolbar contents now come from shellConfig (merged by ConfigManager)
    const allContents = shellConfig?.header?.toolbarContents ?? [];
    const sortedContents = [...allContents].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // All panels now come from shellConfig (merged by ConfigManager)
    const allPanels = shellConfig?.toolPanels ?? [];
    const sortedPanels = [...allPanels].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    // Build header options
    const headerOptions: ShellHeaderOptions = {
      title: shellConfig?.header?.title ?? undefined,
      hasPanels: sortedPanels.length > 0,
      isPanelOpen: runtimeState.isPanelOpen,
      toolPanelIcon,
      // All contents are now in config (no more separate config vs API distinction for rendering)
      configButtons: sortedContents.map((c) => ({
        id: c.id,
        hasElement: false,
        hasRender: !!c.render,
      })),
      apiButtons: [], // No longer needed - all contents merged into configButtons
    };

    // Build body options
    const bodyOptions: ShellBodyOptions = {
      position: shellConfig?.toolPanel?.position ?? 'right',
      isPanelOpen: runtimeState.isPanelOpen,
      expandIcon,
      collapseIcon,
      panels: sortedPanels.map((p) => ({
        id: p.id,
        title: p.title,
        icon: iconToString(p.icon),
        isExpanded: runtimeState.expandedSections.has(p.id),
      })),
    };

    // Build shell elements
    const shellHeader = buildShellHeader(headerOptions);
    const shellBody = buildShellBody(bodyOptions);

    // Build and append complete DOM
    const fragment = buildGridDOM({
      hasShell: true,
      shellHeader,
      shellBody,
    });
    renderRoot.appendChild(fragment);
  } else {
    // No shell - just grid content
    const fragment = buildGridDOM({ hasShell: false });
    renderRoot.appendChild(fragment);
  }

  return hasShell;
}
