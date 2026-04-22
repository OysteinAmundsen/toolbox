import { describe, expect, it } from 'vitest';
import { buildGridDOM, buildShellBody, buildShellHeader, cloneGridContent } from './dom-builder';

describe('dom-builder', () => {
  describe('cloneGridContent', () => {
    it('should return a DocumentFragment', () => {
      const fragment = cloneGridContent();
      expect(fragment).toBeInstanceOf(DocumentFragment);
    });

    it('should contain the scroll area structure', () => {
      const fragment = cloneGridContent();
      expect(fragment.querySelector('.tbw-scroll-area')).not.toBeNull();
    });

    it('should contain header and rows elements', () => {
      const fragment = cloneGridContent();
      expect(fragment.querySelector('.header-row')).not.toBeNull();
      expect(fragment.querySelector('.rows')).not.toBeNull();
    });

    it('should contain faux scrollbar elements', () => {
      const fragment = cloneGridContent();
      expect(fragment.querySelector('.faux-vscroll')).not.toBeNull();
      expect(fragment.querySelector('.faux-vscroll-spacer')).not.toBeNull();
    });
  });

  describe('buildGridDOM', () => {
    it('should build a grid root without shell', () => {
      const fragment = buildGridDOM({ hasShell: false });
      const root = fragment.querySelector('.tbw-grid-root');
      expect(root).not.toBeNull();
      expect(root?.classList.contains('has-shell')).toBe(false);
    });

    it('should build a grid root with shell when hasShell is true', () => {
      const shellHeader = document.createElement('div');
      shellHeader.className = 'tbw-shell-header';
      const shellBody = document.createElement('div');
      shellBody.className = 'tbw-shell-body';
      const fragment = buildGridDOM({ hasShell: true, shellHeader, shellBody });
      const root = fragment.querySelector('.tbw-grid-root');
      expect(root?.classList.contains('has-shell')).toBe(true);
    });

    it('should contain grid content wrapper when no shell', () => {
      const fragment = buildGridDOM({ hasShell: false });
      expect(fragment.querySelector('.tbw-grid-content')).not.toBeNull();
    });
  });

  describe('buildShellHeader', () => {
    const baseOpts = {
      title: 'Test',
      hasPanels: false,
      isPanelOpen: false,
      toolPanelIcon: '\u2699',
      configButtons: [],
      apiButtons: [],
    };

    it('should create a shell header element', () => {
      const header = buildShellHeader(baseOpts);
      expect(header.className).toBe('tbw-shell-header');
    });

    it('should include title when provided', () => {
      const header = buildShellHeader({ ...baseOpts, title: 'My Grid' });
      expect(header.querySelector('.tbw-shell-title')?.textContent).toBe('My Grid');
    });

    it('should include panel toggle button when hasPanels is true', () => {
      const header = buildShellHeader({ ...baseOpts, hasPanels: true });
      expect(header.querySelector('[data-panel-toggle]')).not.toBeNull();
    });

    it('should mark toggle button as active when panel is open', () => {
      const header = buildShellHeader({ ...baseOpts, hasPanels: true, isPanelOpen: true });
      expect(header.querySelector('[data-panel-toggle]')?.classList.contains('active')).toBe(true);
    });
  });

  describe('buildShellBody', () => {
    const baseOpts = {
      position: 'right' as const,
      isPanelOpen: false,
      expandIcon: '+',
      collapseIcon: '-',
      panels: [],
    };

    it('should create a shell body element', () => {
      const body = buildShellBody(baseOpts);
      expect(body.className).toBe('tbw-shell-body');
    });

    it('should contain grid content', () => {
      const body = buildShellBody(baseOpts);
      expect(body.querySelector('.tbw-grid-content')).not.toBeNull();
    });

    it('should include tool panel when panels are provided', () => {
      const body = buildShellBody({
        ...baseOpts,
        isPanelOpen: true,
        panels: [{ id: 'test', title: 'Test Panel', isExpanded: true }],
      });
      expect(body.querySelector('.tbw-tool-panel')).not.toBeNull();
    });

    it('should position tool panel on left when position is left', () => {
      const body = buildShellBody({
        ...baseOpts,
        position: 'left',
        isPanelOpen: true,
        panels: [{ id: 'test', title: 'Test Panel', isExpanded: true }],
      });
      expect(body.firstElementChild).toBe(body.querySelector('.tbw-tool-panel'));
    });

    it('should position tool panel on right when position is right', () => {
      const body = buildShellBody({
        ...baseOpts,
        isPanelOpen: true,
        panels: [{ id: 'test', title: 'Test Panel', isExpanded: true }],
      });
      expect(body.firstElementChild).toBe(body.querySelector('.tbw-grid-content'));
    });
  });
});
