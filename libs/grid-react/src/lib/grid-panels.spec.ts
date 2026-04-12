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

  describe('GridDetailPanel component', () => {
    it('should render a tbw-grid-detail element', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'detail');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridDetailPanel, { children: renderFn }));
      await new Promise((r) => setTimeout(r, 0));

      const detailEl = container.querySelector('tbw-grid-detail');
      expect(detailEl).toBeTruthy();

      root.unmount();
    });

    it('should set showExpandColumn to false', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'detail');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridDetailPanel, { children: renderFn, showExpandColumn: false }));
      await new Promise((r) => setTimeout(r, 0));

      const detailEl = container.querySelector('tbw-grid-detail');
      // React renders camelCase props as lowercase attributes on custom elements
      const attr = detailEl?.getAttribute('showexpandcolumn') ?? detailEl?.getAttribute('showExpandColumn');
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
      await new Promise((r) => setTimeout(r, 0));

      const panelEl = container.querySelector('tbw-grid-tool-panel');
      expect(panelEl).toBeTruthy();

      root.unmount();
    });

    it('should set id and title attributes', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const renderFn = () => React.createElement('div', null, 'panel');

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(GridToolPanel, { id: 'my-panel', title: 'My Panel', children: renderFn }));
      await new Promise((r) => setTimeout(r, 0));

      const panelEl = container.querySelector('tbw-grid-tool-panel');
      expect(panelEl?.getAttribute('id')).toBe('my-panel');
      expect(panelEl?.getAttribute('title')).toBe('My Panel');

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
      await new Promise((r) => setTimeout(r, 0));

      const panelEl = container.querySelector('tbw-grid-tool-panel');
      expect(panelEl?.getAttribute('icon')).toBe('🔍');
      expect(panelEl?.getAttribute('tooltip')).toBe('Search');
      expect(panelEl?.getAttribute('order')).toBe('5');

      root.unmount();
    });
  });
});
