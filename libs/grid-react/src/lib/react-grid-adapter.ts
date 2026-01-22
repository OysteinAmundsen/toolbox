import type {
  CellRenderContext,
  ColumnEditorContext,
  ColumnEditorSpec,
  ColumnViewRenderer,
  FrameworkAdapter,
  TypeDefault,
} from '@toolbox-web/grid';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { getDetailRenderer, type DetailPanelContext } from './grid-detail-panel';
import { getResponsiveCardRenderer, type ResponsiveCardContext } from './grid-responsive-card';
import { getToolPanelRenderer, type ToolPanelContext } from './grid-tool-panel';
import type { ReactTypeDefault, TypeDefaultsMap } from './grid-type-registry';

/**
 * Registry mapping grid elements to their React render functions.
 * Each column element stores its renderer/editor functions here.
 */
interface ColumnRegistry {
  renderer?: (ctx: CellRenderContext<unknown, unknown>) => ReactNode;
  editor?: (ctx: ColumnEditorContext<unknown, unknown>) => ReactNode;
}

const columnRegistries = new WeakMap<HTMLElement, ColumnRegistry>();

// Secondary registry by field name to handle React element re-creation
// React may create new DOM elements on re-render, so we also store by field
const fieldRegistries = new Map<string, ColumnRegistry>();

/**
 * Register a React cell renderer for a column element.
 * Called by GridColumn when it has a children render prop.
 */
export function registerColumnRenderer(
  element: HTMLElement,
  renderer: (ctx: CellRenderContext<unknown, unknown>) => ReactNode,
): void {
  const field = element.getAttribute('field');

  const registry = columnRegistries.get(element) ?? {};
  registry.renderer = renderer;
  columnRegistries.set(element, registry);

  // Also register by field name for fallback lookup
  if (field) {
    const fieldRegistry = fieldRegistries.get(field) ?? {};
    fieldRegistry.renderer = renderer;
    fieldRegistries.set(field, fieldRegistry);
  }
}

/**
 * Register a React cell editor for a column element.
 * Called by GridColumn when it has an editor prop.
 */
export function registerColumnEditor(
  element: HTMLElement,
  editor: (ctx: ColumnEditorContext<unknown, unknown>) => ReactNode,
): void {
  const field = element.getAttribute('field');
  const registry = columnRegistries.get(element) ?? {};
  registry.editor = editor;
  columnRegistries.set(element, registry);

  // Also register by field name for fallback lookup
  if (field) {
    const fieldRegistry = fieldRegistries.get(field) ?? {};
    fieldRegistry.editor = editor;
    fieldRegistries.set(field, fieldRegistry);
  }
}

/**
 * Get the renderer registered for a column element.
 * Falls back to field-based lookup if WeakMap lookup fails.
 */
export function getColumnRenderer(
  element: HTMLElement,
): ((ctx: CellRenderContext<unknown, unknown>) => ReactNode) | undefined {
  let renderer = columnRegistries.get(element)?.renderer;

  // Fallback to field-based lookup for React element re-creation scenarios
  if (!renderer) {
    const field = element.getAttribute('field');
    if (field) {
      renderer = fieldRegistries.get(field)?.renderer;
    }
  }

  return renderer;
}

/**
 * Get the editor registered for a column element.
 * Falls back to field-based lookup if WeakMap lookup fails.
 */
export function getColumnEditor(
  element: HTMLElement,
): ((ctx: ColumnEditorContext<unknown, unknown>) => ReactNode) | undefined {
  let editor = columnRegistries.get(element)?.editor;

  // Fallback to field-based lookup for React element re-creation scenarios
  if (!editor) {
    const field = element.getAttribute('field');
    if (field) {
      editor = fieldRegistries.get(field)?.editor;
    }
  }

  return editor;
}

/**
 * Debug helper: Get list of registered fields.
 * @internal
 */
export function getRegisteredFields(): string[] {
  return Array.from(fieldRegistries.keys());
}

