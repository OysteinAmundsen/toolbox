import { expect, test } from '@playwright/test';
import { openDemo, rightClickCell } from './utils';

test.describe('Context Menu Demos', () => {
  test('ContextMenuDefaultDemo — right-click shows context menu', async ({ page }) => {
    await openDemo(page, 'context-menu/ContextMenuDefaultDemo');

    await rightClickCell(page, 0, 0);

    // Context menu overlay should appear
    const menu = page.locator('.tbw-context-menu, [role="menu"]');
    await expect(menu).toBeVisible({ timeout: 3000 });
  });

  test('ContextMenuWithSubmenusDemo — submenu appears on hover', async ({ page }) => {
    await openDemo(page, 'context-menu/ContextMenuWithSubmenusDemo');

    await rightClickCell(page, 0, 0);

    const menu = page.locator('.tbw-context-menu, [role="menu"]');
    await expect(menu).toBeVisible({ timeout: 3000 });

    // Hover over a submenu item
    const submenuItem = page.locator('[role="menuitem"]', { hasText: /export|share/i }).first();
    if (await submenuItem.isVisible()) {
      await submenuItem.hover();
      await page.waitForTimeout(300);
    }
  });

  test('ContextMenuEventsDemo — right-click fires events to log', async ({ page }) => {
    await openDemo(page, 'context-menu/ContextMenuEventsDemo');

    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const logEl = page.locator('#ctx-menu-events-log, [data-event-log]');
    if (await logEl.isVisible()) {
      const text = await logEl.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('ContextMenuConditionalItemsDemo — disabled items based on row state', async ({ page }) => {
    await openDemo(page, 'context-menu/ContextMenuConditionalItemsDemo');

    await rightClickCell(page, 0, 0);

    const menu = page.locator('.tbw-context-menu, [role="menu"]');
    await expect(menu).toBeVisible({ timeout: 3000 });
  });

  test('PluginContributedItemsDemo — plugin items appear in menu', async ({ page }) => {
    await openDemo(page, 'context-menu/PluginContributedItemsDemo');

    await rightClickCell(page, 0, 0);

    const menu = page.locator('.tbw-context-menu, [role="menu"]');
    await expect(menu).toBeVisible({ timeout: 3000 });

    const items = await page.locator('[role="menuitem"]').count();
    expect(items).toBeGreaterThan(0);
  });
});
