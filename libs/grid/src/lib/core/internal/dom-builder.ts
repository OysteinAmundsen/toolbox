/**
 * DOM Builder - Direct DOM construction for performance.
 *
 * Using direct DOM APIs instead of innerHTML is significantly faster:
 * - No HTML parsing by the browser
 * - No template string concatenation
 * - Immediate element creation without serialization/deserialization
 *
 * Benchmark: DOM construction is ~2-3x faster than innerHTML for complex structures.
 */

/**
 * Create an element with attributes and optional children.
 * Optimized helper that avoids repeated function calls.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (Node | string | null | undefined)[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (attrs) {
    for (const key in attrs) {
      const value = attrs[key];
      if (value !== undefined && value !== null) {
        el.setAttribute(key, value);
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (child == null) continue;
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }

  return el;
}

/**
 * Create a text node (shorthand).
 */
export function text(content: string): Text {
  return document.createTextNode(content);
}

/**
 * Create an element with class (common pattern).
 */
export function div(className?: string, attrs?: Record<string, string>): HTMLDivElement {
  const el = document.createElement('div');
  if (className) el.className = className;
  if (attrs) {
    for (const key in attrs) {
      const value = attrs[key];
      if (value !== undefined && value !== null) {
        el.setAttribute(key, value);
      }
    }
  }
  return el;
}

/**
 * Create a button element.
 */
export function button(className?: string, attrs?: Record<string, string>, content?: string | Node): HTMLButtonElement {
  const el = document.createElement('button');
  if (className) el.className = className;
  if (attrs) {
    for (const key in attrs) {
      const value = attrs[key];
      if (value !== undefined && value !== null) {
        el.setAttribute(key, value);
      }
    }
  }
  if (content) {
    if (typeof content === 'string') {
      el.textContent = content;
    } else {
      el.appendChild(content);
    }
  }
  return el;
}

/**
 * Create a slot element for light DOM projection.
 * @deprecated The grid now uses light DOM without Shadow DOM, so slots are no longer used.
 * This function is kept for backward compatibility but should not be used in new code.
 */
export function slot(name?: string): HTMLSlotElement {
  const el = document.createElement('slot');
  if (name) el.name = name;
  return el;
}

/**
 * Append multiple children to a parent element.
 */
export function appendChildren(parent: Element, children: (Node | null | undefined)[]): void {
  for (const child of children) {
    if (child) parent.appendChild(child);
  }
}

/**
 * Set multiple attributes on an element.
 */
export function setAttrs(el: Element, attrs: Record<string, string | undefined>): void {
  for (const key in attrs) {
    const value = attrs[key];
    if (value !== undefined && value !== null) {
      el.setAttribute(key, value);
    }
  }
}

// ============================================================================
// Grid Structure Templates (Pre-built for cloning)
// ============================================================================

/**
 * Template for grid content (the core scrollable grid area).
 * Pre-built once, then cloned for each grid instance.
 */
