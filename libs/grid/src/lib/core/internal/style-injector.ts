/**
 * Style Injector Module
 *
 * Handles injection of grid and plugin styles into the document.
 * Uses a singleton pattern to avoid duplicate injection across multiple grid instances.
 *
 * @module internal/style-injector
 */

/** ID for the consolidated grid stylesheet in document.head */
const STYLE_ELEMENT_ID = 'tbw-grid-styles';

/** Track injected base styles CSS text */
let baseStyles = '';

/** Track injected plugin styles by plugin name (accumulates across all grid instances) */
const pluginStylesMap = new Map<string, string>();

/**
 * Get or create the consolidated style element in document.head.
 * All grid and plugin styles are combined into this single element.
 */
function getStyleElement(): HTMLStyleElement {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
    styleEl.setAttribute('data-tbw-grid', 'true');
    document.head.appendChild(styleEl);
  }
  return styleEl;
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

/**
 * Check if base styles have already been injected.
 */
export function hasBaseStyles(): boolean {
  return baseStyles.length > 0;
}

/**
 * Set base styles directly (for Vite builds with ?inline import).
 */
export function setBaseStyles(css: string): void {
  baseStyles = css;
  updateStyleElement();
}

/**
 * Add plugin styles to the accumulated plugin styles map.
 * Returns true if any new styles were added.
 */
export function addPluginStyles(pluginStyles: Array<{ name: string; styles: string }>): boolean {
  let hasNewStyles = false;

  for (const { name, styles } of pluginStyles) {
    if (!pluginStylesMap.has(name)) {
      pluginStylesMap.set(name, styles);
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
    console.warn('[tbw-grid] Failed to extract grid.css from document stylesheets:', err);
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
    baseStyles = inlineStyles;
    updateStyleElement();
    return;
  }

  // Fallback: styles is undefined (e.g., when imported in Angular from source without Vite processing)
  // Angular includes grid.css in global styles - extract it from document.styleSheets
  // Wait a bit for Angular to finish loading styles
  await new Promise((resolve) => setTimeout(resolve, 50));

  const gridCssText = extractGridCssFromDocument();

  if (gridCssText) {
    baseStyles = gridCssText;
    updateStyleElement();
  } else if (typeof process === 'undefined' || process.env?.['NODE_ENV'] !== 'test') {
    // Only warn in non-test environments - test environments (happy-dom, jsdom) don't load stylesheets
    console.warn(
      '[tbw-grid] Could not find grid.css in document.styleSheets. Grid styling will not work.',
      'Available stylesheets:',
      Array.from(document.styleSheets).map((s) => s.href || '(inline)'),
    );
  }
}

/**
 * Reset style injector state (for testing purposes only).
 * @internal
 */
export function _resetForTesting(): void {
  baseStyles = '';
  pluginStylesMap.clear();
  const styleEl = document.getElementById(STYLE_ELEMENT_ID);
  styleEl?.remove();
}
