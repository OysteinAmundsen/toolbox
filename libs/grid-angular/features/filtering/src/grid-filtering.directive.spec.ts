/**
 * Tests for `GridFilteringDirective`.
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

const { GridFilteringDirective } = await import('./grid-filtering.directive');

describe('GridFilteringDirective', () => {
  let grid: HTMLElement;
  let directive: InstanceType<typeof GridFilteringDirective>;

  beforeEach(() => {
    grid = document.createElement('tbw-grid');
    gridElementForTest = grid;
    inputState.value = undefined;
    outputEmits.length = 0;
    directive = new GridFilteringDirective();
  });

  afterEach(() => {
    directive.ngOnDestroy();
  });

  describe('claim registration (constructor)', () => {
    it('registers a feature claim under the "filtering" name', () => {
      expect(getFeatureClaim(grid, 'filtering')).toBeDefined();
    });

    it('claims the "filter-change" event so Grid skips its own listener', () => {
      expect(isEventClaimed(grid, 'filter-change')).toBe(true);
    });

    it("claim getter forwards the directive's input value", () => {
      inputState.value = { debounceMs: 250 };
      const claim = getFeatureClaim(grid, 'filtering');
      expect(claim?.()).toEqual({ debounceMs: 250 });
    });
  });

  describe('event wiring (ngOnInit)', () => {
    it('emits filterChange when the grid dispatches filter-change', () => {
      directive.ngOnInit();

      const detail = { filters: [{ field: 'name', operator: 'contains', value: 'x' }] };
      grid.dispatchEvent(new CustomEvent('filter-change', { detail }));

      expect(outputEmits).toEqual([detail]);
    });
  });

  describe('cleanup (ngOnDestroy)', () => {
    it('detaches its event listener so subsequent events do not emit', () => {
      directive.ngOnInit();
      directive.ngOnDestroy();

      grid.dispatchEvent(new CustomEvent('filter-change', { detail: { filters: [] } }));

      expect(outputEmits).toEqual([]);
    });

    it('unregisters its claim so the deprecated Grid input takes back over', () => {
      directive.ngOnDestroy();

      expect(getFeatureClaim(grid, 'filtering')).toBeUndefined();
      expect(isEventClaimed(grid, 'filter-change')).toBe(false);
    });
  });
});
