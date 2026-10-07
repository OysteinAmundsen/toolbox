import { expect, test, type Page } from '@playwright/test';
import { openDemo } from './utils';

const DEMO = '#hierarchy-tree-grouping-demo';

/** `name` of data rows, `[group value]` of group rows, in render order. */
function labels(page: Page): Promise<string[]> {
  return page
    .locator(`${DEMO} tbw-grid`)
    .evaluate((el) =>
      ((el as unknown as { rows: Array<Record<string, unknown>> }).rows ?? []).map((r) =>
        r.__isGroupRow ? `[${String(r.__groupValue)}]` : String(r.name),
      ),
    );
}

async function setGroupLevels(page: Page, value: string) {
  await page.locator(`${DEMO} input[data-ctrl="groupLevels"][value="${value}"]`).check();
  await page.waitForTimeout(300);
}

const CHILDREN = [
  'Rotterdam Q3',
  '[Cargo]',
  'Brent cargo 0712',
  'Forties cargo 0719',
  '[Deal]',
  'Fixed-price swap',
  'Houston Q3',
  '[Cargo]',
  'LNG cargo 0802',
  '[Deal]',
  'WTI forward',
  'Hamburg Q3',
  '[Cargo]',
  'Diesel cargo 0725',
  '[Deal]',
  'Diesel option',
];

test.describe('Hierarchy Demos', () => {
  test('HierarchyTreeGroupingDemo — groups each tree node’s children', async ({ page }) => {
    await openDemo(page, 'hierarchy/HierarchyTreeGroupingDemo');

    expect(await labels(page)).toEqual(CHILDREN);
    await expect(page.locator(`${DEMO} .rows-body`)).toHaveAttribute('role', 'treegrid');
  });

  test('HierarchyTreeGroupingDemo — every level also groups the roots', async ({ page }) => {
    await openDemo(page, 'hierarchy/HierarchyTreeGroupingDemo');
    await setGroupLevels(page, 'every level');

    const rows = await labels(page);
    expect(rows.slice(0, 3)).toEqual(['[Americas]', 'Houston Q3', '[Cargo]']);
    expect(rows).toContain('[Europe]');
    expect(rows).toContain('Diesel option');
  });

  test('HierarchyTreeGroupingDemo — off shows the plain tree, and grouping comes back expanded', async ({ page }) => {
    await openDemo(page, 'hierarchy/HierarchyTreeGroupingDemo');

    await setGroupLevels(page, 'off');
    const plain = await labels(page);
    expect(plain.some((l) => l.startsWith('['))).toBe(false);
    expect(plain).toHaveLength(10);

    await setGroupLevels(page, 'children');
    expect(await labels(page)).toEqual(CHILDREN);
  });
});