/**
 * Tracks mounted React roots for cleanup.
 */
interface MountedView {
  root: Root;
  container: HTMLElement;
}

/**
 * Cache for cell containers and their React roots.
 * Key is a composite of rowIndex + field to uniquely identify each cell.
 */
interface CellRootCache {
  root: Root;
  container: HTMLElement;
  lastRowIndex: number;
}

/**
 * Framework adapter that enables React component integration
 * with the grid's light DOM configuration API.
 *
 * ## Usage
 *
 * The adapter is automatically registered when using the DataGrid component.
 * For advanced use cases, you can manually register:
 *
 * ```tsx
 * import { GridElement } from '@toolbox-web/grid';
 * import { ReactGridAdapter } from '@toolbox-web/grid-react';
 *
 * // One-time registration
 * GridElement.registerAdapter(new ReactGridAdapter());
 * ```
 *
 * ## Declarative usage with DataGrid:
 *
 * ```tsx
 * <DataGrid rows={data} gridConfig={config}>
 *   <GridColumn field="status">
 *     {(ctx) => <StatusBadge value={ctx.value} />}
 *   </GridColumn>
 *   <GridColumn field="name" editor={(ctx) => (
 *     <NameEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />
 *   )} />
 * </DataGrid>
 * ```
 */
export class ReactGridAdapter implements FrameworkAdapter {
  private mountedViews: MountedView[] = [];
  private typeDefaults: TypeDefaultsMap | null = null;

  /**
   * Sets the type defaults map for this adapter.
   * Called by DataGrid when it receives type defaults from context.
   *
   * @internal
   */
  setTypeDefaults(defaults: TypeDefaultsMap | null): void {
    this.typeDefaults = defaults;
  }

  /**
   * Determines if this adapter can handle the given element.
   * Checks if a renderer or editor is registered for this element.
   */
  canHandle(element: HTMLElement): boolean {
    const field = element.getAttribute('field');
    let registry = columnRegistries.get(element);

    // If not found in WeakMap, try field-based lookup
    // This handles the case where React re-renders and creates new elements
    if (!registry && field) {
      const fieldRegistry = fieldRegistries.get(field);
      if (fieldRegistry && (fieldRegistry.renderer || fieldRegistry.editor)) {
        // Copy registration to new element for future WeakMap lookups
        registry = fieldRegistry;
        columnRegistries.set(element, registry);
      }
    }

    const hasRenderer = registry?.renderer !== undefined;
    const hasEditor = registry?.editor !== undefined;
    return registry !== undefined && (hasRenderer || hasEditor);
  }

