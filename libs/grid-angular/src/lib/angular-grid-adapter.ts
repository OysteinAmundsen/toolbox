import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EmbeddedViewRef,
  EnvironmentInjector,
  EventEmitter,
  TemplateRef,
  Type,
  ViewContainerRef,
} from '@angular/core';
import type {
  CellRenderContext,
  ColumnConfig,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
  GridConfig,
  TypeDefault,
} from '@toolbox-web/grid';
import { isComponentClass, type AngularColumnConfig, type AngularGridConfig } from './angular-column-config';
import { getEditorTemplate, GridEditorContext } from './directives/grid-column-editor.directive';
import { getViewTemplate, GridCellContext } from './directives/grid-column-view.directive';
import { getDetailTemplate, GridDetailContext } from './directives/grid-detail-view.directive';
import { getFormArrayContext } from './directives/grid-form-array.directive';
import { getResponsiveCardTemplate, GridResponsiveCardContext } from './directives/grid-responsive-card.directive';
import { getToolPanelTemplate, GridToolPanelContext } from './directives/grid-tool-panel.directive';
import { getStructuralEditorTemplate, getStructuralViewTemplate } from './directives/structural-directives';
import { GridTypeRegistry } from './grid-type-registry';

/**
 * Helper to get view template from either structural directive or nested directive.
 */
function getAnyViewTemplate(element: HTMLElement): TemplateRef<GridCellContext> | undefined {
  // First check structural directive registry (for *tbwRenderer syntax)
  const structuralTemplate = getStructuralViewTemplate(element);
  if (structuralTemplate) return structuralTemplate as unknown as TemplateRef<GridCellContext>;

  // Fall back to nested directive (for <tbw-grid-column-view> syntax)
  return getViewTemplate(element);
}

/**
 * Helper to get editor template from either structural directive or nested directive.
 */
function getAnyEditorTemplate(element: HTMLElement): TemplateRef<GridEditorContext> | undefined {
  // First check structural directive registry (for *tbwEditor syntax)
  // The structural context uses `any` types for better ergonomics, but is compatible with GridEditorContext
  const structuralTemplate = getStructuralEditorTemplate(element);
  if (structuralTemplate) return structuralTemplate as unknown as TemplateRef<GridEditorContext>;

  // Fall back to nested directive (for <tbw-grid-column-editor> syntax)
  return getEditorTemplate(element);
}

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
 * **Declarative configuration in templates (structural directive - recommended):**
 * ```html
 * <tbw-grid>
 *   <tbw-grid-column field="status">
 *     <app-status-badge *tbwRenderer="let value; row as row" [value]="value" />
 *     <app-status-editor *tbwEditor="let value" [value]="value" />
 *   </tbw-grid-column>
 * </tbw-grid>
 * ```
 *
 * **Declarative configuration in templates (nested directive - legacy):**
 * ```html
 * <tbw-grid>
 *   <tbw-grid-column field="status">
 *     <tbw-grid-column-view>
 *       <ng-template let-value let-row="row">
 *         <app-status-badge [value]="value" [row]="row" />
 *       </ng-template>
 *     </tbw-grid-column-view>
 *     <tbw-grid-column-editor>
 *       <ng-template let-value let-onCommit="onCommit" let-onCancel="onCancel">
 *         <app-status-select [value]="value" (commit)="onCommit($event)" (cancel)="onCancel()" />
 *       </ng-template>
 *     </tbw-grid-column-editor>
 *   </tbw-grid-column>
 * </tbw-grid>
 * ```
 *
 * The adapter automatically:
 * - Detects Angular templates registered by directives (both structural and nested)
 * - Creates embedded views with cell context (value, row, column)
 * - Handles editor callbacks (onCommit/onCancel)
 * - Manages view lifecycle and change detection
 */
export class AngularGridAdapter implements FrameworkAdapter {
  private viewRefs: EmbeddedViewRef<unknown>[] = [];
  private componentRefs: ComponentRef<unknown>[] = [];
  private typeRegistry: GridTypeRegistry | null = null;

  constructor(
    private injector: EnvironmentInjector,
    private appRef: ApplicationRef,
    private viewContainerRef: ViewContainerRef,
  ) {
    // Register globally for directive access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__ANGULAR_GRID_ADAPTER__ = this;

    // Try to get the type registry from the injector
    try {
      this.typeRegistry = this.injector.get(GridTypeRegistry, null);
    } catch {
      // GridTypeRegistry not available - type defaults won't be resolved
    }
  }

