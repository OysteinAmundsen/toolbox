import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMenuItems, createMenuElement, isItemDisabled, positionMenu } from './menu';
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

    it('should render custom submenu arrow when provided as string', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'parent',
          name: 'Parent',
          subMenu: [{ id: 'child', name: 'Child' }],
        },
      ];

      const menu = createMenuElement(items, params, onAction, '→');
      const arrow = menu.querySelector('.tbw-context-menu-arrow');

      expect(arrow).not.toBeNull();
      expect(arrow?.innerHTML).toBe('→');
    });

    it('should render custom submenu arrow when provided as HTMLElement', () => {
      const customArrow = document.createElement('span');
      customArrow.className = 'custom-arrow-icon';
      customArrow.textContent = '>';

      const items: ContextMenuItem[] = [
        {
          id: 'parent',
          name: 'Parent',
          subMenu: [{ id: 'child', name: 'Child' }],
        },
      ];

      const menu = createMenuElement(items, params, onAction, customArrow);
      const arrow = menu.querySelector('.tbw-context-menu-arrow');
      const clonedArrow = arrow?.querySelector('.custom-arrow-icon');

      expect(arrow).not.toBeNull();
      expect(clonedArrow).not.toBeNull();
      expect(clonedArrow?.textContent).toBe('>');
    });

    describe('submenu hover interactions', () => {
      it('should show submenu on mouseenter', () => {
        const items: ContextMenuItem[] = [
          {
            id: 'parent',
            name: 'Parent',
            subMenu: [{ id: 'child', name: 'Child Item' }],
          },
        ];

        const menu = createMenuElement(items, params, onAction);
        const parentItem = menu.querySelector('.tbw-context-menu-item');

        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const subMenu = parentItem?.querySelector('.tbw-context-submenu');
        expect(subMenu).not.toBeNull();
        expect(subMenu?.classList.contains('tbw-context-menu')).toBe(true);
      });

      it('should remove submenu on mouseleave', () => {
        const items: ContextMenuItem[] = [
          {
            id: 'parent',
            name: 'Parent',
            subMenu: [{ id: 'child', name: 'Child' }],
          },
        ];

        const menu = createMenuElement(items, params, onAction);
        const parentItem = menu.querySelector('.tbw-context-menu-item');

        // First trigger mouseenter to create submenu
        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(parentItem?.querySelector('.tbw-context-submenu')).not.toBeNull();

        // Then trigger mouseleave to remove it
        parentItem?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        expect(parentItem?.querySelector('.tbw-context-submenu')).toBeNull();
      });

      it('should not create duplicate submenu on repeated mouseenter', () => {
        const items: ContextMenuItem[] = [
          {
            id: 'parent',
            name: 'Parent',
            subMenu: [{ id: 'child', name: 'Child' }],
          },
        ];

        const menu = createMenuElement(items, params, onAction);
        const parentItem = menu.querySelector('.tbw-context-menu-item');

        // Trigger mouseenter multiple times
        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const subMenus = parentItem?.querySelectorAll('.tbw-context-submenu');
        expect(subMenus).toHaveLength(1);
      });

      it('should position submenu correctly', () => {
        const items: ContextMenuItem[] = [
          {
            id: 'parent',
            name: 'Parent',
            subMenu: [{ id: 'child', name: 'Child' }],
          },
        ];

        const menu = createMenuElement(items, params, onAction);
        const parentItem = menu.querySelector('.tbw-context-menu-item') as HTMLElement;

        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const subMenu = parentItem?.querySelector('.tbw-context-submenu') as HTMLElement;
        expect(subMenu?.style.position).toBe('absolute');
        expect(subMenu?.style.left).toBe('100%');
        expect(subMenu?.style.top).toBe('0px');
        expect(parentItem?.style.position).toBe('relative');
      });

      it('should filter hidden items in submenu', () => {
        const items: ContextMenuItem[] = [
          {
            id: 'parent',
            name: 'Parent',
            subMenu: [
              { id: 'visible', name: 'Visible' },
              { id: 'hidden', name: 'Hidden', hidden: true },
            ],
          },
        ];

        const menu = createMenuElement(items, params, onAction);
        const parentItem = menu.querySelector('.tbw-context-menu-item');

        parentItem?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        const subMenu = parentItem?.querySelector('.tbw-context-submenu');
        const subMenuItems = subMenu?.querySelectorAll('.tbw-context-menu-item');
        expect(subMenuItems).toHaveLength(1);
        expect(subMenuItems?.[0].getAttribute('data-id')).toBe('visible');
      });
    });
  });

  describe('positionMenu', () => {
    let menu: HTMLElement;

    beforeEach(() => {
      menu = document.createElement('div');
      menu.style.width = '200px';
      menu.style.height = '150px';
      document.body.appendChild(menu);
    });

    afterEach(() => {
      menu.remove();
    });

    it('should set fixed positioning', () => {
      positionMenu(menu, 100, 100);

      expect(menu.style.position).toBe('fixed');
    });

    it('should set high z-index for top-layer behavior', () => {
      positionMenu(menu, 100, 100);

      expect(menu.style.zIndex).toBe('10000');
    });

    it('should set visibility to visible', () => {
      positionMenu(menu, 100, 100);

      expect(menu.style.visibility).toBe('visible');
    });

    it('should position menu at specified coordinates', () => {
      // Mock viewport large enough
      Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });

      positionMenu(menu, 200, 300);

      expect(menu.style.left).toBe('200px');
      expect(menu.style.top).toBe('300px');
    });

    it('should flip menu left when overflowing right edge', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });

      // Mock getBoundingClientRect
      vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 150,
        left: 450,
        top: 100,
        right: 650,
        bottom: 250,
        x: 450,
        y: 100,
        toJSON: () => ({}),
      });

      positionMenu(menu, 450, 100);

      // Should flip to left (450 - 200 = 250)
      expect(menu.style.left).toBe('250px');
    });

    it('should flip menu up when overflowing bottom edge', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });

      vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 150,
        left: 100,
        top: 400,
        right: 300,
        bottom: 550,
        x: 100,
        y: 400,
        toJSON: () => ({}),
      });

      positionMenu(menu, 100, 400);

      // Should flip up (400 - 150 = 250)
      expect(menu.style.top).toBe('250px');
    });

    it('should not go negative on left edge', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });

      vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 150,
        left: 50,
        top: 100,
        right: 250,
        bottom: 250,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      });

      // x would flip to -150, but should clamp to 0
      positionMenu(menu, 50, 100);

      const left = parseInt(menu.style.left, 10);
      expect(left).toBeGreaterThanOrEqual(0);
    });

    it('should not go negative on top edge', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });

      vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 150,
        left: 100,
        top: 50,
        right: 300,
        bottom: 200,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      });

      // y would flip to -100, but should clamp to 0
      positionMenu(menu, 100, 50);

      const top = parseInt(menu.style.top, 10);
      expect(top).toBeGreaterThanOrEqual(0);
    });
  });
});
