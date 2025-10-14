import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { ContextMenuPlugin } from './ContextMenuPlugin';
import type { ContextMenuItem, ContextMenuParams } from './types';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    menuItems: {
      control: { type: 'object' },
      description: 'Menu items configuration (edit to customize)',
      table: { category: 'Menu Configuration' },
    },
  },
  args: {
    menuItems: [
      { id: 'copy', name: 'Copy Row', icon: '📋', shortcut: 'Ctrl+C' },
      { id: 'edit', name: 'Edit Row', icon: '✏️' },
      { id: 'sep1', separator: true },
      { id: 'duplicate', name: 'Duplicate', icon: '📄' },
      { id: 'sep2', separator: true },
      { id: 'delete', name: 'Delete', icon: '🗑️', cssClass: 'danger' },
    ],
  },
};
export default meta;

interface MenuItemArg {
  id: string;
  name?: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  cssClass?: string;
}

interface ContextMenuArgs {
  menuItems: MenuItemArg[];
}
type Story = StoryObj<ContextMenuArgs>;

/**
 * ## Context Menu
 *
 * Right-click on rows or headers to show a context menu.
 * Define menu items with actions, icons, shortcuts, and submenus.
 */
export const ContextMenu: Story = {
  render: (args: ContextMenuArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    // Convert args to full menu items with actions
    const buildMenuItems = (items: MenuItemArg[]): ContextMenuItem[] => {
      return items.map((item) => {
        if (item.separator) {
          return { id: item.id, name: '', separator: true };
        }
        return {
          id: item.id,
          name: item.name || item.id,
          icon: item.icon,
          shortcut: item.shortcut,
          cssClass: item.cssClass,
          action: (params: ContextMenuParams) => console.log(`${item.name || item.id} clicked`, params.row),
        };
      });
    };

    const codeSnippet = (__$menuItems$: MenuItemArg[]) => {
      // Build menu items from configuration
      const menuItems: ContextMenuItem[] = __$menuItems$.map((item) => {
        if (item.separator) {
          return { id: item.id, name: '', separator: true };
        }
        return {
          id: item.id,
          name: item.name || item.id,
          icon: item.icon,
          shortcut: item.shortcut,
          cssClass: item.cssClass,
          action: (params: ContextMenuParams) => console.log(`${item.name} clicked`, params.row),
        };
      });

      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'email', header: 'Email' },
          { field: 'status', header: 'Status' },
        ],
        plugins: [new ContextMenuPlugin({ items: menuItems })],
      };

      grid.rows = [
        { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
        { id: 2, name: 'Bob', email: 'bob@example.com', status: 'pending' },
        { id: 3, name: 'Carol', email: 'carol@example.com', status: 'active' },
      ];
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;

    // Actually configure the grid with real menu items
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
        { field: 'status', header: 'Status' },
      ],
      plugins: [new ContextMenuPlugin({ items: buildMenuItems(args.menuItems) })],
    };

    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
      { id: 2, name: 'Bob', email: 'bob@example.com', status: 'pending' },
      { id: 3, name: 'Carol', email: 'carol@example.com', status: 'active' },
    ];

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-context-menu',
      plugins: [{ className: 'ContextMenuPlugin', path: 'plugins/context-menu' }],
      description: `
        <p>The <strong>Context Menu</strong> plugin shows a custom menu on right-click.</p>
        <p><strong>Try it:</strong> Right-click on any row to see the context menu.</p>
        <p><strong>Customize:</strong> Edit the <code>menuItems</code> array in the Controls panel to add, remove, or modify menu items. Each item can have:</p>
        <ul>
          <li><code>id</code> - Unique identifier (required)</li>
          <li><code>name</code> - Display text</li>
          <li><code>icon</code> - Emoji or icon character</li>
          <li><code>shortcut</code> - Keyboard hint (e.g., "Ctrl+C")</li>
          <li><code>separator: true</code> - Creates a divider line</li>
          <li><code>cssClass: "danger"</code> - Applies danger styling</li>
        </ul>
      `,
    });
  },
};
