import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMenuItems, isItemDisabled, createMenuElement } from './menu';
import type { ContextMenuItem, ContextMenuParams } from './types';

/**
 * Creates mock context menu params for testing.
 */
function createMockParams(overrides: Partial<ContextMenuParams> = {}): ContextMenuParams {
  return {
    row: { id: 1, name: 'Test Row' },
    rowIndex: 0,
    column: { field: 'name', header: 'Name' },
    columnIndex: 0,
    field: 'name',
    value: 'Test Row',
    isHeader: false,
    event: new MouseEvent('contextmenu'),
    ...overrides,
  };
}

describe('contextMenu', () => {
  describe('buildMenuItems', () => {
    it('should return items from array directly', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' },
      ];
      const params = createMockParams();

      const result = buildMenuItems(items, params);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('item1');
      expect(result[1].id).toBe('item2');
    });

    it('should call function and return items', () => {
      const itemsFactory = vi.fn().mockReturnValue([{ id: 'dynamic1', name: 'Dynamic 1' }]);
      const params = createMockParams();

      const result = buildMenuItems(itemsFactory, params);

      expect(itemsFactory).toHaveBeenCalledWith(params);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dynamic1');
    });

    it('should filter items with hidden: true', () => {
      const items: ContextMenuItem[] = [
        { id: 'visible', name: 'Visible' },
        { id: 'hidden', name: 'Hidden', hidden: true },
        { id: 'also-visible', name: 'Also Visible' },
      ];
      const params = createMockParams();

      const result = buildMenuItems(items, params);

      expect(result).toHaveLength(2);
      expect(result.find((i) => i.id === 'hidden')).toBeUndefined();
    });

    it('should filter items with hidden function returning true', () => {
      const items: ContextMenuItem[] = [
        { id: 'visible', name: 'Visible' },
        {
          id: 'conditionally-hidden',
          name: 'Conditionally Hidden',
          hidden: (p) => p.isHeader,
        },
      ];

      // Test when isHeader is false
      const bodyParams = createMockParams({ isHeader: false });
      const resultBody = buildMenuItems(items, bodyParams);
      expect(resultBody).toHaveLength(2);

      // Test when isHeader is true
      const headerParams = createMockParams({ isHeader: true });
      const resultHeader = buildMenuItems(items, headerParams);
      expect(resultHeader).toHaveLength(1);
      expect(resultHeader[0].id).toBe('visible');
    });

    it('should keep items with hidden: false', () => {
      const items: ContextMenuItem[] = [{ id: 'item1', name: 'Item 1', hidden: false }];
      const params = createMockParams();

      const result = buildMenuItems(items, params);

      expect(result).toHaveLength(1);
    });

    it('should keep items with hidden function returning false', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'item1',
          name: 'Item 1',
          hidden: () => false,
        },
      ];
      const params = createMockParams();

      const result = buildMenuItems(items, params);

      expect(result).toHaveLength(1);
    });
  });

  describe('isItemDisabled', () => {
    let params: ContextMenuParams;

    beforeEach(() => {
      params = createMockParams();
    });

    it('should return false when disabled is undefined', () => {
      const item: ContextMenuItem = { id: 'test', name: 'Test' };

      expect(isItemDisabled(item, params)).toBe(false);
    });

    it('should return true when disabled is true', () => {
      const item: ContextMenuItem = { id: 'test', name: 'Test', disabled: true };

      expect(isItemDisabled(item, params)).toBe(true);
    });

    it('should return false when disabled is false', () => {
      const item: ContextMenuItem = { id: 'test', name: 'Test', disabled: false };

      expect(isItemDisabled(item, params)).toBe(false);
    });

    it('should call function and return result when disabled is a function', () => {
      const disabledFn = vi.fn().mockReturnValue(true);
      const item: ContextMenuItem = {
        id: 'test',
        name: 'Test',
        disabled: disabledFn,
      };

      const result = isItemDisabled(item, params);

      expect(disabledFn).toHaveBeenCalledWith(params);
      expect(result).toBe(true);
    });

    it('should evaluate disabled function based on params', () => {
      const item: ContextMenuItem = {
        id: 'test',
        name: 'Test',
        disabled: (p) => p.rowIndex < 0,
      };

      // Row context - should be enabled
      expect(isItemDisabled(item, createMockParams({ rowIndex: 0 }))).toBe(false);

      // Header context - should be disabled
      expect(isItemDisabled(item, createMockParams({ rowIndex: -1 }))).toBe(true);
    });
  });

  describe('createMenuElement', () => {
    let params: ContextMenuParams;
    let onAction: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      params = createMockParams();
      onAction = vi.fn();
    });

    it('should create a menu element with correct role', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test' }];

      const menu = createMenuElement(items, params, onAction);

      expect(menu.tagName).toBe('DIV');
      expect(menu.className).toBe('tbw-context-menu');
      expect(menu.getAttribute('role')).toBe('menu');
    });

    it('should render menu items with correct structure', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' },
      ];

      const menu = createMenuElement(items, params, onAction);
      const menuItems = menu.querySelectorAll('.tbw-context-menu-item');

      expect(menuItems).toHaveLength(2);
      expect(menuItems[0].getAttribute('role')).toBe('menuitem');
      expect(menuItems[0].getAttribute('data-id')).toBe('item1');
    });

    it('should render separator items correctly', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'sep1', name: '', separator: true },
        { id: 'item2', name: 'Item 2' },
      ];

      const menu = createMenuElement(items, params, onAction);
      const separators = menu.querySelectorAll('.tbw-context-menu-separator');
      const menuItems = menu.querySelectorAll('.tbw-context-menu-item');

      expect(separators).toHaveLength(1);
      expect(separators[0].getAttribute('role')).toBe('separator');
      expect(menuItems).toHaveLength(2);
    });

    it('should render icon when provided', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', icon: '📋' }];

      const menu = createMenuElement(items, params, onAction);
      const icon = menu.querySelector('.tbw-context-menu-icon');

      expect(icon).not.toBeNull();
      expect(icon?.innerHTML).toBe('📋');
    });

    it('should render shortcut when provided', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', shortcut: 'Ctrl+C' }];

      const menu = createMenuElement(items, params, onAction);
      const shortcut = menu.querySelector('.tbw-context-menu-shortcut');

      expect(shortcut).not.toBeNull();
      expect(shortcut?.textContent).toBe('Ctrl+C');
    });

    it('should render label correctly', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'My Action' }];

      const menu = createMenuElement(items, params, onAction);
      const label = menu.querySelector('.tbw-context-menu-label');

      expect(label?.textContent).toBe('My Action');
    });

    it('should mark disabled items correctly', () => {
      const items: ContextMenuItem[] = [
        { id: 'enabled', name: 'Enabled' },
        { id: 'disabled', name: 'Disabled', disabled: true },
      ];

      const menu = createMenuElement(items, params, onAction);
      const menuItems = menu.querySelectorAll('.tbw-context-menu-item');

      expect(menuItems[0].classList.contains('disabled')).toBe(false);
      expect(menuItems[1].classList.contains('disabled')).toBe(true);
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('true');
    });

    it('should add custom CSS class when provided', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', cssClass: 'custom-class' }];

      const menu = createMenuElement(items, params, onAction);
      const menuItem = menu.querySelector('.tbw-context-menu-item');

      expect(menuItem?.classList.contains('custom-class')).toBe(true);
    });

    it('should render submenu arrow when subMenu is provided', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'parent',
          name: 'Parent',
          subMenu: [{ id: 'child', name: 'Child' }],
        },
      ];

      const menu = createMenuElement(items, params, onAction);
      const arrow = menu.querySelector('.tbw-context-menu-arrow');

      expect(arrow).not.toBeNull();
      expect(arrow?.textContent).toBe('▶');
    });

    it('should call onAction when item with action is clicked', () => {
      const action = vi.fn();
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', action }];

      const menu = createMenuElement(items, params, onAction);
      const menuItem = menu.querySelector('.tbw-context-menu-item');

      menuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onAction).toHaveBeenCalledWith(items[0]);
    });

    it('should not call onAction for disabled items', () => {
      const action = vi.fn();
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', action, disabled: true }];

      const menu = createMenuElement(items, params, onAction);
      const menuItem = menu.querySelector('.tbw-context-menu-item');

      menuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onAction).not.toHaveBeenCalled();
    });

    it('should not call onAction for items with subMenu', () => {
      const action = vi.fn();
      const items: ContextMenuItem[] = [
        {
          id: 'parent',
          name: 'Parent',
          action,
          subMenu: [{ id: 'child', name: 'Child' }],
        },
      ];

      const menu = createMenuElement(items, params, onAction);
      const menuItem = menu.querySelector('.tbw-context-menu-item');

      menuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onAction).not.toHaveBeenCalled();
    });

    it('should handle empty items array', () => {
      const items: ContextMenuItem[] = [];

      const menu = createMenuElement(items, params, onAction);

      expect(menu.children).toHaveLength(0);
    });
  });
});