  /**
   * Processes an Angular grid configuration, converting component class references
   * to actual renderer/editor functions.
   *
   * Call this method on your gridConfig before passing it to the grid.
   *
   * @example
   * ```typescript
   * import { AngularGridAdapter, type AngularGridConfig } from '@toolbox-web/grid-angular';
   *
   * const config: AngularGridConfig<Employee> = {
   *   columns: [
   *     { field: 'status', renderer: StatusBadgeComponent, editor: StatusEditorComponent },
   *   ],
   * };
   *
   * // In component
   * constructor() {
   *   const adapter = inject(AngularGridAdapter); // or create new instance
   *   this.processedConfig = adapter.processGridConfig(config);
   * }
   * ```
   *
   * @param config - Angular grid configuration with possible component class references
   * @returns Processed GridConfig with actual renderer/editor functions
   */
  processGridConfig<TRow = unknown>(config: AngularGridConfig<TRow>): GridConfig<TRow> {
    const result = { ...config } as GridConfig<TRow>;

    // Process columns
    if (config.columns) {
      result.columns = config.columns.map((col) => this.processColumn(col));
    }

    // Process typeDefaults - convert Angular component classes to renderer/editor functions
    if (config.typeDefaults) {
      result.typeDefaults = this.processTypeDefaults(config.typeDefaults);
    }

    return result;
  }

  /**
   * Processes typeDefaults configuration, converting component class references
   * to actual renderer/editor functions.
   *
   * @param typeDefaults - Angular type defaults with possible component class references
   * @returns Processed TypeDefault record
   */
  processTypeDefaults<TRow = unknown>(
    typeDefaults: Record<string, import('./angular-column-config').AngularTypeDefault<TRow>>,
  ): Record<string, import('@toolbox-web/grid').TypeDefault<TRow>> {
    const processed: Record<string, import('@toolbox-web/grid').TypeDefault<TRow>> = {};

    for (const [type, config] of Object.entries(typeDefaults)) {
      const processedConfig: import('@toolbox-web/grid').TypeDefault<TRow> = { ...config } as any;

      // Convert renderer component class to function
      if (config.renderer && isComponentClass(config.renderer)) {
        processedConfig.renderer = this.createComponentRenderer(config.renderer);
      }

      // Convert editor component class to function
      if (config.editor && isComponentClass(config.editor)) {
        (processedConfig as any).editor = this.createComponentEditor(config.editor);
      }

      processed[type] = processedConfig;
    }

    return processed;
  }

  /**
   * Processes a single column configuration, converting component class references
   * to actual renderer/editor functions.
   *
   * @param column - Angular column configuration
   * @returns Processed ColumnConfig
   */
  processColumn<TRow = unknown>(column: AngularColumnConfig<TRow>): ColumnConfig<TRow> {
    const processed = { ...column } as ColumnConfig<TRow>;

    // Convert renderer component class to function
    if (column.renderer && isComponentClass(column.renderer)) {
      processed.renderer = this.createComponentRenderer(column.renderer);
    }

    // Convert editor component class to function
    if (column.editor && isComponentClass(column.editor)) {
      processed.editor = this.createComponentEditor(column.editor);
    }

    return processed;
  }

  /**
   * Determines if this adapter can handle the given element.
   * Checks if a template is registered for this element (structural or nested).
   */
  canHandle(element: HTMLElement): boolean {
    return getAnyViewTemplate(element) !== undefined || getAnyEditorTemplate(element) !== undefined;
  }

