/**
 * Central registry of all @toolbox-web/grid CSS custom properties.
 *
 * Both ThemeBuilder and CSSVariableReference import from this file.
 * Run `bun apps/docs/scripts/validate-css-variables.ts` to check
 * that the registry covers every --tbw-* variable found in the CSS source.
 */

export interface CSSVariableDefinition {
  name: string;
  defaultValue: string;
  description: string;
  type: 'color' | 'size' | 'font' | 'number' | 'select' | 'padding';
  options?: string[];
}

export const CSS_VARIABLES: Record<string, CSSVariableDefinition[]> = {
  // ── Core ───────────────────────────────────────────────────────────────

  'Core Colors': [
    { name: '--tbw-color-bg', defaultValue: 'transparent', description: 'Grid background', type: 'color' },
    { name: '--tbw-color-panel-bg', defaultValue: '#eeeeee', description: 'Panel backgrounds', type: 'color' },
    { name: '--tbw-color-fg', defaultValue: '#222222', description: 'Primary text color', type: 'color' },
    { name: '--tbw-color-fg-muted', defaultValue: '#555555', description: 'Secondary text', type: 'color' },
    {
      name: '--tbw-color-accent',
      defaultValue: '#3b82f6',
      description: 'Accent color (focus, selection)',
      type: 'color',
    },
    { name: '--tbw-color-accent-fg', defaultValue: '#ffffff', description: 'Text on accent', type: 'color' },
    { name: '--tbw-color-success', defaultValue: '#4caf50', description: 'Success state', type: 'color' },
    { name: '--tbw-color-warning', defaultValue: '#e6a200', description: 'Warning state', type: 'color' },
    { name: '--tbw-color-error', defaultValue: '#f44336', description: 'Error state', type: 'color' },
    { name: '--tbw-color-shadow', defaultValue: 'rgba(0,0,0,0.1)', description: 'Box‑shadow color', type: 'color' },
  ],

  'Row & Cell Colors': [
    { name: '--tbw-color-selection', defaultValue: '#fff7d6', description: 'Selection background', type: 'color' },
    { name: '--tbw-color-row-alt', defaultValue: 'transparent', description: 'Alternating row color', type: 'color' },
    { name: '--tbw-color-row-hover', defaultValue: '#f0f6ff', description: 'Row hover color', type: 'color' },
    { name: '--tbw-color-active-row-bg', defaultValue: '#fff7d6', description: 'Active row background', type: 'color' },
  ],

  Header: [
    { name: '--tbw-color-header-bg', defaultValue: '#e0e0e0', description: 'Header background', type: 'color' },
    { name: '--tbw-color-header-fg', defaultValue: '#333333', description: 'Header text color', type: 'color' },
    {
      name: '--tbw-color-header-separator',
      defaultValue: '#d0d0d4',
      description: 'Header column separator',
      type: 'color',
    },
    {
      name: '--tbw-color-header-group-fg',
      defaultValue: '#333333',
      description: 'Column group header text',
      type: 'color',
    },
    { name: '--tbw-header-height', defaultValue: '1.875em', description: 'Header row height', type: 'size' },
    { name: '--tbw-font-size-header', defaultValue: '1em', description: 'Header font size', type: 'size' },
    {
      name: '--tbw-font-weight-header',
      defaultValue: 'bold',
      description: 'Header font weight',
      type: 'select',
      options: ['normal', 'bold', '500', '600', '700'],
    },
    {
      name: '--tbw-font-weight-header-group',
      defaultValue: 'bold',
      description: 'Column group font weight',
      type: 'select',
      options: ['normal', 'bold', '500', '600', '700'],
    },
    {
      name: '--tbw-header-text-transform',
      defaultValue: 'none',
      description: 'Header text transform',
      type: 'select',
      options: ['none', 'uppercase', 'lowercase', 'capitalize'],
    },
    { name: '--tbw-header-letter-spacing', defaultValue: 'normal', description: 'Header letter spacing', type: 'size' },
    {
      name: '--tbw-align-header',
      defaultValue: 'flex-start',
      description: 'Header content alignment',
      type: 'select',
      options: ['flex-start', 'center', 'flex-end'],
    },
    {
      name: '--tbw-align-header-group',
      defaultValue: 'flex-start',
      description: 'Column group alignment',
      type: 'select',
      options: ['flex-start', 'center', 'flex-end'],
    },
  ],

  Borders: [
    { name: '--tbw-color-border', defaultValue: '#d0d0d4', description: 'Default border color', type: 'color' },
    { name: '--tbw-color-border-strong', defaultValue: '#777777', description: 'Strong border color', type: 'color' },
    { name: '--tbw-color-border-cell', defaultValue: '#d0d0d4', description: 'Cell border color', type: 'color' },
    { name: '--tbw-color-border-header', defaultValue: '#d0d0d4', description: 'Header border color', type: 'color' },
    { name: '--tbw-border-radius', defaultValue: '0.25em', description: 'Border radius', type: 'size' },
    { name: '--tbw-border-width', defaultValue: '1px', description: 'Default border width', type: 'size' },
    {
      name: '--tbw-border-style',
      defaultValue: 'solid',
      description: 'Default border style',
      type: 'select',
      options: ['solid', 'dashed', 'dotted', 'none'],
    },
    { name: '--tbw-border-input', defaultValue: '1px solid #777', description: 'Input border shorthand', type: 'size' },
    {
      name: '--tbw-border-header',
      defaultValue: '1px solid #d0d0d4',
      description: 'Header border shorthand',
      type: 'size',
    },
    { name: '--tbw-row-divider', defaultValue: '1px solid #d0d0d4', description: 'Row divider border', type: 'size' },
    { name: '--tbw-row-hover-outline', defaultValue: '0', description: 'Row hover outline', type: 'size' },
    { name: '--tbw-active-row-outline', defaultValue: '0', description: 'Active row outline', type: 'size' },
  ],

  Typography: [
    {
      name: '--tbw-font-family',
      defaultValue: 'inherit',
      description: 'Font family',
      type: 'select',
      options: [
        'inherit',
        'system-ui',
        'Arial, sans-serif',
        '"Segoe UI", sans-serif',
        '"Roboto", sans-serif',
        '"Inter", sans-serif',
        'monospace',
      ],
    },
    { name: '--tbw-font-size', defaultValue: '1em', description: 'Base font size', type: 'size' },
    { name: '--tbw-font-size-sm', defaultValue: '0.9285em', description: 'Small font size', type: 'size' },
    { name: '--tbw-font-size-xs', defaultValue: '0.7857em', description: 'Extra small font size', type: 'size' },
    { name: '--tbw-font-size-2xs', defaultValue: '0.7142em', description: 'Extra‑extra small font size', type: 'size' },
  ],

  Spacing: [
    { name: '--tbw-spacing-xs', defaultValue: '0.25em', description: 'Extra small spacing', type: 'size' },
    { name: '--tbw-spacing-sm', defaultValue: '0.375em', description: 'Small spacing', type: 'size' },
    { name: '--tbw-spacing-md', defaultValue: '0.5em', description: 'Medium spacing', type: 'size' },
    { name: '--tbw-spacing-lg', defaultValue: '0.75em', description: 'Large spacing', type: 'size' },
    { name: '--tbw-spacing-xl', defaultValue: '1em', description: 'Extra large spacing', type: 'size' },
    { name: '--tbw-cell-padding', defaultValue: '0.25em 0.5em', description: 'Cell padding', type: 'padding' },
    { name: '--tbw-cell-padding-v', defaultValue: '0.25em', description: 'Cell vertical padding', type: 'size' },
    { name: '--tbw-cell-padding-h', defaultValue: '0.5em', description: 'Cell horizontal padding', type: 'size' },
    {
      name: '--tbw-cell-padding-header',
      defaultValue: '0.25em 0.5em',
      description: 'Header cell padding',
      type: 'padding',
    },
    {
      name: '--tbw-cell-padding-input',
      defaultValue: '0.25em 0.375em',
      description: 'Input cell padding',
      type: 'padding',
    },
  ],

  'Row & Cell Dimensions': [
    { name: '--tbw-row-height', defaultValue: '1.75em', description: 'Row height', type: 'size' },
    {
      name: '--tbw-cell-white-space',
      defaultValue: 'nowrap',
      description: 'Cell text wrapping',
      type: 'select',
      options: ['nowrap', 'normal', 'pre', 'pre-wrap'],
    },
    { name: '--tbw-density-scale', defaultValue: '1', description: 'Density multiplier', type: 'number' },
  ],

  'Focus & Selection': [
    { name: '--tbw-focus-outline-width', defaultValue: '2px', description: 'Focus ring width', type: 'size' },
    { name: '--tbw-focus-outline', defaultValue: '2px solid #3b82f6', description: 'Focus ring style', type: 'size' },
    { name: '--tbw-focus-outline-offset', defaultValue: '-2px', description: 'Focus ring offset', type: 'size' },
    {
      name: '--tbw-focus-background',
      defaultValue: 'rgba(59,130,246,0.12)',
      description: 'Focused cell background tint',
      type: 'color',
    },
    { name: '--tbw-range-border-color', defaultValue: '#3b82f6', description: 'Range selection border', type: 'color' },
    {
      name: '--tbw-range-selection-bg',
      defaultValue: 'rgba(59,130,246,0.12)',
      description: 'Range selection background',
      type: 'color',
    },
  ],

  Icons: [
    { name: '--tbw-base-icon-size', defaultValue: '1em', description: 'Base icon size (bulk override)', type: 'size' },
    { name: '--tbw-icon-size', defaultValue: '1em', description: 'Icon size', type: 'size' },
    { name: '--tbw-icon-size-sm', defaultValue: '0.875em', description: 'Small icon size', type: 'size' },
    { name: '--tbw-checkbox-size', defaultValue: '1em', description: 'Checkbox size', type: 'size' },
    { name: '--tbw-toggle-size', defaultValue: '1.25em', description: 'Toggle icon size', type: 'size' },
  ],

  'Resize Handle': [
    { name: '--tbw-resize-handle-width', defaultValue: '2px', description: 'Resize handle width', type: 'size' },
    {
      name: '--tbw-resize-handle-color',
      defaultValue: 'transparent',
      description: 'Resize handle color',
      type: 'color',
    },
    {
      name: '--tbw-resize-handle-color-hover',
      defaultValue: '#3b82f6',
      description: 'Resize handle hover color',
      type: 'color',
    },
    {
      name: '--tbw-resize-handle-border-radius',
      defaultValue: '0',
      description: 'Resize handle corner radius',
      type: 'size',
    },
    { name: '--tbw-resize-indicator-width', defaultValue: '2px', description: 'Resize indicator width', type: 'size' },
    {
      name: '--tbw-resize-indicator-color',
      defaultValue: '#3b82f6',
      description: 'Resize indicator color',
      type: 'color',
    },
    {
      name: '--tbw-resize-indicator-opacity',
      defaultValue: '0.6',
      description: 'Resize indicator opacity',
      type: 'number',
    },
    { name: '--tbw-resize-hit-area', defaultValue: '6px', description: 'Resize handle clickable area', type: 'size' },
  ],

  Animation: [
    { name: '--tbw-transition-duration', defaultValue: '120ms', description: 'Transition duration', type: 'size' },
    {
      name: '--tbw-transition-ease',
      defaultValue: 'ease',
      description: 'Transition easing',
      type: 'select',
      options: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'],
    },
    { name: '--tbw-animation-duration', defaultValue: '200ms', description: 'Animation duration', type: 'size' },
    {
      name: '--tbw-animation-easing',
      defaultValue: 'ease-out',
      description: 'Animation easing',
      type: 'select',
      options: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'],
    },
    {
      name: '--tbw-animation-enabled',
      defaultValue: '1',
      description: 'Enable animations (0 to disable)',
      type: 'select',
      options: ['1', '0'],
    },
    {
      name: '--tbw-row-change-duration',
      defaultValue: '500ms',
      description: 'Row change highlight duration',
      type: 'size',
    },
    {
      name: '--tbw-row-insert-duration',
      defaultValue: '300ms',
      description: 'Row insert animation duration',
      type: 'size',
    },
    {
      name: '--tbw-row-remove-duration',
      defaultValue: '200ms',
      description: 'Row remove animation duration',
      type: 'size',
    },
    {
      name: '--tbw-row-change-color',
      defaultValue: 'rgba(59,130,246,0.25)',
      description: 'Row change highlight color',
      type: 'color',
    },
  ],

  'Sorting Indicators': [
    { name: '--tbw-sort-indicator-color', defaultValue: '#555555', description: 'Sort indicator color', type: 'color' },
    {
      name: '--tbw-sort-indicator-active-color',
      defaultValue: '#3b82f6',
      description: 'Active sort indicator',
      type: 'color',
    },
    {
      name: '--tbw-sort-indicator-display',
      defaultValue: 'inline-flex',
      description: 'Sort indicator display',
      type: 'select',
      options: ['inline-flex', 'none'],
    },
    {
      name: '--tbw-sort-indicator-visibility',
      defaultValue: 'visible',
      description: 'Sort indicator visibility',
      type: 'select',
      options: ['visible', 'hidden'],
    },
  ],

  'Shell & Panels': [
    { name: '--tbw-shell-header-height', defaultValue: '2.75em', description: 'Shell header height', type: 'size' },
    { name: '--tbw-shell-header-bg', defaultValue: '#eeeeee', description: 'Shell header background', type: 'color' },
    {
      name: '--tbw-shell-header-border',
      defaultValue: '#d0d0d4',
      description: 'Shell header border color',
      type: 'color',
    },
    { name: '--tbw-shell-title-font-size', defaultValue: '1em', description: 'Shell title font size', type: 'size' },
    {
      name: '--tbw-shell-title-font-weight',
      defaultValue: '600',
      description: 'Shell title font weight',
      type: 'select',
      options: ['normal', 'bold', '500', '600', '700'],
    },
    { name: '--tbw-tool-panel-width', defaultValue: '17.5em', description: 'Tool panel width', type: 'size' },
    { name: '--tbw-tool-panel-bg', defaultValue: '#eeeeee', description: 'Tool panel background', type: 'color' },
    { name: '--tbw-tool-panel-border', defaultValue: '#d0d0d4', description: 'Tool panel border color', type: 'color' },
    {
      name: '--tbw-tool-panel-header-height',
      defaultValue: '2.5em',
      description: 'Tool panel header height',
      type: 'size',
    },
    {
      name: '--tbw-tool-panel-transition',
      defaultValue: '200ms ease-out',
      description: 'Tool panel open/close transition',
      type: 'size',
    },
    { name: '--tbw-toolbar-button-size', defaultValue: '2em', description: 'Toolbar button size', type: 'size' },
    { name: '--tbw-toolbar-button-gap', defaultValue: '0.25em', description: 'Toolbar button gap', type: 'size' },
  ],

  'Component Shortcuts': [
    { name: '--tbw-panel-padding', defaultValue: '0.75em', description: 'Panel content padding', type: 'size' },
    { name: '--tbw-panel-gap', defaultValue: '0.5em', description: 'Panel content gap', type: 'size' },
    {
      name: '--tbw-menu-item-padding',
      defaultValue: '0.375em 0.75em',
      description: 'Menu item padding',
      type: 'padding',
    },
    { name: '--tbw-menu-item-gap', defaultValue: '0.5em', description: 'Menu item gap', type: 'size' },
    { name: '--tbw-menu-min-width', defaultValue: '10rem', description: 'Menu minimum width', type: 'size' },
    { name: '--tbw-button-padding', defaultValue: '0.375em 0.75em', description: 'Button padding', type: 'padding' },
    {
      name: '--tbw-button-padding-sm',
      defaultValue: '0.25em 0.5em',
      description: 'Small button padding',
      type: 'padding',
    },
    { name: '--tbw-input-height', defaultValue: '1.75em', description: 'Input height', type: 'size' },
    { name: '--tbw-input-padding', defaultValue: '0 0.5em', description: 'Input padding', type: 'padding' },
    { name: '--tbw-detail-padding', defaultValue: '1em', description: 'Detail row padding', type: 'size' },
    { name: '--tbw-detail-max-height', defaultValue: '31.25rem', description: 'Detail row max height', type: 'size' },
    { name: '--tbw-indicator-size', defaultValue: '0.375em', description: 'Indicator dot size', type: 'size' },
  ],

  Scrollbar: [
    { name: '--tbw-scrollbar-thumb', defaultValue: '#c5c8ce', description: 'Scrollbar thumb color', type: 'color' },
    { name: '--tbw-scrollbar-track', defaultValue: 'transparent', description: 'Scrollbar track color', type: 'color' },
  ],

  // ── Plugins ────────────────────────────────────────────────────────────

  'Loading Spinner': [
    { name: '--tbw-spinner-size', defaultValue: '48px', description: 'Spinner size (grid-level)', type: 'size' },
    { name: '--tbw-spinner-border-width', defaultValue: '3px', description: 'Spinner border thickness', type: 'size' },
    { name: '--tbw-spinner-color', defaultValue: '#3b82f6', description: 'Spinner active color', type: 'color' },
    { name: '--tbw-spinner-track-color', defaultValue: '#d0d0d4', description: 'Spinner track color', type: 'color' },
  ],

  'Context Menu (Plugin)': [
    { name: '--tbw-context-menu-bg', defaultValue: '#ffffff', description: 'Context menu background', type: 'color' },
    { name: '--tbw-context-menu-fg', defaultValue: '#333333', description: 'Context menu text color', type: 'color' },
    {
      name: '--tbw-context-menu-border',
      defaultValue: '#e0e0e0',
      description: 'Context menu border color',
      type: 'color',
    },
    {
      name: '--tbw-context-menu-hover',
      defaultValue: '#f5f5f5',
      description: 'Context menu item hover',
      type: 'color',
    },

    { name: '--tbw-context-menu-muted', defaultValue: '#555555', description: 'Muted text (shortcuts)', type: 'color' },
    { name: '--tbw-context-menu-danger', defaultValue: '#f44336', description: 'Danger action color', type: 'color' },
    { name: '--tbw-context-menu-radius', defaultValue: '4px', description: 'Menu border radius', type: 'size' },
    {
      name: '--tbw-context-menu-shadow',
      defaultValue: '0 2px 10px rgba(0,0,0,0.1)',
      description: 'Menu box shadow',
      type: 'size',
    },
    { name: '--tbw-context-menu-min-width', defaultValue: '160px', description: 'Minimum menu width', type: 'size' },

    { name: '--tbw-context-menu-font-size', defaultValue: '0.9285em', description: 'Menu font size', type: 'size' },
    { name: '--tbw-context-menu-font-family', defaultValue: 'inherit', description: 'Menu font family', type: 'font' },
    {
      name: '--tbw-context-menu-item-padding',
      defaultValue: '0.375em 0.75em',
      description: 'Menu item padding',
      type: 'padding',
    },
    { name: '--tbw-context-menu-item-gap', defaultValue: '0.5em', description: 'Menu item gap', type: 'size' },
    { name: '--tbw-context-menu-icon-size', defaultValue: '1em', description: 'Menu icon size', type: 'size' },
    {
      name: '--tbw-context-menu-shortcut-size',
      defaultValue: '0.7857em',
      description: 'Shortcut text size',
      type: 'size',
    },
    {
      name: '--tbw-context-menu-arrow-size',
      defaultValue: '0.7142em',
      description: 'Submenu arrow size',
      type: 'size',
    },
  ],

  'Filtering (Plugin)': [
    { name: '--tbw-filter-panel-bg', defaultValue: '#ffffff', description: 'Filter panel background', type: 'color' },
    { name: '--tbw-filter-panel-fg', defaultValue: '#333333', description: 'Filter panel text color', type: 'color' },
    { name: '--tbw-filter-panel-border', defaultValue: '#cccccc', description: 'Filter panel border', type: 'color' },
    { name: '--tbw-filter-panel-radius', defaultValue: '4px', description: 'Filter panel radius', type: 'size' },
    {
      name: '--tbw-filter-panel-shadow',
      defaultValue: 'rgba(0,0,0,0.1)',
      description: 'Filter panel shadow color',
      type: 'color',
    },
    { name: '--tbw-filter-accent', defaultValue: '#3b82f6', description: 'Filter accent color', type: 'color' },
    { name: '--tbw-filter-accent-fg', defaultValue: '#ffffff', description: 'Filter accent text color', type: 'color' },
    { name: '--tbw-filter-hover', defaultValue: '#f0f6ff', description: 'Filter item hover', type: 'color' },
    { name: '--tbw-filter-muted', defaultValue: '#555555', description: 'Filter muted text', type: 'color' },
    { name: '--tbw-filter-divider', defaultValue: '#d0d0d4', description: 'Filter divider color', type: 'color' },
    {
      name: '--tbw-filter-input-bg',
      defaultValue: 'transparent',
      description: 'Filter input background',
      type: 'color',
    },
    {
      name: '--tbw-filter-input-border',
      defaultValue: '#d0d0d4',
      description: 'Filter input border color',
      type: 'color',
    },
    { name: '--tbw-filter-input-radius', defaultValue: '0.25em', description: 'Filter input radius', type: 'size' },
    { name: '--tbw-filter-item-height', defaultValue: '28px', description: 'Filter list item height', type: 'size' },
    {
      name: '--tbw-filter-search-padding',
      defaultValue: '0.375em 0.5em',
      description: 'Filter search input padding',
      type: 'padding',
    },
    {
      name: '--tbw-filter-btn-padding',
      defaultValue: '0.375em 0.75em',
      description: 'Filter button padding',
      type: 'padding',
    },
    {
      name: '--tbw-filter-btn-font-weight',
      defaultValue: '500',
      description: 'Filter button font weight',
      type: 'select',
      options: ['normal', 'bold', '500', '600', '700'],
    },
    {
      name: '--tbw-filter-btn-min-height',
      defaultValue: 'auto',
      description: 'Filter button min height',
      type: 'size',
    },
    {
      name: '--tbw-filter-btn-display',
      defaultValue: 'inline-flex',
      description: 'Header filter button display',
      type: 'select',
      options: ['inline-flex', 'none'],
    },
    {
      name: '--tbw-filter-btn-visibility',
      defaultValue: 'visible',
      description: 'Header filter button visibility',
      type: 'select',
      options: ['visible', 'hidden'],
    },
  ],

  'Selection (Plugin)': [
    {
      name: '--tbw-selection-border-style',
      defaultValue: 'solid',
      description: 'Selection border style',
      type: 'select',
      options: ['solid', 'dashed', 'dotted'],
    },
    { name: '--tbw-selection-border-width', defaultValue: '1px', description: 'Selection border width', type: 'size' },
    {
      name: '--tbw-selection-warning-bg',
      defaultValue: 'rgba(244,67,54,0.5)',
      description: 'Invalid selection background',
      type: 'color',
    },
  ],

  'Editing (Plugin)': [
    { name: '--tbw-editing-bg', defaultValue: '#fff7d6', description: 'Editing cell background', type: 'color' },
    { name: '--tbw-editing-row-bg', defaultValue: '#fff7d6', description: 'Editing row background', type: 'color' },
    { name: '--tbw-editing-border', defaultValue: '1px solid #777', description: 'Editor input border', type: 'size' },
    {
      name: '--tbw-padding-editing-input',
      defaultValue: '0.25em 0.375em',
      description: 'Editor input padding',
      type: 'padding',
    },
    { name: '--tbw-font-size-editor', defaultValue: 'inherit', description: 'Editor font size', type: 'size' },
    {
      name: '--tbw-editing-row-outline-color',
      defaultValue: '#3b82f6',
      description: 'Editing row outline color',
      type: 'color',
    },
    {
      name: '--tbw-editing-row-outline-width',
      defaultValue: '1px',
      description: 'Editing row outline width',
      type: 'size',
    },
    { name: '--tbw-invalid-bg', defaultValue: '#fef2f2', description: 'Invalid cell background', type: 'color' },
    {
      name: '--tbw-invalid-border-color',
      defaultValue: '#ef4444',
      description: 'Invalid cell border color',
      type: 'color',
    },
  ],

  'Row Grouping (Plugin)': [
    { name: '--tbw-grouping-rows-bg', defaultValue: '#f5f5f5', description: 'Group row background', type: 'color' },
    { name: '--tbw-grouping-rows-bg-hover', defaultValue: '#eeeeee', description: 'Group row hover bg', type: 'color' },
    {
      name: '--tbw-grouping-rows-toggle-hover',
      defaultValue: '#e0e0e0',
      description: 'Toggle button hover',
      type: 'color',
    },
    {
      name: '--tbw-grouping-rows-count-color',
      defaultValue: '#666666',
      description: 'Group count text color',
      type: 'color',
    },
    {
      name: '--tbw-grouping-rows-aggregate-color',
      defaultValue: '#555555',
      description: 'Aggregate value color',
      type: 'color',
    },
    { name: '--tbw-group-indent-width', defaultValue: '1.25em', description: 'Group indent per level', type: 'size' },
  ],

  'Grouping Columns (Plugin)': [
    {
      name: '--tbw-grouping-columns-header-bg',
      defaultValue: '#e0e0e0',
      description: 'Column group header bg',
      type: 'color',
    },
    {
      name: '--tbw-grouping-columns-border',
      defaultValue: '#d0d0d4',
      description: 'Column group border',
      type: 'color',
    },
    {
      name: '--tbw-grouping-columns-separator',
      defaultValue: '#777777',
      description: 'Column group separator',
      type: 'color',
    },
  ],

  'Tree (Plugin)': [
    { name: '--tbw-tree-indent-width', defaultValue: '1.5em', description: 'Tree indentation width', type: 'size' },
    { name: '--tbw-tree-toggle-size', defaultValue: '1em', description: 'Tree toggle icon size', type: 'size' },
    { name: '--tbw-tree-accent', defaultValue: '#3b82f6', description: 'Tree expand/collapse accent', type: 'color' },
  ],

  'Master-Detail (Plugin)': [
    {
      name: '--tbw-master-detail-bg',
      defaultValue: 'transparent',
      description: 'Detail row background',
      type: 'color',
    },
    { name: '--tbw-master-detail-border', defaultValue: '#d0d0d4', description: 'Detail row border', type: 'color' },
  ],

  'Pivot (Plugin)': [
    { name: '--tbw-pivot-group-bg', defaultValue: 'transparent', description: 'Pivot group row bg', type: 'color' },
    { name: '--tbw-pivot-group-hover', defaultValue: '#f0f6ff', description: 'Pivot group hover bg', type: 'color' },
    { name: '--tbw-pivot-leaf-bg', defaultValue: 'transparent', description: 'Pivot leaf row bg', type: 'color' },
    { name: '--tbw-pivot-grand-total-bg', defaultValue: '#e0e0e0', description: 'Grand total row bg', type: 'color' },
    { name: '--tbw-pivot-toggle-size', defaultValue: '1.25em', description: 'Pivot toggle icon size', type: 'size' },
    { name: '--tbw-pivot-toggle-color', defaultValue: '#555555', description: 'Pivot toggle color', type: 'color' },
    {
      name: '--tbw-pivot-toggle-hover-bg',
      defaultValue: '#f0f6ff',
      description: 'Pivot toggle hover bg',
      type: 'color',
    },
    {
      name: '--tbw-pivot-toggle-hover-color',
      defaultValue: '#222222',
      description: 'Pivot toggle hover color',
      type: 'color',
    },
    { name: '--tbw-pivot-count-color', defaultValue: '#555555', description: 'Pivot count text color', type: 'color' },
    { name: '--tbw-pivot-border', defaultValue: '#d0d0d4', description: 'Pivot section border', type: 'color' },
    {
      name: '--tbw-pivot-section-bg',
      defaultValue: 'transparent',
      description: 'Pivot configurator bg',
      type: 'color',
    },
    {
      name: '--tbw-pivot-header-bg',
      defaultValue: '#e0e0e0',
      description: 'Pivot configurator header bg',
      type: 'color',
    },
    { name: '--tbw-pivot-drop-border', defaultValue: '#d0d0d4', description: 'Drop zone border', type: 'color' },
    { name: '--tbw-pivot-drop-bg', defaultValue: 'transparent', description: 'Drop zone background', type: 'color' },
    {
      name: '--tbw-pivot-drop-active',
      defaultValue: 'rgba(59,130,246,0.12)',
      description: 'Active drop zone bg',
      type: 'color',
    },
    { name: '--tbw-pivot-chip-bg', defaultValue: '#e0e0e0', description: 'Pivot chip background', type: 'color' },
    { name: '--tbw-pivot-chip-border', defaultValue: '#d0d0d4', description: 'Pivot chip border', type: 'color' },
    { name: '--tbw-pivot-chip-hover', defaultValue: '#f0f6ff', description: 'Pivot chip hover bg', type: 'color' },
    {
      name: '--tbw-pivot-chip-remove-hover-bg',
      defaultValue: '#3b82f6',
      description: 'Chip remove button hover bg',
      type: 'color',
    },
    {
      name: '--tbw-pivot-chip-remove-hover-fg',
      defaultValue: '#ffffff',
      description: 'Chip remove button hover text',
      type: 'color',
    },
  ],

  'Multi-Sort (Plugin)': [
    { name: '--tbw-multi-sort-badge-bg', defaultValue: '#eeeeee', description: 'Sort badge background', type: 'color' },
    {
      name: '--tbw-multi-sort-badge-color',
      defaultValue: '#222222',
      description: 'Sort badge text color',
      type: 'color',
    },
    { name: '--tbw-multi-sort-badge-size', defaultValue: '1em', description: 'Sort badge size', type: 'size' },
  ],

  'Visibility Panel (Plugin)': [
    { name: '--tbw-visibility-hover', defaultValue: '#f0f0f0', description: 'Visibility item hover', type: 'color' },
    { name: '--tbw-visibility-indicator', defaultValue: '#3b82f6', description: 'Visibility indicator', type: 'color' },
    { name: '--tbw-visibility-border', defaultValue: '#d0d0d4', description: 'Visibility panel border', type: 'color' },
    { name: '--tbw-visibility-btn-bg', defaultValue: '#e0e0e0', description: 'Visibility button bg', type: 'color' },
  ],

  'Pinned Rows (Plugin)': [
    { name: '--tbw-pinned-rows-bg', defaultValue: '#eeeeee', description: 'Pinned rows background', type: 'color' },
    { name: '--tbw-pinned-rows-border', defaultValue: '#d0d0d4', description: 'Pinned rows border', type: 'color' },
    { name: '--tbw-pinned-rows-color', defaultValue: '#555555', description: 'Pinned rows text color', type: 'color' },
    { name: '--tbw-aggregation-bg', defaultValue: '#e0e0e0', description: 'Aggregation row background', type: 'color' },
    { name: '--tbw-aggregation-border', defaultValue: '#d0d0d4', description: 'Aggregation row border', type: 'color' },
    { name: '--tbw-aggregation-font-size', defaultValue: '0.8em', description: 'Aggregation font size', type: 'size' },
    {
      name: '--tbw-aggregation-font-weight',
      defaultValue: '600',
      description: 'Aggregation font weight',
      type: 'select',
      options: ['normal', 'bold', '500', '600', '700'],
    },
  ],

  'Responsive (Plugin)': [
    { name: '--tbw-responsive-duration', defaultValue: '200ms', description: 'Card layout transition', type: 'size' },
  ],

  'Print (Plugin)': [
    { name: '--tbw-print-border', defaultValue: '#777777', description: 'Print header border', type: 'color' },
    { name: '--tbw-print-muted', defaultValue: '#555555', description: 'Print muted text', type: 'color' },
    { name: '--tbw-print-cell-border', defaultValue: '#d0d0d4', description: 'Print cell border', type: 'color' },
  ],

  'Reorder Columns (Plugin)': [
    {
      name: '--tbw-reorder-indicator',
      defaultValue: '#3b82f6',
      description: 'Column reorder indicator',
      type: 'color',
    },
  ],

  'Reorder Rows (Plugin)': [
    {
      name: '--tbw-row-reorder-handle-color',
      defaultValue: '#555555',
      description: 'Row drag handle color',
      type: 'color',
    },
    {
      name: '--tbw-row-reorder-handle-hover',
      defaultValue: '#3b82f6',
      description: 'Row drag handle hover color',
      type: 'color',
    },
    {
      name: '--tbw-row-reorder-indicator',
      defaultValue: '#3b82f6',
      description: 'Row reorder drop indicator',
      type: 'color',
    },
    {
      name: '--tbw-row-reorder-moving-bg',
      defaultValue: 'rgba(59,130,246,0.08)',
      description: 'Moving row background',
      type: 'color',
    },
    {
      name: '--tbw-row-reorder-moving-border',
      defaultValue: '#3b82f6',
      description: 'Moving row border color',
      type: 'color',
    },
  ],

  'Z-Index Layers': [
    { name: '--tbw-z-layer-rows', defaultValue: '0', description: 'Row area z-index', type: 'number' },
    { name: '--tbw-z-layer-header', defaultValue: '10', description: 'Header z-index', type: 'number' },
    { name: '--tbw-z-layer-pinned-rows', defaultValue: '20', description: 'Pinned rows z-index', type: 'number' },
    { name: '--tbw-z-layer-toolpanel', defaultValue: '5', description: 'Tool panel z-index', type: 'number' },
  ],
};

/** Flat array of every variable name in the registry. */
export const ALL_VARIABLE_NAMES: string[] = Object.values(CSS_VARIABLES).flatMap((vars) => vars.map((v) => v.name));
