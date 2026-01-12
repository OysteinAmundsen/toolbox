import type { ColumnConfig, ColumnInternal, InternalGrid } from '../types';
import { FitModeEnum } from '../types';
import { inferColumns } from './inference';
import { compileTemplate } from './sanitize';

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
      const allowedTypes = new Set(['number', 'string', 'date', 'boolean', 'select', 'typeahead']);
      const type = rawType && allowedTypes.has(rawType) ? (rawType as any) : undefined;
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

      if (el.hasAttribute('resizable')) (config as any).resizable = true;
      if (el.hasAttribute('sizable')) (config as any).resizable = true; // legacy attribute support

      // Parse editor and renderer attribute names for programmatic lookup
      const editorName = el.getAttribute('editor');
      const rendererName = el.getAttribute('renderer');
      if (editorName) (config as any).__editorName = editorName;
      if (rendererName) (config as any).__rendererName = rendererName;

      // Parse options attribute for select/typeahead: "value1:Label1,value2:Label2" or "value1,value2"
      const optionsAttr = el.getAttribute('options');
      if (optionsAttr) {
        (config as any).options = optionsAttr.split(',').map((item) => {
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
      const DataGridElementClass = (globalThis as any).DataGridElement;
      const adapters = DataGridElementClass?.getAdapters?.() ?? [];

      // First check inner view template, then column element itself
      const viewTarget = viewTpl ?? el;
      const viewAdapter = adapters.find((a: any) => a.canHandle(viewTarget));
      if (viewAdapter) {
        // Only assign if adapter returns a truthy renderer
        // Adapters return undefined when only an editor is registered (no view template)
        const renderer = viewAdapter.createRenderer(viewTarget);
        if (renderer) {
          config.viewRenderer = renderer;
        }
      }

      // First check inner editor template, then column element itself
      const editorTarget = editorTpl ?? el;
      const editorAdapter = adapters.find((a: any) => a.canHandle(editorTarget));
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
      if ((c as any).resizable) (existing as any).resizable = true;
      if (c.width != null && existing.width == null) existing.width = c.width;
      if (c.minWidth != null && existing.minWidth == null) existing.minWidth = c.minWidth;
      if ((c as any).__viewTemplate) (existing as any).__viewTemplate = (c as any).__viewTemplate;
      if ((c as any).__editorTemplate) (existing as any).__editorTemplate = (c as any).__editorTemplate;
      if ((c as any).__headerTemplate) (existing as any).__headerTemplate = (c as any).__headerTemplate;
      // Support both 'renderer' alias and 'viewRenderer'
      const cRenderer = (c as any).renderer || c.viewRenderer;
      const existingRenderer = (existing as any).renderer || existing.viewRenderer;
      if (cRenderer && !existingRenderer) {
        existing.viewRenderer = cRenderer;
        if ((c as any).renderer) (existing as any).renderer = cRenderer;
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
    if ((c as any).resizable === true || (d as any).resizable === true) (m as any).resizable = true;
    m.editable = c.editable || d.editable;
    // Merge width/minWidth from DOM if not set programmatically
    if (d.width != null && m.width == null) m.width = d.width;
    if (d.minWidth != null && m.minWidth == null) m.minWidth = d.minWidth;
    if ((d as any).__viewTemplate) (m as any).__viewTemplate = (d as any).__viewTemplate;
    if ((d as any).__editorTemplate) (m as any).__editorTemplate = (d as any).__editorTemplate;
    if ((d as any).__headerTemplate) (m as any).__headerTemplate = (d as any).__headerTemplate;
    // Merge framework adapter renderers/editors from DOM (support both 'renderer' alias and 'viewRenderer')
    const dRenderer = (d as any).renderer || d.viewRenderer;
    const mRenderer = (m as any).renderer || m.viewRenderer;
    if (dRenderer && !mRenderer) {
      m.viewRenderer = dRenderer;
      if ((d as any).renderer) (m as any).renderer = dRenderer;
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
    (el as any).part?.add?.(token);
  } catch {
    /* empty */
  }
  const existing = el.getAttribute('part');
  if (!existing) el.setAttribute('part', token);
  else if (!existing.split(/\s+/).includes(token)) el.setAttribute('part', existing + ' ' + token);
}

/**
 * Resolve the effective column list for the grid by combining:
 * 1. Programmatic columns (`grid._columns`)
 * 2. Light DOM `<tbw-grid-column>` definitions (cached)
 * 3. Inferred columns (if none provided)
 * Also compiles inline template expressions into fast functions.
 * Columns with `hidden: true` in config are added to hidden tracking.
 */
export function getColumnConfiguration(grid: InternalGrid): void {
  if (!grid.__lightDomColumnsCache) {
    grid.__originalColumnNodes = Array.from(
      (grid as unknown as HTMLElement).querySelectorAll('tbw-grid-column'),
    ) as HTMLElement[];
    grid.__lightDomColumnsCache = grid.__originalColumnNodes.length
      ? parseLightDomColumns(grid as unknown as HTMLElement)
      : [];
  }
  const lightDomColumns = grid.__lightDomColumnsCache;
  const merged = mergeColumns(grid._columns, lightDomColumns);
  merged.forEach((c: ColumnInternal) => {
    if (c.__viewTemplate && !c.__compiledView) {
      c.__compiledView = compileTemplate((c.__viewTemplate as HTMLElement).innerHTML);
    }
    if (c.__editorTemplate && !c.__compiledEditor) {
      c.__compiledEditor = compileTemplate((c.__editorTemplate as HTMLElement).innerHTML);
    }
  });
  const { columns } = inferColumns(grid._rows, merged as any);
  grid._columns = columns as ColumnInternal[];
}

/**
 * Measure rendered header + visible cell content to assign initial pixel widths
 * to columns when in `content` fit mode. Runs only once unless fit mode changes.
 */
export function autoSizeColumns(grid: InternalGrid): void {
  const mode = (grid as any).effectiveConfig?.fitMode || grid.fitMode || FitModeEnum.STRETCH;
  // Run for both stretch (to derive baseline pixel widths before fr distribution) and fixed.
  if (mode !== FitModeEnum.STRETCH && mode !== FitModeEnum.FIXED) return;
  if (grid.__didInitialAutoSize) return;
  if (!(grid as unknown as HTMLElement).isConnected) return;
  const headerCells = (grid._headerRowEl?.children || []) as any;
  if (!headerCells.length) return;
  let changed = false;
  grid._visibleColumns.forEach((col: ColumnInternal, i: number) => {
    if (col.width) return;
    const headerCell = headerCells[i] as HTMLElement | undefined;
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
      (col as ColumnInternal).__autoSized = true;
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
  const mode = (grid as any).effectiveConfig?.fitMode || grid.fitMode || FitModeEnum.STRETCH;

  if (mode === FitModeEnum.STRETCH) {
    grid._gridTemplate = grid._visibleColumns
      .map((c: ColumnInternal) => {
        if (c.width) return `${c.width}px`;
        // Flexible column: pure 1fr unless minWidth specified
        const min = (c as any).minWidth;
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
  ((grid as unknown as HTMLElement).style as any).setProperty('--tbw-column-template', grid._gridTemplate);
}
