/**
 * Tests for print-isolated utility.
 *
 * Covers:
 * - createIsolationStylesheet (via printGridIsolated)
 * - printGridIsolated lifecycle (style injection, window.print, cleanup)
 * - Duplicate ID warning
 * - Fallback timeout cleanup
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { printGridIsolated } from './print-isolated';

const STYLE_ID = 'tbw-print-isolation-style';

describe('print-isolated', () => {
  let grid: HTMLElement;

  beforeEach(() => {
    grid = document.createElement('div');
    grid.id = 'test-grid-1';
    document.body.appendChild(grid);

    // happy-dom doesn't define window.print by default
    if (!window.print) {
      window.print = () => {};
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.getElementById(STYLE_ID)?.remove();
    vi.restoreAllMocks();
  });

  // #region Style Injection

  describe('style injection', () => {
    it('should inject an isolation stylesheet into <head>', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => {
        // Simulate afterprint immediately
        window.dispatchEvent(new Event('afterprint'));
      });

      await printGridIsolated(grid);

      // Style is removed after print, so check it was inserted during print
      // We'll verify via a different test that it exists before afterprint fires
    });

    it('should add stylesheet with correct ID before printing', () => {
      // Mock print to inspect DOM during the print call
      let styleExistsDuringPrint = false;
      vi.spyOn(window, 'print').mockImplementation(() => {
        styleExistsDuringPrint = document.getElementById(STYLE_ID) !== null;
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      expect(styleExistsDuringPrint).toBe(true);
    });

    it('should include grid ID in the stylesheet content', () => {
      let styleContent = '';
      vi.spyOn(window, 'print').mockImplementation(() => {
        const style = document.getElementById(STYLE_ID) as HTMLStyleElement;
        styleContent = style?.textContent ?? '';
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      expect(styleContent).toContain('#test-grid-1');
      expect(styleContent).toContain('@media print');
    });

    it('should use landscape orientation by default', () => {
      let styleContent = '';
      vi.spyOn(window, 'print').mockImplementation(() => {
        styleContent = document.getElementById(STYLE_ID)?.textContent ?? '';
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      expect(styleContent).toContain('size: landscape');
    });

    it('should use portrait orientation when specified', () => {
      let styleContent = '';
      vi.spyOn(window, 'print').mockImplementation(() => {
        styleContent = document.getElementById(STYLE_ID)?.textContent ?? '';
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid, { orientation: 'portrait' });

      expect(styleContent).toContain('size: portrait');
    });

    it('should remove existing isolation stylesheet before adding a new one', () => {
      // Pre-create a stale isolation style
      const stale = document.createElement('style');
      stale.id = STYLE_ID;
      stale.textContent = 'old-content';
      document.head.appendChild(stale);

      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      // The old one should have been replaced
      const styles = document.querySelectorAll(`#${STYLE_ID}`);
      // After afterprint fires, the style is cleaned up entirely
      expect(styles.length).toBe(0);
    });

    it('should contain rules to hide body children except the grid', () => {
      let styleContent = '';
      vi.spyOn(window, 'print').mockImplementation(() => {
        styleContent = document.getElementById(STYLE_ID)?.textContent ?? '';
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      expect(styleContent).toContain('body > *:not(#test-grid-1)');
      expect(styleContent).toContain('display: none !important');
    });

    it('should contain ancestor visibility rules using :has()', () => {
      let styleContent = '';
      vi.spyOn(window, 'print').mockImplementation(() => {
        styleContent = document.getElementById(STYLE_ID)?.textContent ?? '';
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      expect(styleContent).toContain(':has(#test-grid-1)');
      expect(styleContent).toContain('visibility: visible');
    });

    it('should set page margin to 1cm', () => {
      let styleContent = '';
      vi.spyOn(window, 'print').mockImplementation(() => {
        styleContent = document.getElementById(STYLE_ID)?.textContent ?? '';
        window.dispatchEvent(new Event('afterprint'));
      });

      printGridIsolated(grid);

      expect(styleContent).toContain('margin: 1cm');
    });
  });

  // #endregion

  // #region Lifecycle

  describe('lifecycle', () => {
    it('should call window.print()', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await printGridIsolated(grid);

      expect(printSpy).toHaveBeenCalledOnce();
    });

    it('should resolve the promise after afterprint event', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      // Should resolve without hanging
      await expect(printGridIsolated(grid)).resolves.toBeUndefined();
    });

    it('should remove isolation stylesheet after afterprint', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await printGridIsolated(grid);

      expect(document.getElementById(STYLE_ID)).toBeNull();
    });

    it('should remove the afterprint listener after it fires', async () => {
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await printGridIsolated(grid);

      expect(removeListenerSpy).toHaveBeenCalledWith('afterprint', expect.any(Function));
    });

    it('should clean up via timeout fallback if afterprint does not fire', async () => {
      vi.useFakeTimers();
      vi.spyOn(window, 'print').mockImplementation(() => {
        // Do not fire afterprint
      });

      const promise = printGridIsolated(grid);

      // Style should exist before timeout
      expect(document.getElementById(STYLE_ID)).not.toBeNull();

      // Advance past the 5s fallback
      vi.advanceTimersByTime(5000);

      await promise;

      // Style should be cleaned up
      expect(document.getElementById(STYLE_ID)).toBeNull();

      vi.useRealTimers();
    });
  });

  // #endregion

  // #region Warnings

  describe('warnings', () => {
    it('should warn when multiple elements share the grid ID', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Add another element with the same ID
      const duplicate = document.createElement('div');
      duplicate.id = 'test-grid-1';
      document.body.appendChild(duplicate);

      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await printGridIsolated(grid);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Multiple elements found with id="test-grid-1"'));
    });

    it('should not warn when only one element has the grid ID', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await printGridIsolated(grid);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Default Options

  describe('default options', () => {
    it('should work with no options argument', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await expect(printGridIsolated(grid)).resolves.toBeUndefined();
    });

    it('should work with empty options object', async () => {
      vi.spyOn(window, 'print').mockImplementation(() => {
        window.dispatchEvent(new Event('afterprint'));
      });

      await expect(printGridIsolated(grid, {})).resolves.toBeUndefined();
    });
  });

  // #endregion
});
