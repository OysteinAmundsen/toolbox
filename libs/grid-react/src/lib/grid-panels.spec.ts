/**
 * Tests for GridDetailPanel and GridToolPanel components.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDetailRenderer } from './grid-detail-panel';
import { getToolPanelElements, getToolPanelRenderer } from './grid-tool-panel';

// ═══════════════════════════════════════════════════════════════════════════
// GridDetailPanel
// ═══════════════════════════════════════════════════════════════════════════

describe('GridDetailPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getDetailRenderer', () => {
    it('should return undefined for grid without detail element', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid with unregistered detail element', () => {
      const gridElement = document.createElement('tbw-grid');
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for grid without id or data-grid-id (no fallback)', () => {
      const gridElement = document.createElement('tbw-grid');
      // No detail element, no id, no data-grid-id → no fallback
      container.appendChild(gridElement);

      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should attempt id-based fallback when detail element exists but has no WeakMap entry', () => {
      const gridElement = document.createElement('tbw-grid');
      gridElement.id = 'test-grid-123';
      const detailElement = document.createElement('tbw-grid-detail');
      gridElement.appendChild(detailElement);
      container.appendChild(gridElement);

      // Even with ID, the gridDetailRegistry is a module-level Map we can't populate
      // from outside, so it should still return undefined
      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });

    it('should try data-grid-id attribute as fallback', () => {
      const gridElement = document.createElement('tbw-grid');
      gridElement.setAttribute('data-grid-id', 'fallback-grid');
      container.appendChild(gridElement);

      // No WeakMap entry and no Map entry → undefined
      const renderer = getDetailRenderer(gridElement);
      expect(renderer).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GridToolPanel
// ═══════════════════════════════════════════════════════════════════════════

describe('GridToolPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getToolPanelRenderer', () => {
    it('should return undefined for element without registered renderer', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for element with id but no id-based registry entry', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      panelElement.id = 'my-panel';
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });

    it('should return undefined for element without id and no WeakMap entry', () => {
      const panelElement = document.createElement('tbw-grid-tool-panel');
      // No id attribute set
      container.appendChild(panelElement);

      const renderer = getToolPanelRenderer(panelElement);
      expect(renderer).toBeUndefined();
    });
  });

  describe('getToolPanelElements', () => {
    it('should return empty array for grid without tool panels', () => {
      const gridElement = document.createElement('tbw-grid');
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toEqual([]);
    });

    it('should return empty array when tool panels have no registered renderers', () => {
      const gridElement = document.createElement('tbw-grid');
      const panel1 = document.createElement('tbw-grid-tool-panel');
      const panel2 = document.createElement('tbw-grid-tool-panel');
      gridElement.appendChild(panel1);
      gridElement.appendChild(panel2);
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toEqual([]);
    });

    it('should not return panels without id and without WeakMap registration', () => {
      const gridElement = document.createElement('tbw-grid');
      const panel = document.createElement('tbw-grid-tool-panel');
      // No id, no WeakMap entry
      gridElement.appendChild(panel);
      container.appendChild(gridElement);

      const elements = getToolPanelElements(gridElement);
      expect(elements).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// React component rendering tests
// ═══════════════════════════════════════════════════════════════════════════

describe('React component rendering', () => {
  let React: typeof import('react');
  let ReactDOM: typeof import('react-dom/client');
  let GridDetailPanel: typeof import('./grid-detail-panel').GridDetailPanel;
  let GridToolPanel: typeof import('./grid-tool-panel').GridToolPanel;

  beforeEach(async () => {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
    const detailModule = await import('./grid-detail-panel');
    const toolModule = await import('./grid-tool-panel');
    GridDetailPanel = detailModule.GridDetailPanel;
    GridToolPanel = toolModule.GridToolPanel;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * Polls the container until React 19 has committed the given custom element
   * to the DOM. A single `setTimeout(0)` is not reliable under happy-dom
   * because React's concurrent renderer can defer the commit across multiple
   * microtask/macrotask cycles, especially when `react`/`react-dom` are loaded
   * via dynamic `import()` in `beforeEach`.
   */
  async function waitForEl(container: HTMLElement, selector: string, timeoutMs = 1000): Promise<Element> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const el = container.querySelector(selector);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error(`${selector} was not rendered within ${timeoutMs}ms`);
  }

  describe('GridDetailPanel component', () => {
    it('should render a tbw-grid-detail element', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'detail');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridDetailPanel, { children: renderFn }));

      const detailEl = await waitForEl(container, 'tbw-grid-detail');
      expect(detailEl).toBeTruthy();

      root.unmount();
    });

    it('should set showExpandColumn to false', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'detail');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridDetailPanel, { children: renderFn, showExpandColumn: false }));

      const detailEl = await waitForEl(container, 'tbw-grid-detail');
      // React renders camelCase props as lowercase attributes on custom elements
      const attr = detailEl.getAttribute('showexpandcolumn') ?? detailEl.getAttribute('showExpandColumn');
      expect(attr).toBe('false');

      root.unmount();
    });
  });

  describe('GridToolPanel component', () => {
    it('should render a tbw-grid-tool-panel element', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'panel content');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridToolPanel, { id: 'test-panel', title: 'Test', children: renderFn }));

      const panelEl = await waitForEl(container, 'tbw-grid-tool-panel');
      expect(panelEl).toBeTruthy();

      root.unmount();
    });

    it('should set id and title attributes', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'panel');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridToolPanel, { id: 'my-panel', title: 'My Panel', children: renderFn }));

      const panelEl = await waitForEl(container, 'tbw-grid-tool-panel');
      expect(panelEl.getAttribute('id')).toBe('my-panel');
      expect(panelEl.getAttribute('title')).toBe('My Panel');

      root.unmount();
    });

    it('should set icon, tooltip, and order attributes', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'panel');

      const root = ReactDOM.createRoot(container);
      root.render(
        React.createElement(GridToolPanel, {
          id: 'my-panel',
          title: 'Panel',
          icon: '🔍',
          tooltip: 'Search',
          order: 5,
          children: renderFn,
        }),
      );

      const panelEl = await waitForEl(container, 'tbw-grid-tool-panel');
      expect(panelEl.getAttribute('icon')).toBe('🔍');
      expect(panelEl.getAttribute('tooltip')).toBe('Search');
      expect(panelEl.getAttribute('order')).toBe('5');

      root.unmount();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Registration + cleanup branches (mounted inside a <tbw-grid> host)