  /**
   * Creates a view renderer function that creates an embedded view
   * from the registered template and returns its DOM element.
   *
   * Returns undefined if no template is registered for this element,
   * allowing the grid to use its default rendering.
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> {
    const template = getAnyViewTemplate(element) as TemplateRef<GridCellContext<TValue, TRow>> | undefined;

    if (!template) {
      // Return undefined so the grid uses default rendering
      // This is important when only an editor template is provided (no view template)
      return undefined as unknown as ColumnViewRenderer<TRow, TValue>;
    }

    return (ctx: CellRenderContext<TRow, TValue>) => {
      // Skip rendering if the cell is in editing mode
      // This prevents the renderer from overwriting the editor when the grid re-renders
      if (ctx.cellEl?.classList.contains('editing')) {
        return null;
      }

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
   * Creates an editor spec that creates an embedded view.
   *
   * **Auto-wiring**: The adapter automatically listens for `commit` and `cancel`
   * CustomEvents on the rendered component. If the component emits these events,
   * the adapter will call the grid's commit/cancel functions automatically.
   *
   * This means templates can be simplified from:
   * ```html
   * <app-editor *tbwEditor="let value; onCommit as onCommit"
   *   [value]="value" (commit)="onCommit($event)" />
   * ```
   * To just:
   * ```html
   * <app-editor *tbwEditor="let value" [value]="value" />
   * ```
   * As long as the component emits `(commit)` with the new value.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> | undefined {
    const template = getAnyEditorTemplate(element) as TemplateRef<GridEditorContext<TValue, TRow>> | undefined;

    // Find the parent grid element for FormArray context access
    const gridElement = element.closest('tbw-grid') as HTMLElement | null;

    if (!template) {
      // No template registered - return undefined to let the grid use its default editor.
      // This allows columns with only *tbwRenderer (no *tbwEditor) to still be editable
      // using the built-in text/number/boolean editors.
      return undefined;
    }

    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      // Create simple callback functions (preferred)
      const onCommit = (value: TValue) => ctx.commit(value);
      const onCancel = () => ctx.cancel();

      // Create EventEmitters for backwards compatibility (deprecated)
      const commitEmitter = new EventEmitter<TValue>();
      const cancelEmitter = new EventEmitter<void>();
      commitEmitter.subscribe((value: TValue) => ctx.commit(value));
      cancelEmitter.subscribe(() => ctx.cancel());

      // Try to get the FormControl from the FormArrayContext
      let control: GridEditorContext<TValue, TRow>['control'];
      if (gridElement) {
        const formContext = getFormArrayContext(gridElement);
        if (formContext?.hasFormGroups) {
          // Find the row index by looking up ctx.row in the grid's rows
          const gridRows = (gridElement as { rows?: TRow[] }).rows;
          if (gridRows) {
            const rowIndex = gridRows.indexOf(ctx.row);
            if (rowIndex >= 0) {
              control = formContext.getControl(rowIndex, ctx.field);
            }
          }
        }
      }

      // Create the context for the template
      const context: GridEditorContext<TValue, TRow> = {
        $implicit: ctx.value,
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
        // Preferred: simple callback functions
        onCommit,
        onCancel,
        // FormControl from FormArray (if available)
        control,
        // Deprecated: EventEmitters (for backwards compatibility)
        commit: commitEmitter,
        cancel: cancelEmitter,
      };

      // Create embedded view from template
      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      this.viewRefs.push(viewRef);

      // Trigger change detection
      viewRef.detectChanges();

      // Get the first root node (the component's host element)
      const rootNode = viewRef.rootNodes[0] as HTMLElement;

      // Auto-wire: Listen for commit/cancel events on the rendered component.
      // This allows components to just emit (commit) and (cancel) without
      // requiring explicit template bindings like (commit)="onCommit($event)".
      if (rootNode && rootNode.addEventListener) {
        rootNode.addEventListener('commit', (e: Event) => {
          const customEvent = e as CustomEvent<TValue>;
          ctx.commit(customEvent.detail);
        });
        rootNode.addEventListener('cancel', () => {
          ctx.cancel();
        });
      }

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
   * Creates a responsive card renderer function for ResponsivePlugin.
   * Renders Angular templates for card layout in responsive mode.
   *
   * @param gridElement - The grid element to look up the template for
   * @returns A card renderer function or undefined if no template is found
   */
  createResponsiveCardRenderer<TRow = unknown>(
    gridElement: HTMLElement,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const template = getResponsiveCardTemplate(gridElement) as TemplateRef<GridResponsiveCardContext<TRow>> | undefined;

    if (!template) {
      return undefined;
    }

    return (row: TRow, rowIndex: number) => {
      // Create the context for the template
      const context: GridResponsiveCardContext<TRow> = {
        $implicit: row,
        row: row,
        index: rowIndex,
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
   * Gets type-level defaults from the application's GridTypeRegistry.
   *
   * This enables application-wide type defaults configured via `provideGridTypeDefaults()`.
   * The returned TypeDefault contains renderer/editor functions that instantiate
   * Angular components dynamically.
   *
   * @example
   * ```typescript
   * // app.config.ts
   * export const appConfig: ApplicationConfig = {
   *   providers: [
   *     provideGridTypeDefaults({
   *       country: {
   *         renderer: CountryCellComponent,
   *         editor: CountryEditorComponent
   *       }
   *     })
   *   ]
   * };
   *
   * // Any grid with type: 'country' columns will use these components
   * gridConfig = {
   *   columns: [{ field: 'country', type: 'country' }]
   * };
   * ```
   */
  getTypeDefault<TRow = unknown>(type: string): TypeDefault<TRow> | undefined {
    if (!this.typeRegistry) {
      return undefined;
    }

    const config = this.typeRegistry.get(type);
    if (!config) {
      return undefined;
    }

    const typeDefault: TypeDefault<TRow> = {
      editorParams: config.editorParams,
    };

    // Create renderer function that instantiates the Angular component
    if (config.renderer) {
      typeDefault.renderer = this.createComponentRenderer<TRow, unknown>(config.renderer);
    }

    // Create editor function that instantiates the Angular component
    if (config.editor) {
      // Type assertion needed: adapter bridges TRow to core's unknown
      typeDefault.editor = this.createComponentEditor<TRow, unknown>(config.editor) as TypeDefault['editor'];
    }

    return typeDefault;
  }

  /**
   * Creates and mounts an Angular component dynamically.
   * Shared logic between renderer and editor component creation.
   * @internal
   */
  private mountComponent<TRow, TValue>(
    componentClass: Type<unknown>,
    inputs: { value: TValue; row: TRow; column: ColumnConfig<TRow> },
  ): { hostElement: HTMLSpanElement; componentRef: ComponentRef<unknown> } {
    // Create a host element for the component
    const hostElement = document.createElement('span');
    hostElement.style.display = 'contents';

    // Create the component dynamically
    const componentRef = createComponent(componentClass, {
      environmentInjector: this.injector,
      hostElement,
    });

    // Set inputs - components should have value, row, column inputs
    this.setComponentInputs(componentRef, inputs);

    // Attach to app for change detection
    this.appRef.attachView(componentRef.hostView);
    this.componentRefs.push(componentRef);

    // Trigger change detection
    componentRef.changeDetectorRef.detectChanges();

    return { hostElement, componentRef };
  }

  /**
   * Wires up commit/cancel handlers for an editor component.
   * Supports both Angular outputs and DOM CustomEvents.
   * @internal
   */
  private wireEditorCallbacks<TValue>(
    hostElement: HTMLElement,
    componentRef: ComponentRef<unknown>,
    commit: (value: TValue) => void,
    cancel: () => void,
  ): void {
    // Subscribe to Angular outputs (commit/cancel) on the component instance.
    // This works with Angular's output() signal API.
    const instance = componentRef.instance as Record<string, unknown>;
    this.subscribeToOutput(instance, 'commit', commit);
    this.subscribeToOutput(instance, 'cancel', cancel);

    // Also listen for DOM events as fallback (for components that dispatch CustomEvents)
    hostElement.addEventListener('commit', (e: Event) => {
      const customEvent = e as CustomEvent<TValue>;
      commit(customEvent.detail);
    });
    hostElement.addEventListener('cancel', () => cancel());
  }

  /**
   * Creates a renderer function from an Angular component class.
   * @internal
   */
  private createComponentRenderer<TRow = unknown, TValue = unknown>(
    componentClass: Type<unknown>,
  ): ColumnViewRenderer<TRow, TValue> {
    return (ctx: CellRenderContext<TRow, TValue>) => {
      const { hostElement } = this.mountComponent<TRow, TValue>(componentClass, {
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
      });
      return hostElement;
    };
  }

  /**
   * Creates an editor function from an Angular component class.
   * @internal
   */
  private createComponentEditor<TRow = unknown, TValue = unknown>(
    componentClass: Type<unknown>,
  ): ColumnEditorSpec<TRow, TValue> {
    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      const { hostElement, componentRef } = this.mountComponent<TRow, TValue>(componentClass, {
        value: ctx.value,
        row: ctx.row,
        column: ctx.column,
      });

      this.wireEditorCallbacks<TValue>(
        hostElement,
        componentRef,
        (value) => ctx.commit(value),
        () => ctx.cancel(),
      );

      return hostElement;
    };
  }

  /**
   * Subscribes to an Angular output on a component instance.
   * Works with both EventEmitter and OutputEmitterRef (signal outputs).
   * @internal
   */
  private subscribeToOutput<T>(
    instance: Record<string, unknown>,
    outputName: string,
    callback: (value: T) => void,
  ): void {
    const output = instance[outputName];
    if (!output) return;

    // Check if it's an Observable-like (EventEmitter or OutputEmitterRef)
    if (typeof (output as { subscribe?: unknown }).subscribe === 'function') {
      (output as { subscribe: (fn: (v: T) => void) => void }).subscribe(callback);
    }
  }

  /**
   * Sets component inputs using Angular's setInput API.
   * @internal
   */
  private setComponentInputs(componentRef: ComponentRef<unknown>, inputs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(inputs)) {
      try {
        componentRef.setInput(key, value);
      } catch {
        // Input doesn't exist on component - that's okay, some inputs are optional
      }
    }
  }

  /**
   * Clean up all view references and component references.
   * Call this when your app/component is destroyed.
   */
  destroy(): void {
    this.viewRefs.forEach((ref) => ref.destroy());
    this.viewRefs = [];
    this.componentRefs.forEach((ref) => ref.destroy());
    this.componentRefs = [];
  }
}
