/**
 * CSS Variable Reference
 *
 * Complete list of all CSS custom properties available for theming.
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite';

// Import styles from ThemeBuilder
import './ThemeBuilder.stories';

// ============================================================================
// CSS VARIABLE DEFINITIONS (shared with ThemeBuilder)
// ============================================================================
interface CSSVariableDefinition {
  name: string;
  defaultValue: string;
  description: string;
  type: 'color' | 'size' | 'font' | 'number' | 'select' | 'padding';
  options?: string[];
}

const CSS_VARIABLES: Record<string, CSSVariableDefinition[]> = {
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
    { name: '--tbw-color-error', defaultValue: '#f44336', description: 'Error state', type: 'color' },
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
    { name: '--tbw-header-height', defaultValue: '1.875em', description: 'Header row height', type: 'size' },
    {
      name: '--tbw-font-weight-header',
      defaultValue: 'bold',
      description: 'Header font weight',
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
  ],
  Borders: [
    { name: '--tbw-color-border', defaultValue: '#d0d0d4', description: 'Default border color', type: 'color' },
    { name: '--tbw-color-border-strong', defaultValue: '#777777', description: 'Strong border color', type: 'color' },
    { name: '--tbw-color-border-cell', defaultValue: '#d0d0d4', description: 'Cell border color', type: 'color' },
    { name: '--tbw-color-border-header', defaultValue: '#d0d0d4', description: 'Header border color', type: 'color' },
    { name: '--tbw-border-radius', defaultValue: '0.25em', description: 'Border radius', type: 'size' },
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
  ],
  Spacing: [
    { name: '--tbw-spacing-xs', defaultValue: '0.25em', description: 'Extra small spacing', type: 'size' },
    { name: '--tbw-spacing-sm', defaultValue: '0.375em', description: 'Small spacing', type: 'size' },
    { name: '--tbw-spacing-md', defaultValue: '0.5em', description: 'Medium spacing', type: 'size' },
    { name: '--tbw-spacing-lg', defaultValue: '0.75em', description: 'Large spacing', type: 'size' },
    { name: '--tbw-spacing-xl', defaultValue: '1em', description: 'Extra large spacing', type: 'size' },
    { name: '--tbw-cell-padding', defaultValue: '0.25em 0.5em', description: 'Cell padding', type: 'padding' },
    {
      name: '--tbw-cell-padding-header',
      defaultValue: '0.25em 0.5em',
      description: 'Header cell padding',
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
  ],
  'Focus & Selection': [
    { name: '--tbw-focus-outline', defaultValue: '2px solid #3b82f6', description: 'Focus ring style', type: 'size' },
    { name: '--tbw-focus-outline-offset', defaultValue: '-2px', description: 'Focus ring offset', type: 'size' },
    { name: '--tbw-range-border-color', defaultValue: '#3b82f6', description: 'Range selection border', type: 'color' },
  ],
  Icons: [
    { name: '--tbw-icon-size', defaultValue: '1em', description: 'Icon size', type: 'size' },
    { name: '--tbw-icon-size-sm', defaultValue: '0.875em', description: 'Small icon size', type: 'size' },
    { name: '--tbw-checkbox-size', defaultValue: '1em', description: 'Checkbox size', type: 'size' },
    { name: '--tbw-toggle-size', defaultValue: '1.25em', description: 'Toggle icon size', type: 'size' },
  ],
  'Resize Handle': [
    { name: '--tbw-resize-handle-width', defaultValue: '0.375em', description: 'Resize handle width', type: 'size' },
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
    { name: '--tbw-resize-indicator-width', defaultValue: '2px', description: 'Resize indicator width', type: 'size' },
    {
      name: '--tbw-resize-indicator-color',
      defaultValue: '#3b82f6',
      description: 'Resize indicator color',
      type: 'color',
    },
  ],
  Animation: [
    { name: '--tbw-transition-duration', defaultValue: '120ms', description: 'Transition duration', type: 'size' },
    { name: '--tbw-animation-duration', defaultValue: '200ms', description: 'Animation duration', type: 'size' },
    {
      name: '--tbw-animation-easing',
      defaultValue: 'ease-out',
      description: 'Animation easing',
      type: 'select',
      options: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'],
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
    { name: '--tbw-tool-panel-width', defaultValue: '17.5em', description: 'Tool panel width', type: 'size' },
    { name: '--tbw-tool-panel-bg', defaultValue: '#eeeeee', description: 'Tool panel background', type: 'color' },
    {
      name: '--tbw-tool-panel-header-height',
      defaultValue: '2.5em',
      description: 'Tool panel header height',
      type: 'size',
    },
    { name: '--tbw-toolbar-button-size', defaultValue: '2em', description: 'Toolbar button size', type: 'size' },
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
    {
      name: '--tbw-context-menu-fg-disabled',
      defaultValue: '#aaaaaa',
      description: 'Disabled item text',
      type: 'color',
    },
    {
      name: '--tbw-context-menu-separator',
      defaultValue: '#e0e0e0',
      description: 'Menu separator color',
      type: 'color',
    },
    { name: '--tbw-context-menu-icon-color', defaultValue: '#666666', description: 'Menu icon color', type: 'color' },
    { name: '--tbw-context-menu-radius', defaultValue: '4px', description: 'Menu border radius', type: 'size' },
    {
      name: '--tbw-context-menu-shadow',
      defaultValue: '0 2px 10px rgba(0,0,0,0.1)',
      description: 'Menu box shadow',
      type: 'size',
    },
    { name: '--tbw-context-menu-min-width', defaultValue: '160px', description: 'Minimum menu width', type: 'size' },
    { name: '--tbw-context-menu-max-width', defaultValue: '280px', description: 'Maximum menu width', type: 'size' },
  ],
  'Filtering Panel (Plugin)': [
    { name: '--tbw-filter-panel-bg', defaultValue: '#ffffff', description: 'Filter panel background', type: 'color' },
    { name: '--tbw-filter-panel-fg', defaultValue: '#333333', description: 'Filter panel text color', type: 'color' },
    { name: '--tbw-filter-panel-border', defaultValue: '#cccccc', description: 'Filter panel border', type: 'color' },
    { name: '--tbw-filter-panel-radius', defaultValue: '4px', description: 'Filter panel radius', type: 'size' },
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
  ],
  'Tree (Plugin)': [
    { name: '--tbw-tree-indent-width', defaultValue: '1.5em', description: 'Tree indentation width', type: 'size' },
    { name: '--tbw-tree-toggle-size', defaultValue: '1em', description: 'Tree toggle icon size', type: 'size' },
  ],
  'Visibility Panel (Plugin)': [
    { name: '--tbw-visibility-hover', defaultValue: '#f0f0f0', description: 'Visibility item hover', type: 'color' },
    { name: '--tbw-visibility-indicator', defaultValue: '#3b82f6', description: 'Visibility indicator', type: 'color' },
  ],
  'Loading Spinner': [
    { name: '--tbw-spinner-size', defaultValue: '48px', description: 'Spinner size (grid-level)', type: 'size' },
    { name: '--tbw-spinner-border-width', defaultValue: '3px', description: 'Spinner border thickness', type: 'size' },
    { name: '--tbw-spinner-color', defaultValue: '#3b82f6', description: 'Spinner active color', type: 'color' },
    { name: '--tbw-spinner-track-color', defaultValue: '#d0d0d4', description: 'Spinner track color', type: 'color' },
  ],
};

// ============================================================================
// STORY DEFINITION
// ============================================================================
const meta: Meta = {
  title: 'Grid/Theming/Variable Reference',
  tags: ['!autodocs', '!dev'],
  parameters: {
    layout: 'padded',
    controls: { disable: true },
    actions: { disable: true },
  },
};

export default meta;

type Story = StoryObj;

/**
 * Complete list of all CSS custom properties available for theming the grid.
 */
