import {
  afterNextRender,
  contentChild,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  EmbeddedViewRef,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import type { DataGridElement } from '@toolbox-web/grid';
import type { HeaderContentDefinition } from '@toolbox-web/grid/plugins/shell';

/**
 * Context object passed to the header content template.
 * @since 1.7.0
 */
export interface GridHeaderContentContext {
  /** The grid element (implicit binding for `let-grid`). */
  $implicit: DataGridElement;
  /** The grid element. */
  grid: DataGridElement;
}

let autoIdCounter = 0;

/**
 * Declarative wrapper around the grid's imperative
 * {@link ShellPlugin.registerHeaderContent} API.
 *
 * Captures an `<ng-template>` and mounts it as an Angular embedded view into
 * the slot the grid provides for header content. Must be a child of
 * `<tbw-grid>`.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid [rows]="rows" [gridConfig]="config">
 *   <tbw-grid-header-content id="calendar-nav" [order]="0">
 *     <ng-template let-grid>
 *       <app-header-nav [year]="year()" (yearChange)="setYear($event)" />
 *     </ng-template>
 *   </tbw-grid-header-content>
 * </tbw-grid>
 * ```
 *
 * @category Directive
 * @since 1.7.0
 */
@Directive({ selector: 'tbw-grid-header-content', standalone: true })
export class GridHeaderContent {
  private elementRef = inject(ElementRef<HTMLElement>);
  private viewContainerRef = inject(ViewContainerRef);
  private destroyRef = inject(DestroyRef);

  /** Unique identifier for this header content entry. Optional — defaults to a stable generated id. */
  id = input<string | undefined>(undefined);

  /** Render order priority. Lower values appear first. @default 100 */
  order = input<number>(100);

  /** The template to mount into the grid's header content slot. */
  template = contentChild(TemplateRef<GridHeaderContentContext>);

  private viewRef: EmbeddedViewRef<GridHeaderContentContext> | null = null;
  private registeredId: string | null = null;
  private resolvedId = `tbw-header-content-${++autoIdCounter}`;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      void this.register();
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.unregister();
    });

    // Re-register when id or order changes after mount.
    effect(() => {
      const nextId = this.id() ?? this.resolvedId;
      const nextOrder = this.order();
      if (this.registeredId && this.registeredId !== nextId) {
        this.unregister();
        void this.register();
        return;
      }
      if (this.registeredId && nextOrder !== this.lastOrder) {
        this.unregister();
        void this.register();
      }
      this.lastOrder = nextOrder;
    });
  }

  private lastOrder: number | undefined;

  private async register(): Promise<void> {
    const grid = this.findGrid();
    if (!grid) return;
    try {
      await grid.ready?.();
    } catch {
      return;
    }
    if (this.destroyed) return;

    const template = this.template();
    const id = this.id() ?? this.resolvedId;
    const order = this.order();

    const def: HeaderContentDefinition = {
      id,
      order,
      render: (container) => {
        if (!template) return undefined;
        // Sticky container: the shell may re-invoke `render` with the SAME
        // container across refreshes. If our embedded view is still attached
        // inside it, the previous render is live and this is a refresh — do
        // nothing (no-op cleanup preserves child state).
        const firstNode = this.viewRef?.rootNodes[0] as Node | undefined;
        if (this.viewRef && firstNode && container.contains(firstNode)) {
          return () => {
            /* intentionally empty */
          };
        }
        // Fresh container (first render or container was replaced) — destroy
        // any stale view, then build a new one.
        if (this.viewRef) {
          this.viewRef.destroy();
          this.viewRef = null;
        }
        this.viewRef = this.viewContainerRef.createEmbeddedView(template, {
          $implicit: grid,
          grid,
        });
        this.viewRef.detectChanges();
        for (const node of this.viewRef.rootNodes as Node[]) {
          container.appendChild(node);
        }
        // No-op cleanup: the grid may call this between re-renders before
        // invoking `render` again with the SAME container. Tearing the view
        // down here would destroy any internal state in the projected
        // template on every shell refresh. Teardown happens in `unregister`
        // (component destroy / id / order change).
        return () => {
          /* intentionally empty */
        };
      },
    };
    // Route through the shell plugin (#370). The shell is opt-in at v3 —
    // content registers only when a shell plugin is present.
    grid.getPluginByName?.('shell')?.registerHeaderContent(def);
    this.registeredId = id;
  }

  private unregister(): void {
    const grid = this.findGrid();
    if (grid && this.registeredId) {
      grid.getPluginByName?.('shell')?.unregisterHeaderContent(this.registeredId);
    }
    this.registeredId = null;
    if (this.viewRef) {
      this.viewRef.destroy();
      this.viewRef = null;
    }
  }

  private findGrid(): DataGridElement | null {
    const host = this.elementRef.nativeElement;
    // Use the stable `[data-tbw-grid]` attribute (set by core on connect) rather
    // than the literal `tbw-grid` tag, so a version-suffixed grid host (e.g.
    // `<tbw-grid-v2-15-0>`) is still found. See the multi-version guide.
    const grid = host.closest('[data-tbw-grid]') as DataGridElement | null;
    return grid;
  }

  /** Type guard for template context inference. */
  static ngTemplateContextGuard(_dir: GridHeaderContent, ctx: unknown): ctx is GridHeaderContentContext {
    return true;
  }
}
