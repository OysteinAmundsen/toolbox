/**
 * Excel Style Engine
 *
 * Builds a deduplicated `<Styles>` block for XML Spreadsheet 2003.
 * Collects unique ExcelCellStyle objects, assigns ss:StyleID values,
 * and generates the corresponding XML.
 */

import type { ExcelBorder, ExcelCellStyle, ExcelStyleConfig } from './types';

// #region Style Hashing

/**
 * Produce a deterministic string key for a style object.
 * Two structurally identical styles produce the same hash.
 * Recursively sorts object keys for order-independent comparison.
 */
function hashStyle(style: ExcelCellStyle): string {
  return JSON.stringify(sortKeys(style));
}

/** Recursively sort object keys for deterministic serialization. */
function sortKeys(obj: unknown): unknown {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

// #endregion

// #region Style Registry

/** Maps a hash → style ID and the original style. */
export interface StyleEntry {
  id: string;
  style: ExcelCellStyle;
}

/**
 * Collects unique styles and assigns each an `ss:StyleID`.
 * Register styles via `register()`, then call `getStyleId()` to look up
 * the ID for a given style, and `toXml()` to emit the `<Styles>` block.
 */
export class StyleRegistry {
  /** hash → StyleEntry */
  #entries = new Map<string, StyleEntry>();
  #counter = 0;

  /**
   * Register a style and return its assigned ID.
   * If an identical style was already registered, returns the existing ID.
   */
  register(style: ExcelCellStyle): string {
    const hash = hashStyle(style);
    const existing = this.#entries.get(hash);
    if (existing) return existing.id;

    this.#counter++;
    const id = `s${this.#counter}`;
    this.#entries.set(hash, { id, style });
    return id;
  }

  /** Look up the ID previously assigned to a style (or undefined). */
  getStyleId(style: ExcelCellStyle): string | undefined {
    return this.#entries.get(hashStyle(style))?.id;
  }

  /** Number of unique styles registered so far. */
  get size(): number {
    return this.#entries.size;
  }

  /** Emit the full `<Styles>…</Styles>` XML fragment, or empty string if no styles. */
  toXml(): string {
    if (this.#entries.size === 0) return '';

    let xml = '\n<Styles>';
    for (const { id, style } of this.#entries.values()) {
      xml += buildStyleElement(id, style);
    }
    xml += '\n</Styles>';
    return xml;
  }
}

// #endregion

// #region XML Builders

function buildStyleElement(id: string, style: ExcelCellStyle): string {
  let xml = `\n<Style ss:ID="${id}">`;

  if (style.font) {
    xml += '<Font';
    if (style.font.name) xml += ` ss:FontName="${style.font.name}"`;
    if (style.font.size) xml += ` ss:Size="${style.font.size}"`;
    if (style.font.bold) xml += ' ss:Bold="1"';
    if (style.font.italic) xml += ' ss:Italic="1"';
    if (style.font.color) xml += ` ss:Color="${style.font.color}"`;
    xml += '/>';
  }

  if (style.fill) {
    const pattern = style.fill.pattern ?? 'Solid';
    xml += `<Interior ss:Color="${style.fill.color}" ss:Pattern="${pattern}"/>`;
  }

  if (style.numberFormat) {
    xml += `<NumberFormat ss:Format="${style.numberFormat}"/>`;
  }

  if (style.alignment) {
    xml += '<Alignment';
    if (style.alignment.horizontal) xml += ` ss:Horizontal="${style.alignment.horizontal}"`;
    if (style.alignment.vertical) xml += ` ss:Vertical="${style.alignment.vertical}"`;
    if (style.alignment.wrapText) xml += ' ss:WrapText="1"';
    xml += '/>';
  }

  if (style.borders) {
    xml += '<Borders>';
    if (style.borders.top) xml += buildBorderElement('Top', style.borders.top);
    if (style.borders.bottom) xml += buildBorderElement('Bottom', style.borders.bottom);
    if (style.borders.left) xml += buildBorderElement('Left', style.borders.left);
    if (style.borders.right) xml += buildBorderElement('Right', style.borders.right);
    xml += '</Borders>';
  }

  xml += '</Style>';
  return xml;
}

function buildBorderElement(position: string, border: ExcelBorder): string {
  let xml = `<Border ss:Position="${position}" ss:LineStyle="Continuous" ss:Weight="${borderWeight(border.style)}"`;
  if (border.color) xml += ` ss:Color="${border.color}"`;
  xml += '/>';
  return xml;
}

function borderWeight(style: ExcelBorder['style']): number {
  switch (style) {
    case 'Thin':
      return 1;
    case 'Medium':
      return 2;
    case 'Thick':
      return 3;
  }
}

// #endregion

// #region Style Resolution

/**
 * Build a StyleRegistry pre-populated with all styles declared in the config.
 * This covers headerStyle, defaultStyle, and columnStyles.
 * (cellStyle callbacks are resolved per-cell at render time.)
 */
export function buildStyleRegistry(config: ExcelStyleConfig): StyleRegistry {
  const registry = new StyleRegistry();

  if (config.headerStyle) registry.register(config.headerStyle);

  if (config.defaultStyle) registry.register(config.defaultStyle);

  if (config.columnStyles) {
    for (const style of Object.values(config.columnStyles)) {
      registry.register(style);
    }
  }

  return registry;
}

/**
 * Resolve the style ID for a data cell. Precedence (highest → lowest):
 * 1. cellStyle callback return value
 * 2. columnStyles[field]
 * 3. defaultStyle
 */
export function resolveDataStyleId(
  registry: StyleRegistry,
  config: ExcelStyleConfig,
  value: unknown,
  field: string,
  row: unknown,
): string | undefined {
  // 1. Dynamic cell callback
  if (config.cellStyle) {
    const dynamic = config.cellStyle(value, field, row);
    if (dynamic) {
      // Register on-the-fly (dedup handles repeats)
      return registry.register(dynamic);
    }
  }

  // 2. Per-column override
  const colStyle = config.columnStyles?.[field];
  if (colStyle) return registry.getStyleId(colStyle);

  // 3. Default
  if (config.defaultStyle) return registry.getStyleId(config.defaultStyle);

  return undefined;
}

// #endregion

// #region Column Widths

/** Character width → Excel column width approximation (px ≈ chars × 7) */
const CHAR_WIDTH = 7;

/**
 * Build `<Column>` elements for explicit or auto-fit widths.
 */
export function buildColumnWidthsXml(
  columns: { field: string; header?: string }[],
  rows: Record<string, unknown>[],
  config: ExcelStyleConfig,
): string {
  const widths = config.columnWidths;
  const autoFit = config.autoFitColumns;

  if (!widths && !autoFit) return '';

  let xml = '';
  for (const col of columns) {
    let width: number | undefined = widths?.[col.field];

    if (width == null && autoFit) {
      width = autoFitWidth(col, rows);
    }

    if (width != null) {
      xml += `\n<Column ss:Width="${width * CHAR_WIDTH}"/>`;
    } else {
      // Emit an empty column entry to keep ordinal alignment
      xml += '\n<Column/>';
    }
  }

  return xml;
}

/** Estimate width from header + first N data rows (capped at 50). */
function autoFitWidth(col: { field: string; header?: string }, rows: Record<string, unknown>[]): number {
  const sampleSize = Math.min(rows.length, 50);
  let maxLen = (col.header ?? col.field).length;

  for (let i = 0; i < sampleSize; i++) {
    const val = rows[i][col.field];
    const len = val == null ? 0 : String(val).length;
    if (len > maxLen) maxLen = len;
  }

  // Add a small padding
  return maxLen + 2;
}

// #endregion
