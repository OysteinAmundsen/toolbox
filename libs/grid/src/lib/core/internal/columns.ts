import type { ColumnConfig, ColumnInternal, ElementWithPart, InternalGrid, PrimitiveColumnType } from '../types';
import { FitModeEnum } from '../types';

/** Global DataGridElement class (may or may not be registered) */
interface DataGridElementClass {
  getAdapters?: () => Array<{
    canHandle: (el: HTMLElement) => boolean;
    createRenderer: (el: HTMLElement) => ((ctx: unknown) => Node | string | void) | undefined;
    createEditor: (el: HTMLElement) => ((ctx: unknown) => HTMLElement | string) | undefined;
  }>;
}

/**
 * Parse `<tbw-grid-column>` elements from the host light DOM into column config objects,
 * capturing template elements for later cloning / compilation.
 */
export function parseLightDomColumns(host: HTMLElement): ColumnInternal[] {
  const domColumns = Array.from(host.querySelectorAll('tbw-grid-column')) as HTMLElement[];
  return domColumns
    .map((el) => {
      const field = el.getAttribute('field') || '';
      if (!field) return null;
      const rawType = el.getAttribute('type') || undefined;
      const allowedTypes = new Set<PrimitiveColumnType>(['number', 'string', 'date', 'boolean', 'select']);
      const type =
        rawType && allowedTypes.has(rawType as PrimitiveColumnType) ? (rawType as PrimitiveColumnType) : undefined;
      const header = el.getAttribute('header') || undefined;
      const sortable = el.hasAttribute('sortable');
      const editable = el.hasAttribute('editable');
      const config: ColumnInternal = { field, type, header, sortable, editable };

      // Parse width attribute (supports px values, percentages, or plain numbers)
      const widthAttr = el.getAttribute('width');
      if (widthAttr) {
        const numericWidth = parseFloat(widthAttr);
        if (!isNaN(numericWidth) && /^\d+(\.\d+)?$/.test(widthAttr.trim())) {
          config.width = numericWidth;
        } else {
          config.width = widthAttr; // e.g. "100px", "20%", "1fr"
        }
      }

      // Parse minWidth attribute (numeric only)
      const minWidthAttr = el.getAttribute('minWidth') || el.getAttribute('min-width');
      if (minWidthAttr) {
        const numericMinWidth = parseFloat(minWidthAttr);
        if (!isNaN(numericMinWidth)) {
          config.minWidth = numericMinWidth;
        }
      }

      if (el.hasAttribute('resizable')) config.resizable = true;
      if (el.hasAttribute('sizable')) config.resizable = true; // legacy attribute support

      // Parse editor and renderer attribute names for programmatic lookup
      const editorName = el.getAttribute('editor');
      const rendererName = el.getAttribute('renderer');
      if (editorName) config.__editorName = editorName;
      if (rendererName) config.__rendererName = rendererName;

      // Parse options attribute for select/typeahead: "value1:Label1,value2:Label2" or "value1,value2"
      const optionsAttr = el.getAttribute('options');
      if (optionsAttr) {
        config.options = optionsAttr.split(',').map((item) => {
          const [value, label] = item.includes(':') ? item.split(':') : [item.trim(), item.trim()];
          return { value: value.trim(), label: label?.trim() || value.trim() };
        });
      }
      const viewTpl = el.querySelector('tbw-grid-column-view');
      const editorTpl = el.querySelector('tbw-grid-column-editor');
      const headerTpl = el.querySelector('tbw-grid-column-header');
      if (viewTpl) config.__viewTemplate = viewTpl as HTMLElement;
      if (editorTpl) config.__editorTemplate = editorTpl as HTMLElement;
      if (headerTpl) config.__headerTemplate = headerTpl as HTMLElement;

      // Check if framework adapters can handle template wrapper elements or the column element itself
      // React adapter registers on the column element, Angular uses inner template wrappers
      const DataGridElementClassRef = (globalThis as { DataGridElement?: DataGridElementClass }).DataGridElement;
      const adapters = DataGridElementClassRef?.getAdapters?.() ?? [];

      // First check inner view template, then column element itself
      const viewTarget = (viewTpl ?? el) as HTMLElement;
      const viewAdapter = adapters.find((a) => a.canHandle(viewTarget));
      if (viewAdapter) {
        // Only assign if adapter returns a truthy renderer
        // Adapters return undefined when only an editor is registered (no view template)
        const renderer = viewAdapter.createRenderer(viewTarget);
        if (renderer) {
          config.viewRenderer = renderer;
        }
      }

      // First check inner editor template, then column element itself
      const editorTarget = (editorTpl ?? el) as HTMLElement;
      const editorAdapter = adapters.find((a) => a.canHandle(editorTarget));
      if (editorAdapter) {
        // Only assign if adapter returns a truthy editor
        const editor = editorAdapter.createEditor(editorTarget);
        if (editor) {
          config.editor = editor;
        }
      }

      return config;
    })
    .filter((c): c is ColumnInternal => !!c);
}

