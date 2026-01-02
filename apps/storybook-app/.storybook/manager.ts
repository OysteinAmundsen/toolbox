import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import './manager.css';

// Detect user's preferred color scheme
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Create custom theme with branding
const toolboxTheme = create({
  base: prefersDark ? 'dark' : 'light',
  brandTitle: '@toolbox-web',
  brandUrl: 'https://github.com/OysteinAmundsen/toolbox',
  brandImage: './logo.png',
  brandTarget: '_blank',
});

addons.setConfig({
  theme: toolboxTheme,
  // Show sidebar panel by default (not canvas/docs panel selector)
  initialActive: 'sidebar',
});
