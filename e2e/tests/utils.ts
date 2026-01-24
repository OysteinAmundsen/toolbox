import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Demo application URLs with their configured ports
 * Ports are configured in each demo's project.json
 */
export const DEMOS = {
  vanilla: 'http://localhost:4000',
  react: 'http://localhost:4300',
  angular: 'http://localhost:4200',
} as const;

export type DemoName = keyof typeof DEMOS;

/**
 * Common grid selectors used across all frameworks
 * Note: Using ARIA role selectors for robustness across demos
 */
export const SELECTORS = {
  // Core grid elements - using ARIA roles for reliability
  grid: 'tbw-grid',
  container: '.tbw-grid-root',
  header: '[role="rowgroup"]:first-child',
  headerRow: '[role="row"]:has([role="columnheader"])',
  headerCell: '[role="columnheader"]',
  body: '.rows-viewport',
  row: '[role="row"]:has([role="gridcell"])',
  cell: '[role="gridcell"]',

  // Detail/master-detail
  detailRow: '.master-detail-row',
  detailContent: '.master-detail-cell',
  expandButton: '.master-detail-toggle',

  // Shell elements
  shellHeader: '.tbw-shell-header',
  shellTitle: '.tbw-shell-title',
  toolPanel: '.tbw-tool-panel',

  // Custom renderers (from demo implementations)
  statusBadge: '.status-badge',
  ratingDisplay: '.rating-display',
  topPerformer: '.top-performer-star',

  // Editor elements
  statusEditor: 'select',
  ratingEditor: '.star-rating, input[type="range"]',

  // Responsive
  responsiveCard: '.responsive-employee-card',

  // Interactive elements
  resizeHandle: '.resize-handle',
  sortIndicator: '[part~="sort-indicator"], .sort-indicator',
} as const;

/**
 * Wait for the grid to be fully rendered and stable
 */
export async function waitForGridReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for grid element to exist
  await page.waitForSelector(SELECTORS.grid, { state: 'attached', timeout });

  // Wait for grid to be ready (has rendered rows) using ARIA role
  await page.waitForSelector(`${SELECTORS.grid} [role="row"]`, {
    state: 'visible',
    timeout,
  });

  // Small delay for any animations to complete
  await page.waitForTimeout(500);
}

/**
 * Wait for the grid to be ready in mobile/responsive mode.
 * In responsive card mode, normal rows may not be visible, so we wait for
 * either responsive cards OR visible rows.
 */
export async function waitForGridReadyMobile(page: Page, timeout = 30000): Promise<void> {
  // Wait for grid element to exist
  await page.waitForSelector(SELECTORS.grid, { state: 'attached', timeout });

  // In mobile mode, wait for either:
  // 1. Responsive cards to appear, OR
  // 2. Regular visible rows (if responsive plugin is not active)
  // 3. The grid container to be visible (fallback)
  await Promise.race([
    page.waitForSelector(`${SELECTORS.grid} ${SELECTORS.responsiveCard}`, { state: 'visible', timeout }),
    page.waitForSelector(`${SELECTORS.grid} [role="gridcell"]`, { state: 'visible', timeout }),
    page.waitForSelector(`${SELECTORS.grid} ${SELECTORS.container}`, { state: 'visible', timeout }),
  ]);

  // Small delay for any animations to complete
  await page.waitForTimeout(500);
}

/**
 * Hide the shell header title to exclude framework name from screenshots
 */
export async function hideShellTitle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const title = document.querySelector('.tbw-shell-title');
    if (title) {
      (title as HTMLElement).style.visibility = 'hidden';
    }
  });
}

/**
 * Get locators for elements that should be masked in visual comparisons
 */
export function getMaskLocators(page: Page): Locator[] {
  return [page.locator(SELECTORS.shellTitle)];
}

/**
 * Take a screenshot of the grid area with title hidden
 */
export async function captureGridScreenshot(page: Page): Promise<Buffer> {
  await hideShellTitle(page);
  const grid = page.locator(SELECTORS.grid);
  return await grid.screenshot({ animations: 'disabled' });
}

/**
 * Get the framework identifier expected in the shell title
 */
export function getExpectedFrameworkLabel(demo: DemoName): string {
  switch (demo) {
    case 'vanilla':
      return '(JS)';
    case 'react':
      return '(React)';
    case 'angular':
      return '(Angular)';
  }
}

/**
 * Verify the shell title contains the correct framework identifier
 */
export async function verifyFrameworkTitle(page: Page, demo: DemoName): Promise<void> {
  const shellTitle = page.locator(SELECTORS.shellTitle);
  await expect(shellTitle).toBeVisible();

  const titleText = await shellTitle.textContent();
  const expectedLabel = getExpectedFrameworkLabel(demo);

  expect(titleText).toContain(expectedLabel);
  expect(titleText).toContain('Employee Management System');
}