  /**
   * Creates a view renderer function that renders a React component
   * and returns its container DOM element.
   *
   * Uses a cell cache to reuse React roots for performance - instead of
   * creating new roots on each render, we reuse existing ones and just
   * call root.render() with new data.
   *
   * Returns undefined if no renderer is registered for this element,
   * allowing the grid to use its default rendering.
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> {
    const renderFn = getColumnRenderer(element);

    if (!renderFn) {
      // Return undefined so the grid uses default rendering
      // This is important when GridColumn only has an editor (no children)
      return undefined as unknown as ColumnViewRenderer<TRow, TValue>;
    }

    // Cell cache for this field - maps cell element to its React root
    const cellCache = new WeakMap<HTMLElement, CellRootCache>();
    return (ctx: CellRenderContext<TRow, TValue>) => {
      // Get the cell element from context (if available)
      const cellEl = (ctx as any).cellEl as HTMLElement | undefined;

      if (cellEl) {
        // Check if we have a cached root for this cell
        const cached = cellCache.get(cellEl);
        if (cached) {
          // Reuse existing root - re-render synchronously with flushSync for immediate DOM update
          flushSync(() => {
            cached.root.render(renderFn(ctx as CellRenderContext<unknown, unknown>));
          });
          return cached.container;
        }

        // Create new container and root for this cell
        const container = document.createElement('div');
        container.className = 'react-cell-renderer';
        container.style.display = 'contents';

        const root = createRoot(container);
        // Use flushSync for synchronous initial render - prevents flicker
        flushSync(() => {
          root.render(renderFn(ctx as CellRenderContext<unknown, unknown>));
        });

        // Cache for reuse
        cellCache.set(cellEl, { root, container, lastRowIndex: (ctx as any).rowIndex ?? -1 });
        this.mountedViews.push({ root, container });

        return container;
      }

      // Fallback: no cellEl in context, create new container each time
      const container = document.createElement('div');
      container.className = 'react-cell-renderer';
      container.style.display = 'contents';

      const root = createRoot(container);
      flushSync(() => {
        root.render(renderFn(ctx as CellRenderContext<unknown, unknown>));
      });
      this.mountedViews.push({ root, container });

      return container;
    };
  }

  /**
   * Creates an editor spec that renders a React component
   * with commit/cancel callbacks passed as props.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> {
    const editorFn = getColumnEditor(element);

    if (!editorFn) {
      return () => document.createElement('div');
    }

    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      // Create container for React
      const container = document.createElement('div');
      container.className = 'react-cell-editor';
      container.style.display = 'contents';

      // Create React root and render synchronously for immediate display
      const root = createRoot(container);
      flushSync(() => {
        root.render(editorFn(ctx as ColumnEditorContext<unknown, unknown>));
      });

      // Track for cleanup
      this.mountedViews.push({ root, container });

      return container;
    };
  }

  /**
   * Creates a detail renderer function for MasterDetailPlugin.
   * Renders React components for expandable detail rows.
   */
  createDetailRenderer<TRow = unknown>(
    gridElement: HTMLElement,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const renderFn = getDetailRenderer(gridElement);

    if (!renderFn) {
      return undefined;
    }

    return (row: TRow, rowIndex: number) => {
      const container = document.createElement('div');
      container.className = 'react-detail-panel';

      const ctx: DetailPanelContext<TRow> = { row, rowIndex };

      const root = createRoot(container);
      flushSync(() => {
        root.render(renderFn(ctx as DetailPanelContext<unknown>));
      });

      this.mountedViews.push({ root, container });

      return container;
    };
  }

  /**
   * Framework adapter hook called by MasterDetailPlugin during attach().
   * Parses the <tbw-grid-detail> element and returns a React-based renderer.
   */
  parseDetailElement<TRow = unknown>(
    detailElement: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement | string) | undefined {
    const gridElement = detailElement.closest('tbw-grid') as HTMLElement | null;
    if (!gridElement) return undefined;

    return this.createDetailRenderer<TRow>(gridElement);
  }

