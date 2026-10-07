/**
 * What a plugin adds to the core grid. Each plugin page declares its kinds in the
 * `pluginKinds` frontmatter field; `PageTitle.astro` renders them as chips.
 */

export const PLUGIN_KIND_NAMES = [
  'structural',
  'functional',
  'visual',
  'performance',
  'data-source',
  'chrome',
  'composite',
] as const;

export type PluginKind = (typeof PLUGIN_KIND_NAMES)[number];

export const PLUGIN_KIND_INFO: Record<PluginKind, { label: string; description: string }> = {
  structural: {
    label: 'Structural',
    description: 'Changes the shape of the grid: which rows or columns exist, how they nest, or where they sit.',
  },
  functional: {
    label: 'Functional',
    description: 'Adds behaviour, interaction, or data operations without changing the shape of the grid.',
  },
  visual: {
    label: 'Visual',
    description: 'Changes presentation only. Data and behaviour stay the same.',
  },
  performance: {
    label: 'Performance',
    description: 'Changes how the grid renders, with no visible effect on the result.',
  },
  'data-source': {
    label: 'Data source',
    description: 'Changes where rows come from, not how they look or behave.',
  },
  chrome: {
    label: 'Chrome',
    description: 'Adds UI around the grid, such as a toolbar or tool panels.',
  },
  composite: {
    label: 'Composite',
    description: 'Bundles several plugins into one.',
  },
};