const gridContentTemplate = document.createElement('template');
gridContentTemplate.innerHTML = `
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

/**
 * Clone the grid content structure.
 * Using template cloning is faster than createElement for nested structures.
 */
export function cloneGridContent(): DocumentFragment {
  return gridContentTemplate.content.cloneNode(true) as DocumentFragment;
}

/**
 * Build the grid root structure using direct DOM construction.
 * This is called once per grid instance during initial render.
 */
export interface GridDOMOptions {
  hasShell: boolean;
  /** Shell header element (pre-built) */
  shellHeader?: Element;
  /** Shell body element with tool panel (pre-built) */
  shellBody?: Element;
}

/**
 * Build the complete grid DOM structure.
 * Returns a DocumentFragment ready to be appended to shadow root.
 */
export function buildGridDOM(options: GridDOMOptions): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const root = div(options.hasShell ? 'tbw-grid-root has-shell' : 'tbw-grid-root');

  if (options.hasShell && options.shellHeader && options.shellBody) {
    // Shell mode: header + body (with grid content inside)
    root.appendChild(options.shellHeader);
    root.appendChild(options.shellBody);
  } else {
    // No shell: just grid content in wrapper
    const contentWrapper = div('tbw-grid-content');
    contentWrapper.appendChild(cloneGridContent());
    root.appendChild(contentWrapper);
  }

  fragment.appendChild(root);
  return fragment;
}

/**
 * Build shell header using direct DOM construction.
 *
 * Note: The grid no longer creates buttons from config (icon/action).
 * Config/API buttons only use element or render function.
 * Light DOM buttons are slotted directly.
 * The ONLY button the grid creates is the panel toggle.
 */
export interface ShellHeaderOptions {
  title?: string;
  hasPanels: boolean;
  isPanelOpen: boolean;
  toolPanelIcon: string;
  /** Config toolbar buttons with element/render (pre-sorted by order) */
  configButtons: Array<{
    id: string;
    hasElement?: boolean;
    hasRender?: boolean;
  }>;
  /** API toolbar buttons with element/render (pre-sorted by order) */
  apiButtons: Array<{
    id: string;
    hasElement?: boolean;
    hasRender?: boolean;
  }>;
}

/**
 * Build shell header element directly without innerHTML.
 */
export function buildShellHeader(options: ShellHeaderOptions): HTMLDivElement {
  const header = div('tbw-shell-header', { part: 'shell-header', role: 'presentation' });

  // Title
  if (options.title) {
    const titleEl = div('tbw-shell-title');
    titleEl.textContent = options.title;
    header.appendChild(titleEl);
  }

  // Shell content with placeholder for light DOM header content
  const content = div('tbw-shell-content', {
    part: 'shell-content',
    role: 'presentation',
    'data-light-dom-header-content': '',
  });
  header.appendChild(content);

  // Toolbar
  const toolbar = div('tbw-shell-toolbar', { part: 'shell-toolbar', role: 'presentation' });

  // Placeholders for config buttons with element or render function
  for (const btn of options.configButtons) {
    if (btn.hasElement || btn.hasRender) {
      toolbar.appendChild(div('tbw-toolbar-btn-slot', { 'data-btn-slot': btn.id }));
    }
  }
  // Placeholders for API buttons with element or render function
  for (const btn of options.apiButtons) {
    if (btn.hasElement || btn.hasRender) {
      toolbar.appendChild(div('tbw-toolbar-btn-slot', { 'data-btn-slot': btn.id }));
    }
  }

  // Light DOM placeholder for toolbar buttons - content moved here from <tbw-grid-tool-buttons>
  toolbar.appendChild(div('tbw-toolbar-light-dom', { 'data-light-dom-toolbar': '' }));

  // Separator between config/API buttons and panel toggle
  const hasCustomButtons =
    options.configButtons.some((b) => b.hasElement || b.hasRender) ||
    options.apiButtons.some((b) => b.hasElement || b.hasRender);
  if (hasCustomButtons && options.hasPanels) {
    toolbar.appendChild(div('tbw-toolbar-separator'));
  }

  // Panel toggle button
  if (options.hasPanels) {
    const toggleBtn = button(options.isPanelOpen ? 'tbw-toolbar-btn active' : 'tbw-toolbar-btn', {
      'data-panel-toggle': '',
      title: 'Settings',
      'aria-label': 'Toggle settings panel',
      'aria-pressed': String(options.isPanelOpen),
      'aria-controls': 'tbw-tool-panel',
    });
    toggleBtn.innerHTML = options.toolPanelIcon;
    toolbar.appendChild(toggleBtn);
  }

  header.appendChild(toolbar);
  return header;
}

/**
 * Build shell body (grid content + optional tool panel).
 */
export interface ShellBodyOptions {
  position: 'left' | 'right';
  isPanelOpen: boolean;
  expandIcon: string;
  collapseIcon: string;
  /** Sorted panels for accordion */
  panels: Array<{
    id: string;
    title: string;
    icon?: string;
    isExpanded: boolean;
  }>;
}

/**
 * Build shell body element directly without innerHTML.
 */
export function buildShellBody(options: ShellBodyOptions): HTMLDivElement {
  const body = div('tbw-shell-body');
  const hasPanel = options.panels.length > 0;
  const isSinglePanel = options.panels.length === 1;

  // Grid content wrapper with cloned grid structure
  const gridContent = div('tbw-grid-content');
  gridContent.appendChild(cloneGridContent());

  // Tool panel
  let panelEl: HTMLElement | null = null;
  if (hasPanel) {
    panelEl = createElement('aside', {
      class: options.isPanelOpen ? 'tbw-tool-panel open' : 'tbw-tool-panel',
      part: 'tool-panel',
      'data-position': options.position,
      role: 'presentation',
      id: 'tbw-tool-panel',
    });

    // Resize handle
    const resizeHandlePosition = options.position === 'left' ? 'right' : 'left';
    panelEl.appendChild(
      div('tbw-tool-panel-resize', {
        'data-resize-handle': '',
        'data-handle-position': resizeHandlePosition,
        'aria-hidden': 'true',
      }),
    );

    // Panel content with accordion
    const panelContent = div('tbw-tool-panel-content', { role: 'presentation' });
    const accordion = div('tbw-accordion');

    for (const panel of options.panels) {
      const sectionClasses = `tbw-accordion-section${panel.isExpanded ? ' expanded' : ''}${isSinglePanel ? ' single' : ''}`;
      const section = div(sectionClasses, { 'data-section': panel.id });

      // Accordion header button
      const headerBtn = button('tbw-accordion-header', {
        'aria-expanded': String(panel.isExpanded),
        'aria-controls': `tbw-section-${panel.id}`,
      });
      if (isSinglePanel) headerBtn.setAttribute('aria-disabled', 'true');

      // Icon
      if (panel.icon) {
        const iconSpan = createElement('span', { class: 'tbw-accordion-icon' });
        iconSpan.innerHTML = panel.icon;
        headerBtn.appendChild(iconSpan);
      }

      // Title
      const titleSpan = createElement('span', { class: 'tbw-accordion-title' });
      titleSpan.textContent = panel.title;
      headerBtn.appendChild(titleSpan);

      // Chevron (hidden for single panel)
      if (!isSinglePanel) {
        const chevronSpan = createElement('span', { class: 'tbw-accordion-chevron' });
        chevronSpan.innerHTML = panel.isExpanded ? options.collapseIcon : options.expandIcon;
        headerBtn.appendChild(chevronSpan);
      }

      section.appendChild(headerBtn);

      // Accordion content (empty, will be filled by panel render functions)
      section.appendChild(
        div('tbw-accordion-content', {
          id: `tbw-section-${panel.id}`,
          role: 'presentation',
        }),
      );

      accordion.appendChild(section);
    }

    panelContent.appendChild(accordion);
    panelEl.appendChild(panelContent);
  }

  // Append in correct order based on position
  if (options.position === 'left' && panelEl) {
    body.appendChild(panelEl);
    body.appendChild(gridContent);
  } else {
    body.appendChild(gridContent);
    if (panelEl) body.appendChild(panelEl);
  }

  return body;
}
