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
  ToolbarButtonConfig,
  ToolbarButtonInfo,
  ToolPanelDefinition,
} from '../types';
import { DEFAULT_GRID_ICONS } from '../types';

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
 */
export interface ShellState {
  /** Registered tool panels (from plugins + consumer API) */
  toolPanels: Map<string, ToolPanelDefinition>;
  /** Registered header content (from plugins + consumer API) */
  headerContents: Map<string, HeaderContentDefinition>;
  /** Custom toolbar buttons registered via API */
  toolbarButtons: Map<string, ToolbarButtonConfig>;
  /** Light DOM toolbar buttons */
  lightDomButtons: HTMLElement[];
  /** Light DOM header content elements */
  lightDomHeaderContent: HTMLElement[];
  /** Whether the tool panel sidebar is open */
  isPanelOpen: boolean;
  /** Which accordion sections are expanded (by panel ID) */
  expandedSections: Set<string>;
  /** Cleanup functions for header content render returns */
  headerContentCleanups: Map<string, () => void>;
  /** Cleanup functions for each panel section's render return */
  panelCleanups: Map<string, () => void>;
  /** Cleanup functions for toolbar button render returns */
  toolbarButtonCleanups: Map<string, () => void>;
  /** @deprecated Use isPanelOpen instead. Kept for backward compatibility. */
  activePanel: string | null;
  /** @deprecated Use panelCleanups instead. Kept for backward compatibility. */
  activePanelCleanup: (() => void) | null;
}

/**
 * Create initial shell state.
 */
export function createShellState(): ShellState {
  return {
    toolPanels: new Map(),
    headerContents: new Map(),
    toolbarButtons: new Map(),
    lightDomButtons: [],
    lightDomHeaderContent: [],
    isPanelOpen: false,
    expandedSections: new Set(),
    headerContentCleanups: new Map(),
    panelCleanups: new Map(),
    toolbarButtonCleanups: new Map(),
    // Deprecated - kept for backward compatibility
    activePanel: null,
    activePanelCleanup: null,
  };
}

/**
 * Determine if shell header should be rendered.
 */
export function shouldRenderShellHeader(config: ShellConfig | undefined, state: ShellState): boolean {
  // Check if title is configured
  if (config?.header?.title) return true;

  // Check if config has toolbar buttons
  if (config?.header?.toolbarButtons?.length) return true;

  // Check if any tool panels are registered (need toolbar buttons for them)
  if (state.toolPanels.size > 0) return true;

  // Check if any header content is registered
  if (state.headerContents.size > 0) return true;

  // Check if any API toolbar buttons registered
  if (state.toolbarButtons.size > 0) return true;

  // Check if light DOM has header elements
  if (state.lightDomButtons.length > 0 || state.lightDomHeaderContent.length > 0) return true;

  return false;
}

/**
 * Render the shell header HTML.
 * @param toolPanelIcon - Icon for the tool panel toggle (from grid icon config)
 */