/**
 * Merge programmatic columns with light DOM columns by field name, allowing DOM-provided
 * attributes / templates to supplement (not overwrite) programmatic definitions.
 * Any DOM columns without a programmatic counterpart are appended.
 * When multiple DOM columns exist for the same field (e.g., separate renderer and editor),
 * their properties are merged together.
 */
export function mergeColumns(
  programmatic: ColumnConfig[] | undefined,
  dom: ColumnConfig[] | undefined,
): ColumnInternal[] {
  if ((!programmatic || !programmatic.length) && (!dom || !dom.length)) return [];
  if (!programmatic || !programmatic.length) return (dom || []) as ColumnInternal[];
  if (!dom || !dom.length) return programmatic as ColumnInternal[];

  // Build domMap by merging multiple DOM columns with the same field
  // This supports React pattern where renderer and editor are in separate GridColumn elements
  const domMap: Record<string, ColumnInternal> = {};
  (dom as ColumnInternal[]).forEach((c) => {
    const existing = domMap[c.field];
    if (existing) {
      // Merge this column's properties into the existing one
      if (c.header && !existing.header) existing.header = c.header;
      if (c.type && !existing.type) existing.type = c.type;
      if (c.sortable) existing.sortable = true;
      if (c.editable) existing.editable = true;
      if (c.resizable) existing.resizable = true;
      if (c.width != null && existing.width == null) existing.width = c.width;
      if (c.minWidth != null && existing.minWidth == null) existing.minWidth = c.minWidth;
      if (c.__viewTemplate) existing.__viewTemplate = c.__viewTemplate;
      if (c.__editorTemplate) existing.__editorTemplate = c.__editorTemplate;
      if (c.__headerTemplate) existing.__headerTemplate = c.__headerTemplate;
      // Support both 'renderer' alias and 'viewRenderer'
      const cRenderer = c.renderer || c.viewRenderer;
      const existingRenderer = existing.renderer || existing.viewRenderer;
      if (cRenderer && !existingRenderer) {
        existing.viewRenderer = cRenderer;
        if (c.renderer) existing.renderer = cRenderer;
      }
      if (c.editor && !existing.editor) existing.editor = c.editor;
    } else {
      domMap[c.field] = { ...c };
    }
  });

  const merged: ColumnInternal[] = (programmatic as ColumnInternal[]).map((c) => {
    const d = domMap[c.field];
    if (!d) return c;
    const m: ColumnInternal = { ...c };
    if (d.header && !m.header) m.header = d.header;
    if (d.type && !m.type) m.type = d.type;
    m.sortable = c.sortable || d.sortable;
    if (c.resizable === true || d.resizable === true) m.resizable = true;
    m.editable = c.editable || d.editable;
    // Merge width/minWidth from DOM if not set programmatically
    if (d.width != null && m.width == null) m.width = d.width;
    if (d.minWidth != null && m.minWidth == null) m.minWidth = d.minWidth;
    if (d.__viewTemplate) m.__viewTemplate = d.__viewTemplate;
    if (d.__editorTemplate) m.__editorTemplate = d.__editorTemplate;
    if (d.__headerTemplate) m.__headerTemplate = d.__headerTemplate;
    // Merge framework adapter renderers/editors from DOM (support both 'renderer' alias and 'viewRenderer')
    const dRenderer = d.renderer || d.viewRenderer;
    const mRenderer = m.renderer || m.viewRenderer;
    if (dRenderer && !mRenderer) {
      m.viewRenderer = dRenderer;
      if (d.renderer) m.renderer = dRenderer;
    }
    if (d.editor && !m.editor) m.editor = d.editor;
    delete domMap[c.field];
    return m;
  });
  Object.keys(domMap).forEach((field) => merged.push(domMap[field]));
  return merged;
}

