/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetForTesting, addPluginStyles, extractGridCssFromDocument, injectStyles } from './style-injector';

describe('style-injector', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  afterEach(() => {
    _resetForTesting();
  });

  // #region addPluginStyles
  describe('addPluginStyles', () => {
    it('should add new plugin styles and return true', () => {
      const result = addPluginStyles([{ name: 'testPlugin', styles: '.test { color: red; }' }]);

      expect(result).toBe(true);
      const styleEl = document.getElementById('tbw-grid-styles');
      expect(styleEl).toBeTruthy();
      expect(styleEl?.textContent).toContain('.test { color: red; }');
    });

    it('should not add duplicate plugin styles', () => {
      addPluginStyles([{ name: 'testPlugin', styles: '.test { color: red; }' }]);
      const result = addPluginStyles([{ name: 'testPlugin', styles: '.test { color: blue; }' }]);

      expect(result).toBe(false);
      const styleEl = document.getElementById('tbw-grid-styles');
      expect(styleEl?.textContent).toContain('color: red');
      expect(styleEl?.textContent).not.toContain('color: blue');
    });

    it('should add multiple plugins at once', () => {
      const result = addPluginStyles([
        { name: 'plugin1', styles: '.p1 { color: red; }' },
        { name: 'plugin2', styles: '.p2 { color: blue; }' },
      ]);

      expect(result).toBe(true);
      const styleEl = document.getElementById('tbw-grid-styles');
      expect(styleEl?.textContent).toContain('.p1');
      expect(styleEl?.textContent).toContain('.p2');
    });

    it('should return true if only some plugins are new', () => {
      addPluginStyles([{ name: 'existing', styles: '.existing {}' }]);
      const result = addPluginStyles([
        { name: 'existing', styles: '.existing {}' },
        { name: 'new', styles: '.new {}' },
      ]);

      expect(result).toBe(true);
    });
  });
  // #endregion

  // #region extractGridCssFromDocument
  describe('extractGridCssFromDocument', () => {
    it('should return null when no grid CSS found', () => {
      const result = extractGridCssFromDocument();
      expect(result).toBeNull();
    });

    it('should find grid CSS in document stylesheets', () => {
      // Create a stylesheet with grid CSS markers
      const style = document.createElement('style');
      style.textContent = `
        tbw-grid { display: block; }
        .tbw-grid-root { position: relative; }
      `;
      document.head.appendChild(style);

      const result = extractGridCssFromDocument();

      expect(result).toContain('.tbw-grid-root');
      expect(result).toContain('tbw-grid');

      style.remove();
    });

    it('should return null for stylesheets without grid markers', () => {
      const style = document.createElement('style');
      style.textContent = '.other-component { color: red; }';
      document.head.appendChild(style);

      const result = extractGridCssFromDocument();
      expect(result).toBeNull();

      style.remove();
    });
  });
  // #endregion

  // #region injectStyles
  describe('injectStyles', () => {
    it('should inject inline styles directly', async () => {
      await injectStyles('.grid { display: block; }');

      const styleEl = document.getElementById('tbw-grid-styles');
      expect(styleEl).toBeTruthy();
      expect(styleEl?.textContent).toContain('.grid { display: block; }');
    });

    it('should not re-inject if styles already present', async () => {
      await injectStyles('.first { }');
      await injectStyles('.second { }');

      const styleEl = document.getElementById('tbw-grid-styles');
      expect(styleEl?.textContent).toContain('.first');
      expect(styleEl?.textContent).not.toContain('.second');
    });

    it('should handle empty inline styles', async () => {
      // With empty styles, it should try to extract from document
      // In test environment, this will likely not find anything
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await injectStyles('');

      // In test environment, no warning should be logged
      warnSpy.mockRestore();
    });
  });
  // #endregion

  // #region _resetForTesting
  describe('_resetForTesting', () => {
    it('should clear all injected styles', async () => {
      await injectStyles('.test { }');
      addPluginStyles([{ name: 'plugin', styles: '.plugin { }' }]);

      expect(document.getElementById('tbw-grid-styles')).toBeTruthy();

      _resetForTesting();

      expect(document.getElementById('tbw-grid-styles')).toBeNull();
    });

    it('should allow re-injection after reset', async () => {
      await injectStyles('.first { }');
      _resetForTesting();
      await injectStyles('.second { }');

      const styleEl = document.getElementById('tbw-grid-styles');
      expect(styleEl?.textContent).toContain('.second');
      expect(styleEl?.textContent).not.toContain('.first');
    });
  });
  // #endregion
});
