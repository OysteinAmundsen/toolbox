/**
 * Tests for `GridMasterDetailDirective` (issue #531: `detailLoadError` output).
 *
 * The directive imports the claims-registry helpers through the
 * `@toolbox-web/grid-angular` barrel (required by ng-packagr at build time,
 * since secondary entries cannot use relative paths into the primary
 * entry's `rootDir`). At test time that barrel transitively loads
 * `@angular/forms` which is partially-compiled and needs JIT — so we mock
 * the Angular peer modules the same way the sibling `index.spec.ts` does.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFeatureClaim, isEventClaimed } from '../../../src/lib/internal/feature-claims';

// Per-instance state captured by the @angular/core mock so each test gets a
// fresh signal pair.
const inputState = { value: undefined as unknown };
const outputEmits: unknown[] = [];

// Captured once per test in `beforeEach` so the mocked `inject` returns the
// same element the test asserts against.
let gridElementForTest: HTMLElement;

vi.mock('@angular/core', () => {
  const decoratorFactory =
    (..._args: unknown[]) =>
    (target?: unknown) =>
      target;
  return {
    // Decorator factories — barrel-loaded directives may decorate at module load.
    Component: decoratorFactory,
    Directive: decoratorFactory,
    Injectable: decoratorFactory,
    Pipe: decoratorFactory,
    NgModule: decoratorFactory,
    Input: decoratorFactory,
    Output: decoratorFactory,
    HostBinding: decoratorFactory,
    HostListener: decoratorFactory,
    ViewChild: decoratorFactory,
    ContentChild: decoratorFactory,
    ContentChildren: decoratorFactory,
    ViewChildren: decoratorFactory,
    inject: vi.fn(() => ({ nativeElement: gridElementForTest })),
    ElementRef: class ElementRef {},
    DestroyRef: class DestroyRef {},
    EventEmitter: class EventEmitter {
      emit(): void {
        /* no-op */
      }
      subscribe(): { unsubscribe(): void } {
        return {
          unsubscribe(): void {
            /* no-op */
          },
        };
      }
    },
    InjectionToken: class InjectionToken {
      constructor(public _desc: string) {}
    },
    TemplateRef: class TemplateRef {},
    ViewContainerRef: class ViewContainerRef {},
    ApplicationRef: class ApplicationRef {},
    EnvironmentInjector: class EnvironmentInjector {},
    EmbeddedViewRef: class EmbeddedViewRef {},
    ComponentRef: class ComponentRef {},
    createComponent: vi.fn(),
    makeEnvironmentProviders: (providers: unknown[]) => providers,
    input: vi.fn(() => () => inputState.value),
    output: vi.fn(() => ({
      emit: (v: unknown) => {
        outputEmits.push(v);
      },
    })),
    contentChild: vi.fn(() => () => undefined),
    contentChildren: vi.fn(() => () => []),
    viewChild: vi.fn(() => () => undefined),
    viewChildren: vi.fn(() => () => []),
    effect: vi.fn(),
    signal: vi.fn((v: unknown) => Object.assign(() => v, { set: vi.fn(), asReadonly: () => () => v })),
    computed: vi.fn((fn: () => unknown) => fn),
    afterNextRender: vi.fn(),
  };
});

vi.mock('@angular/forms', () => ({
  AbstractControl: class AbstractControl {},
  FormArray: class FormArray {},
  FormGroup: class FormGroup {},
  FormControl: class FormControl {},
  ReactiveFormsModule: class ReactiveFormsModule {},
  NG_VALUE_ACCESSOR: { name: 'NG_VALUE_ACCESSOR' },
  Validators: { required: vi.fn(), nullValidator: vi.fn() },
}));
vi.mock('@angular/common', () => ({
  CommonModule: class CommonModule {},
  NgIf: class NgIf {},
  NgForOf: class NgForOf {},
  AsyncPipe: class AsyncPipe {},
}));
vi.mock('@angular/core/rxjs-interop', () => ({
  takeUntilDestroyed: () => (source: unknown) => source,
  toSignal: vi.fn(),
  toObservable: vi.fn(),
}));

const { GridMasterDetailDirective } = await import('./grid-master-detail.directive');

describe('GridMasterDetailDirective', () => {
  let grid: HTMLElement;
  let directive: InstanceType<typeof GridMasterDetailDirective>;

  beforeEach(() => {
    grid = document.createElement('tbw-grid');
    gridElementForTest = grid;
    inputState.value = undefined;
    outputEmits.length = 0;
    directive = new GridMasterDetailDirective();
  });

  afterEach(() => {
    directive.ngOnDestroy();
  });

  it('registers the "masterDetail" claim and claims both owned events', () => {
    expect(getFeatureClaim(grid, 'masterDetail')).toBeDefined();
    expect(isEventClaimed(grid, 'detail-expand')).toBe(true);
    expect(isEventClaimed(grid, 'detail-load-error')).toBe(true);
  });

  it('emits detailExpand and detailLoadError with the unwrapped detail', () => {
    directive.ngOnInit();

    const expand = { rowIndex: 0, row: { id: 1 }, expanded: true };
    const error = { rowIndex: 0, row: { id: 1 }, error: new Error('boom') };
    grid.dispatchEvent(new CustomEvent('detail-expand', { detail: expand }));
    grid.dispatchEvent(new CustomEvent('detail-load-error', { detail: error }));

    expect(outputEmits).toEqual([expand, error]);
  });

  it('detaches its listeners and releases its claims on destroy', () => {
    directive.ngOnInit();
    directive.ngOnDestroy();

    grid.dispatchEvent(new CustomEvent('detail-expand', { detail: {} }));
    grid.dispatchEvent(new CustomEvent('detail-load-error', { detail: {} }));

    expect(outputEmits).toEqual([]);
    expect(getFeatureClaim(grid, 'masterDetail')).toBeUndefined();
    expect(isEventClaimed(grid, 'detail-expand')).toBe(false);
    expect(isEventClaimed(grid, 'detail-load-error')).toBe(false);
  });
});
