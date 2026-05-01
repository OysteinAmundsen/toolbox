import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EmbeddedViewRef,
  EnvironmentInjector,
  TemplateRef,
  Type,
  ViewContainerRef,
} from '@angular/core';
import type {
  ColumnConfig as BaseColumnConfig,
  GridConfig as BaseGridConfig,
  TypeDefault as BaseTypeDefault,
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
  HeaderCellContext,
  HeaderLabelContext,
  LoadingContext,
} from '@toolbox-web/grid';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import type { GroupHeaderRenderParams, GroupingColumnsConfig } from '@toolbox-web/grid/plugins/grouping-columns';
import type { GroupingRowsConfig, GroupRowRenderParams } from '@toolbox-web/grid/plugins/grouping-rows';
import type {
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowSlot,
  ZonedPanelRender,
} from '@toolbox-web/grid/plugins/pinned-rows';
import { isComponentClass, type ColumnConfig, type GridConfig, type TypeDefault } from './angular-column-config';
import { getEditorTemplate, GridEditorContext } from './directives/grid-column-editor.directive';
import { getViewTemplate, GridCellContext } from './directives/grid-column-view.directive';
import { getDetailTemplate, GridDetailContext } from './directives/grid-detail-view.directive';
import { getFormArrayContext } from './directives/grid-form-array.directive';
import { getResponsiveCardTemplate, GridResponsiveCardContext } from './directives/grid-responsive-card.directive';
import { getToolPanelTemplate, GridToolPanelContext } from './directives/grid-tool-panel.directive';
import { getStructuralEditorTemplate, getStructuralViewTemplate } from './directives/structural-directives';
import { notifyEditorMounted, registerEditorMountHook, type EditorMountHook } from './editor-mount-hooks';
import { wireEditorCallbacks } from './editor-wiring';
import { GridTypeRegistry } from './grid-type-registry';

// Re-export so feature secondary entries can install editor-mount hooks via
// `import { registerEditorMountHook } from '@toolbox-web/grid-angular'`.
export { registerEditorMountHook, type EditorMountHook };
export { makeFlushFocusedInput } from './editor-mount-hooks';

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
 * import { GridAdapter } from '@toolbox-web/grid-angular';
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
 *     GridElement.registerAdapter(new GridAdapter(injector, appRef, viewContainerRef));
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

/**
 * Synchronize an embedded view's rootNodes into a stable container element.
 *
 * Angular's control flow blocks (@if, @for, @switch) can dynamically add or
 * remove rootNodes during `detectChanges()`. This helper ensures the container
 * always reflects the current set of rootNodes, preventing orphaned or stale
 * nodes when the template's DOM structure changes between renders.
 */
function syncRootNodes(viewRef: EmbeddedViewRef<unknown>, container: HTMLElement): void {
  // Fast path: if the container already holds exactly the right nodes, skip DOM mutations.
  const rootNodes: Node[] = viewRef.rootNodes;
  const children = container.childNodes;

  let needsSync = children.length !== rootNodes.length;
  if (!needsSync) {
    for (let i = 0; i < rootNodes.length; i++) {
      if (children[i] !== rootNodes[i]) {
        needsSync = true;
        break;
      }
    }
  }

  if (needsSync) {
    // Clear and re-append. replaceChildren is efficient (single reflow).
    container.replaceChildren(...rootNodes);
  }
}

