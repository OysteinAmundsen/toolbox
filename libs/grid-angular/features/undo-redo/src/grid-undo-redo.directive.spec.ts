/**
 * Tests for `GridUndoRedoDirective` — feature/event claims and the `(undo)`, `(redo)`
 * and `(historyChange)` outputs (#563).
 *
 * The `@toolbox-web/grid-angular` barrel is replaced by the real claims registry so
 * `@angular/forms` (JIT-only) is never loaded; `@angular/core` only needs the
 * primitives the directive touches.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFeatureClaim, isEventClaimed } from '../../../src/lib/internal/feature-claims';

const inputState = { value: undefined as unknown };
const outputs: Array<{ emissions: unknown[] }> = [];
let gridElementForTest: HTMLElement;

vi.mock('@angular/core', () => ({
  Directive: () => (target: unknown) => target,
  ElementRef: class ElementRef {},
  inject: vi.fn(() => ({ nativeElement: gridElementForTest })),
  input: vi.fn(() => () => inputState.value),
  output: vi.fn(() => {
    const out = { emissions: [] as unknown[], emit: (v: unknown) => out.emissions.push(v) };
    outputs.push(out);
    return out;
  }),
}));
vi.mock('@toolbox-web/grid-angular', () => import('../../../src/lib/internal/feature-claims'));

const { GridUndoRedoDirective } = await import('./grid-undo-redo.directive');

describe('GridUndoRedoDirective', () => {
  let grid: HTMLElement;
  let directive: InstanceType<typeof GridUndoRedoDirective>;

  beforeEach(() => {
    grid = document.createElement('tbw-grid');
    gridElementForTest = grid;
    inputState.value = undefined;
    outputs.length = 0;
    directive = new GridUndoRedoDirective();
  });

  afterEach(() => {
    directive.ngOnDestroy();
  });

  it('registers the undoRedo claim (forwarding the input) and claims its events', () => {
    inputState.value = { maxHistorySize: 5 };

    expect(getFeatureClaim(grid, 'undoRedo')?.()).toEqual({ maxHistorySize: 5 });
    for (const event of ['undo', 'redo', 'history-change'] as const) {
      expect(isEventClaimed(grid, event)).toBe(true);
    }
  });

  it.each([
    ['undo', 'undo', { action: { type: 'cell-edit' }, type: 'undo' }],
    ['redo', 'redo', { action: { type: 'cell-edit' }, type: 'redo' }],
    ['history-change', 'historyChange', { canUndo: true, canRedo: false }],
  ] as const)('forwards the grid %s event to (%s)', (event, outputName, detail) => {
    directive.ngOnInit();

    grid.dispatchEvent(new CustomEvent(event, { detail }));

    expect(outputs.find((o) => Object.is(o, directive[outputName]))?.emissions).toEqual([detail]);
  });

  it('detaches listeners and releases every claim on destroy', () => {
    directive.ngOnInit();
    directive.ngOnDestroy();

    grid.dispatchEvent(new CustomEvent('history-change', { detail: { canUndo: false, canRedo: false } }));

    expect(outputs.every((o) => o.emissions.length === 0)).toBe(true);
    expect(getFeatureClaim(grid, 'undoRedo')).toBeUndefined();
    expect(isEventClaimed(grid, 'history-change')).toBe(false);
  });
});
