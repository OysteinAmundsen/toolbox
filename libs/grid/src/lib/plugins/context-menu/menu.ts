/**
 * Context Menu Rendering Logic
 *
 * Pure functions for building and positioning context menus.
 */

import type { ContextMenuItem, ContextMenuParams } from './types';

/**
 * Build the visible menu items by resolving dynamic items and filtering hidden ones.
 *
 * @param items - Menu items configuration (array or factory function)
 * @param params - Context menu parameters for evaluating dynamic properties
 * @returns Filtered array of visible menu items
 */
export function buildMenuItems(
  items: ContextMenuItem[] | ((params: ContextMenuParams) => ContextMenuItem[]),
  params: ContextMenuParams
): ContextMenuItem[] {
  const menuItems = typeof items === 'function' ? items(params) : items;

  return menuItems.filter((item) => {
    if (item.hidden === true) return false;
    if (typeof item.hidden === 'function' && item.hidden(params)) return false;
    return true;
  });
}

/**
 * Check if a menu item is disabled.
 *
 * @param item - The menu item to check
 * @param params - Context menu parameters for evaluating dynamic disabled state
 * @returns True if the item is disabled
 */
export function isItemDisabled(item: ContextMenuItem, params: ContextMenuParams): boolean {
  if (item.disabled === true) return true;
  if (typeof item.disabled === 'function') return item.disabled(params);
  return false;
}

/**
 * Create the menu DOM element from a list of menu items.
 *
 * @param items - Array of menu items to render
 * @param params - Context menu parameters for evaluating dynamic properties
 * @param onAction - Callback when a menu item action is triggered
 * @returns The created menu element
 */
export function createMenuElement(
  items: ContextMenuItem[],
  params: ContextMenuParams,
  onAction: (item: ContextMenuItem) => void
): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'tbw-context-menu';
  menu.setAttribute('role', 'menu');

  for (const item of items) {
    if (item.separator) {
      const separator = document.createElement('div');
      separator.className = 'tbw-context-menu-separator';
      separator.setAttribute('role', 'separator');
      menu.appendChild(separator);
      continue;
    }

    const menuItem = document.createElement('div');
    menuItem.className = 'tbw-context-menu-item';
    if (item.cssClass) menuItem.classList.add(item.cssClass);
    menuItem.setAttribute('role', 'menuitem');
    menuItem.setAttribute('data-id', item.id);

    const disabled = isItemDisabled(item, params);
    if (disabled) {
      menuItem.classList.add('disabled');
      menuItem.setAttribute('aria-disabled', 'true');
    }

    if (item.icon) {
      const icon = document.createElement('span');
      icon.className = 'tbw-context-menu-icon';
      icon.innerHTML = item.icon;
      menuItem.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'tbw-context-menu-label';
    label.textContent = item.name;
    menuItem.appendChild(label);

    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'tbw-context-menu-shortcut';
      shortcut.textContent = item.shortcut;
      menuItem.appendChild(shortcut);
    }

    if (item.subMenu?.length) {
      const arrow = document.createElement('span');
      arrow.className = 'tbw-context-menu-arrow';
      arrow.textContent = '▶';
      menuItem.appendChild(arrow);

      // Add submenu on hover
      menuItem.addEventListener('mouseenter', () => {
        const existingSubMenu = menuItem.querySelector('.tbw-context-menu');
        if (existingSubMenu) return;
        if (!item.subMenu) return;

        const subMenuItems = buildMenuItems(item.subMenu, params);
        const subMenu = createMenuElement(subMenuItems, params, onAction);
        subMenu.classList.add('tbw-context-submenu');
        subMenu.style.position = 'absolute';
        subMenu.style.left = '100%';
        subMenu.style.top = '0';
        menuItem.style.position = 'relative';
        menuItem.appendChild(subMenu);
      });

      menuItem.addEventListener('mouseleave', () => {
        const subMenu = menuItem.querySelector('.tbw-context-menu');
        if (subMenu) subMenu.remove();
      });
    }

    if (!disabled && item.action && !item.subMenu) {
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        onAction(item);
      });
    }

    menu.appendChild(menuItem);
  }

  return menu;
}

/**
 * Position the menu at the given viewport coordinates.
 * Menu is rendered in document.body with fixed positioning for top-layer behavior.
 *
 * @param menu - The menu element to position
 * @param x - Desired X coordinate (viewport)
 * @param y - Desired Y coordinate (viewport)
 */
export function positionMenu(menu: HTMLElement, x: number, y: number): void {
  // Use fixed positioning for top-layer behavior
  menu.style.position = 'fixed';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.visibility = 'hidden';
  menu.style.zIndex = '10000';

  // Force layout to get dimensions
  const menuRect = menu.getBoundingClientRect();

  // Calculate visible area within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x;
  let top = y;

  // Check if menu overflows right edge of viewport
  if (x + menuRect.width > viewportWidth) {
    left = x - menuRect.width;
  }
  // Check if menu overflows bottom edge of viewport
  if (y + menuRect.height > viewportHeight) {
    top = y - menuRect.height;
  }

  // Ensure we don't go negative
  left = Math.max(0, left);
  top = Math.max(0, top);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = 'visible';
}