  /**
   * Creates a responsive card renderer function for ResponsivePlugin.
   * Renders React components for card layout in responsive mode.
   */
  createResponsiveCardRenderer<TRow = unknown>(
    gridElement: HTMLElement,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined {
    const renderFn = getResponsiveCardRenderer(gridElement);

    if (!renderFn) {
      return undefined;
    }

    return (row: TRow, rowIndex: number) => {
      const container = document.createElement('div');
      container.className = 'react-responsive-card';

      const ctx: ResponsiveCardContext<TRow> = { row, index: rowIndex };

      const root = createRoot(container);
      flushSync(() => {
        root.render(renderFn(ctx as ResponsiveCardContext<unknown>));
      });

      this.mountedViews.push({ root, container });

      return container;
    };
  }

  /**
   * Creates a tool panel renderer from a light DOM element.
   * Renders React components into tool panel containers.
   */
  createToolPanelRenderer(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined {
    const renderFn = getToolPanelRenderer(element);

    if (!renderFn) {
      return undefined;
    }

    const gridElement = element.closest('tbw-grid') as HTMLElement | null;

    return (container: HTMLElement) => {
      const ctx: ToolPanelContext = {
        grid: gridElement ?? container,
      };

      const root = createRoot(container);
      flushSync(() => {
        root.render(renderFn(ctx));
      });

      this.mountedViews.push({ root, container });

      // Return cleanup function
      return () => {
        const index = this.mountedViews.findIndex((v) => v.container === container);
        if (index !== -1) {
          const { root: viewRoot } = this.mountedViews[index];
          try {
            viewRoot.unmount();
          } catch {
            // Ignore cleanup errors
          }
          this.mountedViews.splice(index, 1);
        }
      };
    };
  }

  /**
   * Gets type-level defaults from the type defaults map.
   *
   * This enables application-wide type defaults configured via GridTypeProvider.
   * The returned TypeDefault contains renderer/editor functions that render
   * React components into the grid's cells.
   *
   * @example
   * ```tsx
   * // App.tsx
   * const typeDefaults = {
   *   country: {
   *     renderer: (ctx) => <CountryBadge code={ctx.value} />,
   *     editor: (ctx) => <CountrySelect value={ctx.value} onCommit={ctx.commit} />
   *   }
   * };
   *
   * <GridTypeProvider defaults={typeDefaults}>
   *   <App />
   * </GridTypeProvider>
   *
   * // Any grid with type: 'country' columns will use these components
   * ```
   */
  getTypeDefault<TRow = unknown>(type: string): TypeDefault<TRow> | undefined {
    if (!this.typeDefaults) {
      return undefined;
    }

    // ReactTypeDefault stored in registry uses unknown since it's framework-agnostic storage.
    // We cast to TRow for type-safe usage at consumption time.
    const reactDefault = this.typeDefaults[type] as ReactTypeDefault<TRow> | undefined;
    if (!reactDefault) {
      return undefined;
    }

    const typeDefault: TypeDefault<TRow> = {
      editorParams: reactDefault.editorParams,
    };

    // Create renderer function that renders React component
    if (reactDefault.renderer) {
      typeDefault.renderer = this.createTypeRenderer<TRow>(reactDefault.renderer);
    }

    // Create editor function that renders React component
    if (reactDefault.editor) {
      typeDefault.editor = this.createTypeEditor<TRow>(reactDefault.editor);
    }

    return typeDefault;
  }

  /**
   * Creates a renderer function from a React render function for type defaults.
   * @internal
   */
  private createTypeRenderer<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: CellRenderContext<TRow, TValue>) => ReactNode,
  ): ColumnViewRenderer<TRow, TValue> {
    return (ctx: CellRenderContext<TRow, TValue>) => {
      const container = document.createElement('span');
      container.style.display = 'contents';

      const root = createRoot(container);
      this.mountedViews.push({ root, container });

      flushSync(() => {
        root.render(renderFn(ctx) as React.ReactElement);
      });

      return container;
    };
  }

  /**
   * Creates an editor function from a React render function for type defaults.
   * @internal
   */
  private createTypeEditor<TRow = unknown, TValue = unknown>(
    renderFn: (ctx: ColumnEditorContext<TRow, TValue>) => ReactNode,
  ): ColumnEditorSpec<TRow, TValue> {
    return (ctx: ColumnEditorContext<TRow, TValue>) => {
      const container = document.createElement('span');
      container.style.display = 'contents';

      const root = createRoot(container);
      this.mountedViews.push({ root, container });

      flushSync(() => {
        root.render(renderFn(ctx) as React.ReactElement);
      });

      return container;
    };
  }

  /**
   * Clean up all mounted React roots.
   * Call this when the grid is unmounted.
   */
  destroy(): void {
    this.mountedViews.forEach(({ root }) => {
      try {
        root.unmount();
      } catch {
        // Ignore cleanup errors
      }
    });
    this.mountedViews = [];
  }

  /**
   * Unmount a specific container (called when cell is recycled).
   */
  unmount(container: HTMLElement): void {
    const index = this.mountedViews.findIndex((v) => v.container === container);
    if (index !== -1) {
      const { root } = this.mountedViews[index];
      try {
        root.unmount();
      } catch {
        // Ignore cleanup errors
      }
      this.mountedViews.splice(index, 1);
    }
  }
}
