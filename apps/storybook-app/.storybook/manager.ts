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
