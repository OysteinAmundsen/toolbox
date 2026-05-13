/**
 * Tests for react-column-config - wrapper functions and config processing.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// Side-effect import: install editor-mount hooks on the adapter so the
// `before-edit-close` blur bridge runs in `wrapReactEditor`. Real consumers
// achieve the same by importing `@toolbox-web/grid-react/features/editing`.
import '../features/editing';

import type { GridConfig } from './react-column-config';
import {
  cleanupConfigRootsIn,
  processGridConfig,
  wrapReactEditor,
  wrapReactEmptyRenderer,
  wrapReactHeaderLabelRenderer,
  wrapReactHeaderRenderer,
  wrapReactLoadingRenderer,
  wrapReactRenderer,
} from './react-column-config';

describe('react-column-config', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region wrapReactRenderer

  describe('wrapReactRenderer', () => {
    it('should return a function', () => {
      const wrapped = wrapReactRenderer(() => 'hello');
      expect(typeof wrapped).toBe('function');
    });

    it('should return an HTMLElement container', () => {
      const wrapped = wrapReactRenderer((ctx) => `Value: ${ctx.value}`);
      const result = wrapped({ value: 'test', row: {}, column: {} as any, field: 'name' } as any);

      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('react-cell-renderer');
      expect(result.style.display).toBe('contents');
    });

    it('should reuse cached root when cellEl is the same', () => {
      const wrapped = wrapReactRenderer((ctx) => `Val: ${ctx.value}`);
      const cellEl = document.createElement('div');

      const result1 = wrapped({ value: 'a', row: {}, column: {} as any, field: 'f', cellEl } as any);
      // Grid attaches the returned container to the cell (production path).
      cellEl.appendChild(result1);
      const result2 = wrapped({ value: 'b', row: {}, column: {} as any, field: 'f', cellEl } as any);

      // Same container returned (cached)
      expect(result2).toBe(result1);
    });

    it('evicts cache and creates fresh container when cached container was detached from cell (issue #250)', () => {
      // Repro: a cell with a renderer is wiped via `cell.innerHTML = ''`
      // (editor opens). The cached container is now detached. The next
      // render call MUST create a fresh container instead of reusing the
      // orphan — otherwise React's still-mounted root throws `removeChild`
      // on the next user-triggered commit.
      const wrapped = wrapReactRenderer((ctx) => `Val: ${ctx.value}`);
      const cellEl = document.createElement('div');
      document.body.appendChild(cellEl);

      const first = wrapped({ value: 'a', row: {}, column: {} as any, field: 'f', cellEl } as any);
      cellEl.appendChild(first);
      expect(cellEl.contains(first)).toBe(true);

      // Editor pipeline simulation: wipe the cell.
      cellEl.innerHTML = '';
      expect(cellEl.contains(first)).toBe(false);

      const second = wrapped({ value: 'b', row: {}, column: {} as any, field: 'f', cellEl } as any);
      // Must be a brand new container, not the orphan.
      expect(second).not.toBe(first);
      expect(second.className).toBe('react-cell-renderer');
    });

    it('should create new container without cellEl', () => {
      const wrapped = wrapReactRenderer(() => 'content');

      const result1 = wrapped({ value: 'a', row: {}, column: {} as any, field: 'f' } as any);
      const result2 = wrapped({ value: 'b', row: {}, column: {} as any, field: 'f' } as any);

      // Different containers (no caching)
      expect(result2).not.toBe(result1);
    });
  });

  // #endregion

  // #region wrapReactEditor

  describe('wrapReactEditor', () => {
    it('should return a function', () => {
      const wrapped = wrapReactEditor(() => 'editor');
      expect(typeof wrapped).toBe('function');
    });

    it('should return an HTMLElement container with editor class', () => {
      const wrapped = wrapReactEditor((ctx) => `Edit: ${ctx.value}`);
      const result = wrapped({
        value: 'test',
        row: {},
        column: {} as any,
        field: 'name',
        commit: () => {
          /* noop */
        },
        cancel: () => {
          /* noop */
        },
      } as any);

      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('react-cell-editor');
    });

    it('flushes the focused input on before-edit-close (issue #250 follow-up)', async () => {
      // Mirror of the slot-path createEditor blur bridge — the config-path
      // wrapReactEditor must attach the same `before-edit-close` listener so
      // Tab/programmatic row exit still commits values for editors written
      // with `onBlur={commit}`.
      const grid = document.createElement('tbw-grid');
      const cell = document.createElement('div');
      grid.appendChild(cell);
      document.body.appendChild(grid);

      const wrapped = wrapReactEditor(() => 'editor');
      const container = wrapped({
        value: 'v',
        row: {},
        column: {} as any,
        field: 'x',
        commit: () => {
          /* noop */
        },
        cancel: () => {
          /* noop */
        },
      } as any);
      cell.appendChild(container);

      const input = document.createElement('input');
      container.appendChild(input);
      input.focus();
      expect(document.activeElement).toBe(input);

      // wrapReactEditor uses queueMicrotask to resolve the host grid.
      await Promise.resolve();

      const blurSpy = vi.fn();
      input.addEventListener('blur', blurSpy);
      grid.dispatchEvent(new CustomEvent('before-edit-close'));
      expect(blurSpy).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(input);

      document.body.removeChild(grid);
    });
  });

  // #endregion

  // #region wrapReactHeaderRenderer

  describe('wrapReactHeaderRenderer', () => {
    it('should return a function that creates a container', () => {
      const wrapped = wrapReactHeaderRenderer((ctx) => `Header: ${ctx.column?.field}`);
      const result = wrapped({ column: { field: 'name' }, value: 'Name' } as any);

      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('react-header-renderer');
    });
  });

  // #endregion

  // #region wrapReactHeaderLabelRenderer

  describe('wrapReactHeaderLabelRenderer', () => {
    it('should return a function that creates a container', () => {
      const wrapped = wrapReactHeaderLabelRenderer((ctx) => `Label: ${ctx.value}`);
      const result = wrapped({ column: { field: 'name' }, value: 'Name' } as any);

      expect(result).toBeInstanceOf(HTMLElement);
      expect(result.className).toBe('react-header-label-renderer');
    });
  });

  // #endregion

  // #region wrapReactLoadingRenderer

  describe('wrapReactLoadingRenderer', () => {
    it('should pass through HTMLElement results', () => {
      const el = document.createElement('div');
      el.textContent = 'Loading...';

      const wrapped = wrapReactLoadingRenderer(() => el as any);
      const result = wrapped({ size: 'large' } as any);

      expect(result).toBe(el);
    });

    it('should pass through string results', () => {
      const wrapped = wrapReactLoadingRenderer(() => 'Loading...' as any);
      const result = wrapped({ size: 'large' } as any);

      expect(result).toBe('Loading...');
    });

    it('should mount React content for non-element results', () => {
      const { createElement } = require('react');
      const wrapped = wrapReactLoadingRenderer(() => createElement('div', null, 'Loading...'));
      const result = wrapped({ size: 'large' } as any);

      expect(result).toBeInstanceOf(HTMLElement);
      expect((result as HTMLElement).className).toBe('react-loading-renderer');
    });
  });

  // #endregion

  // #region wrapReactEmptyRenderer

  describe('wrapReactEmptyRenderer', () => {
    it('should pass through HTMLElement results', () => {
      const el = document.createElement('div');
      el.textContent = 'No data';
      const wrapped = wrapReactEmptyRenderer(() => el as any);
      const result = wrapped({ sourceRowCount: 0, filteredOut: false });
      expect(result).toBe(el);
    });

    it('should pass through string results', () => {
      const wrapped = wrapReactEmptyRenderer(() => 'No data' as any);
      const result = wrapped({ sourceRowCount: 0, filteredOut: false });
      expect(result).toBe('No data');
    });

    it('should mount React content for non-element results', () => {
      const { createElement } = require('react');
      const wrapped = wrapReactEmptyRenderer(() => createElement('div', null, 'No data'));
      const result = wrapped({ sourceRowCount: 0, filteredOut: false });
      expect(result).toBeInstanceOf(HTMLElement);
      expect((result as HTMLElement).className).toBe('react-empty-renderer');
    });
  });

  // #endregion

  // #region processGridConfig

  describe('processGridConfig', () => {
    it('should return undefined for undefined config', () => {
      expect(processGridConfig(undefined)).toBeUndefined();
    });

    it('should pass through config without columns', () => {
      const config = { fitMode: 'fill' as const } as GridConfig;
      const result = processGridConfig(config);
      expect(result?.fitMode).toBe('fill');
    });

    it('should wrap renderer functions in columns', () => {
      const rendererFn = (ctx: any) => `Val: ${ctx.value}`;
      const config: GridConfig = {
        columns: [{ field: 'name', renderer: rendererFn }],
      };

      const result = processGridConfig(config);
      expect(result?.columns![0].renderer).toBeDefined();
      // The wrapped renderer should produce an HTMLElement
      const container = (result?.columns![0].renderer as (...args: unknown[]) => HTMLElement)({
        value: 'test',
        row: {},
        column: {} as any,
        field: 'name',
      });
      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should wrap editor functions in columns', () => {
      const editorFn = (ctx: any) => `Edit: ${ctx.value}`;
      const config: GridConfig = {
        columns: [{ field: 'name', editor: editorFn }],
      };

      const result = processGridConfig(config);
      expect(result?.columns![0].editor).toBeDefined();
      const container = (result?.columns![0].editor as (...args: unknown[]) => HTMLElement)({
        value: 'test',
        row: {},
        column: {} as any,
        field: 'name',
        commit: () => {
          /* noop */
        },
        cancel: () => {
          /* noop */
        },
      });
      expect(container).toBeInstanceOf(HTMLElement);
    });

    it('should wrap headerRenderer functions', () => {
      const headerFn = (ctx: any) => `Header: ${ctx.column?.field}`;
      const config: GridConfig = {
        columns: [{ field: 'name', headerRenderer: headerFn }],
      };

      const result = processGridConfig(config);
      expect((result?.columns![0] as any).headerRenderer).toBeDefined();
    });

    it('should wrap headerLabelRenderer functions', () => {
      const labelFn = (ctx: any) => `Label: ${ctx.value}`;
      const config: GridConfig = {
        columns: [{ field: 'name', headerLabelRenderer: labelFn }],
      };

      const result = processGridConfig(config);
      expect((result?.columns![0] as any).headerLabelRenderer).toBeDefined();
    });

    it('should wrap loadingRenderer at config level', () => {
      const loadingFn = () => ({ type: 'div' }) as any;
      const config: GridConfig = {
        columns: [{ field: 'name' }],
        loadingRenderer: loadingFn,
      };

      const result = processGridConfig(config);
      expect(result?.loadingRenderer).toBeDefined();
    });

    it('should wrap emptyRenderer at config level', () => {
      const emptyFn = () => ({ type: 'div' }) as any;
      const config: GridConfig = {
        columns: [{ field: 'name' }],
        emptyRenderer: emptyFn,
      };

      const result = processGridConfig(config);
      expect(result?.emptyRenderer).toBeDefined();
      expect(result?.emptyRenderer).not.toBe(emptyFn);
    });

    it('should preserve emptyRenderer: null (opt-out)', () => {
      const config: GridConfig = {
        columns: [{ field: 'name' }],
        emptyRenderer: null,
      };

      const result = processGridConfig(config);
      expect(result?.emptyRenderer).toBeNull();
    });

    it('should preserve non-renderer column properties', () => {
      const config: GridConfig = {
        columns: [
          {
            field: 'name',
            header: 'Full Name',
            width: 200,
            sortable: true,
            renderer: (ctx: any) => ctx.value,
          },
        ],
      };

      const result = processGridConfig(config);
      expect(result?.columns![0].field).toBe('name');
      expect(result?.columns![0].header).toBe('Full Name');
      expect(result?.columns![0].width).toBe(200);
      expect(result?.columns![0].sortable).toBe(true);
    });
  });

  // #endregion

  // #region cleanupConfigRootsIn

  describe('cleanupConfigRootsIn', () => {
    it('should not throw when no roots exist', () => {
      const parent = document.createElement('div');
      expect(() => cleanupConfigRootsIn(parent)).not.toThrow();
    });

    it('should clean up editor roots inside the parent element', () => {
      // Create an editor via wrapReactEditor (adds to mountedRoots)
      const wrapped = wrapReactEditor(() => 'editor content');
      const editorContainer = wrapped({
        value: 'test',
        row: {},
        column: {} as any,
        field: 'name',
        commit: () => {
          /* noop */
        },
        cancel: () => {
          /* noop */
        },
      } as any);

      // Put the editor container inside a parent
      const parent = document.createElement('div');
      parent.appendChild(editorContainer);

      // Cleanup should remove the tracked root
      expect(() => cleanupConfigRootsIn(parent)).not.toThrow();
    });
  });

  // #endregion
});
