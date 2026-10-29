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
import { setCellLoadingState } from '../../../core/internal/loading';
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

const MULTI_SELECT_HTML =
  '<select multiple><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>';

/** Open `column`'s editor on `tags: ['a']`, push `next` as an external update, and return the option flags (#555). */
function pushIntoMultiSelect(column: ColumnConfig<any>, next: unknown[]): boolean[] {
  const deps = createDeps();
  const { cell } = createCellInRow();
  injectEditor(deps, { id: '1', tags: ['a'] }, 0, column, 0, cell, true);
  deps.editorValueCallbacks.get('0:tags')!(next);
  const select = cell.querySelector('select') as HTMLSelectElement;
  return Array.from(select.options).map((o) => o.selected);
}

/** Create an editable column whose `<tbw-grid-column-editor>` template is `html`. */
function templateColumn(field: string, html: string): ColumnInternal<any> {
  const column = col(field) as ColumnInternal<any>;
  const tplHolder = document.createElement('div');
  tplHolder.innerHTML = html;
  column.__editorTemplate = tplHolder as any;
  return column;
}

/** Inject a template editor built from `html` on `row`; returns the deps and the rendered cell. */
function injectTemplate(
  html: string,
  row: Record<string, unknown>,
  field: string,
  overrides: Partial<EditorInjectionDeps<any>> = {},
) {
  const deps = createDeps(overrides);
  const { cell, row: rowEl } = createCellInRow();
  const column = templateColumn(field, html);
  injectEditor(deps, row, 0, column, 0, cell, true);
  return { deps, cell, rowEl, column };
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

    it('should leave a nested cell loading overlay in its own grid when injecting an editor', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const nestedGrid = document.createElement('div');
      const nestedCell = document.createElement('div');
      nestedCell.className = 'cell';
      nestedGrid.appendChild(nestedCell);
      cell.appendChild(nestedGrid);
      setCellLoadingState(nestedCell, true, () => document.createElement('span'));
      const nestedOverlay = nestedCell.querySelector(':scope > .tbw-cell-loading-overlay');

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      expect(cell.querySelector(':scope > .tbw-editor-host')).not.toBeNull();
      expect(cell.querySelector(':scope > .tbw-cell-loading-overlay')).toBeNull();
      expect(nestedCell.querySelector(':scope > .tbw-cell-loading-overlay')).toBe(nestedOverlay);
    });

    it('keeps a loading renderer connected while releasing sibling cell content', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const cellRenderer = document.createElement('div');
      cellRenderer.className = 'react-cell-renderer';
      cell.appendChild(cellRenderer);
      setCellLoadingState(cell, true, () => document.createElement('span'));
      const overlay = cell.querySelector(':scope > .tbw-cell-loading-overlay')!;
      const releaseCell = vi.fn((releasedCell: HTMLElement) => {
        expect(overlay.isConnected).toBe(true);
        expect(releasedCell.contains(overlay)).toBe(false);
      });
      deps.grid.__frameworkAdapter = { releaseCell } as any;

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);

      expect(releaseCell).toHaveBeenCalledWith(cell);
      expect(cell.querySelector(':scope > .tbw-editor-host')).not.toBeNull();
      expect(cell.querySelector(':scope > .tbw-cell-loading-overlay')).toBe(overlay);
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

    it('should drop a tab-obfuscated javascript: URL interpolated from row data in string-returned HTML', () => {
      const { cell } = createCellInRow();
      const column = col('name', {
        editor: (ctx) => `<a class="help" href="${(ctx.row as any).helpUrl}">?</a><input class="custom-input" />`,
      });

      injectEditor(
        createDeps(),
        { id: '1', name: 'Alice', helpUrl: 'java\tscript:alert(1)' },
        0,
        column,
        0,
        cell,
        true,
      );

      const help = cell.querySelector('a.help') as HTMLAnchorElement;
      expect(help).not.toBeNull();
      expect(help.hasAttribute('href')).toBe(false);
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

    it('should NOT read raw input DOM on grid-mode Enter for data-editor-managed cells', () => {
      const inject = (editor: ColumnConfig<any>['editor']) => {
        const deps = createDeps({ isGridMode: true });
        const { cell } = createCellInRow();
        injectEditor(deps, { id: '1', amount: 1234 }, 0, col('amount', { editor }), 0, cell, true);
        const input = cell.querySelector('input') as HTMLInputElement;
        input.value = '1,234.00'; // formatted draft owned by the wrapper editor
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        return { deps, cell };
      };

      // Wrapper node → managed: the editor's own blur-commit owns the value.
      const managed = inject(() => {
        const wrap = document.createElement('div');
        wrap.appendChild(document.createElement('input'));
        return wrap;
      });
      expect(managed.cell.hasAttribute('data-editor-managed')).toBe(true);
      expect(managed.deps.commitCellValue).not.toHaveBeenCalled();

      // Bare input → not managed: Enter commits the DOM value as before.
      const plain = inject(() => document.createElement('input'));
      expect(plain.cell.hasAttribute('data-editor-managed')).toBe(false);
      expect(plain.deps.commitCellValue).toHaveBeenCalledTimes(1);
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

    it('should apply array values to a multi-select returned by a factory (#555)', () => {
      const column = col('tags', {
        editor: () => {
          const host = document.createElement('div');
          host.innerHTML = MULTI_SELECT_HTML;
          return host.firstElementChild as HTMLSelectElement;
        },
      });
      expect(pushIntoMultiSelect(column, ['a', 'c'])).toEqual([true, false, true]);
    });

    it('should apply array values to a multi-select produced by an HTML-string factory (#555)', () => {
      const column = col('tags', { editor: () => MULTI_SELECT_HTML });
      expect(pushIntoMultiSelect(column, ['b', 'c'])).toEqual([false, true, true]);
    });
  });

  // #endregion

  // #region Template Editor

  describe('template editor', () => {
    it('should render a template editor when column has __editorTemplate', () => {
      const { cell } = injectTemplate('<input type="text" />', { id: '1', name: 'Alice' }, 'name');

      const input = cell.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Alice');
    });

    it('strips a javascript: URL interpolated into an attribute, keeping the control (security)', () => {
      const { cell } = injectTemplate(
        '<a href="{{ row.helpUrl }}">Help</a><input type="text" />',
        { id: '1', name: 'Alice', helpUrl: 'javascript:alert(1)' },
        'name',
      );

      const link = cell.querySelector('a') as HTMLAnchorElement;
      expect(link).not.toBeNull();
      expect(link.hasAttribute('href')).toBe(false);
      expect((cell.querySelector('input') as HTMLInputElement).value).toBe('Alice');
    });

    it('keeps a safe interpolated URL', () => {
      const { cell } = injectTemplate(
        '<a href="{{ row.helpUrl }}">Help</a><input type="text" />',
        { id: '1', name: 'Alice', helpUrl: 'https://example.com/help' },
        'name',
      );

      expect(cell.querySelector('a')?.getAttribute('href')).toBe('https://example.com/help');
    });

    it('scrubs a javascript: URL in an HTML-string factory editor too', () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const row = { id: '1', name: 'Alice', helpUrl: 'javascript:alert(1)' };
      const column = col('name', {
        editor: (ctx: any) => `<a href="${ctx.row.helpUrl}">Help</a><input type="text" value="${ctx.value}">`,
      });

      injectEditor(deps, row, 0, column, 0, cell, true);

      expect(cell.querySelector('a')?.hasAttribute('href')).toBe(false);
      expect((cell.querySelector('input') as HTMLInputElement).value).toBe('Alice');
    });

    describe('multi-select commit dedupe (#551)', () => {
      /** Selects option `value` and fires `change`, then `blur`, on the template's select. */
      function selectThenBlur(cell: HTMLElement, value: string): HTMLSelectElement {
        const select = cell.querySelector('select') as HTMLSelectElement;
        for (const o of select.options) if (o.value === value) o.selected = true;
        select.dispatchEvent(new Event('change'));
        select.dispatchEvent(new FocusEvent('blur'));
        return select;
      }

      it('emits one commit for change + blur when the commit was applied to the row', () => {
        const commitCellValue = vi.fn((_ri: number, _col: unknown, val: unknown, row: any) => {
          row.tags = val; // the plugin's #commitCellValue writes the accepted value
        });
        const { cell } = injectTemplate(MULTI_SELECT_HTML, { id: '1', tags: ['a'] }, 'tags', { commitCellValue });

        selectThenBlur(cell, 'b');

        expect(commitCellValue).toHaveBeenCalledTimes(1);
        expect(commitCellValue.mock.calls[0][2]).toEqual(['a', 'b']);
      });

      it('retries on blur when the change commit was vetoed (row unchanged)', () => {
        const commitCellValue = vi.fn(); // never writes the row — a vetoed `cell-commit`
        const { cell } = injectTemplate(MULTI_SELECT_HTML, { id: '1', tags: ['a'] }, 'tags', { commitCellValue });

        selectThenBlur(cell, 'b');

        expect(commitCellValue).toHaveBeenCalledTimes(2);
      });

      it('does not commit at all when the selection equals the row value', () => {
        const commitCellValue = vi.fn();
        const { cell } = injectTemplate(MULTI_SELECT_HTML, { id: '1', tags: ['a'] }, 'tags', { commitCellValue });

        selectThenBlur(cell, 'a');

        expect(commitCellValue).not.toHaveBeenCalled();
      });

      it('emits one commit for change → Enter → blur in grid mode (Enter re-reads a fresh array)', () => {
        const commitCellValue = vi.fn((_ri: number, _col: unknown, val: unknown, row: any) => {
          row.tags = val;
        });
        const { cell } = injectTemplate(MULTI_SELECT_HTML, { id: '1', tags: ['a'] }, 'tags', {
          commitCellValue,
          isGridMode: true,
        });
        const select = cell.querySelector('select') as HTMLSelectElement;
        for (const o of select.options) if (o.value === 'b') o.selected = true;

        select.dispatchEvent(new Event('change'));
        // Dispatched on the host, not the select: happy-dom hands `closest()` a
        // different wrapper object than `e.target` for `<select>`, so the #427
        // descendant guard (`ancestor !== target`) would swallow Enter here even
        // though browsers see one identity. Target = host still runs the same
        // grid-mode commit branch.
        const host = cell.querySelector('.tbw-editor-host') as HTMLElement;
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        host.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(true); // the grid-mode branch ran
        select.dispatchEvent(new FocusEvent('blur'));

        expect(commitCellValue).toHaveBeenCalledTimes(1);
        expect(commitCellValue.mock.calls[0][2]).toEqual(['a', 'b']);
      });
    });

    it('should drop a tab-obfuscated javascript: URL interpolated from row data (scrubEditorMarkup)', () => {
      const { cell } = injectTemplate(
        '<a class="help" href="{{ row.helpUrl }}">?</a><input type="text" />',
        { id: '1', name: 'Alice', helpUrl: 'java\tscript:alert(1)' },
        'name',
      );

      const help = cell.querySelector('a.help') as HTMLAnchorElement;
      expect(help).not.toBeNull();
      expect(help.hasAttribute('href')).toBe(false);
      expect(cell.querySelector('input')).not.toBeNull();
    });

    it('should handle checkbox template editor', () => {
      const { cell } = injectTemplate('<input type="checkbox" />', { id: '1', active: true }, 'active');

      const input = cell.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.checked).toBe(true);
    });

    it('should apply compiled editor function when available', () => {
      const column = templateColumn('name', '');
      column.__compiledEditor = vi.fn().mockReturnValue('<input type="text" value="compiled" />');
      const { cell } = createCellInRow();

      injectEditor(createDeps(), { id: '1', name: 'Alice' }, 0, column, 0, cell, true);

      expect(column.__compiledEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          row: { id: '1', name: 'Alice' },
          value: 'Alice',
          field: 'name',
        }),
      );
    });

    it('should interpolate {{value}} in template text nodes', () => {
      const { cell } = injectTemplate(
        '<span>Current: {{value}}</span><input type="text" />',
        { id: '1', name: 'Alice' },
        'name',
      );

      expect(cell.querySelector('span')?.textContent).toBe('Current: Alice');
    });

    it('should interpolate {{row.field}} in template text nodes', () => {
      const { cell } = injectTemplate(
        '<span>ID: {{row.id}}</span><input type="text" />',
        { id: '42', name: 'Alice' },
        'name',
      );

      expect(cell.querySelector('span')?.textContent).toBe('ID: 42');
    });

    it('should skip auto-update for non-primitive values (arrays, objects)', () => {
      const { deps, cell } = injectTemplate('<input type="text" />', { id: '1', tags: 'initial' }, 'tags');

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

    it('should apply array values to a multi-select template editor (#555)', () => {
      expect(pushIntoMultiSelect(templateColumn('tags', MULTI_SELECT_HTML), ['a', 'c'])).toEqual([true, false, true]);
    });

    it('should apply a Date to a date-input template editor, but not to a text input (#555)', () => {
      const push = (html: string) => {
        const { deps, cell } = injectTemplate(html, { id: '1', due: '2024-06-15' }, 'due');
        deps.editorValueCallbacks.get('0:due')!(new Date(Date.UTC(2026, 9, 23)));
        return (cell.querySelector('input') as HTMLInputElement).value;
      };

      expect(push('<input type="date" />')).toBe('2026-10-23');
      expect(push('<input type="text" />')).toBe('2024-06-15');
    });

    it('should seed a multi-select template from an array value via setInputValue (#555 seed)', () => {
      const { cell } = injectTemplate(MULTI_SELECT_HTML, { id: '1', tags: ['a', 'c'] }, 'tags');
      const select = cell.querySelector('select') as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.selected)).toEqual([true, false, true]);
    });

    it('should seed a date-input template from a Date value (#555 seed)', () => {
      const { cell } = injectTemplate(
        '<input type="date" />',
        { id: '1', due: new Date(Date.UTC(2026, 9, 23)) },
        'due',
      );
      expect((cell.querySelector('input') as HTMLInputElement).value).toBe('2026-10-23');
    });

    it('should compile the template lazily and interpolate attributes (config-manager runs before processColumns)', () => {
      const { cell, column } = injectTemplate(
        '<input type="text" placeholder="Hi {{row.id}}" />',
        { id: '42' },
        'name',
      );
      expect(column.__compiledEditor).toBeTypeOf('function');
      expect((cell.querySelector('input') as HTMLInputElement).placeholder).toBe('Hi 42');

      const compiled = column.__compiledEditor;
      const { cell: second } = createCellInRow();
      injectEditor(createDeps(), { id: '7' }, 1, column, 0, second, true);
      expect(column.__compiledEditor).toBe(compiled);
      expect((second.querySelector('input') as HTMLInputElement).placeholder).toBe('Hi 7');
    });

    it('should still render the control when every {{ }} is blank (null / "" / undefined cell, PR #578)', () => {
      for (const amount of [null, '', undefined]) {
        const { cell } = injectTemplate('<input type="number" value="{{ value }}" />', { id: '1', amount }, 'amount');
        const input = cell.querySelector('input') as HTMLInputElement | null;
        expect(input, `value ${String(amount)}`).not.toBeNull();
        expect(input!.type).toBe('number');
        expect(input!.value).toBe('');
      }
    });

    describe('keyboard (shares the host handler)', () => {
      const enter = () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

      it('should exit the row on Enter in row mode', () => {
        const { deps, cell } = injectTemplate('<input type="text" />', { id: '1', name: 'Alice' }, 'name');
        cell.querySelector('input')!.dispatchEvent(enter());
        expect(deps.exitRowEdit).toHaveBeenCalledWith(0, false);
      });

      it('should commit without exiting and let Enter bubble in grid mode', () => {
        const { deps, cell, rowEl } = injectTemplate('<input type="text" />', { id: '1', name: 'Alice' }, 'name', {
          isGridMode: true,
        });
        const reachedRow = vi.fn();
        rowEl.addEventListener('keydown', reachedRow);
        const input = cell.querySelector('input') as HTMLInputElement;
        input.value = 'Bob';
        input.dispatchEvent(enter());

        expect(deps.commitCellValue).toHaveBeenCalledWith(0, expect.anything(), 'Bob', expect.anything());
        expect(deps.exitRowEdit).not.toHaveBeenCalled();
        // The plugin's onKeyDown blurs the editor and returns focus to the grid — it must see the event.
        expect(reachedRow).toHaveBeenCalled();
      });

      it('should NOT exit on Enter when defaultPrevented (#250 parity)', () => {
        const { deps, cell } = injectTemplate('<input type="text" />', { id: '1', name: 'Alice' }, 'name');
        const evt = enter();
        evt.preventDefault();
        cell.querySelector('input')!.dispatchEvent(evt);
        expect(deps.exitRowEdit).not.toHaveBeenCalled();
      });

      it('should NOT exit or preventDefault on Enter from an <option> of an open <select> popup (#427 parity)', () => {
        const { deps, cell } = injectTemplate(
          '<select><option value="a">A</option><option value="b">B</option></select>',
          { id: '1', kind: 'a' },
          'kind',
        );
        const evt = enter();
        cell.querySelector('option[value="b"]')!.dispatchEvent(evt);
        expect(deps.exitRowEdit).not.toHaveBeenCalled();
        expect(deps.commitCellValue).not.toHaveBeenCalled();
        expect(evt.defaultPrevented).toBe(false);
      });

      it('should commit on change for a template <select> (same wiring as HTML-string editors)', () => {
        const { deps, cell } = injectTemplate(
          '<select><option value="a">A</option><option value="b">B</option></select>',
          { id: '1', kind: 'a' },
          'kind',
        );
        const select = cell.querySelector('select') as HTMLSelectElement;
        select.value = 'b';
        select.dispatchEvent(new Event('change'));
        expect(deps.commitCellValue).toHaveBeenCalledWith(0, expect.anything(), 'b', expect.anything());
      });
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

  // #region Accessible name (SC 4.1.2 / 3.3.2)

  describe('accessible name', () => {
    /** `nameEditorFromHeader` defers a microtask so async editors are covered. */
    const flush = () => new Promise<void>((r) => queueMicrotask(() => r()));

    it('names the editor after its column header', async () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name', { header: 'Full name' });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      await flush();

      const input = cell.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).toBe('Full name');
    });

    it('falls back to the field when the column has no header', async () => {
      const deps = createDeps();
      const { cell } = createCellInRow();

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, col('name'), 0, cell, true);
      await flush();

      expect(cell.querySelector('input')?.getAttribute('aria-label')).toBe('name');
    });

    it('leaves an editor that already names itself alone', async () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name', {
        header: 'Full name',
        editor: () => {
          const input = document.createElement('input');
          input.setAttribute('aria-label', 'Employee name');
          return input;
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      await flush();

      expect(cell.querySelector('input')?.getAttribute('aria-label')).toBe('Employee name');
    });

    it('respects a wrapping <label> instead of adding a second name', async () => {
      const deps = createDeps();
      const { cell } = createCellInRow();
      const column = col('name', {
        header: 'Full name',
        editor: () => {
          const label = document.createElement('label');
          label.textContent = 'Employee name';
          label.appendChild(document.createElement('input'));
          return label;
        },
      });

      injectEditor(deps, { id: '1', name: 'Alice' }, 0, column, 0, cell, true);
      await flush();

      expect(cell.querySelector('input')?.hasAttribute('aria-label')).toBe(false);
    });

    it('assigns the name BEFORE focusing a template editor (initial announcement)', async () => {
      const column = templateColumn('name', '<input type="text" />');
      column.header = 'Full name';
      const { cell } = createCellInRow();
      let labelAtFocus: string | null | undefined;

      injectEditor(createDeps(), { id: '1', name: 'Alice' }, 0, column, 0, cell, false);
      const input = cell.querySelector('input') as HTMLInputElement;
      input.addEventListener('focus', () => (labelAtFocus = input.getAttribute('aria-label')));
      await flush();

      expect(document.activeElement).toBe(input);
      expect(labelAtFocus).toBe('Full name');
    });
  });

  // #endregion
});