/**
 * Double-click a cell to activate editing
 */
export async function activateCellEditor(page: Page, field: string): Promise<Locator> {
  const cell = page.locator(`[data-field="${field}"]`).first();
  await cell.dblclick();
  await page.waitForTimeout(300);
  return cell;
}

/**
 * Cancel active editor (press Escape)
 */
export async function cancelEditor(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
}

/**
 * Set viewport to mobile dimensions
 */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 667 });
}

/**
 * Set viewport to tablet dimensions
 */
export async function setTabletViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 768, height: 1024 });
}

/**
 * Set viewport to desktop dimensions
 */
export async function setDesktopViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
}

/**
 * Count visible rows in the grid
 */
export async function countVisibleRows(page: Page): Promise<number> {
  const rows = page.locator(SELECTORS.row);
  return await rows.count();
}

/**
 * Get all header cell texts
 */
export async function getHeaderTexts(page: Page): Promise<string[]> {
  const headerCells = page.locator(SELECTORS.headerCell);
  const count = await headerCells.count();
  const texts: string[] = [];

  for (let i = 0; i < count; i++) {
    const text = await headerCells.nth(i).textContent();
    if (text) {
      texts.push(text.trim());
    }
  }

  return texts;
}

/**
 * Click on a header cell to trigger sorting
 */
export async function clickHeader(page: Page, headerText: string): Promise<void> {
  const header = page.locator(SELECTORS.headerCell).filter({ hasText: headerText });
  await header.click();
  await page.waitForTimeout(300);
}

/**
 * Expand a detail row by clicking the expand button
 */
export async function expandDetailRow(page: Page, rowIndex = 0): Promise<boolean> {
  const expandButtons = page.locator(SELECTORS.expandButton);
  const count = await expandButtons.count();

  if (count > rowIndex) {
    await expandButtons.nth(rowIndex).click();
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

/**
 * Collapse a detail row
 */
export async function collapseDetailRow(page: Page, rowIndex = 0): Promise<void> {
  const expandButtons = page.locator(SELECTORS.expandButton);
  await expandButtons.nth(rowIndex).click();
  await page.waitForTimeout(300);
}

/**
 * Check if detail row is visible
 */
export async function isDetailRowVisible(page: Page): Promise<boolean> {
  const detailRow = page.locator(SELECTORS.detailRow).first();
  return await detailRow.isVisible().catch(() => false);
}

/**
 * Check if a visual snapshot baseline exists.
 * Used to skip visual regression tests gracefully on first run.
 *
 * @param testInfo - Playwright test info object
 * @param snapshotName - Name of the snapshot file (e.g., 'initial-grid-baseline.png')
 * @returns true if snapshot exists, false otherwise
 */
export function snapshotExists(testInfo: TestInfo, snapshotName: string): boolean {
  // Playwright stores snapshots in a folder named after the test file
  // e.g., e2e/snapshots/cross-framework-visual.spec.ts-snapshots/
  const snapshotDir = testInfo.snapshotDir;
  const snapshotPath = resolve(snapshotDir, snapshotName);
  return existsSync(snapshotPath);
}

/**
 * Perform visual comparison if baseline exists, otherwise skip gracefully.
 * This prevents CI failures on first run when no baselines exist.
 *
 * @param locator - Element to screenshot
 * @param snapshotName - Name of the snapshot file
 * @param testInfo - Playwright test info object
 * @param options - Screenshot options (mask, animations, etc.)
 * @returns true if comparison was performed, false if skipped
 */
export async function expectScreenshotIfBaselineExists(
  locator: Locator,
  snapshotName: string,
  testInfo: TestInfo,
  options?: {
    animations?: 'disabled' | 'allow';
    caret?: 'hide' | 'initial';
    mask?: Locator[];
    maskColor?: string;
    maxDiffPixelRatio?: number;
    maxDiffPixels?: number;
    omitBackground?: boolean;
    scale?: 'css' | 'device';
    stylePath?: string | string[];
    threshold?: number;
    timeout?: number;
  },
): Promise<boolean> {
  // Build the platform-specific snapshot name (Playwright adds browser and OS suffix)
  const project = testInfo.project.name; // e.g., 'chromium'
  const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const platformSnapshotName = snapshotName.replace('.png', `-${project}-${platform}.png`);

  if (!snapshotExists(testInfo, platformSnapshotName)) {
    // Log skip reason for visibility in test output
    console.log(`⏭️  Skipping visual comparison: no baseline exists for "${snapshotName}"`);
    console.log(`   Run with --update-snapshots to generate baselines.`);
    return false;
  }

  // Baseline exists, perform the comparison
  await expect(locator).toHaveScreenshot(snapshotName, options);
  return true;
}
