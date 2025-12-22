import type { Preview } from '@storybook/web-components';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/github-dark.min.css';
import './storybook-styles.css';

// Import grid component class to ensure custom element registration side-effect runs
// We import the class (not just the module) to prevent tree-shaking
import { DataGridElement } from '../../../libs/grid/src/index';

// Force the import to be retained by referencing it
if (typeof DataGridElement === 'undefined') {
  console.error('Grid component failed to load');
}

// Static raw imports for themes using relative paths
import contrastCss from '../../../libs/themes/dg-theme-contrast.css?raw';
import largeCss from '../../../libs/themes/dg-theme-large.css?raw';
import standardCss from '../../../libs/themes/dg-theme-standard.css?raw';
import vibrantCss from '../../../libs/themes/dg-theme-vibrant.css?raw';

// Register languages for syntax highlighting
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);

const THEME_MAP: Record<string, string> = {
  standard: standardCss,
  contrast: contrastCss,
  vibrant: vibrantCss,
  large: largeCss,
};

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
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
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
        items: [
          { value: 'default', title: 'Default (Built-in)' },
          { value: 'standard', title: 'Standard' },
          { value: 'contrast', title: 'High Contrast' },
          { value: 'large', title: 'Large' },
          { value: 'vibrant', title: 'Vibrant' },
        ],
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
