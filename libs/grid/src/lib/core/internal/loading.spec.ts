/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultSpinner,
  createLoadingContent,
  createLoadingOverlay,
  hideLoadingOverlay,
  setCellLoadingState,
  setRowLoadingState,
  showLoadingOverlay,
} from './loading';

describe('loading', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region createDefaultSpinner
  describe('createDefaultSpinner', () => {
    it('should create a large spinner with correct classes', () => {
      const spinner = createDefaultSpinner('large');
      expect(spinner.className).toBe('tbw-spinner tbw-spinner--large');
      expect(spinner.getAttribute('role')).toBe('progressbar');
      expect(spinner.getAttribute('aria-label')).toBe('Loading');
    });

    it('should create a small spinner with correct classes', () => {
      const spinner = createDefaultSpinner('small');
      expect(spinner.className).toBe('tbw-spinner tbw-spinner--small');
      expect(spinner.getAttribute('role')).toBe('progressbar');
      expect(spinner.getAttribute('aria-label')).toBe('Loading');
    });
  });
  // #endregion

  // #region createLoadingContent
  describe('createLoadingContent', () => {
    it('should return default spinner when no renderer provided', () => {
      const content = createLoadingContent('large');
      expect(content.className).toBe('tbw-spinner tbw-spinner--large');
    });

    it('should use custom renderer returning HTMLElement', () => {
      const customEl = document.createElement('span');
      customEl.textContent = 'Custom Loading';
      const renderer = vi.fn().mockReturnValue(customEl);

      const content = createLoadingContent('small', renderer);

      expect(renderer).toHaveBeenCalledWith({ size: 'small' });
      expect(content).toBe(customEl);
    });

    it('should use custom renderer returning string', () => {
      const renderer = vi.fn().mockReturnValue('<span>Loading...</span>');

      const content = createLoadingContent('large', renderer);

      expect(renderer).toHaveBeenCalledWith({ size: 'large' });
      expect(content.innerHTML).toBe('<span>Loading...</span>');
    });
  });
  // #endregion

  // #region createLoadingOverlay
  describe('createLoadingOverlay', () => {
    it('should create overlay with correct structure and attributes', () => {
      const overlay = createLoadingOverlay();

      expect(overlay.className).toBe('tbw-loading-overlay');
      expect(overlay.getAttribute('role')).toBe('status');
      expect(overlay.getAttribute('aria-live')).toBe('polite');
      expect(overlay.querySelector('.tbw-spinner--large')).toBeTruthy();
    });

    it('should use custom renderer if provided', () => {
      const customEl = document.createElement('div');
      customEl.className = 'custom-loader';
      const renderer = vi.fn().mockReturnValue(customEl);

      const overlay = createLoadingOverlay(renderer);

      expect(overlay.querySelector('.custom-loader')).toBeTruthy();
    });
  });
  // #endregion

  // #region showLoadingOverlay
  describe('showLoadingOverlay', () => {
    it('should append overlay to grid root', () => {
      const gridRoot = document.createElement('div');
      gridRoot.className = 'tbw-grid-root';
      document.body.appendChild(gridRoot);

      const overlay = createLoadingOverlay();
      showLoadingOverlay(gridRoot, overlay);

      expect(gridRoot.querySelector('.tbw-loading-overlay')).toBe(overlay);
    });
  });
  // #endregion

  // #region hideLoadingOverlay
  describe('hideLoadingOverlay', () => {
    it('should remove overlay from DOM', () => {
      const container = document.createElement('div');
      const overlay = document.createElement('div');
      overlay.className = 'tbw-loading-overlay';
      container.appendChild(overlay);
      document.body.appendChild(container);

      expect(container.querySelector('.tbw-loading-overlay')).toBeTruthy();

      hideLoadingOverlay(overlay);

      expect(container.querySelector('.tbw-loading-overlay')).toBeNull();
    });

    it('should handle undefined overlay gracefully', () => {
      expect(() => hideLoadingOverlay(undefined)).not.toThrow();
    });
  });
  // #endregion

  // #region setRowLoadingState
  describe('setRowLoadingState', () => {
    it('should add loading class and aria-busy when loading is true', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';

      setRowLoadingState(row, true);

      expect(row.classList.contains('tbw-row-loading')).toBe(true);
      expect(row.getAttribute('aria-busy')).toBe('true');
    });

    it('should inject overlay and spinner DOM elements when loading is true', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';

      setRowLoadingState(row, true);

      const overlay = row.querySelector('.tbw-row-loading-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay!.getAttribute('aria-hidden')).toBe('true');

      const spinner = overlay!.querySelector('.tbw-row-loading-spinner');
      expect(spinner).not.toBeNull();
    });

    it('should not double-inject overlay when called twice', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';

      setRowLoadingState(row, true);
      setRowLoadingState(row, true);

      const overlays = row.querySelectorAll('.tbw-row-loading-overlay');
      expect(overlays.length).toBe(1);
    });

    it('should remove loading class and aria-busy when loading is false', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row tbw-row-loading';
      row.setAttribute('aria-busy', 'true');

      setRowLoadingState(row, false);

      expect(row.classList.contains('tbw-row-loading')).toBe(false);
      expect(row.getAttribute('aria-busy')).toBeNull();
    });

    it('should remove overlay DOM elements when loading is false', () => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';

      setRowLoadingState(row, true);
      expect(row.querySelector('.tbw-row-loading-overlay')).not.toBeNull();

      setRowLoadingState(row, false);
      expect(row.querySelector('.tbw-row-loading-overlay')).toBeNull();
    });
  });
  // #endregion

  // #region setCellLoadingState
  describe('setCellLoadingState', () => {
    it('should add loading class and aria-busy when loading is true', () => {
      const cell = document.createElement('div');
      cell.className = 'cell';

      setCellLoadingState(cell, true);

      expect(cell.classList.contains('tbw-cell-loading')).toBe(true);
      expect(cell.getAttribute('aria-busy')).toBe('true');
    });

    it('should remove loading class and aria-busy when loading is false', () => {
      const cell = document.createElement('div');
      cell.className = 'cell tbw-cell-loading';
      cell.setAttribute('aria-busy', 'true');

      setCellLoadingState(cell, false);

      expect(cell.classList.contains('tbw-cell-loading')).toBe(false);
      expect(cell.getAttribute('aria-busy')).toBeNull();
    });
  });
  // #endregion
});
