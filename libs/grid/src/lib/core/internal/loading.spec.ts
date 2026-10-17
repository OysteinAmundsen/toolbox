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

    it('should use loadingRenderer with size "small" instead of the default spinner (PR #511)', () => {
      const row = document.createElement('div');
      const renderer = vi.fn((_ctx: { size: 'large' | 'small' }) => {
        const el = document.createElement('span');
        el.className = 'my-row-loader';
        return el;
      });

      setRowLoadingState(row, true, renderer);
      setRowLoadingState(row, true, renderer); // re-applied every render: no second call

      expect(renderer).toHaveBeenCalledTimes(1);
      expect(renderer).toHaveBeenCalledWith({ size: 'small' });
      expect(row.querySelector('.tbw-row-loading-overlay .my-row-loader')).not.toBeNull();
      expect(row.querySelector('.tbw-row-loading-spinner')).toBeNull();
    });

    it('should sanitize a string returned by loadingRenderer', () => {
      const row = document.createElement('div');

      setRowLoadingState(row, true, () => '<em>Loading…</em><img src=x onerror="alert(1)">');

      const overlay = row.querySelector('.tbw-row-loading-overlay')!;
      expect(overlay.querySelector('em')?.textContent).toBe('Loading…');
      expect(overlay.querySelector('[onerror]')).toBeNull();
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

    it('should unmount adapter-rendered content when the overlay is removed', () => {
      const unmount = vi.fn();
      const row = document.createElement('div');
      row.className = 'data-grid-row';

      setRowLoadingState(row, true, () => document.createElement('span'));
      const overlay = row.querySelector('.tbw-row-loading-overlay');

      setRowLoadingState(row, false, undefined, { unmount });

      expect(unmount).toHaveBeenCalledWith(overlay);
      expect(row.querySelector('.tbw-row-loading-overlay')).toBeNull();
    });

    it('should leave a nested grid row overlay alone', () => {
      const outerRow = document.createElement('div');
      const nestedRow = document.createElement('div');
      outerRow.appendChild(nestedRow);

      setRowLoadingState(nestedRow, true);
      const nestedOverlay = nestedRow.querySelector('.tbw-row-loading-overlay');

      setRowLoadingState(outerRow, true);
      expect(outerRow.querySelector(':scope > .tbw-row-loading-overlay')).not.toBeNull();

      setRowLoadingState(outerRow, false);
      expect(outerRow.querySelector(':scope > .tbw-row-loading-overlay')).toBeNull();
      expect(nestedRow.querySelector('.tbw-row-loading-overlay')).toBe(nestedOverlay);
    });
  });
  // #endregion

  // #region setCellLoadingState
  describe('setCellLoadingState', () => {
    it('skips overlay lookup when the cell has no element children', () => {
      const cell = document.createElement('div');
      const querySelector = vi.spyOn(cell, 'querySelector');
      const unmount = vi.fn((_container: HTMLElement) => undefined);

      setCellLoadingState(cell, false, undefined, { unmount });

      expect(querySelector).not.toHaveBeenCalled();
      expect(unmount).not.toHaveBeenCalled();
    });

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

    it('should use loadingRenderer with size "small" and avoid duplicate overlays', () => {
      const cell = document.createElement('div');
      const renderer = vi.fn((_ctx: { size: 'large' | 'small' }) => {
        const el = document.createElement('span');
        el.className = 'my-cell-loader';
        return el;
      });

      setCellLoadingState(cell, true, renderer);
      setCellLoadingState(cell, true, renderer);

      expect(renderer).toHaveBeenCalledTimes(1);
      expect(renderer).toHaveBeenCalledWith({ size: 'small' });
      expect(cell.classList.contains('tbw-cell-loading-custom')).toBe(true);
      expect(cell.querySelector('.tbw-cell-loading-overlay .my-cell-loader')).not.toBeNull();
      expect(cell.querySelectorAll('.tbw-cell-loading-overlay')).toHaveLength(1);
      expect(cell.querySelector('.tbw-spinner')).toBeNull();

      setCellLoadingState(cell, false, renderer);

      expect(cell.querySelector('.tbw-cell-loading-overlay')).toBeNull();
      expect(cell.classList.contains('tbw-cell-loading-custom')).toBe(false);
      expect(cell.getAttribute('aria-busy')).toBeNull();
    });

    it('should manage only its direct overlay and unmount it when cleared', () => {
      const outerCell = document.createElement('div');
      const nestedGrid = document.createElement('div');
      const nestedCell = document.createElement('div');
      nestedCell.className = 'cell';
      nestedGrid.appendChild(nestedCell);
      outerCell.appendChild(nestedGrid);

      const renderer = (ctx: { size: 'large' | 'small' }) => {
        const el = document.createElement('span');
        el.textContent = ctx.size;
        return el;
      };
      const unmount = vi.fn((_container: HTMLElement) => undefined);
      const adapter = { unmount };

      setCellLoadingState(nestedCell, true, renderer, adapter);
      const nestedOverlay = nestedCell.querySelector(':scope > .tbw-cell-loading-overlay');
      setCellLoadingState(outerCell, true, renderer, adapter);
      const outerOverlay = outerCell.querySelector(':scope > .tbw-cell-loading-overlay');

      expect(outerOverlay).not.toBeNull();
      expect(nestedCell.querySelector(':scope > .tbw-cell-loading-overlay')).toBe(nestedOverlay);

      setCellLoadingState(outerCell, false, renderer, adapter);

      expect(unmount).toHaveBeenCalledExactlyOnceWith(outerOverlay);
      expect(nestedCell.querySelector(':scope > .tbw-cell-loading-overlay')).toBe(nestedOverlay);
    });

    it('should keep the built-in cell spinner when no renderer is provided', () => {
      const cell = document.createElement('div');

      setCellLoadingState(cell, true);

      expect(cell.classList.contains('tbw-cell-loading')).toBe(true);
      expect(cell.classList.contains('tbw-cell-loading-custom')).toBe(false);
      expect(cell.querySelector('.tbw-cell-loading-overlay')).toBeNull();
    });
  });
  // #endregion
});
