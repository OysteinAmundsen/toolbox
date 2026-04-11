import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenuPlugin } from './ContextMenuPlugin';
import {
  buildMenuItems,
  collapseSeparators,
  createMenuElement,
  focusFirstMenuItem,
  isItemDisabled,
  positionMenu,
  setupMenuKeyboard,
} from './menu';
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
    selectedRows: [],
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

  describe('collapseSeparators', () => {
    it('should remove consecutive separators', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'sep1', name: '', separator: true },
        { id: 'sep2', name: '', separator: true },
        { id: 'sep3', name: '', separator: true },
        { id: 'item2', name: 'Item 2' },
      ];

      const result = collapseSeparators(items);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('item1');
      expect(result[1].separator).toBe(true);
      expect(result[2].id).toBe('item2');
    });

    it('should remove leading separators', () => {
      const items: ContextMenuItem[] = [
        { id: 'sep1', name: '', separator: true },
        { id: 'item1', name: 'Item 1' },
      ];

      const result = collapseSeparators(items);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item1');
    });

    it('should remove trailing separators', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'sep1', name: '', separator: true },
      ];

      const result = collapseSeparators(items);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item1');
    });

    it('should handle empty array', () => {
      const result = collapseSeparators([]);
      expect(result).toHaveLength(0);
    });

    it('should handle separator-only array', () => {
      const items: ContextMenuItem[] = [
        { id: 'sep1', name: '', separator: true },
        { id: 'sep2', name: '', separator: true },
      ];

      const result = collapseSeparators(items);

      expect(result).toHaveLength(0);
    });

    it('should keep valid single separators between items', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'sep1', name: '', separator: true },
        { id: 'item2', name: 'Item 2' },
      ];

      const result = collapseSeparators(items);

      expect(result).toHaveLength(3);
      expect(result[1].separator).toBe(true);
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

    it('should add icon placeholder when at least one item has an icon', () => {
      const items: ContextMenuItem[] = [
        { id: 'with-icon', name: 'With Icon', icon: '📋' },
        { id: 'without-icon', name: 'Without Icon' },
      ];

      const menu = createMenuElement(items, params, onAction);
      const menuItems = menu.querySelectorAll('.tbw-context-menu-item');
      const icons = menu.querySelectorAll('.tbw-context-menu-icon');

      // Both items should have icon elements
      expect(icons).toHaveLength(2);
      // First has the real icon
      expect(icons[0].innerHTML).toBe('📋');
      // Second has a placeholder
      expect(icons[1].innerHTML).toBe('&nbsp;');
    });

    it('should not add icon placeholder when no items have icons', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', name: 'Item 1' },
        { id: 'item2', name: 'Item 2' },
      ];

      const menu = createMenuElement(items, params, onAction);
      const icons = menu.querySelectorAll('.tbw-context-menu-icon');

      expect(icons).toHaveLength(0);
    });

    it('should sanitize icon HTML to prevent XSS', () => {
      const items: ContextMenuItem[] = [{ id: 'xss', name: 'XSS', icon: '<img src=x onerror="alert(1)">' }];

      const menu = createMenuElement(items, params, onAction);
      const icon = menu.querySelector('.tbw-context-menu-icon');

      expect(icon).not.toBeNull();
      // onerror attribute should be stripped by sanitizeHTML
      expect(icon?.innerHTML).not.toContain('onerror');
    });

    it('should sanitize script tags in icon', () => {
      const items: ContextMenuItem[] = [{ id: 'xss', name: 'XSS', icon: '<script>alert(1)</script>📋' }];

      const menu = createMenuElement(items, params, onAction);
      const icon = menu.querySelector('.tbw-context-menu-icon');

      expect(icon).not.toBeNull();
      expect(icon?.innerHTML).not.toContain('<script');
      expect(icon?.innerHTML).toContain('📋');
    });

    it('should render shortcut string as a single kbd element', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', shortcut: 'Enter' }];

      const menu = createMenuElement(items, params, onAction);
      const shortcut = menu.querySelector('.tbw-context-menu-shortcut');

      expect(shortcut).not.toBeNull();
      expect(shortcut?.textContent).toBe('Enter');
      const kbds = shortcut?.querySelectorAll('kbd');
      expect(kbds).toHaveLength(1);
      expect(kbds?.[0].textContent).toBe('Enter');
    });

    it('should render shortcut array as key combo with + separators', () => {
      const items: ContextMenuItem[] = [{ id: 'test', name: 'Test', shortcut: ['Ctrl', 'C'] }];

      const menu = createMenuElement(items, params, onAction);
      const shortcut = menu.querySelector('.tbw-context-menu-shortcut');

      expect(shortcut).not.toBeNull();
      expect(shortcut?.textContent).toBe('Ctrl+C');
      const kbds = shortcut?.querySelectorAll('kbd');
      expect(kbds).toHaveLength(2);
      expect(kbds?.[0].textContent).toBe('Ctrl');
      expect(kbds?.[1].textContent).toBe('C');
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
      expect(arrow?.getAttribute('data-icon')).toBe('submenu-arrow');
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

  describe('syncSelectionOnContextMenu', () => {
    /**
     * Creates a mock grid with a configurable query function for testing
     * the selection sync behavior.
     */
    function createMockGridForPlugin(queryFn: (...args: unknown[]) => unknown[] = () => []) {
      const grid = document.createElement('div');
      grid.className = 'tbw-grid';

      const container = document.createElement('div');
      container.className = 'tbw-grid-root';
      grid.appendChild(container);

      Object.assign(grid, {
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        columns: [{ field: 'id' }],
        gridConfig: {},
        effectiveConfig: {},
        focusRow: 0,
        focusCol: 0,
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        query: vi.fn(queryFn),
        queryPlugins: vi.fn().mockReturnValue([]),
        _hostElement: grid,
      });

      grid.dispatchEvent = vi.fn();
      return grid;
    }

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should return empty array when rowIndex is negative', () => {
      const plugin = new ContextMenuPlugin();
      const grid = createMockGridForPlugin();
      plugin.attach(grid as never);

      const result = plugin['syncSelectionOnContextMenu'](-1);

      expect(result).toEqual([]);
    });

    it('should return [rowIndex] when no selection plugin is loaded', () => {
      // query returns empty array (no plugin responded)
      const plugin = new ContextMenuPlugin();
      const grid = createMockGridForPlugin(() => []);
      plugin.attach(grid as never);

      const result = plugin['syncSelectionOnContextMenu'](2);

      expect(result).toEqual([2]);
    });

    it('should preserve multi-selection when right-clicked row is already selected', () => {
      const plugin = new ContextMenuPlugin();
      // getSelectedRowIndices returns [0, 2, 3]
      const grid = createMockGridForPlugin((type: unknown) => {
        if (type === 'getSelectedRowIndices') return [[0, 2, 3]];
        return [];
      });
      plugin.attach(grid as never);

      const result = plugin['syncSelectionOnContextMenu'](2);

      expect(result).toEqual([0, 2, 3]);
      // selectRows should NOT have been called
      const queryCalls = (grid as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls;
      const selectRowsCalls = queryCalls.filter((c: unknown[]) => c[0] === 'selectRows');
      expect(selectRowsCalls).toHaveLength(0);
    });

    it('should select only the right-clicked row when it is not in the current selection', () => {
      const plugin = new ContextMenuPlugin();
      const grid = createMockGridForPlugin((type: unknown) => {
        if (type === 'getSelectedRowIndices') return [[0, 1]];
        return [];
      });
      plugin.attach(grid as never);

      const result = plugin['syncSelectionOnContextMenu'](3);

      expect(result).toEqual([3]);
      // selectRows SHOULD have been called with [3]
      const queryCalls = (grid as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls;
      const selectRowsCalls = queryCalls.filter((c: unknown[]) => c[0] === 'selectRows');
      expect(selectRowsCalls).toHaveLength(1);
      expect(selectRowsCalls[0][1]).toEqual([3]);
    });

    it('should select the right-clicked row when selection is empty', () => {
      const plugin = new ContextMenuPlugin();
      const grid = createMockGridForPlugin((type: unknown) => {
        if (type === 'getSelectedRowIndices') return [[]];
        return [];
      });
      plugin.attach(grid as never);

      const result = plugin['syncSelectionOnContextMenu'](1);

      expect(result).toEqual([1]);
      // selectRows should have been called
      const queryCalls = (grid as unknown as { query: ReturnType<typeof vi.fn> }).query.mock.calls;
      const selectRowsCalls = queryCalls.filter((c: unknown[]) => c[0] === 'selectRows');
      expect(selectRowsCalls).toHaveLength(1);
      expect(selectRowsCalls[0][1]).toEqual([1]);
    });
  });

  describe('collectPluginItems', () => {
    function createMockGrid(queryFn: (...args: unknown[]) => unknown[] = () => []) {
      const grid = document.createElement('div');
      Object.assign(grid, {
        rows: [],
        columns: [],
        gridConfig: {},
        effectiveConfig: {},
        focusRow: 0,
        focusCol: 0,
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        query: vi.fn(queryFn),
        queryPlugins: vi.fn().mockReturnValue([]),
        _hostElement: grid,
      });
      grid.dispatchEvent = vi.fn();
      return grid;
    }

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should collect items from plugin query responses', () => {
      const plugin = new ContextMenuPlugin();
      const grid = createMockGrid((type: unknown) => {
        if (type === 'getContextMenuItems') {
          return [
            [
              {
                id: 'hide',
                label: 'Hide Column',
                icon: '👁',
                order: 30,
                action: () => {
                  /* noop */
                },
              },
            ],
            [
              {
                id: 'clear-filter',
                label: 'Clear Filter',
                icon: '✕',
                order: 20,
                action: () => {
                  /* noop */
                },
              },
            ],
          ];
        }
        return [];
      });
      plugin.attach(grid as never);

      const params = createMockParams({ isHeader: true });
      const result = plugin['collectPluginItems'](params);

      // Should be sorted by order (20 before 30), with separator between groups
      expect(result.length).toBeGreaterThanOrEqual(2);
      const nonSeparators = result.filter((i) => !i.separator);
      expect(nonSeparators[0].id).toBe('clear-filter');
      expect(nonSeparators[1].id).toBe('hide');
    });

    it('should return empty array when no plugins respond', () => {
      const plugin = new ContextMenuPlugin();
      const grid = createMockGrid(() => []);
      plugin.attach(grid as never);

      const params = createMockParams({ isHeader: true });
      const result = plugin['collectPluginItems'](params);

      expect(result).toEqual([]);
    });

    it('should filter out non-array responses', () => {
      const plugin = new ContextMenuPlugin();
      const grid = createMockGrid((type: unknown) => {
        if (type === 'getContextMenuItems') return [undefined, null, 'invalid'];
        return [];
      });
      plugin.attach(grid as never);

      const params = createMockParams({ isHeader: true });
      const result = plugin['collectPluginItems'](params);

      expect(result).toEqual([]);
    });
  });

  describe('insertGroupSeparators', () => {
    it('should insert separators between different order groups', () => {
      const plugin = new ContextMenuPlugin();
      const items = [
        {
          id: 'a',
          label: 'A',
          order: 20,
          action: () => {
            /* noop */
          },
        },
        {
          id: 'b',
          label: 'B',
          order: 21,
          action: () => {
            /* noop */
          },
        },
        {
          id: 'c',
          label: 'C',
          order: 30,
          action: () => {
            /* noop */
          },
        },
      ];

      const result = plugin['insertGroupSeparators'](items);

      // group 2 (20, 21) and group 3 (30) → separator between them
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('a');
      expect(result[1].id).toBe('b');
      expect(result[2].separator).toBe(true);
      expect(result[3].id).toBe('c');
    });

    it('should not insert separators within the same group', () => {
      const plugin = new ContextMenuPlugin();
      const items = [
        {
          id: 'a',
          label: 'A',
          order: 20,
          action: () => {
            /* noop */
          },
        },
        {
          id: 'b',
          label: 'B',
          order: 21,
          action: () => {
            /* noop */
          },
        },
      ];

      const result = plugin['insertGroupSeparators'](items);

      expect(result).toHaveLength(2);
      expect(result.every((i) => !i.separator)).toBe(true);
    });

    it('should return empty array for empty input', () => {
      const plugin = new ContextMenuPlugin();
      const result = plugin['insertGroupSeparators']([]);

      expect(result).toEqual([]);
    });

    it('should return single item unchanged', () => {
      const plugin = new ContextMenuPlugin();
      const items = [
        {
          id: 'a',
          label: 'A',
          order: 10,
          action: () => {
            /* noop */
          },
        },
      ];

      const result = plugin['insertGroupSeparators'](items);

      expect(result).toHaveLength(1);
    });
  });

  describe('convertPluginItems', () => {
    it('should convert HeaderContextMenuItems to ContextMenuItems', () => {
      const plugin = new ContextMenuPlugin();
      const action = vi.fn();
      const items = [{ id: 'test', label: 'Test Item', icon: '📋', shortcut: 'Ctrl+H', action }];

      const result = plugin['convertPluginItems'](items);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test');
      expect(result[0].name).toBe('Test Item');
      expect(result[0].icon).toBe('📋');
      expect(result[0].shortcut).toBe('Ctrl+H');
      // Should wrap action
      result[0].action?.({} as ContextMenuParams);
      expect(action).toHaveBeenCalled();
    });

    it('should convert disabled items correctly', () => {
      const plugin = new ContextMenuPlugin();
      const items = [
        {
          id: 'disabled',
          label: 'Disabled',
          disabled: true,
          action: () => {
            /* noop */
          },
        },
      ];

      const result = plugin['convertPluginItems'](items);

      expect(result[0].disabled).toBe(true);
    });

    it('should convert separator items correctly', () => {
      const plugin = new ContextMenuPlugin();
      const items = [
        {
          id: 'sep',
          label: '',
          separator: true as const,
          action: () => {
            /* noop */
          },
        },
      ];

      const result = plugin['convertPluginItems'](items);

      expect(result[0].separator).toBe(true);
    });
  });

  describe('cross-grid menu exclusivity', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should close menu from other grids when opening a new one', () => {
      // Simulate an existing menu in the DOM (from another grid instance)
      const existingMenu = document.createElement('div');
      existingMenu.className = 'tbw-context-menu';
      document.body.appendChild(existingMenu);

      const plugin = new ContextMenuPlugin({
        items: [
          {
            id: 'test',
            name: 'Test',
            action: () => {
              /* noop */
            },
          },
        ],
      });
      const grid = document.createElement('div');
      grid.className = 'tbw-grid';
      const container = document.createElement('div');
      container.className = 'tbw-grid-root';
      grid.appendChild(container);
      Object.assign(grid, {
        rows: [{ id: 1 }],
        columns: [{ field: 'id' }],
        gridConfig: {},
        effectiveConfig: {},
        focusRow: 0,
        focusCol: 0,
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        query: vi.fn(() => []),
        queryPlugins: vi.fn().mockReturnValue([]),
        _hostElement: grid,
      });
      grid.dispatchEvent = vi.fn();
      document.body.appendChild(grid);

      plugin.attach(grid as never);
      plugin.showMenu(100, 100, { rowIndex: 0, field: 'id', value: '1' });

      // The old menu from another grid should be removed
      expect(document.body.contains(existingMenu)).toBe(false);
      // Only the new menu should exist
      const menus = document.querySelectorAll('.tbw-context-menu');
      expect(menus).toHaveLength(1);

      plugin.detach();
    });
  });

  describe('scroll closes menu', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should close menu when a scroll event fires', () => {
      const plugin = new ContextMenuPlugin({
        items: [
          {
            id: 'test',
            name: 'Test',
            action: () => {
              /* noop */
            },
          },
        ],
      });
      const grid = document.createElement('div');
      grid.className = 'tbw-grid';
      const container = document.createElement('div');
      container.className = 'tbw-grid-root';
      grid.appendChild(container);
      Object.assign(grid, {
        rows: [{ id: 1 }],
        columns: [{ field: 'id' }],
        gridConfig: {},
        effectiveConfig: {},
        focusRow: 0,
        focusCol: 0,
        disconnectSignal: new AbortController().signal,
        requestRender: vi.fn(),
        requestAfterRender: vi.fn(),
        forceLayout: vi.fn().mockResolvedValue(undefined),
        getPlugin: vi.fn(),
        getPluginByName: vi.fn(),
        query: vi.fn(() => []),
        queryPlugins: vi.fn().mockReturnValue([]),
        _hostElement: grid,
      });
      grid.dispatchEvent = vi.fn();
      document.body.appendChild(grid);

      plugin.attach(grid as never);
      plugin.showMenu(100, 100, { rowIndex: 0, field: 'id', value: '1' });
      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(1);

      // Simulate a scroll event (uses capture, so dispatch on document)
      document.dispatchEvent(new Event('scroll'));

      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(0);

      plugin.detach();
    });
  });

  describe('keyboard navigation', () => {
    describe('setupMenuKeyboard', () => {
      let menu: HTMLElement;
      let onClose: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        const items: ContextMenuItem[] = [
          { id: 'item1', name: 'Item 1', action: vi.fn() },
          { id: 'item2', name: 'Item 2', action: vi.fn() },
          { id: 'item3', name: 'Item 3', action: vi.fn(), disabled: true },
          { id: 'item4', name: 'Item 4', action: vi.fn() },
        ];
        const params = createMockParams();
        onClose = vi.fn();
        menu = createMenuElement(items, params, vi.fn());
        document.body.appendChild(menu);
        setupMenuKeyboard(menu, onClose);
      });

      afterEach(() => {
        menu.remove();
      });

      it('should move focus down with ArrowDown', () => {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        items[0].focus();

        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.activeElement).toBe(items[1]);
      });

      it('should wrap focus from last to first with ArrowDown', () => {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        // Focus the last non-disabled item
        items[items.length - 1].focus();

        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(document.activeElement).toBe(items[0]);
      });

      it('should move focus up with ArrowUp', () => {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        items[1].focus();

        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(document.activeElement).toBe(items[0]);
      });

      it('should wrap focus from first to last with ArrowUp', () => {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        items[0].focus();

        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(document.activeElement).toBe(items[items.length - 1]);
      });

      it('should activate item with Enter', () => {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        const clickSpy = vi.spyOn(items[0], 'click');
        items[0].focus();

        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(clickSpy).toHaveBeenCalled();
      });

      it('should activate item with Space', () => {
        const items = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        const clickSpy = vi.spyOn(items[0], 'click');
        items[0].focus();

        menu.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        expect(clickSpy).toHaveBeenCalled();
      });

      it('should call onClose with Escape', () => {
        menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(onClose).toHaveBeenCalled();
      });

      it('should skip disabled items', () => {
        // item3 is disabled — disabled items should not appear in non-disabled query
        const enabledItems = menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not(.disabled)');
        expect(enabledItems).toHaveLength(3); // item1, item2, item4
      });
    });

    describe('focusFirstMenuItem', () => {
      it('should focus the first non-disabled item', () => {
        const items: ContextMenuItem[] = [
          { id: 'disabled1', name: 'Disabled', disabled: true },
          { id: 'first', name: 'First Enabled' },
          { id: 'second', name: 'Second' },
        ];
        const params = createMockParams();
        const menu = createMenuElement(items, params, vi.fn());
        document.body.appendChild(menu);

        focusFirstMenuItem(menu);

        const focused = document.activeElement as HTMLElement;
        expect(focused?.getAttribute('data-id')).toBe('first');

        menu.remove();
      });
    });

    describe('menu items have tabindex', () => {
      it('should set tabindex="-1" on menu items', () => {
        const items: ContextMenuItem[] = [
          { id: 'item1', name: 'Item 1' },
          { id: 'item2', name: 'Item 2' },
        ];
        const params = createMockParams();
        const menu = createMenuElement(items, params, vi.fn());

        const menuItems = menu.querySelectorAll('[role="menuitem"]');
        menuItems.forEach((item) => {
          expect(item.getAttribute('tabindex')).toBe('-1');
        });
      });
    });
  });

  // #region Integration tests (plugin-level with mock grid)

  /**
   * Creates a mock grid element with a `.tbw-grid-root` container and data cells.
   * Returns { grid, plugin } ready for integration testing.
   */
  function createMockGrid(
    config: Partial<import('./types').ContextMenuConfig> = {},
    options: { rows?: Record<string, unknown>[]; columns?: { field: string; header?: string }[] } = {},
  ) {
    const rows = options.rows ?? [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const columns = options.columns ?? [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
    ];

    const plugin = new ContextMenuPlugin({
      items: [
        { id: 'copy', name: 'Copy', action: vi.fn() },
        { id: 'delete', name: 'Delete', action: vi.fn() },
      ],
      ...config,
    });

    const grid = document.createElement('div');
    grid.className = 'tbw-grid';

    // Build container with rows + cells
    const container = document.createElement('div');
    container.className = 'tbw-grid-root';

    // Header row
    const headerRow = document.createElement('div');
    headerRow.setAttribute('role', 'row');
    columns.forEach((col, ci) => {
      const headerCell = document.createElement('div');
      headerCell.setAttribute('part', 'header-cell');
      headerCell.setAttribute('data-col', String(ci));
      headerCell.textContent = col.header ?? col.field;
      headerRow.appendChild(headerCell);
    });
    container.appendChild(headerRow);

    // Data rows with cells
    rows.forEach((row, ri) => {
      const rowEl = document.createElement('div');
      rowEl.setAttribute('role', 'row');
      columns.forEach((col, ci) => {
        const cell = document.createElement('div');
        cell.setAttribute('data-row', String(ri));
        cell.setAttribute('data-col', String(ci));
        cell.textContent = String(row[col.field] ?? '');
        rowEl.appendChild(cell);
      });
      container.appendChild(rowEl);
    });

    grid.appendChild(container);

    Object.assign(grid, {
      rows,
      columns,
      _visibleColumns: columns,
      gridConfig: {},
      effectiveConfig: {},
      _focusRow: 0,
      _focusCol: 0,
      disconnectSignal: new AbortController().signal,
      requestRender: vi.fn(),
      requestAfterRender: vi.fn(),
      forceLayout: vi.fn().mockResolvedValue(undefined),
      getPlugin: vi.fn(),
      getPluginByName: vi.fn(),
      query: vi.fn(() => []),
      queryPlugins: vi.fn().mockReturnValue([]),
      _hostElement: grid,
    });
    grid.dispatchEvent = vi.fn();
    document.body.appendChild(grid);

    plugin.attach(grid as never);

    return { grid, plugin, container, rows, columns };
  }

  describe('onKeyDown', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should open context menu on Shift+F10', () => {
      const { plugin } = createMockGrid();

      const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      plugin.onKeyDown(event);

      expect(preventSpy).toHaveBeenCalled();
      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(1);
      expect(plugin.isMenuOpen()).toBe(true);

      plugin.detach();
    });

    it('should open context menu on ContextMenu key', () => {
      const { plugin } = createMockGrid();

      const event = new KeyboardEvent('keydown', { key: 'ContextMenu' });
      plugin.onKeyDown(event);

      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(1);
      expect(plugin.isMenuOpen()).toBe(true);

      plugin.detach();
    });

    it('should ignore other keys', () => {
      const { plugin } = createMockGrid();

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(0);

      plugin.detach();
    });

    it('should ignore F10 without Shift', () => {
      const { plugin } = createMockGrid();

      const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: false });
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(0);

      plugin.detach();
    });

    it('should return true when menu is opened', () => {
      const { plugin } = createMockGrid();

      const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true });
      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);

      plugin.detach();
    });

    it('should build params from the focused cell', () => {
      const actionFn = vi.fn();
      const { grid, plugin } = createMockGrid({
        items: [{ id: 'test', name: 'Test', action: actionFn }],
      });

      // Set focus to row 1, col 1 (Bob, name)
      (grid as any)._focusRow = 1;
      (grid as any)._focusCol = 1;

      const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true });
      plugin.onKeyDown(event);

      // Click the menu item to verify params are correct
      const menuItem = document.querySelector<HTMLElement>('[role="menuitem"]');
      menuItem?.click();

      expect(actionFn).toHaveBeenCalledWith(
        expect.objectContaining({
          rowIndex: 1,
          columnIndex: 1,
          field: 'name',
          value: 'Bob',
          isHeader: false,
        }),
      );

      plugin.detach();
    });

    it('should focus first menu item when opened via keyboard', () => {
      const { plugin } = createMockGrid();

      const event = new KeyboardEvent('keydown', { key: 'F10', shiftKey: true });
      plugin.onKeyDown(event);

      const firstItem = document.querySelector<HTMLElement>('[role="menuitem"]');
      expect(document.activeElement).toBe(firstItem);

      plugin.detach();
    });
  });

  describe('afterRender', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should bind contextmenu handler on afterRender', () => {
      const { container, plugin } = createMockGrid();
      plugin.afterRender();

      expect(container.getAttribute('data-context-menu-bound')).toBe('true');

      plugin.detach();
    });

    it('should not double-bind on repeated afterRender calls', () => {
      const { container, plugin } = createMockGrid();
      plugin.afterRender();
      plugin.afterRender();

      // If double-bound, two context menus would appear; verify only one handler
      expect(container.getAttribute('data-context-menu-bound')).toBe('true');

      plugin.detach();
    });

    it('should open menu on right-click of a data cell', () => {
      const { container, plugin } = createMockGrid();
      plugin.afterRender();

      const cell = container.querySelector('[data-row="0"][data-col="0"]')!;
      const event = new MouseEvent('contextmenu', { bubbles: true });
      cell.dispatchEvent(event);

      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(1);

      plugin.detach();
    });

    it('should open menu on right-click of a header cell', () => {
      const { container, plugin } = createMockGrid();
      plugin.afterRender();

      const header = container.querySelector('[part~="header-cell"]')!;
      const event = new MouseEvent('contextmenu', { bubbles: true });
      header.dispatchEvent(event);

      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(1);

      plugin.detach();
    });

    it('should not open menu on right-click outside cells', () => {
      const { container, plugin } = createMockGrid();
      plugin.afterRender();

      // Click on the container itself, not on a cell
      const event = new MouseEvent('contextmenu', { bubbles: false });
      container.dispatchEvent(event);

      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(0);

      plugin.detach();
    });
  });

  describe('hideMenu / isMenuOpen', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should report isMenuOpen as false when no menu is open', () => {
      const { plugin } = createMockGrid();

      expect(plugin.isMenuOpen()).toBe(false);

      plugin.detach();
    });

    it('should report isMenuOpen as true after showMenu', () => {
      const { plugin } = createMockGrid();

      plugin.showMenu(100, 100, { rowIndex: 0, field: 'id', value: '1' });

      expect(plugin.isMenuOpen()).toBe(true);

      plugin.detach();
    });

    it('should hide menu and report closed after hideMenu', () => {
      const { plugin } = createMockGrid();

      plugin.showMenu(100, 100, { rowIndex: 0, field: 'id', value: '1' });
      expect(plugin.isMenuOpen()).toBe(true);
      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(1);

      plugin.hideMenu();

      expect(plugin.isMenuOpen()).toBe(false);
      expect(document.querySelectorAll('.tbw-context-menu')).toHaveLength(0);

      plugin.detach();
    });

    it('should be safe to call hideMenu when no menu is open', () => {
      const { plugin } = createMockGrid();

      expect(() => plugin.hideMenu()).not.toThrow();
      expect(plugin.isMenuOpen()).toBe(false);

      plugin.detach();
    });
  });
  // #endregion
});