export class GridAdapter implements FrameworkAdapter {
  private viewRefs: EmbeddedViewRef<unknown>[] = [];
  private componentRefs: ComponentRef<unknown>[] = [];
  /** Editor-specific view refs tracked separately for per-cell cleanup via releaseCell. */
  private editorViewRefs: EmbeddedViewRef<unknown>[] = [];
  /** Editor-specific component refs tracked separately for per-cell cleanup via releaseCell. */
  private editorComponentRefs: ComponentRef<unknown>[] = [];
  /**
   * Per-editor mount-hook teardown functions, keyed by editor host element.
   *
   * Populated by {@link runEditorMountHooks} (which invokes
   * {@link notifyEditorMounted}) and torn down per-cell from
   * {@link releaseCell}, with full sweep on {@link destroy}. The actual
   * lifecycle behaviour is supplied by feature secondary entries (e.g.
   * `@toolbox-web/grid-angular/features/editing` installs the
   * `before-edit-close` blur bridge).
   */
  private editorMountTeardowns: Map<HTMLElement, () => void> = new Map();
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
   * import { GridAdapter, type GridConfig } from '@toolbox-web/grid-angular';
   *
   * const config: GridConfig<Employee> = {
   *   columns: [
   *     { field: 'status', renderer: StatusBadgeComponent, editor: StatusEditorComponent },
   *   ],
   * };
   *
   * // In component
   * constructor() {
   *   const adapter = inject(GridAdapter); // or create new instance
   *   this.processedConfig = adapter.processGridConfig(config);
   * }
   * ```
   *
   * @param config - Angular grid configuration with possible component class references
   * @returns Processed GridConfig with actual renderer/editor functions
   */
  processGridConfig<TRow = unknown>(config: GridConfig<TRow>): BaseGridConfig<TRow> {
    return this.processConfig(config as BaseGridConfig<TRow>);
  }

  /**
   * FrameworkAdapter.processConfig implementation.
   * Called automatically by the grid's `set gridConfig` setter.
   */
  processConfig<TRow = unknown>(config: BaseGridConfig<TRow>): BaseGridConfig<TRow> {
    // Cast to Angular's extended GridConfig since the config may contain
    // Angular component classes as renderers/editors at runtime
    const angularConfig = config as unknown as GridConfig<TRow>;
    const result = { ...angularConfig };

    // Process columns
    if (angularConfig.columns) {
      result.columns = angularConfig.columns.map((col) => this.processColumn(col));
    }

    // Process typeDefaults - convert Angular component classes to renderer/editor functions
    if (angularConfig.typeDefaults) {
      result.typeDefaults = this.processTypeDefaults(angularConfig.typeDefaults) as typeof angularConfig.typeDefaults;
    }

    // Process loadingRenderer - convert Angular component class to function
    if (angularConfig.loadingRenderer && isComponentClass(angularConfig.loadingRenderer)) {
      (result as BaseGridConfig<TRow>).loadingRenderer = this.createComponentLoadingRenderer(
        angularConfig.loadingRenderer,
      ) as unknown as BaseGridConfig<TRow>['loadingRenderer'];
    }

    return result as BaseGridConfig<TRow>;
  }

  /**
   * Processes typeDefaults configuration, converting component class references
   * to actual renderer/editor functions.
   *
   * @param typeDefaults - Angular type defaults with possible component class references
   * @returns Processed TypeDefault record
   */
  processTypeDefaults<TRow = unknown>(
    typeDefaults: Record<string, TypeDefault<TRow>>,
  ): Record<string, BaseTypeDefault<TRow>> {
    const processed: Record<string, BaseTypeDefault<TRow>> = {};

    for (const [type, config] of Object.entries(typeDefaults)) {
      const processedConfig: BaseTypeDefault<TRow> = { ...config } as BaseTypeDefault<TRow>;

      // Convert renderer component class to function
      if (config.renderer && isComponentClass(config.renderer)) {
        processedConfig.renderer = this.createComponentRenderer(config.renderer);
      }

      // Convert editor component class to function
      if (config.editor && isComponentClass(config.editor)) {
        (processedConfig as any).editor = this.createComponentEditor(config.editor);
      }

      // Convert filterPanelRenderer component class to function
      if (config.filterPanelRenderer && isComponentClass(config.filterPanelRenderer)) {
        processedConfig.filterPanelRenderer = this.createComponentFilterPanelRenderer(config.filterPanelRenderer);
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
  processColumn<TRow = unknown>(column: ColumnConfig<TRow>): BaseColumnConfig<TRow> {
    const processed = { ...column } as BaseColumnConfig<TRow>;

    // Convert renderer component class to function
    if (column.renderer && isComponentClass(column.renderer)) {
      processed.renderer = this.createComponentRenderer(column.renderer);
    }

    // Convert editor component class to function
    if (column.editor && isComponentClass(column.editor)) {
      processed.editor = this.createComponentEditor(column.editor);
    }

    // Convert headerRenderer component class to function
    if (column.headerRenderer && isComponentClass(column.headerRenderer)) {
      processed.headerRenderer = this.createComponentHeaderRenderer(column.headerRenderer) as any;
    }

    // Convert headerLabelRenderer component class to function
    if (column.headerLabelRenderer && isComponentClass(column.headerLabelRenderer)) {
      processed.headerLabelRenderer = this.createComponentHeaderLabelRenderer(column.headerLabelRenderer) as any;
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
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> | undefined {
    const template = getAnyViewTemplate(element) as TemplateRef<GridCellContext<TValue, TRow>> | undefined;

    if (!template) {
      // Return undefined so the grid uses default rendering
      // This is important when only an editor template is provided (no view template)
      return undefined;
    }

    // Cell cache for this column - maps cell element to its view ref and container.
    // When the grid recycles pool elements during scroll, the same cellEl is reused
    // for different row data. By caching per cellEl, we reuse the Angular view and
    // just update its context instead of creating a new embedded view every time.
    // This matches what React and Vue adapters do with their cell caches.
    //
    // IMPORTANT: We always use a stable wrapper container (display:contents) rather
    // than caching individual rootNodes. This is critical because Angular's control
    // flow (@if, @for, @switch) can dynamically add/remove rootNodes during
    // detectChanges(). If we cached a single rootNode, newly created nodes (e.g.,
    // from an @if becoming true) would be orphaned outside the grid cell.
    const cellCache = new WeakMap<
      HTMLElement,
      { viewRef: EmbeddedViewRef<GridCellContext<TValue, TRow>>; container: HTMLElement }
    >();

    return (ctx: CellRenderContext<TRow, TValue>) => {
      // Skip rendering if the cell is in editing mode
      // This prevents the renderer from overwriting the editor when the grid re-renders
      if (ctx.cellEl?.classList.contains('editing')) {
        return null;
      }

      const cellEl = ctx.cellEl as HTMLElement | undefined;

      if (cellEl) {
        const cached = cellCache.get(cellEl);
        if (cached) {
          // Reuse existing view - just update context and re-run change detection
          cached.viewRef.context.$implicit = ctx.value;
          cached.viewRef.context.value = ctx.value;
          cached.viewRef.context.row = ctx.row;
          cached.viewRef.context.column = ctx.column;
          cached.viewRef.detectChanges();
          // Re-sync rootNodes into the container. Angular's control flow (@if/@for)
          // may have added or removed nodes during detectChanges().
          syncRootNodes(cached.viewRef, cached.container);
          return cached.container;
        }
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

      // Always use a stable wrapper container so Angular can freely add/remove
      // rootNodes (via @if, @for, etc.) without orphaning them outside the grid cell.
      const container = document.createElement('span');
      container.style.display = 'contents';
      syncRootNodes(viewRef, container);

      // Cache for reuse on scroll recycles
      if (cellEl) {
        cellCache.set(cellEl, { viewRef, container });
      }

      return container;
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
      // Create simple callback functions
      const onCommit = (value: TValue) => ctx.commit(value);
      const onCancel = () => ctx.cancel();

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
        field: ctx.field as string,
        column: ctx.column,
        rowId: ctx.rowId ?? '',
        onCommit,
        onCancel,
        updateRow: ctx.updateRow,
        onValueChange: ctx.onValueChange,
        // FormControl from FormArray (if available)
        control,
      };

      // Create embedded view from template
      const viewRef = this.viewContainerRef.createEmbeddedView(template, context);
      // Track in editor-specific array for per-cell cleanup via releaseCell
      this.editorViewRefs.push(viewRef);

      // Trigger change detection
      viewRef.detectChanges();

      // Use a stable wrapper so Angular's rootNodes (which may include comment
      // placeholders from <ng-container>) are always inside one element node.
      const container = document.createElement('span');
      container.style.display = 'contents';
      syncRootNodes(viewRef, container);
      this.runEditorMountHooks(container);

      // Auto-wire: Listen for commit/cancel events on the rendered component.
      // This allows components to just emit (commit) and (cancel) without
      // requiring explicit template bindings like (commit)="onCommit($event)".
      container.addEventListener('commit', (e: Event) => {
        const customEvent = e as CustomEvent<TValue>;
        ctx.commit(customEvent.detail);
      });
      container.addEventListener('cancel', () => {
        ctx.cancel();
      });

      // Auto-update editor when value changes externally (e.g., via updateRow cascade
      // or Escape-revert in grid mode). Update the template context and run synchronous
      // detectChanges() — Angular's own bindings and control flow (@for, @if) handle
      // re-rendering regardless of editor type (inputs, chips, contenteditable, etc.).
      ctx.onValueChange?.((newVal: unknown) => {
        context.$implicit = newVal as TValue;
        context.value = newVal as TValue;
        viewRef.detectChanges();
        // Re-sync rootNodes in case Angular control flow changed them
        syncRootNodes(viewRef, container);
      });

      return container;
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
   * FrameworkAdapter hook called by ResponsivePlugin during attach().
   * Parses the `<tbw-grid-responsive-card>` element and delegates to
   * {@link createResponsiveCardRenderer}. Required for parity with the Vue
   * adapter so ResponsivePlugin's standard lookup path works for Angular
   * users without relying on imperative `refreshCardRenderer` calls.
   */
  parseResponsiveCardElement<TRow = unknown>(
    cardElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const gridElement = cardElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;
    return this.createResponsiveCardRenderer<TRow>(gridElement);
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
  getTypeDefault<TRow = unknown>(type: string, _gridEl?: HTMLElement): BaseTypeDefault<TRow> | undefined {
    if (!this.typeRegistry) {
      return undefined;
    }

    const config = this.typeRegistry.get(type);
    if (!config) {
      return undefined;
    }

    const typeDefault: BaseTypeDefault<TRow> = {
      editorParams: config.editorParams,
    };

    // Create renderer function that instantiates the Angular component
    if (config.renderer) {
      typeDefault.renderer = this.createComponentRenderer<TRow, unknown>(config.renderer);
    }

    // Create editor function that instantiates the Angular component
    if (config.editor) {
      // Type assertion needed: adapter bridges TRow to core's unknown
      typeDefault.editor = this.createComponentEditor<TRow, unknown>(config.editor) as BaseTypeDefault['editor'];
    }

    // Create filterPanelRenderer function that instantiates the Angular component
    if (config.filterPanelRenderer && isComponentClass(config.filterPanelRenderer)) {
      typeDefault.filterPanelRenderer = this.createComponentFilterPanelRenderer(config.filterPanelRenderer);
    } else if (config.filterPanelRenderer) {
      typeDefault.filterPanelRenderer = config.filterPanelRenderer as BaseTypeDefault['filterPanelRenderer'];
    }

    return typeDefault;
  }

  /**
   * Generalized component-mount primitive. All `createComponent*Renderer` methods
   * are thin wrappers around this. Returns a function `(ctx) => { hostElement, componentRef }`
   * so callers that need the `componentRef` (editor wiring, value-change subscription)
   * still have it; callers that only need the host element use `.hostElement`.
   *
   * @param componentClass Angular component class to instantiate per call.
   * @param mapInputs Maps the renderer context to a `setInput()` bag.
   * @param pool Which `componentRefs[]` array tracks the instance for cleanup.
   *   `'render'` (default) is the long-lived pool cleared at `dispose()`.
   *   `'editor'` is the per-cell pool swept by `releaseCell()`.
   * @internal
   */
  private mountComponentRenderer<TCtx>(
    componentClass: Type<unknown>,
    mapInputs: (ctx: TCtx) => Record<string, unknown>,
    pool: 'render' | 'editor' = 'render',
  ): (ctx: TCtx) => { hostElement: HTMLSpanElement; componentRef: ComponentRef<unknown> } {
    return (ctx: TCtx) => {
      const hostElement = document.createElement('span');
      hostElement.style.display = 'contents';
      const componentRef = createComponent(componentClass, {
        environmentInjector: this.injector,
        hostElement,
      });
      this.setComponentInputs(componentRef, mapInputs(ctx));
      this.appRef.attachView(componentRef.hostView);
      (pool === 'editor' ? this.editorComponentRefs : this.componentRefs).push(componentRef);
      componentRef.changeDetectorRef.detectChanges();
      return { hostElement, componentRef };
    };
  }

  /**
   * Creates a renderer function from an Angular component class.
   * Wraps {@link mountComponentRenderer} with a per-cell `WeakMap` cache so
   * scroll-recycled cells reuse the existing component (just refresh inputs)
   * instead of mounting a fresh one.
   * @internal
   */
  private createComponentRenderer<TRow = unknown, TValue = unknown>(
    componentClass: Type<unknown>,
  ): ColumnViewRenderer<TRow, TValue> {
    const cellCache = new WeakMap<HTMLElement, { componentRef: ComponentRef<unknown>; hostElement: HTMLSpanElement }>();
    const mount = this.mountComponentRenderer<CellRenderContext<TRow, TValue>>(componentClass, (ctx) => ({
      value: ctx.value,
      row: ctx.row,
      column: ctx.column,
    }));

    return (ctx: CellRenderContext<TRow, TValue>) => {
      const cellEl = ctx.cellEl as HTMLElement | undefined;

      if (cellEl) {
        const cached = cellCache.get(cellEl);
        if (cached) {
          // Reuse existing component - just update inputs.
          this.setComponentInputs(cached.componentRef, {
            value: ctx.value,
            row: ctx.row,
            column: ctx.column,
          });
          cached.componentRef.changeDetectorRef.detectChanges();
          return cached.hostElement;
        }
      }

      const { hostElement, componentRef } = mount(ctx);
      if (cellEl) cellCache.set(cellEl, { componentRef, hostElement });
      return hostElement;
    };
  }

  /**
   * Creates an editor function from an Angular component class.
   * Wraps {@link mountComponentRenderer} (using the `'editor'` pool for per-cell
   * cleanup) plus editor-specific wiring: callback bridge, mount-hook fan-out
   * (see {@link runEditorMountHooks}), and external value-change subscription.
   * @internal
   */
  private createComponentEditor<TRow = unknown, TValue = unknown>(
    componentClass: Type<unknown>,
  ): ColumnEditorSpec<TRow, TValue> {
    const mount = this.mountComponentRenderer<ColumnEditorContext<TRow, TValue>>(
      componentClass,
      (ctx) => ({ value: ctx.value, row: ctx.row, column: ctx.column }),
      'editor',
    );

    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      const { hostElement, componentRef } = mount(ctx);

      wireEditorCallbacks<TValue>(
        hostElement,
        componentRef.instance as Record<string, unknown>,
        (value) => ctx.commit(value),
        () => ctx.cancel(),
      );
      this.runEditorMountHooks(hostElement);

      // Auto-update editor when value changes externally (e.g., via updateRow cascade
      // or Escape-revert). Update the component input and run detectChanges() —
      // the component's own template handles rendering regardless of editor type.
      ctx.onValueChange?.((newVal: unknown) => {
        try {
          // Notify the editor so it can clear stale internal state (e.g., searchText
          // in autocomplete editors) before the value input updates.
          const instance = componentRef.instance;
          if (typeof (instance as Record<string, unknown>)['onExternalValueChange'] === 'function') {
            (instance as { onExternalValueChange: (v: unknown) => void }).onExternalValueChange(newVal);
          }
          componentRef.setInput('value', newVal);
          componentRef.changeDetectorRef.detectChanges();
        } catch {
          // Component is destroyed — nothing to update.
        }
      });

      return hostElement;
    };
  }

  /**
   * Creates a header renderer function from an Angular component class.
   * Mounts the component with full header context (column, value, sortState, etc.).
   * @internal
   */
  private createComponentHeaderRenderer<TRow = unknown>(
    componentClass: Type<unknown>,
  ): (ctx: HeaderCellContext<TRow>) => HTMLElement {
    const mount = this.mountComponentRenderer<HeaderCellContext<TRow>>(componentClass, (ctx) => ({
      column: ctx.column,
      value: ctx.value,
      sortState: ctx.sortState,
      filterActive: ctx.filterActive,
      renderSortIcon: ctx.renderSortIcon,
      renderFilterButton: ctx.renderFilterButton,
    }));
    return (ctx) => mount(ctx).hostElement;
  }

  /**
   * Creates a header label renderer function from an Angular component class.
   * Mounts the component with label context (column, value).
   * @internal
   */
  private createComponentHeaderLabelRenderer<TRow = unknown>(
    componentClass: Type<unknown>,
  ): (ctx: HeaderLabelContext<TRow>) => HTMLElement {
    const mount = this.mountComponentRenderer<HeaderLabelContext<TRow>>(componentClass, (ctx) => ({
      column: ctx.column,
      value: ctx.value,
    }));
    return (ctx) => mount(ctx).hostElement;
  }

  /**
   * Creates a group header renderer function from an Angular component class.
   *
   * The component should accept group header inputs (id, label, columns, firstIndex, isImplicit).
   * Returns the host element directly (groupHeaderRenderer returns an element, not void).
   * @internal
   */
  private createComponentGroupHeaderRenderer(
    componentClass: Type<unknown>,
  ): (params: GroupHeaderRenderParams) => HTMLElement {
    const mount = this.mountComponentRenderer<GroupHeaderRenderParams>(componentClass, (p) => ({
      id: p.id,
      label: p.label,
      columns: p.columns,
      firstIndex: p.firstIndex,
      isImplicit: p.isImplicit,
    }));
    return (params) => mount(params).hostElement;
  }

  /**
   * Processes a GroupingColumnsConfig, converting component class references
   * to actual renderer functions.
   *
   * @param config - Angular grouping columns configuration with possible component class references
   * @returns Processed GroupingColumnsConfig with actual renderer functions
   */
  processGroupingColumnsConfig(config: GroupingColumnsConfig): GroupingColumnsConfig {
    const processed = { ...config };
    let changed = false;

    // Bridge top-level groupHeaderRenderer component class
    if (config.groupHeaderRenderer && isComponentClass(config.groupHeaderRenderer)) {
      processed.groupHeaderRenderer = this.createComponentGroupHeaderRenderer(config.groupHeaderRenderer);
      changed = true;
    }

    // Bridge per-group renderer component classes inside columnGroups
    if (Array.isArray(config.columnGroups)) {
      const mappedGroups = config.columnGroups.map((def) => {
        if (def.renderer && isComponentClass(def.renderer)) {
          changed = true;
          return { ...def, renderer: this.createComponentGroupHeaderRenderer(def.renderer) };
        }
        return def;
      });
      if (changed) processed.columnGroups = mappedGroups;
    }

    return changed ? processed : config;
  }

  /**
   * Processes a GroupingRowsConfig, converting component class references
   * to actual renderer functions.
   *
   * @param config - Angular grouping rows configuration with possible component class references
   * @returns Processed GroupingRowsConfig with actual renderer functions
   */
  processGroupingRowsConfig(config: GroupingRowsConfig): GroupingRowsConfig {
    if (config.groupRowRenderer && isComponentClass(config.groupRowRenderer)) {
      return {
        ...config,
        groupRowRenderer: this.createComponentGroupRowRenderer(config.groupRowRenderer),
      };
    }
    return config;
  }

  /**
   * Processes a PinnedRowsConfig, converting component class references
   * in `customPanels[].render` AND in `slots[].render` (issue #255) to
   * actual renderer functions.
   *
   * @param config - Angular pinned rows configuration with possible component class references
   * @returns Processed PinnedRowsConfig with actual renderer functions
   */
  processPinnedRowsConfig(config: PinnedRowsConfig): PinnedRowsConfig {
    let next: PinnedRowsConfig = config;

    // Legacy customPanels bridging (unchanged behavior).
    if (Array.isArray(config.customPanels)) {
      const hasComponentRender = config.customPanels.some((panel) => isComponentClass(panel.render));
      if (hasComponentRender) {
        next = {
          ...next,
          customPanels: config.customPanels.map((panel) => {
            if (!isComponentClass(panel.render)) return panel;
            return {
              ...panel,
              render: this.createComponentPinnedRowsPanelRenderer(panel.render),
            };
          }),
        };
      }
    }

    // Slots[] bridging — each PanelSlot.render may be a component class,
    // or an array of { zone?, render } where each render may be a component class.
    if (Array.isArray(config.slots)) {
      next = {
        ...next,
        slots: config.slots.map((slot) => this.bridgePinnedRowSlot(slot)),
      };
    }

    return next;
  }

  /**
   * Bridge a single pinned-row slot. Aggregation slots (no `render`) pass through.
   * For panel slots, wrap any component-class `render` (or array entry's `render`)
   * with the Angular component renderer.
   * @internal
   */
  private bridgePinnedRowSlot(slot: PinnedRowSlot): PinnedRowSlot {
    if (!('render' in slot) || slot.render == null) return slot;

    if (Array.isArray(slot.render)) {
      const zoned: ZonedPanelRender[] = slot.render.map((entry) => {
        if (entry?.render == null) return entry;
        if (isComponentClass(entry.render)) {
          return {
            zone: entry.zone,
            render: this.createComponentPinnedRowsPanelRenderer(entry.render as Type<unknown>),
          };
        }
        return entry;
      });
      return { ...slot, render: zoned };
    }

    if (isComponentClass(slot.render)) {
      return {
        ...slot,
        render: this.createComponentPinnedRowsPanelRenderer(slot.render as Type<unknown>),
      };
    }
    return slot;
  }

  /**
   * Creates a pinned rows panel renderer function from an Angular component class.
   *
   * The component should accept inputs from PinnedRowsContext (totalRows, filteredRows,
   * selectedRows, columns, rows, grid).
   * @internal
   */
  private createComponentPinnedRowsPanelRenderer(
    componentClass: Type<unknown>,
  ): (ctx: PinnedRowsContext) => HTMLElement {
    const mount = this.mountComponentRenderer<PinnedRowsContext>(componentClass, (ctx) => ({
      totalRows: ctx.totalRows,
      filteredRows: ctx.filteredRows,
      selectedRows: ctx.selectedRows,
      columns: ctx.columns,
      rows: ctx.rows,
      grid: ctx.grid,
    }));
    return (ctx) => mount(ctx).hostElement;
  }

  /**
   * Creates a loading renderer function from an Angular component class.
   *
   * The component should accept a `size` input ('large' | 'small').
   * @internal
   */
  private createComponentLoadingRenderer(componentClass: Type<unknown>): (ctx: LoadingContext) => HTMLElement {
    const mount = this.mountComponentRenderer<LoadingContext>(componentClass, (ctx) => ({ size: ctx.size }));
    return (ctx) => mount(ctx).hostElement;
  }

  /**
   * Creates a group row renderer function from an Angular component class.
   *
   * The component should accept group row inputs (key, value, depth, rows, expanded, toggleExpand).
   * Returns the host element directly (groupRowRenderer returns an element, not void).
   * @internal
   */
  private createComponentGroupRowRenderer(
    componentClass: Type<unknown>,
  ): (params: GroupRowRenderParams) => HTMLElement {
    const mount = this.mountComponentRenderer<GroupRowRenderParams>(componentClass, (p) => ({
      key: p.key,
      value: p.value,
      depth: p.depth,
      rows: p.rows,
      expanded: p.expanded,
      toggleExpand: p.toggleExpand,
    }));
    return (params) => mount(params).hostElement;
  }

  /**
   * Creates a filter panel renderer function from an Angular component class.
   *
   * The component must implement `FilterPanel` (i.e., have a `params` input).
   * The component is mounted into the filter panel container element.
   * @internal
   */
  private createComponentFilterPanelRenderer(
    componentClass: Type<unknown>,
  ): (container: HTMLElement, params: FilterPanelParams) => void {
    // FilterPanel renderers `appendChild` into the supplied container instead of
    // returning the host element. The mount primitive still owns lifecycle.
    const mount = this.mountComponentRenderer<FilterPanelParams>(componentClass, (params) => ({ params }));
    return (container, params) => {
      container.appendChild(mount(params).hostElement);
    };
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
   * Called when a cell's content is about to be wiped (e.g., exiting edit mode,
   * scroll-recycling a row, or rebuilding a row).
   *
   * Destroys any editor embedded views or component refs whose DOM is
   * inside the given cell element. This prevents memory leaks from
   * orphaned Angular views that would otherwise stay in the change
   * detection tree indefinitely.
   */
  releaseCell(cellEl: HTMLElement): void {
    // Release editor embedded views whose root nodes are inside this cell
    for (let i = this.editorViewRefs.length - 1; i >= 0; i--) {
      const ref = this.editorViewRefs[i];
      if (ref.rootNodes.some((n: Node) => cellEl.contains(n))) {
        ref.destroy();
        this.editorViewRefs.splice(i, 1);
      }
    }
    // Release editor component refs whose host element is inside this cell
    for (let i = this.editorComponentRefs.length - 1; i >= 0; i--) {
      const ref = this.editorComponentRefs[i];
      if (cellEl.contains(ref.location.nativeElement)) {
        ref.destroy();
        this.editorComponentRefs.splice(i, 1);
      }
    }
    // Detach editor-mount hook teardowns for editor hosts inside this cell.
    for (const [hostEl, unsub] of this.editorMountTeardowns) {
      if (cellEl.contains(hostEl)) {
        unsub();
        this.editorMountTeardowns.delete(hostEl);
      }
    }
  }

  /**
   * Unmount a specific container (e.g., detail panel, tool panel).
   * Finds the matching view or component ref whose DOM nodes are inside
   * the container and properly destroys it to prevent memory leaks.
   */
  unmount(container: HTMLElement): void {
    for (let i = this.viewRefs.length - 1; i >= 0; i--) {
      const ref = this.viewRefs[i];
      if (ref.rootNodes.some((n: Node) => container.contains(n))) {
        ref.destroy();
        this.viewRefs.splice(i, 1);
        return;
      }
    }
    for (let i = this.componentRefs.length - 1; i >= 0; i--) {
      const ref = this.componentRefs[i];
      if (container.contains(ref.location.nativeElement)) {
        ref.destroy();
        this.componentRefs.splice(i, 1);
        return;
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
    this.editorViewRefs.forEach((ref) => ref.destroy());
    this.editorViewRefs = [];
    this.componentRefs.forEach((ref) => ref.destroy());
    this.componentRefs = [];
    this.editorComponentRefs.forEach((ref) => ref.destroy());
    this.editorComponentRefs = [];
    this.editorMountTeardowns.forEach((unsub) => unsub());
    this.editorMountTeardowns.clear();
  }

  /**
   * Runs every registered {@link EditorMountHook} against a freshly mounted
   * editor host once it has been parented to the grid. The grid is resolved
   * lazily via `queueMicrotask` because the host is appended to the cell
   * *after* the editor wrapper returns. Mirror of Vue's
   * `attachBeforeEditCloseFlush` and React's `wrapReactEditor`
   * queueMicrotask bridge.
   *
   * Without any feature imports the hook list is empty and this is a no-op
   * — `before-edit-close` blur handling lives in
   * `@toolbox-web/grid-angular/features/editing`.
   * @internal
   */
  private runEditorMountHooks(host: HTMLElement): void {
    queueMicrotask(() => {
      const gridEl = host.closest('tbw-grid') as HTMLElement | null;
      if (!gridEl) return;
      this.editorMountTeardowns.set(host, notifyEditorMounted(host, gridEl));
    });
  }
}
