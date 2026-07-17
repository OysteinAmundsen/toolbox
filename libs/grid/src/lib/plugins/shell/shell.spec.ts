/**
 * Shell Module Unit Tests
 *
 * Tests the pure functions for shell header bar and tool panel infrastructure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalGrid } from '../../core/types';
import {
  cleanupShellState,
  createShellState,
  hideToolPanelDropdown,
  renderShellBody,
  renderShellHeader,
  repairDropdownAnchor,
  setupClickOutsideDismiss,
  setupEscapeDismiss,
  shouldRenderHeaderBar,
  shouldRenderShellHeader,
  showToolPanelDropdown,
  type ShellState,
} from './shell';
import { createShellController } from './shell-controller';
import type { HeaderContentDefinition, ShellConfig, ToolPanelDefinition } from './types';

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
      expect(state.toolbarContents).toBeInstanceOf(Map);
      expect(state.toolbarContents.size).toBe(0);
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

    it('returns true when config has toolbar contents with render', () => {
      const config: ShellConfig = {
        header: {
          toolbarContents: [
            {
              id: 'refresh',
              render: () => {
                /* noop */
              },
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

  describe('shouldRenderHeaderBar', () => {
    it('returns true when config is undefined', () => {
      expect(shouldRenderHeaderBar(undefined)).toBe(true);
    });

    it('returns true by default when header.visible is not set', () => {
      const config: ShellConfig = { header: { title: 'My Grid' } };
      expect(shouldRenderHeaderBar(config)).toBe(true);
    });

    it('returns true when header.visible is explicitly true', () => {
      const config: ShellConfig = { header: { visible: true } };
      expect(shouldRenderHeaderBar(config)).toBe(true);
    });

    it('returns false only when header.visible is explicitly false', () => {
      const config: ShellConfig = { header: { visible: false } };
      expect(shouldRenderHeaderBar(config)).toBe(false);
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
      expect(html).toContain('data-icon="tool-panel"');
      expect(html).toContain('title="Settings"');
      // Regression: issue #296 — the data-panel-toggle button specifically
      // MUST have type="button" so it doesn't default to type="submit"
      // inside a <form>. Match the button tag directly so this can't be
      // satisfied by a `type="button"` appearing elsewhere in the header.
      const toggleMatch = html.match(/<button\b[^>]*\bdata-panel-toggle\b[^>]*>/);
      expect(toggleMatch, 'expected a <button data-panel-toggle ...> in the header HTML').not.toBeNull();
      expect(toggleMatch![0]).toContain('type="button"');
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

    it('renders slot placeholders for toolbar contents with render', () => {
      const config: ShellConfig = {
        header: {
          toolbarContents: [
            {
              id: 'custom',
              render: () => {
                /* noop */
              },
            },
          ],
        },
      };

      const html = renderShellHeader(config, state);

      expect(html).toContain('data-toolbar-content="custom"');
    });

    it('renders slot for light DOM toolbar content when registered in state', () => {
      // Simulate light DOM parsing - adds a content entry to state.toolbarContents
      state.toolbarContents.set('light-dom-toolbar-content', {
        id: 'light-dom-toolbar-content',
        order: 0,
        render: () => {
          /* noop */
        },
      });
      state.lightDomToolbarContentIds.add('light-dom-toolbar-content');

      const html = renderShellHeader(undefined, state);

      // Should create a slot for the light DOM toolbar content
      expect(html).toContain('data-toolbar-content="light-dom-toolbar-content"');
    });

    it('renders separator when both toolbar contents and panel toggles exist', () => {
      const config: ShellConfig = {
        header: {
          toolbarContents: [
            {
              id: 'refresh',
              render: () => {
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

    it('omits built-in toggle button when shell.header.toolPanelToggle is false', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellHeader({ header: { toolPanelToggle: false } }, state);

      expect(html).not.toContain('data-panel-toggle');
      expect(html).not.toContain('tbw-toolbar-btn');
      // Header itself still renders so consumer toolbarContents can mount.
      expect(html).toContain('tbw-shell-header');
    });

    it('omits separator when toolPanelToggle is false even with custom toolbar contents', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);
      const config: ShellConfig = {
        header: {
          toolPanelToggle: false,
          toolbarContents: [
            {
              id: 'eds-button',
              render: () => {
                /* noop */
              },
            },
          ],
        },
      };

      const html = renderShellHeader(config, state);

      expect(html).toContain('data-toolbar-content="eds-button"');
      expect(html).not.toContain('tbw-toolbar-separator');
      expect(html).not.toContain('data-panel-toggle');
    });

    it('still renders built-in toggle when toolPanelToggle is explicitly true (default)', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellHeader({ header: { toolPanelToggle: true } }, state);

      expect(html).toContain('data-panel-toggle');
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

    it('defaults shell body to overlay mode', () => {
      const html = renderShellBody(undefined, state, gridContentHtml);
      expect(html).toContain('data-mode="overlay"');
    });

    it('emits data-mode="push" on shell body when configured', () => {
      const config: ShellConfig = { toolPanel: { mode: 'push' } };
      const html = renderShellBody(config, state, gridContentHtml);
      expect(html).toContain('data-mode="push"');
    });

    it('emits data-mode="dropdown" and a manual popover attribute when configured', () => {
      const config: ShellConfig = { toolPanel: { mode: 'dropdown' } };
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const html = renderShellBody(config, state, gridContentHtml);

      expect(html).toContain('data-mode="dropdown"');
      expect(html).toContain('popover="manual"');
    });

    it('does not set a popover attribute in overlay or push modes', () => {
      const panel: ToolPanelDefinition = {
        id: 'columns',
        title: 'Columns',
        render: () => {
          /* noop */
        },
      };
      state.toolPanels.set('columns', panel);

      const overlay = renderShellBody(undefined, state, gridContentHtml);
      const push = renderShellBody({ toolPanel: { mode: 'push' } }, state, gridContentHtml);

      expect(overlay).not.toContain('popover=');
      expect(push).not.toContain('popover=');
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

  describe('renderShellBody — optional tool panel title', () => {
    const gridContentHtml = '<div class="test-grid-content"></div>';

    it('skips the accordion header entirely for a single title-less panel', () => {
      state.toolPanels.set('columns', {
        id: 'columns',
        icon: '☰',
        render: () => {
          /* noop */
        },
      });
      state.isPanelOpen = true;

      const html = renderShellBody(undefined, state, gridContentHtml);

      // Section still renders (content is shown directly)…
      expect(html).toContain('data-section="columns"');
      expect(html).toContain('tbw-accordion-content');
      // …but the header button is omitted.
      expect(html).not.toContain('tbw-accordion-header');
    });

    it('renders the accordion header for a single panel when a title is given', () => {
      state.toolPanels.set('columns', {
        id: 'columns',
        title: 'Columns',
        render: () => {
          /* noop */
        },
      });
      state.isPanelOpen = true;

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).toContain('tbw-accordion-header');
      expect(html).toContain('Columns');
    });

    it('renders a title-less header (empty title span) when multiple panels are registered', () => {
      state.toolPanels.set('columns', {
        id: 'columns',
        render: () => {
          /* noop */
        },
      });
      state.toolPanels.set('filters', {
        id: 'filters',
        title: 'Filters',
        render: () => {
          /* noop */
        },
      });
      state.isPanelOpen = true;

      const html = renderShellBody(undefined, state, gridContentHtml);

      // Both headers render (chevron/toggle needed to switch sections)…
      expect(html).toContain('data-section="columns"');
      expect(html).toContain('data-section="filters"');
      // …and the title-less panel keeps an empty title span plus a chevron.
      expect(html).toContain('<span class="tbw-accordion-title"></span>');
      expect(html).toContain('tbw-accordion-chevron');
    });

    it('escapes the panel title to prevent XSS', () => {
      state.toolPanels.set('columns', {
        id: 'columns',
        title: '<img src=x onerror=alert(1)>',
        render: () => {
          /* noop */
        },
      });
      state.toolPanels.set('filters', {
        id: 'filters',
        title: 'Filters',
        render: () => {
          /* noop */
        },
      });
      state.isPanelOpen = true;

      const html = renderShellBody(undefined, state, gridContentHtml);

      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
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
      state.toolbarContentCleanups.set('custom', () => {
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
      state.toolbarContents.set('custom', {
        id: 'custom',
        render: () => {
          /* noop */
        },
      });
      state.headerContentCleanups.set('search', () => {
        /* noop */
      });
      state.toolbarContentCleanups.set('custom', () => {
        /* noop */
      });

      cleanupShellState(state);

      expect(state.toolPanels.size).toBe(0);
      expect(state.headerContents.size).toBe(0);
      expect(state.toolbarContents.size).toBe(0);
      expect(state.headerContentCleanups.size).toBe(0);
      expect(state.toolbarContentCleanups.size).toBe(0);
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

    it('clears adapterBoundToolPanelIds so reconnect re-triggers vanilla→adapter teardown', () => {
      // Regression: <tbw-grid> reuses #shellState across disconnect/reconnect.
      // If adapterBoundToolPanelIds isn't cleared on cleanup, a panel parsed
      // during the next lifecycle would see firstAdapterAttach=false and skip
      // the required teardown when the adapter renderer first becomes
      // available, leaving the vanilla fallback rendered.
      state.lightDomToolPanelIds.add('settings');
      state.adapterBoundToolPanelIds.add('settings');

      cleanupShellState(state);

      expect(state.adapterBoundToolPanelIds.size).toBe(0);
      expect(state.lightDomToolPanelIds.size).toBe(0);
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

    it('lets a plugin-owned panel win over a colliding light-DOM panel (#370)', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      // Simulate a plugin having already contributed a panel with id "shared".
      // Plugin-owned panels live in toolPanels but NOT in lightDomToolPanelIds.
      state.toolPanels.set('shared', {
        id: 'shared',
        title: 'Plugin Panel',
        order: 100,
        render: () => undefined,
      });

      host.innerHTML = `
        <tbw-grid-tool-panel id="shared" title="Light DOM Panel">Content</tbw-grid-tool-panel>
      `;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* intentionally empty */
      });
      parseLightDomToolPanels(host, state);

      // Plugin keeps ownership; light-DOM definition is ignored.
      expect(state.toolPanels.get('shared')!.title).toBe('Plugin Panel');
      expect(state.lightDomToolPanelIds.has('shared')).toBe(false);
      // The ignored light-DOM element is hidden.
      const panelEl = host.querySelector('tbw-grid-tool-panel') as HTMLElement;
      expect(panelEl.style.display).toBe('none');
      // A diagnostic warning was emitted (TBW073).
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TBW073'));
      warnSpy.mockRestore();
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

    it('sanitizes light DOM fallback content to prevent XSS', async () => {
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="xss" title="XSS Panel">
          <div class="safe">hello</div>
          <script>window.__xssFired = true;</script>
          <img src="x" onerror="window.__xssFired = true">
        </tbw-grid-tool-panel>
      `;

      parseLightDomToolPanels(host, state);

      const panel = state.toolPanels.get('xss');
      expect(panel).toBeDefined();

      const container = document.createElement('div');
      panel!.render(container);

      // Safe content preserved
      expect(container.querySelector('.safe')).toBeTruthy();
      // <script> tags stripped by sanitizer
      expect(container.querySelector('script')).toBeNull();
      // Event-handler attributes stripped
      const img = container.querySelector('img');
      expect(img?.getAttribute('onerror')).toBeNull();
    });

    it('does not tear down adapter-rendered panel content on idempotent re-parse', async () => {
      // Regression test: previously every call to parseLightDomToolPanels with
      // an adapter renderer ran the existing panel's cleanup and forced a
      // re-render. For React/Vue users this meant any `grid.gridConfig = …`
      // setter (e.g. driven by a checkbox inside a custom tool panel that
      // toggles column visibility) unmounted their panel component, losing
      // local state and resetting the panel's scrollTop to 0.
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="settings" title="Settings"></tbw-grid-tool-panel>
      `;

      let renderCalls = 0;
      let cleanupCalls = 0;
      const rendererFactory = () => (container: HTMLElement) => {
        renderCalls++;
        container.innerHTML = '<div class="adapter">x</div>';
        return () => {
          cleanupCalls++;
        };
      };

      // First parse: registers the panel + first adapter attach
      parseLightDomToolPanels(host, state, rendererFactory);
      const panel = state.toolPanels.get('settings')!;
      // Simulate the panel being opened and rendered
      const contentArea = document.createElement('div');
      const cleanup = panel.render(contentArea);
      if (typeof cleanup === 'function') {
        state.panelCleanups.set('settings', cleanup);
      }
      expect(renderCalls).toBe(1);
      expect(cleanupCalls).toBe(0);
      expect(state.panelCleanups.has('settings')).toBe(true);

      // Re-parse with identical attributes — must NOT tear down rendered content
      parseLightDomToolPanels(host, state, rendererFactory);
      expect(cleanupCalls).toBe(0);
      expect(state.panelCleanups.has('settings')).toBe(true);

      // Re-parse with changed attributes — DOES tear down so header updates
      host.querySelector('tbw-grid-tool-panel')!.setAttribute('icon', '⚙️');
      parseLightDomToolPanels(host, state, rendererFactory);
      expect(cleanupCalls).toBe(1);
      expect(state.panelCleanups.has('settings')).toBe(false);
      expect(state.toolPanels.get('settings')!.icon).toBe('⚙️');
    });

    it('tears down vanilla fallback when an adapter renderer first becomes available', async () => {
      // The Angular case: panel parsed first with no adapter (template not
      // yet projected), so the vanilla innerHTML fallback was registered.
      // When the adapter renderer becomes available later, we MUST swap and
      // re-render — otherwise the user sees the wrong content.
      const { parseLightDomToolPanels } = await import('./shell');

      host.innerHTML = `
        <tbw-grid-tool-panel id="late" title="Late">
          <span>vanilla</span>
        </tbw-grid-tool-panel>
      `;

      // First parse: no adapter renderer → vanilla fallback
      parseLightDomToolPanels(host, state);
      const contentArea = document.createElement('div');
      const cleanup = state.toolPanels.get('late')!.render(contentArea);
      if (typeof cleanup === 'function') {
        state.panelCleanups.set('late', cleanup);
      }
      expect(state.panelCleanups.has('late')).toBe(true);

      // Second parse: adapter renderer now available → must tear down
      const rendererFactory = () => (container: HTMLElement) => {
        container.innerHTML = '<div class="adapter">x</div>';
        return () => undefined;
      };
      parseLightDomToolPanels(host, state, rendererFactory);
      expect(state.panelCleanups.has('late')).toBe(false);
    });
  });

  describe('setupClickOutsideDismiss', () => {
    let gridEl: HTMLElement;
    let onClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      gridEl = document.createElement('div');
      // Simulate minimal grid DOM structure
      const toolPanel = document.createElement('div');
      toolPanel.className = 'tbw-tool-panel';
      gridEl.appendChild(toolPanel);

      const toggleBtn = document.createElement('button');
      toggleBtn.setAttribute('data-panel-toggle', '');
      gridEl.appendChild(toggleBtn);

      const gridBody = document.createElement('div');
      gridBody.className = 'grid-body';
      gridEl.appendChild(gridBody);

      document.body.appendChild(gridEl);
      onClose = vi.fn();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('returns no-op cleanup when closeOnClickOutside is not set', () => {
      const config: ShellConfig = { toolPanel: {} };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Click on grid body — should NOT close
      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('returns no-op cleanup when config is undefined', () => {
      const cleanup = setupClickOutsideDismiss(gridEl, undefined, state, onClose);

      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('closes panel when clicking outside tool panel', () => {
      const config: ShellConfig = { toolPanel: { closeOnClickOutside: true } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Click on grid body (outside panel)
      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('does NOT close when clicking inside tool panel', () => {
      const config: ShellConfig = { toolPanel: { closeOnClickOutside: true } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Click inside the tool panel
      gridEl.querySelector('.tbw-tool-panel')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('does NOT close when clicking the toggle button', () => {
      const config: ShellConfig = { toolPanel: { closeOnClickOutside: true } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Click the panel toggle button
      gridEl.querySelector('[data-panel-toggle]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('does NOT close when panel is not open', () => {
      const config: ShellConfig = { toolPanel: { closeOnClickOutside: true } };
      state.isPanelOpen = false;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('cleanup removes the listener', () => {
      const config: ShellConfig = { toolPanel: { closeOnClickOutside: true } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);
      cleanup();

      // Click after cleanup — should NOT close
      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('is a no-op in push mode (no overlay = no meaningful "outside")', () => {
      const config: ShellConfig = {
        toolPanel: { closeOnClickOutside: true, mode: 'push' },
      };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Click anywhere outside the panel — should NOT close in push mode.
      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('closes when clicking anywhere in the window outside the panel (window-wide)', () => {
      const config: ShellConfig = { toolPanel: { closeOnClickOutside: true } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Click on an unrelated element outside the grid entirely.
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('always light-dismisses in dropdown mode even without closeOnClickOutside', () => {
      const config: ShellConfig = { toolPanel: { mode: 'dropdown' } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      gridEl.querySelector('.grid-body')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('ignores clicks on the resolved dropdown anchor element', () => {
      const config: ShellConfig = { toolPanel: { mode: 'dropdown' } };
      state.isPanelOpen = true;
      const anchor = document.createElement('button');
      gridEl.appendChild(anchor);
      state.dropdownAnchorEl = anchor;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      anchor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
      state.dropdownAnchorEl = null;
    });

    it('closes when clicking ANOTHER grid\u2019s toggle/panel (multi-grid scoping)', () => {
      // A second, independent grid on the same page with its own toggle + panel.
      const otherGrid = document.createElement('div');
      const otherPanel = document.createElement('div');
      otherPanel.className = 'tbw-tool-panel';
      otherGrid.appendChild(otherPanel);
      const otherToggle = document.createElement('button');
      otherToggle.setAttribute('data-panel-toggle', '');
      otherGrid.appendChild(otherToggle);
      document.body.appendChild(otherGrid);

      const config: ShellConfig = { toolPanel: { mode: 'dropdown' } };
      state.isPanelOpen = true;

      const cleanup = setupClickOutsideDismiss(gridEl, config, state, onClose);

      // Clicking the OTHER grid's toggle is an outside click for us — must
      // dismiss even though the node matches the generic [data-panel-toggle]
      // selector (regression: #375 left grid A stuck open when grid B opened).
      otherToggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      // Clicking the OTHER grid's panel must likewise dismiss us.
      otherPanel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(2);

      cleanup();
    });
  });

  describe('dropdown popover helpers', () => {
    let renderRoot: HTMLElement;
    let panel: HTMLElement;
    let anchor: HTMLElement;

    beforeEach(() => {
      renderRoot = document.createElement('div');
      panel = document.createElement('aside');
      panel.className = 'tbw-tool-panel';
      panel.setAttribute('data-position', 'right');
      panel.setAttribute('popover', 'manual');
      renderRoot.appendChild(panel);
      anchor = document.createElement('button');
      renderRoot.appendChild(anchor);
      document.body.appendChild(renderRoot);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('tracks the anchor and tags the placement on show', () => {
      showToolPanelDropdown(renderRoot, state, anchor, false);

      expect(state.dropdownAnchorEl).toBe(anchor);
      expect(panel.dataset.anchor).toBe('below');
    });

    it('tags corner placement when anchored to the grid corner', () => {
      showToolPanelDropdown(renderRoot, state, anchor, true);

      expect(panel.dataset.anchor).toBe('corner');
    });

    it('clears anchor wiring on hide', () => {
      showToolPanelDropdown(renderRoot, state, anchor, false);
      hideToolPanelDropdown(renderRoot, state);

      expect(state.dropdownAnchorEl).toBeNull();
      expect(panel.dataset.anchor).toBeUndefined();
      expect(anchor.style.getPropertyValue('anchor-name')).toBe('');
    });

    it('mints a UNIQUE anchor-name per grid so two open dropdowns do not collide', () => {
      // Force the anchor-positioning branch on regardless of the test DOM's
      // CSS.supports() result, so the name-pairing logic is exercised.
      const realSupports = CSS.supports;
      CSS.supports = (() => true) as typeof CSS.supports;
      try {
        // First grid opens.
        showToolPanelDropdown(renderRoot, state, anchor, false);
        const name1 = anchor.style.getPropertyValue('anchor-name');
        expect(name1).not.toBe('');
        // The popover's position-anchor must reference the SAME name the
        // trigger advertises, or CSS anchor resolution fails.
        expect(panel.style.getPropertyValue('position-anchor')).toBe(name1);

        // A second, independent grid opens its own dropdown.
        const renderRoot2 = document.createElement('div');
        const panel2 = document.createElement('aside');
        panel2.className = 'tbw-tool-panel';
        panel2.setAttribute('data-position', 'right');
        panel2.setAttribute('popover', 'manual');
        renderRoot2.appendChild(panel2);
        const anchor2 = document.createElement('button');
        renderRoot2.appendChild(anchor2);
        document.body.appendChild(renderRoot2);
        const state2 = createShellState();

        showToolPanelDropdown(renderRoot2, state2, anchor2, false);
        const name2 = anchor2.style.getPropertyValue('anchor-name');

        // The two grids MUST use different anchor names (#375 follow-up).
        expect(name2).not.toBe(name1);
        expect(panel2.style.getPropertyValue('position-anchor')).toBe(name2);
      } finally {
        CSS.supports = realSupports;
      }
    });
  });

  describe('setupEscapeDismiss', () => {
    let onClose: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onClose = vi.fn();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('closes the panel when Escape is pressed while open', () => {
      const config: ShellConfig = { toolPanel: {} };
      state.isPanelOpen = true;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('does NOT close when the panel is not open', () => {
      const config: ShellConfig = { toolPanel: {} };
      state.isPanelOpen = false;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('ignores non-Escape keys', () => {
      const config: ShellConfig = { toolPanel: {} };
      state.isPanelOpen = true;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('yields to more-specific handlers when the event was already defaultPrevented', () => {
      const config: ShellConfig = { toolPanel: {} };
      state.isPanelOpen = true;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      event.preventDefault();
      document.dispatchEvent(event);
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('is a no-op in push mode', () => {
      const config: ShellConfig = { toolPanel: { mode: 'push' } };
      state.isPanelOpen = true;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).not.toHaveBeenCalled();

      cleanup();
    });

    it('closes the dropdown popover on Escape', () => {
      const config: ShellConfig = { toolPanel: { mode: 'dropdown' } };
      state.isPanelOpen = true;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('cleanup removes the listener', () => {
      const config: ShellConfig = { toolPanel: {} };
      state.isPanelOpen = true;

      const cleanup = setupEscapeDismiss(config, state, onClose);
      cleanup();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('reanchorOpenDropdown', () => {
    let renderRoot: HTMLElement;
    let host: HTMLElement;
    let panel: HTMLElement;

    /** Append a fresh `[data-panel-toggle]` trigger to the render root. */
    function addToggle(): HTMLElement {
      const btn = document.createElement('button');
      btn.setAttribute('data-panel-toggle', '');
      renderRoot.appendChild(btn);
      return btn;
    }

    function makeGrid(mode: 'dropdown' | 'overlay' | 'push'): InternalGrid {
      const grid: Partial<InternalGrid> = {
        id: 'g1',
        _renderRoot: renderRoot,
        _hostElement: host,
        effectiveConfig: { shell: { toolPanel: { mode } } },
      };
      return grid as InternalGrid;
    }

    beforeEach(() => {
      host = document.createElement('div');
      renderRoot = document.createElement('div');
      panel = document.createElement('aside');
      panel.className = 'tbw-tool-panel';
      panel.setAttribute('popover', 'manual');
      renderRoot.appendChild(panel);
      host.appendChild(renderRoot);
      document.body.appendChild(host);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('re-anchors to a freshly recreated [data-panel-toggle] when the original trigger was detached', () => {
      // Open against the original trigger.
      const original = addToggle();
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('dropdown'));
      showToolPanelDropdown(renderRoot, state, original, false);
      expect(state.dropdownAnchorEl).toBe(original);

      // Simulate a structural re-render: the host recreates the trigger node
      // (e.g. a custom column-header button rebuilt on a column toggle).
      original.remove();
      const recreated = addToggle();
      expect(state.dropdownAnchorEl!.isConnected).toBe(false);

      controller.reanchorOpenDropdown();

      // The popover must now track the live, connected trigger.
      expect(state.dropdownAnchorEl).toBe(recreated);
      expect(state.dropdownAnchorEl!.isConnected).toBe(true);
      expect(panel.dataset.anchor).toBe('below');
    });

    it('reuses the still-connected trigger when it survived the re-render', () => {
      const toggle = addToggle();
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('dropdown'));
      showToolPanelDropdown(renderRoot, state, toggle, false);

      controller.reanchorOpenDropdown();

      expect(state.dropdownAnchorEl).toBe(toggle);
    });

    it('keeps the popover at its last position (no corner flash) when a trigger-origin dropdown loses its trigger', () => {
      const original = addToggle();
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('dropdown'));
      showToolPanelDropdown(renderRoot, state, original, false);
      expect(panel.dataset.anchor).toBe('below');

      // Re-render drops the trigger entirely with no replacement yet (an outer
      // framework will re-commit it on a later task). Re-anchoring must NOT
      // flash the popover to the grid corner — it must stay where it was so the
      // ShellPlugin observer can re-pair the trigger before paint.
      original.remove();
      controller.reanchorOpenDropdown();

      expect(panel.dataset.anchor).toBe('below');
      expect(state.dropdownAnchorEl).not.toBe(host);
    });

    it('preserves grid-corner placement on re-anchor when there is no trigger', () => {
      // Open with the corner fallback (anchored directly to the grid host).
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('dropdown'));
      showToolPanelDropdown(renderRoot, state, host, true);
      expect(state.dropdownAnchorEl).toBe(host);
      expect(panel.dataset.anchor).toBe('corner');

      // A structural re-render must keep the popover at the corner, not drop it
      // below the entire grid (which reusing the host as an explicit anchor
      // would do).
      controller.reanchorOpenDropdown();

      expect(state.dropdownAnchorEl).toBe(host);
      expect(panel.dataset.anchor).toBe('corner');
    });

    it('is a no-op when the panel is closed', () => {
      addToggle();
      state.isPanelOpen = false;
      const controller = createShellController(state, makeGrid('dropdown'));

      controller.reanchorOpenDropdown();

      expect(state.dropdownAnchorEl).toBeFalsy();
    });

    it('is a no-op when the tool panel mode is not dropdown', () => {
      addToggle();
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('overlay'));

      controller.reanchorOpenDropdown();

      expect(state.dropdownAnchorEl).toBeFalsy();
    });

    it('idempotent fast-path: skips re-anchoring when the connected trigger still carries the minted anchor-name', () => {
      const toggle = addToggle();
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('dropdown'));
      // Simulate a supported-anchor-positioning open: the trigger carries a
      // minted anchor-name and state tracks it. (showToolPanelDropdown only
      // sets these when CSS anchor positioning is supported, which happy-dom
      // does not report — so wire them up manually to exercise the fast-path.)
      state.dropdownAnchorEl = toggle;
      state.dropdownAnchorName = '--tbw-tool-panel-anchor-1';
      toggle.style.setProperty('anchor-name', '--tbw-tool-panel-anchor-1');
      panel.dataset.anchor = 'below';

      controller.reanchorOpenDropdown();

      // Anchor is intact → the same trigger is kept and no re-show occurred
      // (data-anchor untouched, anchor-name unchanged).
      expect(state.dropdownAnchorEl).toBe(toggle);
      expect(toggle.style.getPropertyValue('anchor-name')).toBe('--tbw-tool-panel-anchor-1');
    });

    it('re-anchors when the trigger lost its anchor-name even though the node is still connected', () => {
      const toggle = addToggle();
      state.isPanelOpen = true;
      const controller = createShellController(state, makeGrid('dropdown'));
      state.dropdownAnchorEl = toggle;
      state.dropdownAnchorName = '--tbw-tool-panel-anchor-1';
      // Trigger node survived but its anchor-name was cleared by a re-render
      // that reset inline styles.
      toggle.style.removeProperty('anchor-name');

      controller.reanchorOpenDropdown();

      // Fast-path must NOT short-circuit: the panel is re-shown/anchored.
      expect(state.dropdownAnchorEl).toBe(toggle);
      expect(panel.dataset.anchor).toBe('below');
    });

    it('fallback fast-path: skips the layout read when the trigger survived and the panel is still positioned', () => {
      // Fixed-coordinate fallback mode (no minted anchor-name). When nothing was
      // recreated — same connected trigger, panel still tagged `data-anchor` —
      // re-anchoring must not re-run the `getBoundingClientRect()` re-position.
      const toggle = addToggle();
      state.isPanelOpen = true;
      state.dropdownAnchorEl = toggle;
      state.dropdownAnchorName = null;
      panel.dataset.anchor = 'below';
      const controller = createShellController(state, makeGrid('dropdown'));

      const rectSpy = vi.spyOn(toggle, 'getBoundingClientRect');
      controller.reanchorOpenDropdown();

      expect(rectSpy).not.toHaveBeenCalled();
      expect(state.dropdownAnchorEl).toBe(toggle);
    });

    it('fallback path: re-positions a FRESH panel even when the trigger survived', () => {
      // A structural rebuild replaces `.tbw-tool-panel` (no `data-anchor`) while
      // the trigger node survives — the fast-path MUST NOT short-circuit here,
      // or the fresh panel would never be re-shown/positioned.
      const toggle = addToggle();
      state.isPanelOpen = true;
      state.dropdownAnchorEl = toggle;
      state.dropdownAnchorName = null;
      const controller = createShellController(state, makeGrid('dropdown'));

      panel.remove();
      const freshPanel = document.createElement('aside');
      freshPanel.className = 'tbw-tool-panel';
      freshPanel.setAttribute('popover', 'manual');
      renderRoot.appendChild(freshPanel);

      controller.reanchorOpenDropdown();

      // Fresh panel had no `data-anchor` → fast-path did not short-circuit → it
      // was re-shown and tagged.
      expect(freshPanel.dataset.anchor).toBe('below');
      expect(state.dropdownAnchorEl).toBe(toggle);
    });
  });

  describe('repairDropdownAnchor', () => {
    let renderRoot: HTMLElement;
    let panel: HTMLElement;
    let state: ShellState;

    beforeEach(() => {
      renderRoot = document.createElement('div');
      panel = document.createElement('aside');
      panel.className = 'tbw-tool-panel';
      panel.setAttribute('popover', 'manual');
      renderRoot.appendChild(panel);
      document.body.appendChild(renderRoot);
      state = createShellState();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('moves the existing anchor-name to a fresh trigger in place (no re-show)', () => {
      const old = document.createElement('button');
      old.setAttribute('data-panel-toggle', '');
      old.style.setProperty('anchor-name', '--tbw-tool-panel-anchor-1');
      renderRoot.appendChild(old);
      state.dropdownAnchorEl = old;
      state.dropdownAnchorName = '--tbw-tool-panel-anchor-1';
      // Stale fixed-coord styles from a previous fallback open must be cleared.
      panel.style.setProperty('top', '100px');
      panel.style.setProperty('left', '50px');

      const fresh = document.createElement('button');
      fresh.setAttribute('data-panel-toggle', '');
      renderRoot.appendChild(fresh);

      const result = repairDropdownAnchor(renderRoot, state, fresh);

      expect(result).toBe(true);
      expect(fresh.style.getPropertyValue('anchor-name')).toBe('--tbw-tool-panel-anchor-1');
      expect(old.style.getPropertyValue('anchor-name')).toBe('');
      expect(panel.style.getPropertyValue('position-anchor')).toBe('--tbw-tool-panel-anchor-1');
      expect(panel.style.getPropertyValue('top')).toBe('');
      expect(panel.style.getPropertyValue('left')).toBe('');
      expect(panel.dataset.anchor).toBe('below');
      expect(state.dropdownAnchorEl).toBe(fresh);
    });

    it('returns false when no anchor-name has been minted', () => {
      state.dropdownAnchorName = null;
      const fresh = document.createElement('button');
      renderRoot.appendChild(fresh);

      expect(repairDropdownAnchor(renderRoot, state, fresh)).toBe(false);
    });

    it('returns false when the tool panel is absent', () => {
      panel.remove();
      state.dropdownAnchorName = '--tbw-tool-panel-anchor-1';
      const fresh = document.createElement('button');
      renderRoot.appendChild(fresh);

      expect(repairDropdownAnchor(renderRoot, state, fresh)).toBe(false);
    });

    it('idempotently shows the popover in the top layer (a structural rebuild leaves a fresh, un-shown panel)', () => {
      // `rebuildShellDOM` creates a brand-new `.tbw-tool-panel` that is NOT in
      // the top layer. repairDropdownAnchor must re-assert the popover so the
      // dropdown is not left rendered only via the `.open` fallback.
      const showPopover = vi.fn();
      (panel as HTMLElement & { showPopover?: () => void }).showPopover = showPopover;
      state.dropdownAnchorName = '--tbw-tool-panel-anchor-1';
      const fresh = document.createElement('button');
      fresh.setAttribute('data-panel-toggle', '');
      renderRoot.appendChild(fresh);

      expect(repairDropdownAnchor(renderRoot, state, fresh)).toBe(true);
      expect(showPopover).toHaveBeenCalledTimes(1);
    });
  });
});
