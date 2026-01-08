import {
  ApplicationRef,
  EmbeddedViewRef,
  EnvironmentInjector,
  EventEmitter,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import type {
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
} from '@toolbox-web/grid';
import { getEditorTemplate, GridEditorContext } from './directives/grid-column-editor.directive';
import { getViewTemplate, GridCellContext } from './directives/grid-column-view.directive';
import { getDetailTemplate, GridDetailContext } from './directives/grid-detail-view.directive';
import { getToolPanelTemplate, GridToolPanelContext } from './directives/grid-tool-panel.directive';

/**
 * Framework adapter that enables zero-boilerplate integration of Angular components
 * with the grid's light DOM configuration API.
 *
 * ## Usage
 *
 * **One-time setup in your app:**
 * ```typescript
 * import { Component, inject, EnvironmentInjector, ApplicationRef, ViewContainerRef } from '@angular/core';
 * import { GridElement } from '@toolbox-web/grid';
 * import { AngularGridAdapter } from '@toolbox-web/grid-angular';
 *
 * @Component({
 *   selector: 'app-root',
 *   // ...
 * })
 * export class AppComponent {
 *   constructor() {
 *     const injector = inject(EnvironmentInjector);
 *     const appRef = inject(ApplicationRef);
 *     const viewContainerRef = inject(ViewContainerRef);
 *     GridElement.registerAdapter(new AngularGridAdapter(injector, appRef, viewContainerRef));
 *   }
 * }
 * ```
 *
 * **Declarative configuration in templates:**
 * ```html
 * <tbw-grid>
 *   <tbw-grid-column field="status">
 *     <tbw-grid-column-view>
 *       <ng-template let-value let-row="row">
 *         <app-status-badge [value]="value" [row]="row" />
 *       </ng-template>
 *     </tbw-grid-column-view>
 *     <tbw-grid-column-editor>
 *       <ng-template let-value let-commit="commit" let-cancel="cancel">
 *         <app-status-select [value]="value" (commit)="commit.emit($event)" (cancel)="cancel.emit()" />
 *       </ng-template>
 *     </tbw-grid-column-editor>
 *   </tbw-grid-column>
 * </tbw-grid>
 * ```
 *
 * The adapter automatically:
 * - Detects Angular templates registered by directives
 * - Creates embedded views with cell context (value, row, column)
 * - Handles editor outputs (commit/cancel) via EventEmitters
 * - Manages view lifecycle and change detection
 */
export class AngularGridAdapter implements FrameworkAdapter {
  private viewRefs: EmbeddedViewRef<unknown>[] = [];

  constructor(
    private injector: EnvironmentInjector,
    private appRef: ApplicationRef,
    private viewContainerRef: ViewContainerRef,
  ) {
    // Register globally for directive access
    (window as any).__ANGULAR_GRID_ADAPTER__ = this;
  }

  /**
   * Determines if this adapter can handle the given element.
   * Checks if a template is registered for this element.
   */
  canHandle(element: HTMLElement): boolean {
    return getViewTemplate(element) !== undefined || getEditorTemplate(element) !== undefined;
  }

  /**
   * Creates a view renderer function that creates an embedded view
   * from the registered template and returns its DOM element.
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> {
    const template = getViewTemplate(element) as TemplateRef<GridCellContext<TValue, TRow>> | undefined;

    if (!template) {
      console.warn(`[AngularGridAdapter] No template registered for element`);
      return () => '';
    }

    return (ctx: CellRenderContext<TRow, TValue>) => {
      // Create the context for the template
      const context: GridCellContext<TValue, TRow> = {
        $implicit: ctx.value,
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
      };

      // Create embedded view from template
      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      this.viewRefs.push(viewRef);

      // Trigger change detection
      viewRef.detectChanges();

      // Get the first root node (the component's host element)
      const rootNode = viewRef.rootNodes[0];
      return rootNode;
    };
  }

  /**
   * Creates an editor spec that creates an embedded view
   * with commit/cancel EventEmitters in the context.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> {
    const template = getEditorTemplate(element) as TemplateRef<GridEditorContext<TValue, TRow>> | undefined;

    if (!template) {
      console.warn(`[AngularGridAdapter] No editor template registered for element`);
      return () => document.createElement('div');
    }

    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      // Create EventEmitters that bridge to the grid's commit/cancel
      const commitEmitter = new EventEmitter<TValue>();
      const cancelEmitter = new EventEmitter<void>();

      // Subscribe to the emitters
      commitEmitter.subscribe((value: TValue) => ctx.commit(value));
      cancelEmitter.subscribe(() => ctx.cancel());

      // Create the context for the template
      const context: GridEditorContext<TValue, TRow> = {
        $implicit: ctx.value,
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
        commit: commitEmitter,
        cancel: cancelEmitter,
      };

      // Create embedded view from template
      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      this.viewRefs.push(viewRef);

      // Trigger change detection
      viewRef.detectChanges();

      // Get the first root node (the component's host element)
      const rootNode = viewRef.rootNodes[0];
      return rootNode;
    };
  }

  /**
   * Creates a detail renderer function for MasterDetailPlugin.
   * Renders Angular templates for expandable detail rows.
   */
  createDetailRenderer<TRow = unknown>(gridElement: HTMLElement): ((row: TRow) => HTMLElement) | undefined {
    const template = getDetailTemplate(gridElement) as TemplateRef<GridDetailContext<TRow>> | undefined;

    if (!template) {
      return undefined;
    }

    return (row: TRow) => {
      // Create the context for the template
      const context: GridDetailContext<TRow> = {
        $implicit: row,
        row: row,
      };

      // Create embedded view from template
      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      this.viewRefs.push(viewRef);

      // Trigger change detection
      viewRef.detectChanges();

      // Create a container for the root nodes
      const container = document.createElement('div');
      viewRef.rootNodes.forEach((node) => container.appendChild(node));
      return container;
    };
  }

  /**
   * Framework adapter hook called by MasterDetailPlugin during attach().
   * Parses the <tbw-grid-detail> element and returns an Angular template-based renderer.
   *
   * This enables MasterDetailPlugin to automatically use Angular templates
   * without manual configuration in the Grid directive.
   */
  parseDetailElement<TRow = unknown>(
    detailElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement | string) | undefined {
    // Get the template from the registry for this detail element
    const template = getDetailTemplate(detailElement.closest('tbw-grid') as HTMLElement) as
      | TemplateRef<GridDetailContext<TRow>>
      | undefined;

    if (!template) {
      return undefined;
    }

    // Return a renderer function that creates embedded views
    // Note: rowIndex is part of the MasterDetailPlugin detailRenderer signature but not needed here
    return (row: TRow) => {
      const context: GridDetailContext<TRow> = {
        $implicit: row,
        row: row,
      };

      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      this.viewRefs.push(viewRef);
      viewRef.detectChanges();

      const container = document.createElement('div');
      viewRef.rootNodes.forEach((node) => container.appendChild(node));
      return container;
    };
  }

  /**
   * Creates a tool panel renderer from a light DOM element.
   * The renderer creates an Angular template-based panel content.
   */
  createToolPanelRenderer(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined {
    const template = getToolPanelTemplate(element) as TemplateRef<GridToolPanelContext> | undefined;

    if (!template) {
      return undefined;
    }

    // Find the parent grid element for context
    const gridElement = element.closest('tbw-grid') as HTMLElement | null;

    return (container: HTMLElement) => {
      // Create the context for the template
      const context: GridToolPanelContext = {
        $implicit: gridElement ?? container,
        grid: gridElement ?? container,
      };

      // Create embedded view from template
      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      this.viewRefs.push(viewRef);

      // Trigger change detection
      viewRef.detectChanges();

      // Append all root nodes to the container
      viewRef.rootNodes.forEach((node) => container.appendChild(node));

      // Return cleanup function
      return () => {
        const index = this.viewRefs.indexOf(viewRef);
        if (index > -1) {
          this.viewRefs.splice(index, 1);
        }
        viewRef.destroy();
      };
    };
  }

  /**
   * Clean up all view references.
   * Call this when your app/component is destroyed.
   */
  destroy(): void {
    this.viewRefs.forEach((ref) => ref.destroy());
    this.viewRefs = [];
  }
}
