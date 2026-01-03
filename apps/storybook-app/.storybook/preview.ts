import type { Preview } from '@storybook/web-components';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github-dark.min.css';
import { themes } from 'storybook/theming';
import './storybook-styles.css';

// Import grid component class to ensure custom element registration side-effect runs
// We import the class (not just the module) to prevent tree-shaking
import { DataGridElement } from '../../../libs/grid/src/index';

// Force the import to be retained by referencing it
if (typeof DataGridElement === 'undefined') {
  console.error('Grid component failed to load');
}

// Auto-import all theme CSS files from the themes directory
// Adding a new theme file automatically makes it available
const themeModules = import.meta.glob('../../../libs/themes/dg-theme-*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// Build THEME_MAP from glob results: extract theme name from filename
// e.g., '../../../libs/themes/dg-theme-contrast.css' -> 'contrast'
const THEME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(themeModules).map(([path, css]) => {
    const match = path.match(/dg-theme-(\w+)\.css$/);
    const themeName = match?.[1] ?? 'unknown';
    return [themeName, css];
  }),
);

// Build toolbar items dynamically from available themes
const themeToolbarItems = [
  { value: 'default', title: 'Default (Built-in)' },
  ...Object.keys(THEME_MAP).map((name) => ({
    value: name,
    title: name.charAt(0).toUpperCase() + name.slice(1),
  })),
];

// Register languages for syntax highlighting
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);

function applyTheme(name: string) {
  const id = 'dg-active-theme-style';
  if (name === 'default') {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    return; // rely on component's bundled internal styles only
  }
  let styleEl = document.getElementById(id) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = id;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = THEME_MAP[name] || THEME_MAP.standard;
}

const preview: Preview = {
  // Stories are embedded in MDX docs pages (docsMode: true in main.ts)
  // No autodocs tag needed - MDX pages control documentation structure
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    // Configure storybook-dark-mode addon
    darkMode: {
      dark: { ...themes.dark },
      light: { ...themes.light },
      // Apply dark/light class to preview iframe for CSS targeting
      stylePreview: true,
      classTarget: 'html',
    },
    options: {
      // Control sidebar navigation order
      storySort: {
        order: [
          'Grid',
          [
            'Introduction',
            'Getting Started',
            'Core', // Core grid stories
            'Theming',
            'Plugins', // Plugin overview and individual plugins
            ['Overview', 'Selection', 'Filtering', 'Multi Sort', 'Grouping Rows', 'Grouping Columns', '*'],
            'API Reference',
            'All Features',
            'Benchmarks', // Performance tests at the end
            '*', // Everything else alphabetically
          ],
          '*',
        ],
      },
    },
    docs: {
      // Enable table of contents for documentation pages
      toc: {
        contentsSelector: '.sbdocs-content',
        headingSelector: 'h2, h3',
        title: 'On this page',
      },
      extractComponentDescription: (component: any, { notes }: any) => {
        if (notes) {
          return typeof notes === 'string' ? notes : notes.markdown || notes.text;
        }
        return null;
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'standard',
      toolbar: {
        icon: 'paintbrush',
        items: themeToolbarItems,
        dynamicTitle: true,
        showName: true,
      },
    },
  },
  decorators: [
    // Apply theme styles + syntax highlighting
    (story: any, context: any) => {
      applyTheme(context.globals.theme || 'standard');
      const html = story();
      queueMicrotask(() => {
        document.querySelectorAll('pre code.hljs').forEach((el) => {
          try {
            hljs.highlightElement(el as HTMLElement);
          } catch {}
        });
      });
      return html;
    },
  ],
};

export default preview;
