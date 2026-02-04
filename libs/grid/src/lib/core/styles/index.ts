/**
 * Grid Base Styles - Concatenated from partials
 *
 * This module imports all CSS partials and exports them as a single string.
 * Each partial is wrapped in @layer tbw-base for proper cascade ordering.
 *
 * CSS Cascade Layers priority (lowest to highest):
 * - tbw-base: Core grid styles (this file)
 * - tbw-plugins: Plugin styles (override base)
 * - tbw-theme: Theme overrides (override plugins)
 * - Unlayered CSS: User customizations (highest priority - always wins)
 *
 * @module styles
 */

// Import all CSS partials as inline strings (Vite handles ?inline)
import animations from './animations.css?inline';
import base from './base.css?inline';
import header from './header.css?inline';
import loading from './loading.css?inline';
import mediaQueries from './media-queries.css?inline';
import rows from './rows.css?inline';
import shell from './shell.css?inline';
import toolPanel from './tool-panel.css?inline';
import variables from './variables.css?inline';

/**
 * Complete grid base styles.
 *
 * Concatenates all CSS partials in the correct order:
 * 1. Layer declaration (defines cascade order)
 * 2. Variables (CSS custom properties)
 * 3. Base (root element styles)
 * 4. Header (column headers, sort, resize)
 * 5. Rows (data rows and cells)
 * 6. Shell (toolbar, layout)
 * 7. Tool Panel (side panels, accordion)
 * 8. Loading (spinners, overlays)
 * 9. Animations (keyframes, transitions)
 * 10. Media Queries (accessibility, responsive)
 */
export const gridStyles = `/**
 * tbw-grid Light DOM Styles
 *
 * This stylesheet uses CSS nesting to scope all styles to the tbw-grid element.
 * All selectors are automatically prefixed with \`tbw-grid\` for encapsulation.
 *
 * CSS Cascade Layers are used to control style priority:
 * - tbw-base: Core grid styles (lowest priority)
 * - tbw-plugins: Plugin styles (override base)
 * - tbw-theme: Theme overrides (override plugins)
 * - Unlayered CSS: User customizations (highest priority - always wins)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@layer
 */

/* Declare layer order - earlier layers have lower priority */
@layer tbw-base, tbw-plugins, tbw-theme;

${variables}
${base}
${header}
${rows}
${shell}
${toolPanel}
${loading}
${animations}
${mediaQueries}
`;

// Default export for backwards compatibility with `import styles from './grid.css?inline'`
export default gridStyles;