/**
 * Safely add a token to an element's `part` attribute (supporting the CSS ::part API)
 * without duplicating values. Falls back to string manipulation if `el.part` API isn't present.
 */
export function addPart(el: HTMLElement, token: string): void {
  try {
    (el as ElementWithPart).part?.add?.(token);
  } catch {
    /* empty */
  }
  const existing = el.getAttribute('part');
  if (!existing) el.setAttribute('part', token);
  else if (!existing.split(/\s+/).includes(token)) el.setAttribute('part', existing + ' ' + token);
}

/**
 * Measure rendered header + visible cell content to assign initial pixel widths
 * to columns when in `content` fit mode. Runs only once unless fit mode changes.
 */
export function autoSizeColumns(grid: InternalGrid): void {
  const mode = grid.effectiveConfig?.fitMode || grid.fitMode || FitModeEnum.STRETCH;
  // Run for both stretch (to derive baseline pixel widths before fr distribution) and fixed.
  if (mode !== FitModeEnum.STRETCH && mode !== FitModeEnum.FIXED) return;
  if (grid.__didInitialAutoSize) return;
  if (!(grid as unknown as HTMLElement).isConnected) return;
  const headerCells = Array.from(grid._headerRowEl?.children || []) as HTMLElement[];
  if (!headerCells.length) return;
  let changed = false;
  grid._visibleColumns.forEach((col: ColumnInternal, i: number) => {
    if (col.width) return;
    const headerCell = headerCells[i];
    let max = headerCell ? headerCell.scrollWidth : 0;
    for (const rowEl of grid._rowPool) {
      const cell = rowEl.children[i] as HTMLElement | undefined;
      if (cell) {
        const w = cell.scrollWidth;
        if (w > max) max = w;
      }
    }
    if (max > 0) {
      col.width = max + 2;
      col.__autoSized = true;
      changed = true;
    }
  });
  if (changed) updateTemplate(grid);
  grid.__didInitialAutoSize = true;
}

/**
 * Compute and apply the CSS grid template string that drives column layout.
 * Uses `fr` units for flexible (non user-resized) columns in stretch mode, otherwise
 * explicit pixel widths or auto sizing.
 */
export function updateTemplate(grid: InternalGrid): void {
  // Modes:
  //  - 'stretch': columns with explicit width use that width; columns without width are flexible
  //               Uses minmax(minWidth, maxWidth) when both min/max specified (bounded flex)
  //               Uses minmax(minWidth, 1fr) when only min specified (grows unbounded)
  //               Uses minmax(defaultMin, maxWidth) when only max specified (capped growth)
  //  - 'fixed': columns with explicit width use that width; columns without width use max-content
  const mode = grid.effectiveConfig?.fitMode || grid.fitMode || FitModeEnum.STRETCH;

  if (mode === FitModeEnum.STRETCH) {
    grid._gridTemplate = grid._visibleColumns
      .map((c: ColumnInternal) => {
        if (c.width) return `${c.width}px`;
        // Flexible column: pure 1fr unless minWidth specified
        const min = c.minWidth;
        return min != null ? `minmax(${min}px, 1fr)` : '1fr';
      })
      .join(' ')
      .trim();
  } else {
    // fixed mode: explicit pixel widths or max-content for content-based sizing
    grid._gridTemplate = grid._visibleColumns
      .map((c: ColumnInternal) => (c.width ? `${c.width}px` : 'max-content'))
      .join(' ');
  }
  (grid as unknown as HTMLElement).style.setProperty('--tbw-column-template', grid._gridTemplate);
}
