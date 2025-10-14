/**
 * Shell Module Unit Tests
 *
 * Tests the pure functions for shell header bar and tool panel infrastructure.
 */

import { beforeEach, describe, expect, it } from 'vitest';
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
      expect(state.lightDomButtons).toEqual([]);
      expect(state.lightDomHeaderContent).toEqual([]);
      expect(state.activePanel).toBeNull();
    });
  });

  describe('shouldRenderShellHeader', () => {
    it('returns false when no config and empty state', () => {
      expect(shouldRenderShellHeader(undefined, state)).toBe(false);
    });

    it('returns true when config has title', () => {
      const config: ShellConfig = { header: { title: 'My Grid' } };
      expect(shouldRenderShellHeader(config, state)).toBe(true);
    });

    it('returns true when config has toolbar buttons', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [
            {
              id: 'refresh',
              label: 'Refresh',
              icon: '↻',
              action: () => {
                /* noop */
              },
            },
          ],
        },
      };
      expect(shouldRenderShellHeader(config, state)).toBe(true);
    });

    it('returns true when tool panels are registered', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      expect(shouldRenderShellHeader(undefined, state)).toBe(true);
    });

    it('returns true when header contents are registered', () => {
      const content: HeaderContentDefinition = {
        id: 'search',
        render: () => {
          /* noop */
        },
      };
      state.headerContents.set('search', content);
      expect(shouldRenderShellHeader(undefined, state)).toBe(true);
    });

    it('returns true when API toolbar buttons are registered', () => {
      state.toolbarButtons.set('custom', {
        id: 'custom',
        label: 'Custom',
        icon: '★',
        action: () => {
          /* noop */
        },
      });
      expect(shouldRenderShellHeader(undefined, state)).toBe(true);
    });

    it('returns true when light DOM buttons exist', () => {
      state.lightDomButtons = [document.createElement('button')];
      expect(shouldRenderShellHeader(undefined, state)).toBe(true);
    });

    it('returns true when light DOM header content exists', () => {
      state.lightDomHeaderContent = [document.createElement('div')];
      expect(shouldRenderShellHeader(undefined, state)).toBe(true);
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

    it('renders header without title section when not configured', () => {
      const html = renderShellHeader(undefined, state);

      expect(html).toContain('tbw-shell-header');
      expect(html).not.toContain('tbw-shell-title');
    });

    it('renders panel toggle buttons for registered panels', () => {
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

      expect(html).toContain('data-panel="columns"');
      expect(html).toContain('☰');
      expect(html).toContain('title="Show/hide columns"');
    });

    it('marks active panel button as active', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      state.activePanel = 'columns';

      const html = renderShellHeader(undefined, state);

      expect(html).toContain('class="tbw-toolbar-btn active"');
      expect(html).toContain('aria-pressed="true"');
    });

    it('renders config toolbar buttons with icon/action', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [
            {
              id: 'refresh',
              label: 'Refresh',
              icon: '↻',
              action: () => {
                /* noop */
              },
            },
          ],
        },
      };

      const html = renderShellHeader(config, state);

      expect(html).toContain('data-btn="refresh"');
      expect(html).toContain('↻');
      expect(html).toContain('title="Refresh"');
    });

    it('renders slot placeholders for element/render toolbar buttons', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [{ id: 'custom', label: 'Custom', element: document.createElement('button') }],
        },
      };

      const html = renderShellHeader(config, state);

      expect(html).toContain('data-btn-slot="custom"');
    });

    it('renders separator when both custom buttons and panel toggles exist', () => {
      const config: ShellConfig = {
        header: {
          toolbarButtons: [
            {
              id: 'refresh',
              label: 'Refresh',
              icon: '↻',
              action: () => {
                /* noop */
              },
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

    it('sorts panels by order', () => {
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

      // Filter should come before columns in the HTML
      const filterIdx = html.indexOf('data-panel="filter"');
      const columnsIdx = html.indexOf('data-panel="columns"');
      expect(filterIdx).toBeLessThan(columnsIdx);
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

      expect(html).toContain('role="banner"');
      expect(html).toContain('role="toolbar"');
      expect(html).toContain('aria-label="Grid tools"');
      expect(html).toContain('aria-controls="tbw-panel-columns"');
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

    it('renders tool panel when panels registered', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      state.activePanel = 'columns';

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('tbw-tool-panel');
      expect(html).toContain('open');
      expect(html).toContain('tbw-tool-panel-header');
      expect(html).toContain('Columns');
      expect(html).toContain('tbw-tool-panel-close');
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
      state.activePanel = null;

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
      state.activePanel = 'columns';

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('role="complementary"');
      expect(html).toContain('aria-label="Columns"');
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
      state.activePanelCleanup = () => {
        panelCleanupCalled = true;
      };
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
      state.lightDomButtons = [document.createElement('button')];
      state.lightDomHeaderContent = [document.createElement('div')];

      cleanupShellState(state);

      expect(state.lightDomButtons).toEqual([]);
      expect(state.lightDomHeaderContent).toEqual([]);
    });

    it('resets activePanel and activePanelCleanup', () => {
      state.activePanel = 'columns';
      state.activePanelCleanup = () => {
        /* noop */
      };

      cleanupShellState(state);

      expect(state.activePanel).toBeNull();
      expect(state.activePanelCleanup).toBeNull();
    });
  });
});
