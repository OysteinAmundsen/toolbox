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
  ShellConfig,
  ToolbarButtonConfig,
  ToolbarButtonInfo,
  ToolPanelDefinition,
} from '../types';

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
  /** Currently open tool panel ID (null if closed) */
  activePanel: string | null;
  /** Cleanup functions for header content render returns */
  headerContentCleanups: Map<string, () => void>;
  /** Cleanup function for active panel render return */
  activePanelCleanup: (() => void) | null;
  /** Cleanup functions for toolbar button render returns */
  toolbarButtonCleanups: Map<string, () => void>;
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
    activePanel: null,
    headerContentCleanups: new Map(),
    activePanelCleanup: null,
    toolbarButtonCleanups: new Map(),
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
 */
export function renderShellHeader(config: ShellConfig | undefined, state: ShellState): string {
  const title = config?.header?.title ?? '';
  const hasTitle = !!title;

  // Collect all toolbar buttons in order
  // 1. Config buttons (sorted by order)
  // 2. API-registered buttons (sorted by order)
  // 3. Light DOM buttons via slot
  // 4. Panel toggle buttons (sorted by order)

  const configButtons = config?.header?.toolbarButtons ?? [];
  const hasConfigButtons = configButtons.length > 0;
  const hasApiButtons = state.toolbarButtons.size > 0;
  const hasLightDomButtons = state.lightDomButtons.length > 0;
  const hasPanelToggles = state.toolPanels.size > 0;
  const hasCustomButtons = hasConfigButtons || hasApiButtons || hasLightDomButtons;
  const showSeparator = hasCustomButtons && hasPanelToggles;

  // Sort config buttons by order
  const sortedConfigButtons = [...configButtons].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  // Sort API buttons by order
  const sortedApiButtons = [...state.toolbarButtons.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

  // Sort panel toggles by order
  const sortedPanels = [...state.toolPanels.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

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

  // Panel toggle buttons
  for (const panel of sortedPanels) {
    const isActive = state.activePanel === panel.id;
    toolbarHtml += `<button class="tbw-toolbar-btn${isActive ? ' active' : ''}" data-panel="${panel.id}" title="${
      panel.tooltip ?? panel.title
    }" aria-label="${panel.tooltip ?? panel.title}" aria-pressed="${isActive}" aria-controls="tbw-panel-${panel.id}">${
      panel.icon
    }</button>`;
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
 * Render the shell body wrapper HTML (contains grid content + tool panel).
 */
export function renderShellBody(config: ShellConfig | undefined, state: ShellState, gridContentHtml: string): string {
  const position = config?.toolPanel?.position ?? 'right';
  const hasPanel = state.toolPanels.size > 0;
  const isOpen = state.activePanel !== null;
  const activePanel = state.activePanel ? state.toolPanels.get(state.activePanel) : null;

  const panelHtml = hasPanel
    ? `
    <aside class="tbw-tool-panel${
      isOpen ? ' open' : ''
    }" part="tool-panel" data-position="${position}" role="complementary" aria-label="${
        activePanel?.title ?? 'Tool panel'
      }" id="tbw-panel-${state.activePanel ?? 'closed'}">
      <div class="tbw-tool-panel-header">
        <span class="tbw-tool-panel-title">${activePanel?.title ?? ''}</span>
        <button class="tbw-tool-panel-close" aria-label="Close panel">✕</button>
      </div>
      <div class="tbw-tool-panel-content" role="region"></div>
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
  state.lightDomHeaderContent.forEach((el, i) => {
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
 * Set up event listeners for shell toolbar buttons.
 */
export function setupShellEventListeners(
  shadowRoot: ShadowRoot,
  config: ShellConfig | undefined,
  state: ShellState,
  callbacks: {
    onPanelToggle: (panelId: string) => void;
    onPanelClose: () => void;
    onToolbarButtonClick: (buttonId: string) => void;
  }
): void {
  const toolbar = shadowRoot.querySelector('.tbw-shell-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-panel]') as HTMLElement | null;
      if (btn) {
        const panelId = btn.getAttribute('data-panel');
        if (panelId) {
          callbacks.onPanelToggle(panelId);
        }
        return;
      }

      const customBtn = target.closest('[data-btn]') as HTMLElement | null;
      if (customBtn) {
        const btnId = customBtn.getAttribute('data-btn');
        if (btnId) {
          callbacks.onToolbarButtonClick(btnId);
        }
      }
    });
  }

  const closeBtn = shadowRoot.querySelector('.tbw-tool-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      callbacks.onPanelClose();
    });
  }
}

/**
 * Render custom button elements/render functions into toolbar slots.
 */
export function renderCustomToolbarButtons(
  shadowRoot: ShadowRoot,
  config: ShellConfig | undefined,
  state: ShellState
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
 * Render tool panel content when panel opens.
 */
export function renderPanelContent(shadowRoot: ShadowRoot, state: ShellState): void {
  if (!state.activePanel) return;

  const panel = state.toolPanels.get(state.activePanel);
  if (!panel) return;

  const contentArea = shadowRoot.querySelector('.tbw-tool-panel-content');
  if (!contentArea) return;

  // Clean up previous panel content
  if (state.activePanelCleanup) {
    state.activePanelCleanup();
    state.activePanelCleanup = null;
  }

  // Clear content area
  contentArea.innerHTML = '';

  // Render new content
  const cleanup = panel.render(contentArea as HTMLElement);
  if (cleanup) {
    state.activePanelCleanup = cleanup;
  }
}

/**
 * Update toolbar button active states.
 */
export function updateToolbarActiveStates(shadowRoot: ShadowRoot, state: ShellState): void {
  const buttons = shadowRoot.querySelectorAll('[data-panel]');
  buttons.forEach((btn) => {
    const panelId = btn.getAttribute('data-panel');
    const isActive = panelId === state.activePanel;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

/**
 * Update tool panel open/close state.
 */
export function updatePanelState(shadowRoot: ShadowRoot, state: ShellState): void {
  const panel = shadowRoot.querySelector('.tbw-tool-panel');
  if (!panel) return;

  const isOpen = state.activePanel !== null;
  panel.classList.toggle('open', isOpen);

  if (isOpen && state.activePanel) {
    const panelDef = state.toolPanels.get(state.activePanel);
    const titleEl = panel.querySelector('.tbw-tool-panel-title');
    if (titleEl) {
      titleEl.textContent = panelDef?.title ?? '';
    }
    panel.setAttribute('aria-label', `${panelDef?.title ?? 'Tool'} panel`);
    panel.id = `tbw-panel-${state.activePanel}`;
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
