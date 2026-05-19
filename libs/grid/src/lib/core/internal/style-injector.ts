/**
 * Style Injector Module
 *
 * Handles injection of grid and plugin styles into the document.
 * Uses a singleton pattern to avoid duplicate injection across multiple grid instances.
 *
 * ## Multi-version coexistence
 *
 * The style element ID is scoped to the registered tag name
 * (`tbw-grid-styles-<activeTag>`) so that a second `@toolbox-web/grid` bundle
 * loaded under a version-suffixed tag (e.g. `tbw-grid-v2-11-0`, see
 * `DataGridElement.activeTag`) creates its OWN `<style>` element rather than
 * overwriting the first bundle's. Each bundle's CSS is also rewritten at
 * injection time to target its own active tag, so a suffixed grid still
 * picks up its bundle's styles. Issue #339.
 *
 * @module internal/style-injector
 */
import { DataGridElement } from '../grid';
import { STYLE_EXTRACT_FAILED, STYLE_NOT_FOUND, warnDiagnostic } from './diagnostics';

// #region State
/** Base ID for the consolidated grid stylesheet in document.head */
const STYLE_ELEMENT_ID_BASE = 'tbw-grid-styles';

/** Track injected base styles CSS text (per this module instance / bundle) */
let baseStyles = '';

/** Track injected plugin styles by plugin name (accumulates across all grid instances in this bundle) */
const pluginStylesMap = new Map<string, string>();
// #endregion

// #region Internal Helpers
/**
 * Resolve the per-bundle style element ID. When the grid registered under
 * a version-suffixed tag, the style element ID includes that suffix so
 * bundles can coexist without overwriting each other's styles.
 */
function getStyleElementId(): string {
  const tag = DataGridElement.activeTag;
  return tag === DataGridElement.tagName ? STYLE_ELEMENT_ID_BASE : `${STYLE_ELEMENT_ID_BASE}-${tag}`;
}

/**
 * Get or create the consolidated style element in document.head.
 * All grid and plugin styles are combined into this single element.
 */
function getStyleElement(): HTMLStyleElement {
  const id = getStyleElementId();
  let styleEl = document.getElementById(id) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = id;
    styleEl.setAttribute('data-tbw-grid', 'true');
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

/**
 * Rewrite occurrences of the bare `tbw-grid` tag name in a CSS string so that
 * the bundle's stylesheet targets its actual registered tag (`activeTag`).
 *
 * The match is bounded on both sides:
 *  - Negative lookbehind on `[-\w]` excludes `tbw-grid` that follows a `-`
 *    or word character, most importantly inside the attribute selector
 *    `[data-tbw-grid]`. (A plain `\b` would happily match between `-` and
 *    `t` and corrupt the selector to `[data-tbw-grid-v<…>]`.)
 *  - Negative lookahead on `[-\w]` excludes longer light-DOM tags like
 *    `tbw-grid-detail`, `tbw-grid-column`, `tbw-grid-tool-panel`.
 *
 * No-op when `activeTag === 'tbw-grid'` (the common single-version case).
 */
function rewriteTagSelectors(css: string): string {
  const tag = DataGridElement.activeTag;
  if (tag === DataGridElement.tagName) return css;
  return css.replace(/(?<![-\w])tbw-grid(?![-\w])/g, tag);
}

/**
 * Update the consolidated stylesheet with current base + plugin styles.
 */
function updateStyleElement(): void {
  const styleEl = getStyleElement();
  // Combine base styles and all accumulated plugin styles
  const pluginStyles = Array.from(pluginStylesMap.values()).join('\n');
  styleEl.textContent = `${baseStyles}\n\n/* Plugin Styles */\n${pluginStyles}`;
}
// #endregion

// #region Public API
/**
 * Add plugin styles to the accumulated plugin styles map.
 * Returns true if any new styles were added.
 */
export function addPluginStyles(pluginStyles: Array<{ name: string; styles: string }>): boolean {
  let hasNewStyles = false;

  for (const { name, styles } of pluginStyles) {
    if (!pluginStylesMap.has(name)) {
      pluginStylesMap.set(name, rewriteTagSelectors(styles));
      hasNewStyles = true;
    }
  }

  if (hasNewStyles) {
    updateStyleElement();
  }

  return hasNewStyles;
}

/**
 * Extract grid CSS from document.styleSheets (Angular fallback).
 * Angular bundles CSS files into one stylesheet, so we search for it.
 */
export function extractGridCssFromDocument(): string | null {
  try {
    // Try to find the stylesheet containing grid CSS
    // Angular bundles all CSS files from angular.json styles array into one stylesheet
    for (const stylesheet of Array.from(document.styleSheets)) {
      try {
        // For inline/bundled stylesheets, check if it contains grid CSS
        const rules = Array.from(stylesheet.cssRules || []);
        const cssText = rules.map((rule) => rule.cssText).join('\n');

        // Check if this stylesheet contains grid CSS by looking for distinctive selectors
        // Without Shadow DOM, we look for tbw-grid nesting selectors
        if (cssText.includes('.tbw-grid-root') && cssText.includes('tbw-grid')) {
          // Found the bundled stylesheet with grid CSS - use ALL of it
          // This includes core grid.css + all plugin CSS files
          return cssText;
        }
      } catch {
        // CORS or access restriction - skip
        continue;
      }
    }
  } catch (err) {
    warnDiagnostic(STYLE_EXTRACT_FAILED, `Failed to extract grid.css from document stylesheets: ${err}`);
  }

  return null;
}

/**
 * Inject grid styles into the document.
 * All styles go into a single <style id="tbw-grid-styles"> element in document.head.
 * Uses a singleton pattern to avoid duplicate injection across multiple grid instances.
 *
 * @param inlineStyles - CSS string from Vite ?inline import (may be empty in Angular)
 */
export async function injectStyles(inlineStyles: string): Promise<void> {
  // If base styles already injected, nothing to do
  if (baseStyles) {
    return;
  }

  // If styles is a string (from ?inline import in Vite builds), use it directly
  if (typeof inlineStyles === 'string' && inlineStyles.length > 0) {
    baseStyles = rewriteTagSelectors(inlineStyles);
    updateStyleElement();
    return;
  }

  // Fallback: styles is undefined (e.g., when imported in Angular from source without Vite processing)
  // Angular includes grid.css in global styles - extract it from document.styleSheets
  // Wait a bit for Angular to finish loading styles
  await new Promise((resolve) => setTimeout(resolve, 50));

  const gridCssText = extractGridCssFromDocument();

  if (gridCssText) {
    baseStyles = rewriteTagSelectors(gridCssText);
    updateStyleElement();
  } else if (typeof process === 'undefined' || process.env?.['NODE_ENV'] !== 'test') {
    // Only warn in non-test environments - test environments (happy-dom, jsdom) don't load stylesheets
    warnDiagnostic(
      STYLE_NOT_FOUND,
      'Could not find grid.css in document.styleSheets. Grid styling will not work. ' +
        `Available stylesheets: ${Array.from(document.styleSheets)
          .map((s) => s.href || '(inline)')
          .join(', ')}`,
    );
  }
}
// #endregion

// #region Testing
/**
 * Reset style injector state (for testing purposes only).
 * @internal
 */
export function _resetForTesting(): void {
  baseStyles = '';
  pluginStylesMap.clear();
  // Remove every per-tag style element (single-version uses the base id; the
  // multi-version test plants suffixed ids as well).
  for (const el of Array.from(document.querySelectorAll(`style[id^="${STYLE_ELEMENT_ID_BASE}"]`))) {
    el.remove();
  }
}
// #endregion
