import { test } from '@playwright/test';
import { DEMOS, waitForGridReady } from './utils';

test('probe', async ({ page }) => {
  await page.goto(DEMOS.vanilla);
  await waitForGridReady(page);

  console.log(
    'first row cells:',
    JSON.stringify(
      await page.evaluate(() => {
        const row = document.querySelector('tbw-grid [role="row"]:has([role="gridcell"])');
        return [...(row?.querySelectorAll('[role="gridcell"]') ?? [])]
          .slice(0, 4)
          .map((c) => ({ field: c.getAttribute('data-field'), cls: c.className }));
      }),
    ),
  );

  console.log(
    '[data-field=status]:',
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll('[data-field="status"]')]
          .slice(0, 4)
          .map((e) => ({ tag: e.tagName, role: e.getAttribute('role'), cls: e.className })),
      ),
    ),
  );

  const controls = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('tbw-grid input, tbw-grid select')].slice(0, 6).map((e) => ({
        tag: e.tagName,
        cls: (e as HTMLElement).className,
        visible: !!((e as HTMLElement).offsetWidth || (e as HTMLElement).offsetHeight),
      })),
    );

  console.log('before:', JSON.stringify(await controls()));

  const firstCell = page.locator('[role="row"]:has([role="gridcell"])').first().locator('[role="gridcell"]').first();
  await firstCell.dblclick();
  await page.waitForTimeout(300);
  console.log('after dblclick first cell:', JSON.stringify(await controls()));
});
