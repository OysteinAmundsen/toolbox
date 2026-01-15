/**
 * Shell Module Unit Tests
 *
 * Tests the pure functions for shell header bar and tool panel infrastructure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeaderContentDefinition, ShellConfig, ToolPanelDefinition } from '../types';
import {
  cleanupShellState,
  createShellState,
  renderShellBody,
  renderShellHeader,
  shouldRenderShellHeader,
  type ShellState,
} from './shell';

describe('shell module', () => {
  let state: ShellState;

  beforeEach(() => {
    state = createShellState();
  });

  describe('createShellState', () => {
    it('returns initial state with empty collections', () => {
      expect(state.toolPanels).toBeInstanceOf(Map);
      expect(state.toolPanels.size).toBe(0);
      expect(state.headerContents).toBeInstanceOf(Map);
      expect(state.headerContents.size).toBe(0);
      expect(state.toolbarButtons).toBeInstanceOf(Map);
      expect(state.toolbarButtons.size).toBe(0);
      expect(state.hasToolButtonsContainer).toBe(false);
      expect(state.lightDomHeaderContent).toEqual([]);
      expect(state.isPanelOpen).toBe(false);
    });
  });

  describe('shouldRenderShellHeader', () => {
    it('returns false when no config', () => {
      expect(shouldRenderShellHeader(undefined)).toBe(false);
    });

    it('returns true when config has title', () => {
      const config: ShellConfig = { header: { title: 'My Grid' } };
      expect(shouldRenderShellHeader(config)).toBe(true);
    });

    it('returns true when config has toolbar buttons with element/render', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [
            {
              id: 'refresh',
              element: document.createElement('button'),
            },
          ],
        },
      };
      expect(shouldRenderShellHeader(config)).toBe(true);
    });

    it('returns true when tool panels are configured', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      const config: ShellConfig = { toolPanels: [panel] };
      expect(shouldRenderShellHeader(config)).toBe(true);
    });

    it('returns true when header contents are configured', () => {
      const content: HeaderContentDefinition = {
        id: 'search',
        render: () => {
          /* noop */
        },
      };
      const config: ShellConfig = { headerContents: [content] };
      expect(shouldRenderShellHeader(config)).toBe(true);
    });

    it('returns true when light DOM header content exists in config', () => {
      const config: ShellConfig = { header: { lightDomContent: [document.createElement('div')] } };
      expect(shouldRenderShellHeader(config)).toBe(true);
    });

    it('returns true when tool buttons container was found in config', () => {
      const config: ShellConfig = { header: { hasToolButtonsContainer: true } };
      expect(shouldRenderShellHeader(config)).toBe(true);
    });
  });

  describe('renderShellHeader', () => {
    it('renders header with title when configured', () => {
      const config: ShellConfig = { header: { title: 'My Grid' } };
      const html = renderShellHeader(config, state);

      expect(html).toContain('tbw-shell-header');
      expect(html).toContain('My Grid');
      expect(html).toContain('tbw-shell-title');
    });

    it('escapes HTML in title to prevent XSS', () => {
      const config: ShellConfig = { header: { title: '<script>alert("xss")</script>' } };
      const html = renderShellHeader(config, state);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;/script&gt;');
    });

    it('escapes HTML entities in light DOM title', () => {
      state.lightDomTitle = '<img src=x onerror=alert(1)>';
      const html = renderShellHeader(undefined, state);

      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });

    it('renders header without title section when not configured', () => {
      const html = renderShellHeader(undefined, state);

      expect(html).toContain('tbw-shell-header');
      expect(html).not.toContain('tbw-shell-title');
    });

    it('renders single panel toggle button when panels registered', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        tooltip: 'Show/hide columns',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellHeader(undefined, state);

      expect(html).toContain('data-panel-toggle');
      expect(html).toContain('☰');
      expect(html).toContain('title="Settings"');
    });

    it('marks panel toggle button as active when panel is open', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      state.isPanelOpen = true;

      const html = renderShellHeader(undefined, state);

      expect(html).toContain('class="tbw-toolbar-btn active"');
      expect(html).toContain('aria-pressed="true"');
    });

    it('renders slot placeholders for element/render toolbar buttons', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [{ id: 'custom', element: document.createElement('button') }],
        },
      };

      const html = renderShellHeader(config, state);

      expect(html).toContain('data-btn-slot="custom"');
    });

    it('always includes toolbar slot for light DOM buttons', () => {
      const html = renderShellHeader(undefined, state);

      expect(html).toContain('slot name="toolbar"');
    });

    it('renders separator when both element buttons and panel toggles exist', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [
            {
              id: 'refresh',
              element: document.createElement('button'),
            },
          ],
        },
      };
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellHeader(config, state);

      expect(html).toContain('tbw-toolbar-separator');
    });

    it('does not render separator when only panel toggles exist', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellHeader(undefined, state);

      expect(html).not.toContain('tbw-toolbar-separator');
    });

    it('renders single panel toggle for multiple panels', () => {
      const panel1: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        order: 20,
        render: () => {
          /* noop */
        },
      };
      const panel2: ToolPanelDefinition = {
        id: 'filter',
        title: 'Filter',
        icon: '⚙',
        order: 10,
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel1);
      state.toolPanels.set('filter', panel2);

      const html = renderShellHeader(undefined, state);

      // Should only have one toggle button
      const matches = html.match(/data-panel-toggle/g);
      expect(matches).toHaveLength(1);
    });

    it('renders ARIA attributes for accessibility', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellHeader(undefined, state);

      // Shell elements inside role="grid" must use role="presentation" to be valid ARIA children
      expect(html).toContain('role="presentation"');
      expect(html).toContain('aria-controls="tbw-tool-panel"');
    });
  });

  describe('renderShellBody', () => {
    const gridContentHtml = '<div class="test-grid-content"></div>';

    it('renders grid content inside shell body', () => {
      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('tbw-shell-body');
      expect(html).toContain('tbw-grid-content');
      expect(html).toContain('test-grid-content');
    });

    it('renders tool panel with accordion sections when panels registered', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      state.isPanelOpen = true;

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('tbw-tool-panel');
      expect(html).toContain('open');
      expect(html).toContain('tbw-accordion');
      expect(html).toContain('tbw-accordion-section');
      expect(html).toContain('data-section="columns"');
      expect(html).toContain('Columns');
    });

    it('does not include open class when panel is closed', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      state.isPanelOpen = false;

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('tbw-tool-panel');
      expect(html).not.toContain('tbw-tool-panel open');
    });

    it('positions panel on right by default', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('data-position="right"');
      // Panel should come after content
      const contentIdx = html.indexOf('tbw-grid-content');
      const panelIdx = html.indexOf('tbw-tool-panel');
      expect(contentIdx).toBeLessThan(panelIdx);
    });

    it('positions panel on left when configured', () => {
      const config: ShellConfig = { toolPanel: { position: 'left' } };
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellBody(config, state, gridContentHtml);

      expect(html).toContain('data-position="left"');
      // Panel should come before content
      const contentIdx = html.indexOf('tbw-grid-content');
      const panelIdx = html.indexOf('tbw-tool-panel');
      expect(panelIdx).toBeLessThan(contentIdx);
    });

    it('does not render panel when no panels registered', () => {
      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('tbw-shell-body');
      expect(html).not.toContain('tbw-tool-panel');
    });

    it('renders ARIA attributes for accordion sections', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      state.isPanelOpen = true;

      const html = renderShellBody(undefined, state, gridContentHtml);

      // Tool panel inside role="grid" must use role="presentation" to be valid ARIA children
      expect(html).toContain('role="presentation"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="tbw-section-columns"');
    });
  });

  describe('cleanupShellState', () => {
    it('calls all cleanup functions', () => {
      let headerCleanupCalled = false;
      let panelCleanupCalled = false;
      let buttonCleanupCalled = false;

      state.headerContentCleanups.set('search', () => {
        headerCleanupCalled = true;
      });
      state.panelCleanups.set('columns', () => {
        panelCleanupCalled = true;
      });
      state.toolbarButtonCleanups.set('custom', () => {
        buttonCleanupCalled = true;
      });

      cleanupShellState(state);

      expect(headerCleanupCalled).toBe(true);
      expect(panelCleanupCalled).toBe(true);
      expect(buttonCleanupCalled).toBe(true);
    });

    it('clears all Maps', () => {
      state.toolPanels.set('columns', {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      });
      state.headerContents.set('search', {
        id: 'search',
        render: () => {
          /* noop */
        },
      });
      state.toolbarButtons.set('custom', {
        id: 'custom',
        label: 'Custom',
        icon: '★',
        action: () => {
          /* noop */
        },
      });
      state.headerContentCleanups.set('search', () => {
        /* noop */
      });
      state.toolbarButtonCleanups.set('custom', () => {
        /* noop */
      });

      cleanupShellState(state);

      expect(state.toolPanels.size).toBe(0);
      expect(state.headerContents.size).toBe(0);
      expect(state.toolbarButtons.size).toBe(0);
      expect(state.headerContentCleanups.size).toBe(0);
      expect(state.toolbarButtonCleanups.size).toBe(0);
    });

    it('clears arrays', () => {
      state.lightDomHeaderContent = [document.createElement('div')];

      cleanupShellState(state);

      expect(state.lightDomHeaderContent).toEqual([]);
    });

    it('resets isPanelOpen state', () => {
      state.isPanelOpen = true;
      state.expandedSections.add('columns');

      cleanupShellState(state);

      expect(state.isPanelOpen).toBe(false);
    });
  });

  describe('parseLightDomToolPanels', () => {
    let host: HTMLDivElement;

    beforeEach(() => {
      host = document.createElement('div');
    });

    it('parses tool panel elements with required attributes', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="filters" title="Filters" icon="🔍" tooltip="Filter data" order="10">
          <div class="filter-content">Filter UI here</div>
        </tbw-grid-tool-panel>
      `;

      parseLightDomToolPanels(host, state);

      expect(state.toolPanels.size).toBe(1);
      expect(state.toolPanels.has('filters')).toBe(true);

      const panel = state.toolPanels.get('filters');
      expect(panel?.title).toBe('Filters');
      expect(panel?.icon).toBe('🔍');
      expect(panel?.tooltip).toBe('Filter data');
      expect(panel?.order).toBe(10);
    });

    it('skips tool panels without required id or title', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="no-title">Content</tbw-grid-tool-panel>
        <tbw-grid-tool-panel title="No ID">Content</tbw-grid-tool-panel>
      `;

      // Suppress expected warning about missing attributes
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* intentionally empty */
      });
      parseLightDomToolPanels(host, state);
      warnSpy.mockRestore();

      expect(state.toolPanels.size).toBe(0);
    });

    it('hides parsed tool panel elements', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="test" title="Test">Content</tbw-grid-tool-panel>
      `;

      const panelEl = host.querySelector('tbw-grid-tool-panel') as HTMLElement;
      expect(panelEl.style.display).toBe('');

      parseLightDomToolPanels(host, state);

      expect(panelEl.style.display).toBe('none');
    });

    it('tracks parsed panel IDs to avoid re-parsing', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="test" title="Test">Content</tbw-grid-tool-panel>
      `;

      parseLightDomToolPanels(host, state);
      expect(state.lightDomToolPanelIds.has('test')).toBe(true);

      // Modify the panel definition
      state.toolPanels.get('test')!.title = 'Modified';

      // Re-parse should not overwrite
      parseLightDomToolPanels(host, state);
      expect(state.toolPanels.get('test')!.title).toBe('Modified');
    });

    it('uses framework adapter renderer when provided', async () => {
      const { parseLightDomToolPanels } = await import('./shell');
      let adapterCalled = false;

      host.innerHTML = `
        <tbw-grid-tool-panel id="custom" title="Custom Panel">Template content</tbw-grid-tool-panel>
      `;

      const rendererFactory = () => {
        adapterCalled = true;
        return (container: HTMLElement) => {
          container.innerHTML = '<div>From adapter</div>';
        };
      };

      parseLightDomToolPanels(host, state, rendererFactory);

      expect(adapterCalled).toBe(true);

      const panel = state.toolPanels.get('custom');
      expect(panel).toBeDefined();

      // Test the render function
      const container = document.createElement('div');
      panel!.render(container);
      expect(container.innerHTML).toBe('<div>From adapter</div>');
    });

    it('falls back to innerHTML when no adapter renderer', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="vanilla" title="Vanilla Panel">
          <div class="my-content">Static content</div>
        </tbw-grid-tool-panel>
      `;

      parseLightDomToolPanels(host, state);

      const panel = state.toolPanels.get('vanilla');
      expect(panel).toBeDefined();

      // Test the render function
      const container = document.createElement('div');
      panel!.render(container);
      expect(container.querySelector('.my-content')).toBeTruthy();
    });
  });
});
