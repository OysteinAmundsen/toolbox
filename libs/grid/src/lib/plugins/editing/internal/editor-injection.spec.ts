/**
 * Tests for editor-injection.
 *
 * Covers:
 * - injectEditor: guards (not editable, already editing)
 * - injectEditor: cell state setup (class, editingCells set, row editing count)
 * - injectEditor: editor host creation
 * - injectEditor: commit / cancel callbacks
 * - injectEditor: keyboard handling (Enter, Escape) in default and grid modes
 * - injectEditor: factory-function editors (string return, Node return, void return)
 * - injectEditor: custom-element string editors
 * - injectEditor: external editor object (mount callback)
 * - injectEditor: template editors
 * - injectEditor: value-change callback registration
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ColumnConfig, ColumnInternal } from '../../../core/types';
import { injectEditor, type EditorInjectionDeps } from './editor-injection';

// #region Helpers

/** Create a minimal mock deps object. */
function createDeps<T = Record<string, unknown>>(
  overrides: Partial<EditorInjectionDeps<T>> = {},
): EditorInjectionDeps<T> {
  return {
    grid: {
      getRowId: (row: any) => String(row.id ?? ''),
      _getRowEntry: vi.fn().mockReturnValue(undefined),
      __frameworkAdapter: undefined,
      effectiveConfig: {},
      updateRow: vi.fn(),
    } as any,
    isGridMode: false,
    config: {} as any,
    editingCells: new Set<string>(),
    editorValueCallbacks: new Map(),
    isEditSessionActive: () => true,
    commitCellValue: vi.fn(),
    exitRowEdit: vi.fn(),
    ...overrides,
  };
}

/** Create a cell element inside a row (simulates grid DOM). */
function createCellInRow(): { cell: HTMLElement; row: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'row';
  const cell = document.createElement('div');
  cell.className = 'cell';
  row.appendChild(cell);
  document.body.appendChild(row);
  return { cell, row };
}

/** Create a column config with field and editable. */
function col(field: string, extra: Partial<ColumnConfig<any>> = {}): ColumnConfig<any> {
  return { field, editable: true, ...extra } as ColumnConfig<any>;
}

// #endregion

