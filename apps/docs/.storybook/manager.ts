import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import './manager.css';

// Create theme based on color scheme
const createToolboxTheme = (dark: boolean) =>
  create({
    base: dark ? 'dark' : 'light',
    brandTitle: '@toolbox-web',
    brandUrl: 'https://github.com/OysteinAmundsen/toolbox',
    brandImage: dark ? './logo_dark.svg' : './logo_light.svg',
    brandTarget: '_blank',
  });

// Detect user's preferred color scheme for initial branding theme
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

addons.setConfig({
  theme: createToolboxTheme(darkModeQuery.matches),
  // Show sidebar panel by default (not canvas/docs panel selector)
  initialActive: 'sidebar',
});

// Listen for system theme changes and update config
darkModeQuery.addEventListener('change', (e) => {
  addons.setConfig({
    theme: createToolboxTheme(e.matches),
  });
});

// SEO: Update document title based on current story/doc
// Format: "Page Title | Category | Toolbox"
const SITE_SUFFIX = 'Toolbox';

/**
 * Converts a Storybook title to an SEO-friendly document title.
 * Storybook sets titles like "Grid/Introduction ⋅ Storybook" or "Selection ⋅ Storybook"
 * We transform to: "Introduction | Grid | Toolbox"
 */
function formatDocumentTitle(storybookTitle: string): string {
  // Strip Storybook suffix if present
  let title = storybookTitle.replace(/\s*[⋅·-]\s*Storybook\s*$/i, '').trim();
  if (!title) return SITE_SUFFIX;

  // Remove "- Docs" suffix that Storybook adds to doc pages
  title = title.replace(/\s*-\s*Docs\s*$/i, '').trim();

  // Split by / or ⋅ (Storybook uses both depending on context)
  const parts = title
    .split(/[/⋅·]/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Reverse to get "Page | Parent | Grandparent" format, then add suffix
  const reversed = parts.reverse();
  return `${reversed.join(' | ')} | ${SITE_SUFFIX}`;
}

// Use MutationObserver to intercept Storybook's title changes
// This is more reliable than events since Storybook manages its own title
let isUpdatingTitle = false;

const titleObserver = new MutationObserver(() => {
  if (isUpdatingTitle) return; // Prevent infinite loop

  const currentTitle = document.title;
  // Skip if already formatted (ends with our suffix)
  if (currentTitle.endsWith(SITE_SUFFIX)) return;

  isUpdatingTitle = true;
  document.title = formatDocumentTitle(currentTitle);
  isUpdatingTitle = false;
});

// Start observing once the title element exists
const startObserving = () => {
  const titleEl = document.querySelector('title');
  if (titleEl) {
    // Set initial title
    document.title = formatDocumentTitle(document.title);
    // Watch for changes
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  } else {
    // Title element not ready yet, try again
    setTimeout(startObserving, 50);
  }
};

startObserving();
