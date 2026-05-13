/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyContent,
  createEmptyOverlay,
  DEFAULT_EMPTY_MESSAGE,
  DEFAULT_FILTERED_OUT_MESSAGE,
  defaultEmptyRenderer,
  hideEmptyOverlay,
  shouldShowEmpty,
  showEmptyOverlay,
} from './empty';

describe('empty', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region defaultEmptyRenderer
  describe('defaultEmptyRenderer', () => {
    it('returns the no-data message when filteredOut is false', () => {
      const el = defaultEmptyRenderer({ sourceRowCount: 0, filteredOut: false });
      expect(el.className).toBe('tbw-empty-message');
      expect(el.textContent).toBe(DEFAULT_EMPTY_MESSAGE);
    });

    it('returns the filtered-out message when filteredOut is true', () => {
      const el = defaultEmptyRenderer({ sourceRowCount: 5, filteredOut: true });
      expect(el.textContent).toBe(DEFAULT_FILTERED_OUT_MESSAGE);
    });
  });
  // #endregion

  // #region createEmptyContent
  describe('createEmptyContent', () => {
    it('falls back to the default renderer when none is provided', () => {
      const el = createEmptyContent({ sourceRowCount: 0, filteredOut: false });
      expect(el.textContent).toBe(DEFAULT_EMPTY_MESSAGE);
    });

    it('uses a custom renderer returning HTMLElement', () => {
      const custom = document.createElement('span');
      custom.textContent = 'Whoops';
      const renderer = vi.fn().mockReturnValue(custom);

      const el = createEmptyContent({ sourceRowCount: 3, filteredOut: true }, renderer);

      expect(renderer).toHaveBeenCalledWith({ sourceRowCount: 3, filteredOut: true });
      expect(el).toBe(custom);
    });

    it('wraps a string-returning renderer in a div', () => {
      const renderer = vi.fn().mockReturnValue('<strong>oops</strong>');
      const el = createEmptyContent({ sourceRowCount: 0, filteredOut: false }, renderer);
      expect(el.tagName).toBe('DIV');
      expect(el.innerHTML).toBe('<strong>oops</strong>');
    });
  });
  // #endregion

  // #region createEmptyOverlay
  describe('createEmptyOverlay', () => {
    it('creates an overlay with the right classes and a11y attributes', () => {
      const overlay = createEmptyOverlay({ sourceRowCount: 0, filteredOut: false });
      expect(overlay.className).toBe('tbw-empty-overlay');
      expect(overlay.getAttribute('role')).toBe('status');
      expect(overlay.getAttribute('aria-live')).toBe('polite');
      expect(overlay.getAttribute('data-overlay-target')).toBe('rows');
      expect(overlay.querySelector('.tbw-empty-message')?.textContent).toBe(DEFAULT_EMPTY_MESSAGE);
    });

    it('records the chosen overlay target', () => {
      const overlay = createEmptyOverlay({ sourceRowCount: 0, filteredOut: false }, undefined, 'grid');
      expect(overlay.getAttribute('data-overlay-target')).toBe('grid');
    });

    it('uses the custom renderer when provided', () => {
      const custom = document.createElement('div');
      custom.className = 'my-empty';
      const overlay = createEmptyOverlay({ sourceRowCount: 0, filteredOut: false }, () => custom);
      expect(overlay.querySelector('.my-empty')).toBe(custom);
    });
  });
  // #endregion

  // #region show/hide
  describe('showEmptyOverlay / hideEmptyOverlay', () => {
    it('mounts and unmounts the overlay', () => {
      const target = document.createElement('div');
      document.body.appendChild(target);
      const overlay = createEmptyOverlay({ sourceRowCount: 0, filteredOut: false });

      showEmptyOverlay(target, overlay);
      expect(target.querySelector('.tbw-empty-overlay')).toBe(overlay);

      hideEmptyOverlay(overlay);
      expect(target.querySelector('.tbw-empty-overlay')).toBeNull();
    });

    it('hideEmptyOverlay tolerates undefined', () => {
      expect(() => hideEmptyOverlay(undefined)).not.toThrow();
    });
  });
  // #endregion

  // #region shouldShowEmpty
  describe('shouldShowEmpty', () => {
    it('returns false while loading is true', () => {
      expect(shouldShowEmpty(true, 0, undefined)).toBe(false);
    });

    it('returns false when there are rendered rows', () => {
      expect(shouldShowEmpty(false, 5, undefined)).toBe(false);
    });

    it('returns true when not loading and no rendered rows', () => {
      expect(shouldShowEmpty(false, 0, undefined)).toBe(true);
    });

    it('returns false when the renderer is explicitly null (opt-out)', () => {
      expect(shouldShowEmpty(false, 0, null)).toBe(false);
    });

    it('returns true when a custom renderer is provided', () => {
      expect(shouldShowEmpty(false, 0, () => 'whatever')).toBe(true);
    });
  });
  // #endregion
});