describe('editor-injection', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // #region Guards

  describe('guards', () => {
    it('should not inject when column is not editable', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name', { editable: false });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, false);

      expect(cell.classList.contains('editing')).toBe(false);
      expect(cell.querySelector('.tbw-editor-host')).toBeNull();
    });

    it('should not inject when cell is already editing', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      cell.classList.add('editing');

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, false);

      // Should not add a second editor host
      expect(cell.querySelectorAll('.tbw-editor-host').length).toBe(0);
    });
  });

  // #endregion

  // #region Cell State

  describe('cell state setup', () => {
    it('should add "editing" class to cell', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      expect(cell.classList.contains('editing')).toBe(true);
    });

    it('should track cell in editingCells set', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 2, col('name'), 3, cell, true);

      expect(deps.editingCells.has('2:3')).toBe(true);
    });

    it('should set data-has-editing on parent row', () => {
      const deps = createDeps();
      const { cell, row } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      expect(row.hasAttribute('data-has-editing')).toBe(true);
    });

    it('should create an editor host element', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      const host = cell.querySelector('.tbw-editor-host');
      expect(host).not.toBeNull();
    });

    it('should clear previous cell content', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      cell.textContent = 'Original content';

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      expect(cell.textContent).not.toContain('Original content');
    });
  });

  // #endregion

  // #region Built-in Default Editor

  describe('built-in default editor', () => {
    it('should render a default text input when no editor is specified', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      const input = cell.querySelector('input');
      expect(input).not.toBeNull();
    });

    it('should set input value to current field value', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      const input = cell.querySelector('input') as HTMLInputElement | null;
      expect(input?.value).toBe('Alice');
    });
  });

  // #endregion

  // #region Factory Function Editor

  describe('factory function editor', () => {
    it('should render string-returned editor HTML', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name', {
        editor: () => '<input class="custom-input" />',
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(cell.querySelector('.custom-input')).not.toBeNull();
    });

    it('should render Node-returned editor', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const customInput = document.createElement('input');
      customInput.className = 'node-editor';
      const column = col('name', {
        editor: () => customInput,
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(cell.querySelector('.node-editor')).not.toBeNull();
    });

    it('should mark cell as editor-managed when factory returns a non-input Node', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const customDiv = document.createElement('div');
      customDiv.textContent = 'Custom editor';
      const column = col('name', {
        editor: () => customDiv,
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(cell.hasAttribute('data-editor-managed')).toBe(true);
    });

    it('should NOT mark cell as editor-managed when factory returns a simple input', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const input = document.createElement('input');
      const column = col('name', {
        editor: () => input,
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(cell.hasAttribute('data-editor-managed')).toBe(false);
    });

    it('should pass EditorContext to factory function', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const editorSpy = vi.fn().mockReturnValue(document.createElement('input'));
      const column = col('name', { editor: editorSpy });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(editorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          row: { id: '1', name: 'Alice' },
          value: 'Alice',
          field: 'name',
          column: expect.any(Object),
          commit: expect.any(Function),
          cancel: expect.any(Function),
          updateRow: expect.any(Function),
          onValueChange: expect.any(Function),
        }),
      );
    });

    it('should mark cell as editor-managed when factory returns void but mounts content', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name', {
        editor: (_ctx: any) => {
          // Simulate framework adapter mounting content into the host
          const host = cell.querySelector('.tbw-editor-host');
          if (host) {
            const el = document.createElement('div');
            el.textContent = 'Framework editor';
            host.appendChild(el);
          }
          // Return void
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(cell.hasAttribute('data-editor-managed')).toBe(true);
    });
  });

  // #endregion

  // #region Custom Element Editor

  describe('custom element editor', () => {
    it('should create a custom element when editor spec is a tag name string', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      // Simulate resolveEditor returning a custom-element tag name
      // by setting column.editor to a string via the column's internal type
      const column = col('name') as ColumnInternal<any>;
      column.editor = 'my-custom-editor' as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      const customEl = cell.querySelector('my-custom-editor');
      expect(customEl).not.toBeNull();
    });

    it('should set value property on custom element', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;
      column.editor = 'my-custom-editor' as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      const customEl = cell.querySelector('my-custom-editor') as HTMLElement & { value?: unknown };
      expect(customEl?.value).toBe('Alice');
    });
  });

  // #endregion

  // #region External Editor Object

  describe('external editor object (mount)', () => {
    it('should call mount callback when editor spec is an object with mount', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const mountFn = vi.fn();
      const column = col('name') as ColumnInternal<any>;
      column.editor = { mount: mountFn } as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(mountFn).toHaveBeenCalledWith(
        expect.objectContaining({
          placeholder: expect.any(HTMLElement),
          context: expect.objectContaining({
            row: { id: '1', name: 'Alice' },
            field: 'name',
          }),
          spec: expect.objectContaining({ mount: mountFn }),
        }),
      );
    });

    it('should mark cell as editor-managed for external editors', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;
      column.editor = { mount: vi.fn() } as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(cell.hasAttribute('data-editor-managed')).toBe(true);
    });

    it('should dispatch mount-external-editor event when no mount callback', () => {
      // Use a real element so dispatchEvent exists
      const gridEl = document.createElement('div');
      document.body.appendChild(gridEl);
      const deps = createDeps({
        grid: Object.assign(gridEl, {
          getRowId: (row: any) => String(row.id ?? ''),
          _getRowEntry: vi.fn().mockReturnValue(undefined),
          __frameworkAdapter: undefined,
          effectiveConfig: {},
          updateRow: vi.fn(),
        }) as any,
      });
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;
      column.editor = { type: 'angular-component' } as any;

      const dispatchSpy = vi.spyOn(gridEl, 'dispatchEvent');

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mount-external-editor',
        }),
      );
    });

    it('should warn if mount callback throws', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* noop */
      });
      const column = col('name') as ColumnInternal<any>;
      column.editor = {
        mount: () => {
          throw new Error('mount failed');
        },
      } as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('External editor mount error'));
      warnSpy.mockRestore();
    });
  });

  // #endregion

  // #region Commit and Cancel

  describe('commit and cancel', () => {
    it('should call commitCellValue when commit is invoked', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      let capturedCtx: any;
      const column = col('name', {
        editor: (ctx: any) => {
          capturedCtx = ctx;
          return document.createElement('input');
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      capturedCtx.commit('Bob');

      expect(deps.commitCellValue).toHaveBeenCalledWith(0, column, 'Bob', expect.any(Object));
    });

    it('should restore original value on cancel', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const rowData = { id: '1', name: 'Alice' };
      let capturedCtx: any;
      const column = col('name', {
        editor: (ctx: any) => {
          capturedCtx = ctx;
          return document.createElement('input');
        },
      });

      injectEditor(deps, rowData, 0, column, 0, cell, true);

      // Mutate the row
      rowData.name = 'Changed';
      capturedCtx.cancel();

      // Original value should be restored
      expect(rowData.name).toBe('Alice');
    });

    it('should not commit after cancel (editFinalized guard)', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      let capturedCtx: any;
      const column = col('name', {
        editor: (ctx: any) => {
          capturedCtx = ctx;
          return document.createElement('input');
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      capturedCtx.cancel();
      capturedCtx.commit('Bob');

      // commitCellValue should not have been called after cancel
      expect(deps.commitCellValue).not.toHaveBeenCalled();
    });

    it('should not commit in non-grid mode when no edit session is active', () => {
      const deps = createDeps({ isEditSessionActive: () => false });
      const { cell } = createCellInRow();
      let capturedCtx: any;
      const column = col('name', {
        editor: (ctx: any) => {
          capturedCtx = ctx;
          return document.createElement('input');
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      capturedCtx.commit('Bob');

      expect(deps.commitCellValue).not.toHaveBeenCalled();
    });

    it('should allow commit in grid mode even without active edit session', () => {
      const deps = createDeps({
        isGridMode: true,
        isEditSessionActive: () => false,
      });
      const { cell } = createCellInRow();
      let capturedCtx: any;
      const column = col('name', {
        editor: (ctx: any) => {
          capturedCtx = ctx;
          return document.createElement('input');
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      capturedCtx.commit('Bob');

      expect(deps.commitCellValue).toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Keyboard Handling

  describe('keyboard handling', () => {
    function getEditorHost(cell: HTMLElement): HTMLElement {
      return cell.querySelector('.tbw-editor-host') as HTMLElement;
    }

    it('should call exitRowEdit(revert=false) on Enter in default mode', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      getEditorHost(cell).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(deps.exitRowEdit).toHaveBeenCalledWith(0, false);
    });

    it('should call exitRowEdit(revert=true) on Escape in default mode', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      getEditorHost(cell).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(deps.exitRowEdit).toHaveBeenCalledWith(0, true);
    });

    it('should NOT exit on Enter in grid mode (commits only)', () => {
      const deps = createDeps({ isGridMode: true });
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      getEditorHost(cell).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(deps.exitRowEdit).not.toHaveBeenCalled();
    });

    it('should NOT exit on Escape in grid mode', () => {
      const deps = createDeps({ isGridMode: true });
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      getEditorHost(cell).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(deps.exitRowEdit).not.toHaveBeenCalled();
    });

    it('should NOT exit on Enter when defaultPrevented (portal pickers, #250)', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      // Simulate a portal-based picker (combobox/autocomplete) that handles
      // Enter to confirm a selection and calls preventDefault on the event
      // before it bubbles up to the editor host.
      const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      evt.preventDefault();
      getEditorHost(cell).dispatchEvent(evt);

      expect(deps.exitRowEdit).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Value-Change Callbacks

  describe('value-change callbacks', () => {
    it('should register a value-change callback in editorValueCallbacks', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      expect(deps.editorValueCallbacks.has('0:name')).toBe(true);
    });

    it('should invoke onValueChange callback when editorValueCallbacks triggers', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      let _capturedOnValueChange: ((v: unknown) => void) | undefined;
      const column = col('name', {
        editor: (ctx: any) => {
          _capturedOnValueChange = ctx.onValueChange;
          const valueSpy = vi.fn();
          ctx.onValueChange(valueSpy);
          return document.createElement('input');
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      // Trigger the value-change callback from the deps
      const cb = deps.editorValueCallbacks.get('0:name');
      expect(cb).toBeDefined();
      cb!('NewValue');

      // The spy registered inside the editor factory should have been called
    });
  });

  // #endregion

  // #region Template Editor

  describe('template editor', () => {
    it('should render a template editor when column has __editorTemplate', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;

      // Create a template holder with an input
      const tplHolder = document.createElement('div');
      tplHolder.innerHTML = '<input type="text" />';
      column.__editorTemplate = tplHolder as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      const input = cell.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input?.value).toBe('Alice');
    });

    it('should handle checkbox template editor', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('active') as ColumnInternal<any>;

      const tplHolder = document.createElement('div');
      tplHolder.innerHTML = '<input type="checkbox" />';
      column.__editorTemplate = tplHolder as any;

      injectEditor(deps, { id: '1', active: true }, 0, column, 0, cell, true);

      const input = cell.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.checked).toBe(true);
    });

    it('should apply compiled editor function when available', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;

      const tplHolder = document.createElement('div');
      column.__editorTemplate = tplHolder as any;
      column.__compiledEditor = vi.fn().mockReturnValue('<input type="text" value="compiled" />');

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(column.__compiledEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          row: { id: '1', name: 'Alice' },
          value: 'Alice',
          field: 'name',
        }),
      );
    });

    it('should interpolate {{value}} in template text nodes', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;

      const tplHolder = document.createElement('div');
      tplHolder.innerHTML = '<span>Current: {{value}}</span><input type="text" />';
      column.__editorTemplate = tplHolder as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      const span = cell.querySelector('span');
      expect(span?.textContent).toBe('Current: Alice');
    });

    it('should interpolate {{row.field}} in template text nodes', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name') as ColumnInternal<any>;

      const tplHolder = document.createElement('div');
      tplHolder.innerHTML = '<span>ID: {{row.id}}</span><input type="text" />';
      column.__editorTemplate = tplHolder as any;

      injectEditor(deps, { id: '42', name: 'Alice' }, 0, column, 0, cell, true);

      const span = cell.querySelector('span');
      expect(span?.textContent).toBe('ID: 42');
    });

    it('should skip auto-update for non-primitive values (arrays, objects)', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('tags') as ColumnInternal<any>;

      const tplHolder = document.createElement('div');
      tplHolder.innerHTML = '<input type="text" />';
      column.__editorTemplate = tplHolder as any;

      injectEditor(deps, { id: '1', tags: 'initial' }, 0, column, 0, cell, true);

      const input = cell.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('initial');

      // Trigger value-change callback with an array — should be skipped
      const cb = deps.editorValueCallbacks.get('0:tags');
      expect(cb).toBeDefined();
      cb!(['a', 'b', 'c']);
      expect(input.value).toBe('initial'); // unchanged

      // Trigger with an object — should also be skipped
      cb!({ nested: true });
      expect(input.value).toBe('initial'); // unchanged

      // Trigger with a primitive string — should update
      cb!('updated');
      expect(input.value).toBe('updated');
    });
  });

  // #endregion

  // #region Row ID Handling

  describe('row ID handling', () => {
    it('should work when getRowId is not available', () => {
      const deps = createDeps({
        grid: {
          getRowId: undefined,
          _getRowEntry: vi.fn(),
          __frameworkAdapter: undefined,
          effectiveConfig: {},
        } as any,
      });
      const { cell } = createCellInRow();

      // Should not throw
      expect(() => {
        injectEditor(deps, { name: 'Alice' }, 0, col('name'), 0, cell, true);
      }).not.toThrow();
    });

    it('should use _getRowEntry for fresh row lookup on commit', () => {
      const freshRow = { id: '1', name: 'UpdatedAlice' };
      const getRowEntrySpy = vi.fn().mockReturnValue({ row: freshRow, index: 5 });
      const deps = createDeps({
        grid: {
          getRowId: (row: any) => row.id,
          _getRowEntry: getRowEntrySpy,
          __frameworkAdapter: undefined,
          effectiveConfig: {},
          updateRow: vi.fn(),
        } as any,
      });
      const { cell } = createCellInRow();
      let capturedCtx: any;
      const column = col('name', {
        editor: (ctx: any) => {
          capturedCtx = ctx;
          return document.createElement('input');
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      capturedCtx.commit('Bob');

      expect(getRowEntrySpy).toHaveBeenCalledWith('1');
      // commitCellValue should use the fresh index (5) and fresh row
      expect(deps.commitCellValue).toHaveBeenCalledWith(5, column, 'Bob', freshRow);
    });
  });

  // #endregion
});