export function renderShellHeader(
  config: ShellConfig | undefined,
  state: ShellState,
  toolPanelIcon: IconValue = '☰',
): string {
  const title = config?.header?.title ?? '';
  const hasTitle = !!title;
  const iconStr = iconToString(toolPanelIcon);

  // Collect all toolbar buttons in order
  // 1. Config buttons (sorted by order)
  // 2. API-registered buttons (sorted by order)
  // 3. Light DOM buttons via slot
  // 4. Single panel toggle button (if any panels registered)

  const configButtons = config?.header?.toolbarButtons ?? [];
  const hasConfigButtons = configButtons.length > 0;
  const hasApiButtons = state.toolbarButtons.size > 0;
  const hasLightDomButtons = state.lightDomButtons.length > 0;
  const hasPanels = state.toolPanels.size > 0;
  const hasCustomButtons = hasConfigButtons || hasApiButtons || hasLightDomButtons;
  const showSeparator = hasCustomButtons && hasPanels;

  // Sort config buttons by order
  const sortedConfigButtons = [...configButtons].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  // Sort API buttons by order
  const sortedApiButtons = [...state.toolbarButtons.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  // Build toolbar HTML
  let toolbarHtml = '';

  // Config buttons with icon/action (grid renders these)
  for (const btn of sortedConfigButtons) {
    if (btn.icon && btn.action) {
      toolbarHtml += `<button class="tbw-toolbar-btn" data-btn="${btn.id}" title="${btn.label}" aria-label="${
        btn.label
      }"${btn.disabled ? ' disabled' : ''}>${btn.icon}</button>`;
    }
  }

  // API buttons with icon/action
  for (const btn of sortedApiButtons) {
    if (btn.icon && btn.action) {
      toolbarHtml += `<button class="tbw-toolbar-btn" data-btn="${btn.id}" title="${btn.label}" aria-label="${
        btn.label
      }"${btn.disabled ? ' disabled' : ''}>${btn.icon}</button>`;
    }
  }

  // Placeholders for config/API buttons with element or render function
  for (const btn of sortedConfigButtons) {
    if (btn.element || btn.render) {
      toolbarHtml += `<div class="tbw-toolbar-btn-slot" data-btn-slot="${btn.id}"></div>`;
    }
  }
  for (const btn of sortedApiButtons) {
    if (btn.element || btn.render) {
      toolbarHtml += `<div class="tbw-toolbar-btn-slot" data-btn-slot="${btn.id}"></div>`;
    }
  }

  // Light DOM slot
  if (hasLightDomButtons) {
    toolbarHtml += '<slot name="toolbar"></slot>';
  }

  // Separator
  if (showSeparator) {
    toolbarHtml += '<div class="tbw-toolbar-separator"></div>';
  }

  // Single panel toggle button (opens accordion-style sidebar with all panels)
  if (hasPanels) {
    const isOpen = state.isPanelOpen;
    toolbarHtml += `<button class="tbw-toolbar-btn${isOpen ? ' active' : ''}" data-panel-toggle title="Settings" aria-label="Toggle settings panel" aria-pressed="${isOpen}" aria-controls="tbw-tool-panel">${iconStr}</button>`;
  }

  return `
    <div class="tbw-shell-header" part="shell-header" role="banner">
      ${hasTitle ? `<div class="tbw-shell-title">${title}</div>` : ''}
      <div class="tbw-shell-content" part="shell-content" role="region" aria-label="Grid information">
        <slot name="header-content"></slot>
      </div>
      <div class="tbw-shell-toolbar" part="shell-toolbar" role="toolbar" aria-label="Grid tools">
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
        <div class="tbw-accordion-content" id="tbw-section-${panel.id}" role="region" aria-labelledby="tbw-section-header-${panel.id}"></div>
      </div>
    `;
  }

  // Resize handle position depends on panel position
  const resizeHandlePosition = position === 'left' ? 'right' : 'left';

  const panelHtml = hasPanel
    ? `
    <aside class="tbw-tool-panel${isOpen ? ' open' : ''}" part="tool-panel" data-position="${position}" role="complementary" aria-label="Tool panel" id="tbw-tool-panel">
      <div class="tbw-tool-panel-resize" data-resize-handle data-handle-position="${resizeHandlePosition}" aria-hidden="true"></div>
      <div class="tbw-tool-panel-content" role="region">
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
 */
export function parseLightDomShell(host: HTMLElement, state: ShellState): void {
  const headerEl = host.querySelector('tbw-grid-header');
  if (!headerEl) return;

  // Hide the light DOM container
  (headerEl as HTMLElement).style.display = 'none';

  // Parse header content elements
  const headerContents = headerEl.querySelectorAll('tbw-grid-header-content');
  state.lightDomHeaderContent = Array.from(headerContents) as HTMLElement[];

  // Assign slot names for slotting into shadow DOM
  state.lightDomHeaderContent.forEach((el) => {
    el.setAttribute('slot', 'header-content');
  });

  // Parse toolbar button elements
  const toolButtons = headerEl.querySelectorAll('tbw-grid-tool-button');
  state.lightDomButtons = Array.from(toolButtons) as HTMLElement[];

  // Sort by order attribute and assign slots
  state.lightDomButtons.sort((a, b) => {
    const orderA = parseInt(a.getAttribute('order') ?? '100', 10);
    const orderB = parseInt(b.getAttribute('order') ?? '100', 10);
    return orderA - orderB;
  });

  state.lightDomButtons.forEach((el) => {
    el.setAttribute('slot', 'toolbar');
  });
}

/**
 * Set up event listeners for shell toolbar buttons and accordion.
 */
export function setupShellEventListeners(
  shadowRoot: ShadowRoot,
  config: ShellConfig | undefined,
  state: ShellState,
  callbacks: {
    onPanelToggle: () => void;
    onSectionToggle: (sectionId: string) => void;
    onToolbarButtonClick: (buttonId: string) => void;
  },
): void {
  const toolbar = shadowRoot.querySelector('.tbw-shell-toolbar');
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
  const accordion = shadowRoot.querySelector('.tbw-accordion');
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
  shadowRoot: ShadowRoot,
  config: ShellConfig | undefined,
  onResize: (width: number) => void,
): () => void {
  const panel = shadowRoot.querySelector('.tbw-tool-panel') as HTMLElement | null;
  const handle = shadowRoot.querySelector('[data-resize-handle]') as HTMLElement | null;
  const shellBody = shadowRoot.querySelector('.tbw-shell-body') as HTMLElement | null;
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
 * Render custom button elements/render functions into toolbar slots.
 */
export function renderCustomToolbarButtons(
  shadowRoot: ShadowRoot,
  config: ShellConfig | undefined,
  state: ShellState,
): void {
  const allButtons = [...(config?.header?.toolbarButtons ?? []), ...state.toolbarButtons.values()];

  for (const btn of allButtons) {
    const slot = shadowRoot.querySelector(`[data-btn-slot="${btn.id}"]`);
    if (!slot) continue;

    // Clean up previous render if any
    const existingCleanup = state.toolbarButtonCleanups.get(btn.id);
    if (existingCleanup) {
      existingCleanup();
      state.toolbarButtonCleanups.delete(btn.id);
    }

    if (btn.element) {
      slot.appendChild(btn.element);
    } else if (btn.render) {
      const cleanup = btn.render(slot as HTMLElement);
      if (cleanup) {
        state.toolbarButtonCleanups.set(btn.id, cleanup);
      }
    }
  }
}

/**
 * Render header content from plugins into the shell content area.
 */
export function renderHeaderContent(shadowRoot: ShadowRoot, state: ShellState): void {
  const contentArea = shadowRoot.querySelector('.tbw-shell-content');
  if (!contentArea) return;

  // Sort by order
  const sortedContents = [...state.headerContents.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  // Create containers for each content piece (before the slot)
  const slot = contentArea.querySelector('slot[name="header-content"]');

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
      // Insert before the slot
      if (slot) {
        contentArea.insertBefore(container, slot);
      } else {
        contentArea.appendChild(container);
      }
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
  shadowRoot: ShadowRoot,
  state: ShellState,
  icons?: { expand?: IconValue; collapse?: IconValue },
): void {
  if (!state.isPanelOpen) return;

  const expandIcon = iconToString(icons?.expand ?? DEFAULT_GRID_ICONS.expand);
  const collapseIcon = iconToString(icons?.collapse ?? DEFAULT_GRID_ICONS.collapse);

  for (const [panelId, panel] of state.toolPanels) {
    const isExpanded = state.expandedSections.has(panelId);
    const section = shadowRoot.querySelector(`[data-section="${panelId}"]`);
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
export function updateToolbarActiveStates(shadowRoot: ShadowRoot, state: ShellState): void {
  // Update single panel toggle button
  const panelToggle = shadowRoot.querySelector('[data-panel-toggle]');
  if (panelToggle) {
    panelToggle.classList.toggle('active', state.isPanelOpen);
    panelToggle.setAttribute('aria-pressed', String(state.isPanelOpen));
  }
}

/**
 * Update tool panel open/close state.
 */
export function updatePanelState(shadowRoot: ShadowRoot, state: ShellState): void {
  const panel = shadowRoot.querySelector('.tbw-tool-panel') as HTMLElement | null;
  if (!panel) return;

  panel.classList.toggle('open', state.isPanelOpen);

  // Clear inline width when closing (resize sets inline style that overrides CSS)
  if (!state.isPanelOpen) {
    panel.style.width = '';
  }
}

/**
 * Get all toolbar button info.
 */
export function getToolbarButtonsInfo(config: ShellConfig | undefined, state: ShellState): ToolbarButtonInfo[] {
  const result: ToolbarButtonInfo[] = [];

  // Config buttons
  for (const btn of config?.header?.toolbarButtons ?? []) {
    result.push({
      id: btn.id,
      label: btn.label,
      disabled: btn.disabled ?? false,
      source: 'config',
    });
  }

  // API buttons
  for (const btn of state.toolbarButtons.values()) {
    result.push({
      id: btn.id,
      label: btn.label,
      disabled: btn.disabled ?? false,
      source: 'config',
    });
  }

  // Light DOM buttons (limited info since user provides DOM)
  for (let i = 0; i < state.lightDomButtons.length; i++) {
    const el = state.lightDomButtons[i];
    const btn = el.querySelector('button');
    result.push({
      id: `light-dom-${i}`,
      label: btn?.getAttribute('title') ?? btn?.getAttribute('aria-label') ?? '',
      disabled: btn?.disabled ?? false,
      source: 'light-dom',
    });
  }

  // Panel toggles
  for (const panel of state.toolPanels.values()) {
    result.push({
      id: `panel-toggle-${panel.id}`,
      label: panel.tooltip ?? panel.title,
      disabled: false,
      source: 'panel-toggle',
      panelId: panel.id,
    });
  }

  return result;
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

  // Clean up active panel
  if (state.activePanelCleanup) {
    state.activePanelCleanup();
    state.activePanelCleanup = null;
  }

  // Clean up toolbar buttons
  for (const cleanup of state.toolbarButtonCleanups.values()) {
    cleanup();
  }
  state.toolbarButtonCleanups.clear();

  // Invoke panel onClose if open
  if (state.activePanel) {
    const panel = state.toolPanels.get(state.activePanel);
    panel?.onClose?.();
  }

  // Clear registrations
  state.toolPanels.clear();
  state.headerContents.clear();
  state.toolbarButtons.clear();
  state.lightDomButtons = [];
  state.lightDomHeaderContent = [];
  state.activePanel = null;
}