// ═══════════════════════════════════════════════════════════════════════════

describe('Registration & cleanup branches', () => {
  let React: typeof import('react');
  let ReactDOM: typeof import('react-dom/client');
  let GridDetailPanel: typeof import('./grid-detail-panel').GridDetailPanel;
  let GridToolPanel: typeof import('./grid-tool-panel').GridToolPanel;
  let GridResponsiveCard: typeof import('./grid-responsive-card').GridResponsiveCard;
  let getDetailRenderer: typeof import('./grid-detail-panel').getDetailRenderer;
  let getResponsiveCardRenderer: typeof import('./grid-responsive-card').getResponsiveCardRenderer;
  let getToolPanelRenderer: typeof import('./grid-tool-panel').getToolPanelRenderer;

  beforeEach(async () => {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
    const detailModule = await import('./grid-detail-panel');
    const toolModule = await import('./grid-tool-panel');
    const cardModule = await import('./grid-responsive-card');
    GridDetailPanel = detailModule.GridDetailPanel;
    GridToolPanel = toolModule.GridToolPanel;
    GridResponsiveCard = cardModule.GridResponsiveCard;
    getDetailRenderer = detailModule.getDetailRenderer;
    getResponsiveCardRenderer = cardModule.getResponsiveCardRenderer;
    getToolPanelRenderer = toolModule.getToolPanelRenderer;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function waitFor<T>(fn: () => T | undefined, timeoutMs = 1000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const v = fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error('waitFor timed out');
  }

  it('GridDetailPanel: registers by grid id when mounted inside a tbw-grid with id', async () => {
    const gridEl = document.createElement('tbw-grid');
    gridEl.id = 'detail-host-1';
    document.body.appendChild(gridEl);

    const renderFn = () => React.createElement('div', null, 'detail');
    const root = ReactDOM.createRoot(gridEl);
    root.render(React.createElement(GridDetailPanel, { children: renderFn }));

    // Wait for the renderer to be registered against the host grid.
    const renderer = await waitFor(() => getDetailRenderer(gridEl));
    expect(typeof renderer).toBe('function');

    root.unmount();
    // Cleanup runs the gridDetailRegistry.delete(gridId) branch.
  });

  it('GridDetailPanel: registers by data-grid-id attribute fallback', async () => {
    const gridEl = document.createElement('tbw-grid');
    gridEl.setAttribute('data-grid-id', 'detail-host-2');
    document.body.appendChild(gridEl);

    const renderFn = () => React.createElement('div', null, 'detail');
    const root = ReactDOM.createRoot(gridEl);
    root.render(React.createElement(GridDetailPanel, { children: renderFn }));

    const renderer = await waitFor(() => getDetailRenderer(gridEl));
    expect(typeof renderer).toBe('function');

    root.unmount();
  });

  it('GridResponsiveCard: registers by grid id when mounted inside a tbw-grid with id', async () => {
    const gridEl = document.createElement('tbw-grid');
    gridEl.id = 'card-host-1';
    document.body.appendChild(gridEl);

    const renderFn = () => React.createElement('div', null, 'card');
    const root = ReactDOM.createRoot(gridEl);
    root.render(React.createElement(GridResponsiveCard, { children: renderFn }));

    const renderer = await waitFor(() => getResponsiveCardRenderer(gridEl));
    expect(typeof renderer).toBe('function');

    root.unmount();
  });

  it('GridResponsiveCard: registers by data-grid-id attribute fallback', async () => {
    const gridEl = document.createElement('tbw-grid');
    gridEl.setAttribute('data-grid-id', 'card-host-2');
    document.body.appendChild(gridEl);

    const renderFn = () => React.createElement('div', null, 'card');
    const root = ReactDOM.createRoot(gridEl);
    root.render(React.createElement(GridResponsiveCard, { children: renderFn }));

    const renderer = await waitFor(() => getResponsiveCardRenderer(gridEl));
    expect(typeof renderer).toBe('function');

    root.unmount();
  });

  it('GridToolPanel: id-based registry lookup returns the registered renderer', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const renderFn = () => React.createElement('div', null, 'panel');
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(GridToolPanel, { id: 'tool-1', title: 'Tool 1', children: renderFn }));

    await waitFor(() => container.querySelector('tbw-grid-tool-panel') as HTMLElement | null);

    // Lookup via a fresh element with the same id — exercises the panelIdRegistry fallback path
    // in `getToolPanelRenderer` (no WeakMap entry → ID lookup).
    const detached = document.createElement('tbw-grid-tool-panel');
    detached.id = 'tool-1';
    expect(typeof getToolPanelRenderer(detached)).toBe('function');

    root.unmount();
  });
});
