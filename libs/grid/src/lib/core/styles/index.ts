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
import empty from './empty.css?inline';
import header from './header.css?inline';
import icons from './icons.css?inline';
import loading from './loading.css?inline';
import mediaQueries from './media-queries.css?inline';
import rows from './rows.css?inline';
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
 * 6. Loading (spinners, overlays)
 * 7. Empty state (no-rows overlay)
 * 8. Animations (keyframes, transitions)
 * 9. Media Queries (accessibility, responsive)
 *
 * Shell + tool-panel styles are no longer aggregated here — they ship via the
 * auto-registered ShellPlugin's `styles` (extraction #370, Step 1b.1.5),
 * injected in the `tbw-base` layer so the cascade is byte-identical.
 */
export const gridStyles = `@layer tbw-base, tbw-plugins, tbw-theme;

${variables}
${base}
${icons}
${header}
${rows}
${loading}
${empty}
${animations}
${mediaQueries}
`;
