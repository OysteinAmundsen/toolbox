import { describe, expect, it } from 'vitest';
import {
  appendChildren,
  buildGridDOM,
  buildShellBody,
  buildShellHeader,
  button,
  cloneGridContent,
  createElement,
  div,
  setAttrs,
  text,
} from './dom-builder';

describe('dom-builder', () => {
  describe('createElement', () => {
    it('should create an element with the specified tag', () => {
      const el = createElement('div');
      expect(el.tagName).toBe('DIV');
    });

    it('should set attributes on the element', () => {
      const el = createElement('input', { type: 'text', name: 'test', 'data-id': '123' });
      expect(el.getAttribute('type')).toBe('text');
      expect(el.getAttribute('name')).toBe('test');
      expect(el.getAttribute('data-id')).toBe('123');
    });

    it('should append text and node children', () => {
      const child = document.createElement('span');
      child.textContent = 'child';
      const el = createElement('div', undefined, ['text node', child]);
      expect(el.childNodes.length).toBe(2);
      expect(el.childNodes[0].textContent).toBe('text node');
      expect(el.childNodes[1]).toBe(child);
    });

    it('should skip null and undefined children', () => {
      const el = createElement('div', undefined, ['valid', null, undefined, 'also valid']);
      expect(el.childNodes.length).toBe(2);
    });
  });

  describe('text', () => {
    it('should create a text node', () => {
      const node = text('hello world');
      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.textContent).toBe('hello world');
    });
  });

  describe('div', () => {
    it('should create a div element', () => {
      const el = div();
      expect(el.tagName).toBe('DIV');
    });

    it('should set className', () => {
      const el = div('my-class');
      expect(el.className).toBe('my-class');
    });

    it('should set additional attributes', () => {
      const el = div('my-class', { id: 'test', role: 'button' });
      expect(el.className).toBe('my-class');
      expect(el.id).toBe('test');
      expect(el.getAttribute('role')).toBe('button');
    });
  });

  describe('button', () => {
    it('should create a button element', () => {
      const el = button();
      expect(el.tagName).toBe('BUTTON');
    });

    it('should set className and attributes', () => {
      const el = button('btn-primary', { type: 'submit', disabled: '' });
      expect(el.className).toBe('btn-primary');
      expect(el.getAttribute('type')).toBe('submit');
      expect(el.hasAttribute('disabled')).toBe(true);
    });

    it('should set string content', () => {
      const el = button('btn', undefined, 'Click me');
      expect(el.textContent).toBe('Click me');
    });

    it('should append node content', () => {
      const icon = document.createElement('span');
      icon.textContent = '★';
      const el = button('btn', undefined, icon);
      expect(el.firstChild).toBe(icon);
    });
  });

  describe('appendChildren', () => {
    it('should append multiple children to a parent', () => {
      const parent = document.createElement('div');
      const child1 = document.createElement('span');
      const child2 = document.createElement('span');
      appendChildren(parent, [child1, child2]);
      expect(parent.children.length).toBe(2);
    });

    it('should skip null and undefined children', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      appendChildren(parent, [child, null, undefined]);
      expect(parent.children.length).toBe(1);
    });
  });

  describe('setAttrs', () => {
    it('should set multiple attributes on an element', () => {
      const el = document.createElement('div');
      setAttrs(el, { id: 'test', class: 'my-class', 'data-value': '123' });
      expect(el.id).toBe('test');
      expect(el.className).toBe('my-class');
      expect(el.getAttribute('data-value')).toBe('123');
    });

    it('should skip undefined values', () => {
      const el = document.createElement('div');
      setAttrs(el, { id: 'test', class: undefined });
      expect(el.id).toBe('test');
      expect(el.hasAttribute('class')).toBe(false);
    });
  });

  describe('cloneGridContent', () => {
    it('should return a DocumentFragment', () => {
      const fragment = cloneGridContent();
      expect(fragment).toBeInstanceOf(DocumentFragment);
    });

    it('should contain the scroll area structure', () => {
      const fragment = cloneGridContent();
      const scrollArea = fragment.querySelector('.tbw-scroll-area');
      expect(scrollArea).not.toBeNull();
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
      const shellHeader = div('tbw-shell-header');
      const shellBody = div('tbw-shell-body');
      const fragment = buildGridDOM({
        hasShell: true,
        shellHeader,
        shellBody,
      });
      const root = fragment.querySelector('.tbw-grid-root');
      expect(root?.classList.contains('has-shell')).toBe(true);
    });

    it('should contain grid content wrapper when no shell', () => {
      const fragment = buildGridDOM({ hasShell: false });
      expect(fragment.querySelector('.tbw-grid-content')).not.toBeNull();
    });
  });

  describe('buildShellHeader', () => {
    it('should create a shell header element', () => {
      const header = buildShellHeader({
        title: 'Test Grid',
        hasLightDomButtons: false,
        hasPanels: false,
        isPanelOpen: false,
        toolPanelIcon: '⚙️',
        configButtons: [],
        apiButtons: [],
      });
      expect(header.className).toBe('tbw-shell-header');
    });

    it('should include title when provided', () => {
      const header = buildShellHeader({
        title: 'My Grid',
        hasLightDomButtons: false,
        hasPanels: false,
        isPanelOpen: false,
        toolPanelIcon: '⚙️',
        configButtons: [],
        apiButtons: [],
      });
      const title = header.querySelector('.tbw-shell-title');
      expect(title?.textContent).toBe('My Grid');
    });

    it('should include panel toggle button when hasPanels is true', () => {
      const header = buildShellHeader({
        title: 'Test',
        hasLightDomButtons: false,
        hasPanels: true,
        isPanelOpen: false,
        toolPanelIcon: '⚙️',
        configButtons: [],
        apiButtons: [],
      });
      const toggleBtn = header.querySelector('[data-panel-toggle]');
      expect(toggleBtn).not.toBeNull();
    });

    it('should mark toggle button as active when panel is open', () => {
      const header = buildShellHeader({
        title: 'Test',
        hasLightDomButtons: false,
        hasPanels: true,
        isPanelOpen: true,
        toolPanelIcon: '⚙️',
        configButtons: [],
        apiButtons: [],
      });
      const toggleBtn = header.querySelector('[data-panel-toggle]');
      expect(toggleBtn?.classList.contains('active')).toBe(true);
    });
  });

  describe('buildShellBody', () => {
    it('should create a shell body element', () => {
      const body = buildShellBody({
        position: 'right',
        isPanelOpen: false,
        expandIcon: '+',
        collapseIcon: '-',
        panels: [],
      });
      expect(body.className).toBe('tbw-shell-body');
    });

    it('should contain grid content', () => {
      const body = buildShellBody({
        position: 'right',
        isPanelOpen: false,
        expandIcon: '+',
        collapseIcon: '-',
        panels: [],
      });
      expect(body.querySelector('.tbw-grid-content')).not.toBeNull();
    });

    it('should include tool panel when panels are provided', () => {
      const body = buildShellBody({
        position: 'right',
        isPanelOpen: true,
        expandIcon: '+',
        collapseIcon: '-',
        panels: [{ id: 'test', title: 'Test Panel', isExpanded: true }],
      });
      expect(body.querySelector('.tbw-tool-panel')).not.toBeNull();
    });

    it('should position tool panel on left when position is left', () => {
      const body = buildShellBody({
        position: 'left',
        isPanelOpen: true,
        expandIcon: '+',
        collapseIcon: '-',
        panels: [{ id: 'test', title: 'Test Panel', isExpanded: true }],
      });
      const panel = body.querySelector('.tbw-tool-panel');
      // Panel should be first child when on left
      expect(body.firstElementChild).toBe(panel);
    });

    it('should position tool panel on right when position is right', () => {
      const body = buildShellBody({
        position: 'right',
        isPanelOpen: true,
        expandIcon: '+',
        collapseIcon: '-',
        panels: [{ id: 'test', title: 'Test Panel', isExpanded: true }],
      });
      const panel = body.querySelector('.tbw-tool-panel');
      const gridContent = body.querySelector('.tbw-grid-content');
      // Grid content should be first when panel is on right
      expect(body.firstElementChild).toBe(gridContent);
    });
  });
});
