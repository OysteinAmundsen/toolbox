/**
 * `GridFilteringDirective` — attribute-selector directive that owns the
 * `filtering` input and the `filterChange` output on `<tbw-grid>`.
 *
 * ## Why this exists
 *
 * Historically these bindings lived on the central `Grid` directive in
 * `@toolbox-web/grid-angular`. That meant the typed surface for the
 * filtering plugin shipped in the core bundle of every consumer, even those
 * that never imported the filtering feature. Moving them here lets the
 * surface tree-shake away with the rest of the feature when it is not
 * imported, matching the philosophy of the React / Vue adapters and the
 * web-component core (where unloaded plugins simply don't exist on the
 * element).
 *
 * ## Usage
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { Grid } from '@toolbox-web/grid-angular';
 * import { GridFilteringDirective } from '@toolbox-web/grid-angular/features/filtering';
 *
 * @Component({
 *   selector: 'app-grid',
 *   imports: [Grid, GridFilteringDirective],
 *   template: `
 *     <tbw-grid [rows]="rows" [filtering]="true" (filterChange)="onFilter($event)" />
 *   `,
 * })
 * export class AppGridComponent {}
 * ```
 *
 * ## Backward compatibility (v1.x)
 *
 * The matching `filtering` input and `filterChange` output also still exist
 * on `Grid` (marked `@deprecated`) so existing apps that bind them without
 * importing `GridFilteringDirective` continue to work — those will be
 * removed in v2.0.0. When both this directive and the deprecated bindings
 * are present, the directive wins via the per-grid claims registry in
 * `internal/feature-claims.ts`: `Grid` consults the registry and skips its
 * own plugin creation + event wiring for any claimed feature.
 *
 * @category Directive
 */
import { Directive, ElementRef, inject, input, OnDestroy, OnInit, output } from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import { claimEvent, registerFeatureClaim, unclaimEvent, unregisterFeatureClaim } from '@toolbox-web/grid-angular';
import type { FilterChangeDetail, FilterConfig } from '@toolbox-web/grid/plugins/filtering';

/**
 * Owns the `[filtering]` input and `(filterChange)` output on `<tbw-grid>`.
 *
 * Selector matches when *either* binding is present so users can pick the
 * style that suits their template — both go through the same claim and the
 * same wiring.
 * @category Directive
 */
@Directive({
  selector: 'tbw-grid[filtering], tbw-grid[filterChange]',
  standalone: true,
})
export class GridFilteringDirective implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<DataGridElement>);

  /**
   * Enable column filtering. Identical semantics to the deprecated input on
   * `Grid` — this directive owns the binding when both are present.
   *
   * @example
   * ```html
   * <tbw-grid [filtering]="true" />
   * <tbw-grid [filtering]="{ debounceMs: 200 }" />
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly filtering = input<boolean | FilterConfig<any>>();

  /**
   * Emitted when filter values change.
   *
   * @example
   * ```html
   * <tbw-grid (filterChange)="onFilterChange($event)" />
   * ```
   */
  readonly filterChange = output<FilterChangeDetail>();

  // Listener kept so we can detach in `ngOnDestroy`.
  private listener?: (e: Event) => void;

  constructor() {
    const grid = this.elementRef.nativeElement;
    // Tell `Grid` we own this feature's input. Reading `this.filtering()`
    // inside the getter establishes a reactive dependency in `Grid`'s
    // `createFeaturePlugins` effect — when our input changes, that effect
    // re-runs and the plugin config is updated.
    registerFeatureClaim(grid, 'filtering', () => this.filtering());
    // Tell `Grid` we own the matching event so it doesn't double-emit on
    // its own deprecated `filterChange` output.
    claimEvent(grid, 'filter-change');
  }

  ngOnInit(): void {
    const grid = this.elementRef.nativeElement;
    this.listener = (e: Event) => {
      this.filterChange.emit((e as CustomEvent<FilterChangeDetail>).detail);
    };
    grid.addEventListener('filter-change', this.listener);
  }

  ngOnDestroy(): void {
    const grid = this.elementRef.nativeElement;
    if (this.listener) {
      grid.removeEventListener('filter-change', this.listener);
      this.listener = undefined;
    }
    // Drop the claims so that, if the directive is removed via *ngIf but
    // the host `<tbw-grid>` survives, `Grid`'s deprecated bindings take
    // back over without leaving stale ownership behind.
    unregisterFeatureClaim(grid, 'filtering');
    unclaimEvent(grid, 'filter-change');
  }
}