export const Reference: Story = {
  render: () => {
    const container = document.createElement('div');
    container.className = 'theme-builder-reference';

    // Create a hidden grid element to read computed styles from
    const probeGrid = document.createElement('tbw-grid');
    probeGrid.style.cssText = 'position: absolute; visibility: hidden; pointer-events: none;';
    container.appendChild(probeGrid);

    const title = document.createElement('h2');
    title.textContent = 'CSS Variable Reference';
    title.className = 'theme-builder-reference__title';
    container.appendChild(title);

    const intro = document.createElement('p');
    intro.textContent = 'Complete list of all CSS custom properties available for theming.';
    intro.className = 'theme-builder-reference__intro';
    container.appendChild(intro);

    // Build structure first with placeholders, then populate after DOM attachment
    const valueElements: Array<{
      cell: HTMLTableCellElement;
      swatchEl: HTMLSpanElement | null;
      variable: CSSVariableDefinition;
    }> = [];

    for (const [category, variables] of Object.entries(CSS_VARIABLES)) {
      const section = document.createElement('section');
      section.className = 'theme-builder-reference__section';

      const heading = document.createElement('h3');
      heading.textContent = category;
      heading.className = 'theme-builder-reference__heading';
      section.appendChild(heading);

      const table = document.createElement('table');
      table.className = 'theme-builder-reference__table';

      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>Variable</th>
          <th>Current Value</th>
          <th>Description</th>
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const variable of variables) {
        const row = document.createElement('tr');

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.innerHTML = `<code class="theme-builder-reference__var-name">${variable.name}</code>`;
        row.appendChild(nameCell);

        // Value cell (will be populated after DOM attachment)
        const valueCell = document.createElement('td');
        valueCell.className = 'theme-builder-reference__default';

        let swatchEl: HTMLSpanElement | null = null;
        if (variable.type === 'color') {
          swatchEl = document.createElement('span');
          swatchEl.className = 'theme-builder-reference__color-swatch';
          valueCell.appendChild(swatchEl);
        }
        const valueText = document.createTextNode(variable.defaultValue);
        valueCell.appendChild(valueText);
        row.appendChild(valueCell);

        // Track for later update
        valueElements.push({ cell: valueCell, swatchEl, variable });

        // Description cell
        const descCell = document.createElement('td');
        descCell.textContent = variable.description;
        row.appendChild(descCell);

        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      section.appendChild(table);
      container.appendChild(section);
    }

    // Helper to convert rgb/rgba to hex
    const rgbToHex = (rgb: string): string => {
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match) return rgb;
      const [, r, g, b, a] = match;
      const hex = `#${[r, g, b].map((x) => parseInt(x).toString(16).padStart(2, '0')).join('')}`;
      if (a !== undefined && parseFloat(a) < 1) {
        const alpha = Math.round(parseFloat(a) * 255)
          .toString(16)
          .padStart(2, '0');
        return `${hex}${alpha}`;
      }
      return hex;
    };

    // Function to update all values from computed styles
    const updateValues = () => {
      const computedStyle = getComputedStyle(probeGrid);
      for (const { cell, swatchEl, variable } of valueElements) {
        // Get the CSS value (may be a function like light-dark(...))
        const computedValue = computedStyle.getPropertyValue(variable.name).trim() || variable.defaultValue;
        let displayValue: string;

        if (variable.type === 'color' && swatchEl) {
          // Apply the CSS function to the swatch - browser will render it correctly
          swatchEl.style.background = computedValue;
          // Read the resolved color from the swatch for the text display
          const resolvedColor = getComputedStyle(swatchEl).backgroundColor;
          displayValue = rgbToHex(resolvedColor) || variable.defaultValue;
        } else {
          displayValue = computedValue;
        }

        // Update text (last child is the text node)
        const textNode = cell.lastChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = displayValue;
        }
      }
    };

    // Update values after DOM attachment
    requestAnimationFrame(updateValues);

    // Watch for color scheme changes to update values dynamically
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => requestAnimationFrame(updateValues);
    mediaQuery.addEventListener('change', handleChange);

    // Also observe class changes on document (for Storybook theme switching)
    const observer = new MutationObserver(() => requestAnimationFrame(updateValues));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    // Cleanup on disconnect
    const cleanup = () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };

    // Use a hidden element to detect when container is removed
    const sentinel = document.createElement('span');
    sentinel.style.display = 'none';
    container.appendChild(sentinel);

    const disconnectObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === container || (node as Element).contains?.(sentinel)) {
            cleanup();
            disconnectObserver.disconnect();
            return;
          }
        }
      }
    });

    requestAnimationFrame(() => {
      if (container.parentElement) {
        disconnectObserver.observe(container.parentElement, { childList: true, subtree: true });
      }
    });

    return container;
  },
};
