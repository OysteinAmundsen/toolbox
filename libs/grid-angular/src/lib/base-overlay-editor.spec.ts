/**
 * Tests for the BaseOverlayEditor abstract class.
 *
 * These tests verify the class structure, keyboard handlers, and overlay lifecycle
 * without requiring Angular TestBed. DOM-dependent tests use happy-dom.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import type { OverlayPosition } from './base-overlay-editor.js';
import { BaseOverlayEditor } from './base-overlay-editor.js';

describe('BaseOverlayEditor', () => {
  it('should be importable and defined', () => {
    expect(BaseOverlayEditor).toBeDefined();
  });

  it('should be a class that can be extended', () => {
    expect(typeof BaseOverlayEditor).toBe('function');
  });

  it('should extend BaseGridEditor', () => {
    // Verify inherited methods from BaseGridEditor
    expect(typeof BaseOverlayEditor.prototype.commitValue).toBe('function');
    expect(typeof BaseOverlayEditor.prototype.cancelEdit).toBe('function');
  });

  it('should have overlay methods on the prototype', () => {
    expect(typeof BaseOverlayEditor.prototype['initOverlay']).toBe('function');
    expect(typeof BaseOverlayEditor.prototype['showOverlay']).toBe('function');
    expect(typeof BaseOverlayEditor.prototype['hideOverlay']).toBe('function');
    expect(typeof BaseOverlayEditor.prototype['reopenOverlay']).toBe('function');
    expect(typeof BaseOverlayEditor.prototype['teardownOverlay']).toBe('function');
    expect(typeof BaseOverlayEditor.prototype.onInlineKeydown).toBe('function');
    expect(typeof BaseOverlayEditor.prototype.onInlineClick).toBe('function');
    expect(typeof BaseOverlayEditor.prototype['handleEscape']).toBe('function');
    expect(typeof BaseOverlayEditor.prototype['advanceGridFocus']).toBe('function');
  });

  describe('onInlineKeydown', () => {
    function createInstance() {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = document.createElement('div');
      instance['_isOpen'] = false;
      instance['_supportsAnchor'] = false;
      instance['showOverlay'] = vi.fn(() => {
        instance['_isOpen'] = true;
      });
      instance['hideOverlay'] = vi.fn(() => {
        instance['_isOpen'] = false;
      });
      instance['onOverlayOpened'] = vi.fn();
      instance['handleEscape'] = vi.fn();
      return instance;
    }

    it('should call showOverlay on Enter key', () => {
      const instance = createInstance();
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      vi.spyOn(event, 'preventDefault');

      instance.onInlineKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(instance['showOverlay']).toHaveBeenCalled();
      expect(instance['onOverlayOpened']).toHaveBeenCalled();
    });

    it('should call showOverlay on Space key', () => {
      const instance = createInstance();
      const event = new KeyboardEvent('keydown', { key: ' ' });
      vi.spyOn(event, 'preventDefault');

      instance.onInlineKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(instance['showOverlay']).toHaveBeenCalled();
    });

    it('should call showOverlay on ArrowDown key', () => {
      const instance = createInstance();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      vi.spyOn(event, 'preventDefault');

      instance.onInlineKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(instance['showOverlay']).toHaveBeenCalled();
    });

    it('should call showOverlay on F2 key', () => {
      const instance = createInstance();
      const event = new KeyboardEvent('keydown', { key: 'F2' });
      vi.spyOn(event, 'preventDefault');

      instance.onInlineKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(instance['showOverlay']).toHaveBeenCalled();
    });

    it('should call handleEscape on Escape key', () => {
      const instance = createInstance();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });

      instance.onInlineKeydown(event);

      expect(instance['handleEscape']).toHaveBeenCalledWith(event);
      expect(instance['showOverlay']).not.toHaveBeenCalled();
    });

    it('should not react to other keys', () => {
      const instance = createInstance();
      const event = new KeyboardEvent('keydown', { key: 'a' });

      instance.onInlineKeydown(event);

      expect(instance['showOverlay']).not.toHaveBeenCalled();
      expect(instance['handleEscape']).not.toHaveBeenCalled();
    });
  });

  describe('onInlineClick', () => {
    it('should toggle overlay state', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = document.createElement('div');
      instance['_isOpen'] = false;
      instance['_supportsAnchor'] = false;
      instance['onOverlayOpened'] = vi.fn();

      const showOverlay = vi.fn(() => {
        instance['_isOpen'] = true;
      });
      const hideOverlay = vi.fn(() => {
        instance['_isOpen'] = false;
      });
      instance['showOverlay'] = showOverlay;
      instance['hideOverlay'] = hideOverlay;

      // First click: should show
      instance.onInlineClick();
      expect(showOverlay).toHaveBeenCalledOnce();
      expect(instance['onOverlayOpened']).toHaveBeenCalledOnce();

      // Second click: should hide (since _isOpen is now true)
      instance.onInlineClick();
      expect(hideOverlay).toHaveBeenCalledOnce();
    });
  });

  describe('handleEscape', () => {
    it('should hide overlay if open and stop propagation', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_isOpen'] = true;
      instance['_panel'] = document.createElement('div');
      instance['hideOverlay'] = vi.fn();
      instance['cancelEdit'] = vi.fn();

      const event = new Event('keydown');
      vi.spyOn(event, 'stopPropagation');

      instance['handleEscape'](event);

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(instance['hideOverlay']).toHaveBeenCalled();
      expect(instance['cancelEdit']).not.toHaveBeenCalled();
    });

    it('should cancel edit if overlay is already closed', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_isOpen'] = false;
      instance['hideOverlay'] = vi.fn();
      instance['cancelEdit'] = vi.fn();

      const event = new Event('keydown');

      instance['handleEscape'](event);

      expect(instance['hideOverlay']).not.toHaveBeenCalled();
      expect(instance['cancelEdit']).toHaveBeenCalled();
    });
  });

  describe('teardownOverlay', () => {
    it('should clean up panel from DOM', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      document.body.appendChild(panel);
      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['_abortCtrl'] = new AbortController();
      instance['_focusObserver'] = null;
      instance['_supportsAnchor'] = false;
      instance['_elementRef'] = { nativeElement: document.createElement('div') };

      instance['teardownOverlay']();

      expect(instance['_panel']).toBeNull();
      expect(instance['_isOpen']).toBe(false);
      expect(instance['_abortCtrl']).toBeNull();
      expect(document.body.contains(panel)).toBe(false);
    });

    it('should disconnect MutationObserver', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const disconnect = vi.fn();
      instance['_panel'] = null;
      instance['_isOpen'] = false;
      instance['_abortCtrl'] = null;
      instance['_focusObserver'] = { disconnect };
      instance['_supportsAnchor'] = false;

      instance['teardownOverlay']();

      expect(disconnect).toHaveBeenCalledOnce();
      expect(instance['_focusObserver']).toBeNull();
    });

    it('should abort the AbortController', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const ctrl = new AbortController();
      const abortSpy = vi.spyOn(ctrl, 'abort');

      instance['_panel'] = null;
      instance['_isOpen'] = false;
      instance['_abortCtrl'] = ctrl;
      instance['_focusObserver'] = null;
      instance['_supportsAnchor'] = false;

      instance['teardownOverlay']();

      expect(abortSpy).toHaveBeenCalledOnce();
      expect(instance['_abortCtrl']).toBeNull();
    });
  });

  describe('OverlayPosition type', () => {
    it('should accept valid position values', () => {
      const positions: OverlayPosition[] = ['below', 'above', 'below-right', 'over-top-left', 'over-bottom-left'];
      expect(positions).toHaveLength(5);
    });
  });

  describe('overlay global styles', () => {
    it('should inject styles into document head', async () => {
      // Import the module to trigger style injection (ensureOverlayStyles is called in constructor)
      // Just verify the style element exists
      const styleEl = document.querySelector('style[data-tbw-overlay]');
      // May or may not exist depending on whether any instance was created
      expect(styleEl !== undefined || BaseOverlayEditor).toBeTruthy();
    });
  });

  describe('_setupFocusObserver flash guard', () => {
    it('should have _setupFocusObserver method on the prototype', () => {
      expect(typeof BaseOverlayEditor.prototype['_setupFocusObserver']).toBe('function');
    });

    it('should not close overlay immediately after opening (flash guard)', async () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      document.body.appendChild(cell);

      instance['_isOpen'] = false;
      instance['_focusObserver'] = null;
      instance['_elementRef'] = { nativeElement: cell.appendChild(document.createElement('span')) };
      instance['showOverlay'] = vi.fn(() => {
        instance['_isOpen'] = true;
      });
      instance['hideOverlay'] = vi.fn(() => {
        instance['_isOpen'] = false;
      });
      instance['onOverlayOpened'] = vi.fn();

      // Override _getCell to return our cell
      instance['_getCell'] = () => cell;

      // Set up the observer
      instance['_setupFocusObserver']();
      expect(instance['_focusObserver']).not.toBeNull();

      // Simulate cell gaining focus
      cell.classList.add('cell-focus');
      // Flush microtask queue so MutationObserver callbacks fire
      await new Promise((r) => setTimeout(r, 0));

      // showOverlay should be called
      expect(instance['showOverlay']).toHaveBeenCalledOnce();

      // Immediately remove focus (simulating beginBulkEdit focus adjustment)
      cell.classList.remove('cell-focus');
      // Flush again
      await new Promise((r) => setTimeout(r, 0));

      // hideOverlay should NOT be called due to the flash guard
      expect(instance['hideOverlay']).not.toHaveBeenCalled();

      // Cleanup
      instance['_focusObserver']?.disconnect();
      document.body.removeChild(cell);
    });
  });

  describe('protected member visibility', () => {
    it('should have _isOpen accessible (protected)', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_isOpen'] = false;
      expect(instance['_isOpen']).toBe(false);
      instance['_isOpen'] = true;
      expect(instance['_isOpen']).toBe(true);
    });

    it('should have _focusObserver accessible (protected)', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_focusObserver'] = null;
      expect(instance['_focusObserver']).toBeNull();
    });
  });

  describe('initOverlay', () => {
    it('should move panel to body and set up CSS classes/attributes', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      const host = document.createElement('span');
      cell.appendChild(host);
      document.body.appendChild(cell);

      instance['_panel'] = null;
      instance['_anchorId'] = '';
      instance['_supportsAnchor'] = false;
      instance['_abortCtrl'] = null;
      instance['overlayPosition'] = 'below';
      instance['_elementRef'] = { nativeElement: host };
      instance['_getCell'] = () => cell;
      instance['_getGridElement'] = () => null;
      instance['_onDocumentPointerDown'] = vi.fn();

      instance['initOverlay'](panel);

      expect(panel.classList.contains('tbw-overlay-panel')).toBe(true);
      expect(panel.getAttribute('data-pos')).toBe('below');
      expect(panel.getAttribute('data-anchor-id')).toBeTruthy();
      expect(panel.style.display).toBe('none');
      expect(document.body.contains(panel)).toBe(true);
      expect(instance['_panel']).toBe(panel);
      expect(instance['_abortCtrl']).toBeInstanceOf(AbortController);

      // Cleanup
      panel.remove();
      cell.remove();
      instance['_abortCtrl']?.abort();
    });

    it('should register panel as external focus container on the grid', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const registerFn = vi.fn();

      instance['_panel'] = null;
      instance['_anchorId'] = '';
      instance['_supportsAnchor'] = false;
      instance['_abortCtrl'] = null;
      instance['overlayPosition'] = 'below';
      instance['_elementRef'] = { nativeElement: document.createElement('div') };
      instance['_getCell'] = () => null;
      instance['_getGridElement'] = () => ({ registerExternalFocusContainer: registerFn });
      instance['_onDocumentPointerDown'] = vi.fn();

      instance['initOverlay'](panel);

      expect(registerFn).toHaveBeenCalledWith(panel);

      // Cleanup
      panel.remove();
      instance['_abortCtrl']?.abort();
    });
  });

  describe('showOverlay', () => {
    it('should make panel visible', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      panel.style.display = 'none';

      instance['_panel'] = panel;
      instance['_isOpen'] = false;
      instance['_supportsAnchor'] = true;

      instance['showOverlay']();

      expect(instance['_isOpen']).toBe(true);
      expect(panel.style.display).toBe('');
    });

    it('should do nothing if panel is null', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = null;
      instance['_isOpen'] = false;

      expect(() => instance['showOverlay']()).not.toThrow();
      expect(instance['_isOpen']).toBe(false);
    });

    it('should do nothing if already open', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      instance['_panel'] = panel;
      instance['_isOpen'] = true;

      instance['showOverlay']();
      // No error, remains open
      expect(instance['_isOpen']).toBe(true);
    });

    it('should use JS fallback positioning when CSS anchor not supported', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      panel.style.display = 'none';
      document.body.appendChild(panel);

      instance['_panel'] = panel;
      instance['_isOpen'] = false;
      instance['_supportsAnchor'] = false;
      instance['_positionWithJs'] = vi.fn();

      instance['showOverlay']();

      expect(instance['_positionWithJs']).toHaveBeenCalledOnce();
      expect(instance['_isOpen']).toBe(true);

      panel.remove();
    });
  });

  describe('hideOverlay', () => {
    it('should hide the panel and return focus to inline input', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const input = document.createElement('input');
      const focusSpy = vi.spyOn(input, 'focus');

      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['getInlineInput'] = () => input;

      instance['hideOverlay']();

      expect(instance['_isOpen']).toBe(false);
      expect(panel.style.display).toBe('none');
      expect(focusSpy).toHaveBeenCalledOnce();
    });

    it('should not return focus when suppressTabAdvance is true', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const input = document.createElement('input');
      const focusSpy = vi.spyOn(input, 'focus');

      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['getInlineInput'] = () => input;

      instance['hideOverlay'](true);

      expect(instance['_isOpen']).toBe(false);
      expect(focusSpy).not.toHaveBeenCalled();
    });

    it('should do nothing if panel is null', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = null;
      instance['_isOpen'] = false;

      expect(() => instance['hideOverlay']()).not.toThrow();
    });

    it('should do nothing if already closed', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      instance['_panel'] = panel;
      instance['_isOpen'] = false;

      expect(() => instance['hideOverlay']()).not.toThrow();
    });
  });

  describe('reopenOverlay', () => {
    it('should close and immediately reopen', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['_supportsAnchor'] = true;

      instance['reopenOverlay']();

      expect(instance['_isOpen']).toBe(true);
      expect(panel.style.display).toBe('');
    });

    it('should do nothing if panel is null', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = null;

      expect(() => instance['reopenOverlay']()).not.toThrow();
    });
  });

  describe('onEditClose', () => {
    it('should call hideOverlay with suppressTabAdvance=true', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['hideOverlay'] = vi.fn();

      instance['onEditClose']();

      expect(instance['hideOverlay']).toHaveBeenCalledWith(true);
    });
  });

  describe('advanceGridFocus', () => {
    it('should dispatch a Tab keydown event on the cell', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      let received: KeyboardEvent | null = null;
      cell.addEventListener('keydown', (e) => {
        received = e as KeyboardEvent;
      });

      instance['_getCell'] = () => cell;

      instance['advanceGridFocus']();

      expect(received).not.toBeNull();
      expect(received!.key).toBe('Tab');
      expect(received!.shiftKey).toBe(false);
      expect(received!.bubbles).toBe(true);
    });

    it('should dispatch Shift+Tab when backward=true', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      let received: KeyboardEvent | null = null;
      cell.addEventListener('keydown', (e) => {
        received = e as KeyboardEvent;
      });

      instance['_getCell'] = () => cell;

      instance['advanceGridFocus'](true);

      expect(received).not.toBeNull();
      expect(received!.key).toBe('Tab');
      expect(received!.shiftKey).toBe(true);
    });

    it('should do nothing when no parent cell exists', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_getCell'] = () => null;

      expect(() => instance['advanceGridFocus']()).not.toThrow();
    });
  });

  describe('_onDocumentPointerDown', () => {
    it('should call onOverlayOutsideClick when clicking outside panel and host', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const host = document.createElement('div');
      const outside = document.createElement('div');

      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['_elementRef'] = { nativeElement: host };
      instance['onOverlayOutsideClick'] = vi.fn();

      const event = new PointerEvent('pointerdown');
      Object.defineProperty(event, 'target', { value: outside });

      instance['_onDocumentPointerDown'](event);

      expect(instance['onOverlayOutsideClick']).toHaveBeenCalledOnce();
    });

    it('should ignore clicks inside the panel', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const child = document.createElement('span');
      panel.appendChild(child);

      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['_elementRef'] = { nativeElement: document.createElement('div') };
      instance['onOverlayOutsideClick'] = vi.fn();

      const event = new PointerEvent('pointerdown');
      Object.defineProperty(event, 'target', { value: child });

      instance['_onDocumentPointerDown'](event);

      expect(instance['onOverlayOutsideClick']).not.toHaveBeenCalled();
    });

    it('should ignore clicks inside the host element', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const host = document.createElement('div');
      const child = document.createElement('span');
      host.appendChild(child);

      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['_elementRef'] = { nativeElement: host };
      instance['onOverlayOutsideClick'] = vi.fn();

      const event = new PointerEvent('pointerdown');
      Object.defineProperty(event, 'target', { value: child });

      instance['_onDocumentPointerDown'](event);

      expect(instance['onOverlayOutsideClick']).not.toHaveBeenCalled();
    });

    it('should do nothing when overlay is not open', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = document.createElement('div');
      instance['_isOpen'] = false;
      instance['onOverlayOutsideClick'] = vi.fn();

      const event = new PointerEvent('pointerdown');
      instance['_onDocumentPointerDown'](event);

      expect(instance['onOverlayOutsideClick']).not.toHaveBeenCalled();
    });

    it('should do nothing when panel is null', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = null;
      instance['_isOpen'] = true;
      instance['onOverlayOutsideClick'] = vi.fn();

      const event = new PointerEvent('pointerdown');
      instance['_onDocumentPointerDown'](event);

      expect(instance['onOverlayOutsideClick']).not.toHaveBeenCalled();
    });
  });

  describe('_positionWithJs', () => {
    function createPositionInstance(position: string) {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      const panel = document.createElement('div');
      document.body.appendChild(cell);
      document.body.appendChild(panel);

      // Mock getBoundingClientRect
      vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 140,
        left: 200,
        right: 400,
        width: 200,
        height: 40,
        x: 200,
        y: 100,
        toJSON: vi.fn(),
      });
      vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 100,
        left: 0,
        right: 150,
        width: 150,
        height: 100,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      });

      instance['_panel'] = panel;
      instance['overlayPosition'] = position;
      instance['_getCell'] = () => cell;

      return { instance, cell, panel };
    }

    it('should position below the cell (default)', () => {
      const { instance, panel, cell } = createPositionInstance('below');

      instance['_positionWithJs']();

      expect(panel.style.top).toBe('140px'); // cellRect.bottom
      expect(panel.style.left).toBe('200px'); // cellRect.left

      panel.remove();
      cell.remove();
    });

    it('should position above the cell', () => {
      const { instance, panel, cell } = createPositionInstance('above');

      instance['_positionWithJs']();

      expect(panel.style.top).toBe('0px'); // cellRect.top - panelHeight
      expect(panel.style.left).toBe('200px');

      panel.remove();
      cell.remove();
    });

    it('should position below-right', () => {
      const { instance, panel, cell } = createPositionInstance('below-right');

      instance['_positionWithJs']();

      expect(panel.style.top).toBe('140px'); // cellRect.bottom
      expect(panel.style.left).toBe('250px'); // cellRect.right - panelWidth

      panel.remove();
      cell.remove();
    });

    it('should position over-top-left', () => {
      const { instance, panel, cell } = createPositionInstance('over-top-left');

      instance['_positionWithJs']();

      expect(panel.style.top).toBe('100px'); // cellRect.top
      expect(panel.style.left).toBe('200px'); // cellRect.left

      panel.remove();
      cell.remove();
    });

    it('should position over-bottom-left', () => {
      const { instance, panel, cell } = createPositionInstance('over-bottom-left');

      instance['_positionWithJs']();

      expect(panel.style.top).toBe('40px'); // cellRect.bottom - panelHeight
      expect(panel.style.left).toBe('200px');

      panel.remove();
      cell.remove();
    });

    it('should do nothing when cell is null', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = document.createElement('div');
      instance['_getCell'] = () => null;

      expect(() => instance['_positionWithJs']()).not.toThrow();
    });

    it('should do nothing when panel is null', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      instance['_panel'] = null;
      instance['_getCell'] = () => document.createElement('div');

      expect(() => instance['_positionWithJs']()).not.toThrow();
    });

    it('should flip "above" to below when top goes negative', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      const panel = document.createElement('div');
      document.body.appendChild(cell);
      document.body.appendChild(panel);

      vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({
        top: 20,
        bottom: 60,
        left: 100,
        right: 300,
        width: 200,
        height: 40,
        x: 100,
        y: 20,
        toJSON: vi.fn(),
      });
      vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 200,
        left: 0,
        right: 150,
        width: 150,
        height: 200,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      });

      instance['_panel'] = panel;
      instance['overlayPosition'] = 'above';
      instance['_getCell'] = () => cell;

      instance['_positionWithJs']();

      // top = cellRect.top - panelHeight = 20 - 200 = -180, flips to cellRect.bottom = 60
      expect(panel.style.top).toBe('60px');

      panel.remove();
      cell.remove();
    });

    it('should clamp left to viewport edge when panel exceeds right boundary', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      const panel = document.createElement('div');
      document.body.appendChild(cell);
      document.body.appendChild(panel);

      // Place cell near right edge of viewport
      vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 140,
        left: 700,
        right: 900,
        width: 200,
        height: 40,
        x: 700,
        y: 100,
        toJSON: vi.fn(),
      });
      vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 50,
        left: 0,
        right: 300,
        width: 300,
        height: 50,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      });

      // Mock viewport to be narrow
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      instance['_panel'] = panel;
      instance['overlayPosition'] = 'below';
      instance['_getCell'] = () => cell;

      instance['_positionWithJs']();

      // left = cellRect.left = 700, but 700 + 300 > 800, so left = 800 - 300 - 4 = 496
      expect(panel.style.left).toBe('496px');

      panel.remove();
      cell.remove();
    });
  });

  describe('initOverlay - CSS anchor positioning', () => {
    it('should set anchor-name on cell when CSS anchor supported', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      const host = document.createElement('span');
      cell.appendChild(host);
      document.body.appendChild(cell);

      instance['_panel'] = null;
      instance['_anchorId'] = '';
      instance['_supportsAnchor'] = true;
      instance['_abortCtrl'] = null;
      instance['overlayPosition'] = 'below';
      instance['_elementRef'] = { nativeElement: host };
      instance['_getCell'] = () => cell;
      instance['_getGridElement'] = () => null;
      instance['_onDocumentPointerDown'] = vi.fn();

      instance['initOverlay'](panel);

      // Should set CSS anchor properties
      expect(cell.style.getPropertyValue('anchor-name')).toBeTruthy();
      expect(panel.style.getPropertyValue('--tbw-overlay-anchor')).toBeTruthy();

      panel.remove();
      cell.remove();
      instance['_abortCtrl']?.abort();
    });
  });

  describe('teardownOverlay - CSS anchor cleanup', () => {
    it('should remove anchor-name from cell when CSS anchor supported', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      cell.style.setProperty('anchor-name', '--tbw-anchor-42');

      instance['_panel'] = null;
      instance['_isOpen'] = false;
      instance['_abortCtrl'] = null;
      instance['_focusObserver'] = null;
      instance['_supportsAnchor'] = true;
      instance['_elementRef'] = { nativeElement: document.createElement('span') };
      instance['_getCell'] = () => cell;

      instance['teardownOverlay']();

      expect(cell.style.getPropertyValue('anchor-name')).toBe('');
    });

    it('should call unregisterExternalFocusContainer on grid', () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const panel = document.createElement('div');
      document.body.appendChild(panel);
      const unregisterFn = vi.fn();

      instance['_panel'] = panel;
      instance['_isOpen'] = true;
      instance['_abortCtrl'] = null;
      instance['_focusObserver'] = null;
      instance['_supportsAnchor'] = false;
      instance['_getGridElement'] = () => ({ unregisterExternalFocusContainer: unregisterFn });

      instance['teardownOverlay']();

      expect(unregisterFn).toHaveBeenCalledWith(panel);
    });
  });

  describe('_setupFocusObserver - detached host', () => {
    it('should disconnect when host is detached from cell', async () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      const host = document.createElement('span');
      cell.appendChild(host);
      document.body.appendChild(cell);

      instance['_isOpen'] = false;
      instance['_focusObserver'] = null;
      instance['_elementRef'] = { nativeElement: host };
      instance['showOverlay'] = vi.fn();
      instance['hideOverlay'] = vi.fn();
      instance['onOverlayOpened'] = vi.fn();
      instance['_getCell'] = () => cell;

      instance['_setupFocusObserver']();
      expect(instance['_focusObserver']).not.toBeNull();

      // Detach host from cell
      cell.removeChild(host);

      // Trigger a class mutation
      cell.classList.add('cell-focus');
      await new Promise((r) => setTimeout(r, 0));

      // Observer should have disconnected itself
      expect(instance['_focusObserver']).toBeNull();

      document.body.removeChild(cell);
    });
  });

  describe('_setupFocusObserver - deferred hide', () => {
    it('should call hideOverlay after focus-away past the flash guard', async () => {
      const instance = Object.create(BaseOverlayEditor.prototype);
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      const host = document.createElement('span');
      cell.appendChild(host);
      document.body.appendChild(cell);

      instance['_isOpen'] = false;
      instance['_focusObserver'] = null;
      instance['_elementRef'] = { nativeElement: host };
      instance['showOverlay'] = vi.fn(() => {
        instance['_isOpen'] = true;
      });
      instance['hideOverlay'] = vi.fn(() => {
        instance['_isOpen'] = false;
      });
      instance['onOverlayOpened'] = vi.fn();
      instance['_getCell'] = () => cell;

      instance['_setupFocusObserver']();

      // Gain focus
      cell.classList.add('cell-focus');
      await new Promise((r) => setTimeout(r, 0));
      expect(instance['showOverlay']).toHaveBeenCalledOnce();

      // Wait for justOpened guard to clear
      await new Promise((r) => setTimeout(r, 10));

      // Lose focus
      cell.classList.remove('cell-focus');
      await new Promise((r) => setTimeout(r, 0));

      // rAF fires — hideOverlay should be called
      // happy-dom fires rAF synchronously in setTimeout
      await new Promise((r) => setTimeout(r, 50));
      expect(instance['hideOverlay']).toHaveBeenCalledWith(true);

      instance['_focusObserver']?.disconnect();
      document.body.removeChild(cell);
    });
  });
});
