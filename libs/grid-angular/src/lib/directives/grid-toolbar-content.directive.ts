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
import type { DataGridElement, ToolbarContentDefinition } from '@toolbox-web/grid';
// Activate the `PluginNameMap` augmentation so `grid.getPluginByName('shell')`
// is typed as the shell plugin (which owns register/unregisterToolbarContent).

/**
 * Context object passed to the toolbar content template.
 * @since 1.7.0
 */
export interface GridToolbarContentContext {
  /** The grid element (implicit binding for `let-grid`). */
  $implicit: DataGridElement;
  /** The grid element. */
  grid: DataGridElement;
}

let autoIdCounter = 0;

/**
 * Declarative wrapper around the grid's imperative
 * {@link ShellPlugin.registerToolbarContent} API.
 *
 * Captures an `<ng-template>` and mounts it as an Angular embedded view into
 * the slot the grid provides for toolbar content. Must be a child of
 * `<tbw-grid>`.
 *
 * Prefer this over `<tbw-grid-tool-buttons>` (light DOM) when you need
 * Angular template bindings to component state. Use the light-DOM form for
 * static markup that should be moved verbatim into the toolbar.
 *
 * ## Usage
 *
 * ```html
 * <tbw-grid [rows]="rows" [gridConfig]="config">
 *   <tbw-grid-toolbar-content id="calendar-nav" [order]="0">
 *     <ng-template let-grid>
 *       <app-toolbar-nav (prev)="prev()" (today)="today()" (next)="next()" />
 *     </ng-template>
 *   </tbw-grid-toolbar-content>
 * </tbw-grid>
 * ```
 *
 * @category Directive
 * @since 1.7.0
 */
@Directive({ selector: 'tbw-grid-toolbar-content', standalone: true })
export class GridToolbarContent {
  private elementRef = inject(ElementRef<HTMLElement>);
  private viewContainerRef = inject(ViewContainerRef);
  private destroyRef = inject(DestroyRef);

  id = input<string | undefined>(undefined);
  order = input<number>(100);
  template = contentChild(TemplateRef<GridToolbarContentContext>);

  private viewRef: EmbeddedViewRef<GridToolbarContentContext> | null = null;
  private registeredId: string | null = null;
  private resolvedId = `tbw-toolbar-content-${++autoIdCounter}`;
  private lastOrder: number | undefined;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      void this.register();
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.unregister();
    });

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

    const def: ToolbarContentDefinition = {
      id,
      order,
      render: (container) => {
        if (!template) return undefined;
        // Sticky container: see grid-header-content.directive.ts for rationale.
        const firstNode = this.viewRef?.rootNodes[0] as Node | undefined;
        if (this.viewRef && firstNode && container.contains(firstNode)) {
          return () => {
            /* intentionally empty */
          };
        }
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
        // No-op cleanup — see comment in grid-header-content.directive.ts.
        return () => {
          /* intentionally empty */
        };
      },
    };
    // Route through the shell plugin (#370). The core grid-element delegates
    // (`grid.registerToolbarContent`) are deprecated (TBW076) and removed at v3;
    // fall back to them only on cores that predate the shell plugin.
    const shell = grid.getPluginByName?.('shell');
    if (shell?.registerToolbarContent) {
      shell.registerToolbarContent(def);
    } else {
      grid.registerToolbarContent?.(def);
    }
    this.registeredId = id;
  }

  private unregister(): void {
    const grid = this.findGrid();
    if (grid && this.registeredId) {
      const shell = grid.getPluginByName?.('shell');
      if (shell?.unregisterToolbarContent) {
        shell.unregisterToolbarContent(this.registeredId);
      } else {
        grid.unregisterToolbarContent?.(this.registeredId);
      }
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
    return host.closest('[data-tbw-grid]') as DataGridElement | null;
  }

  static ngTemplateContextGuard(_dir: GridToolbarContent, ctx: unknown): ctx is GridToolbarContentContext {
    return true;
  }
}
