import { type Locator, type Page, expect } from '@playwright/test';

/** Navigate to a demo page and wait for the grid to be ready. */
export async function openDemo(page: Page, demoSlug: string) {
  await page.goto(`/demo/${demoSlug}`);
  await waitForGrid(page);
}

/** Wait for tbw-grid to render rows. */
export async function waitForGrid(page: Page, timeout = 15_000) {
  await page.waitForSelector('tbw-grid', { state: 'attached', timeout });
  await page.waitForSelector('tbw-grid [role="row"]', { state: 'visible', timeout });
  // Let the render scheduler finish
  await page.waitForTimeout(300);
}

/** Get the grid locator. */
export function grid(page: Page) {
  return page.locator('tbw-grid');
}

/** Get grid locator scoped to a container ID. */
export function gridIn(page: Page, containerId: string) {
  return page.locator(`#${containerId} tbw-grid`);
}

/** Body rowgroup selector — where data rows live (not the header rowgroup). */
const BODY_ROWS = 'tbw-grid [role="rowgroup"]:last-of-type [role="row"]';

/** Get all visible data rows (excludes header rows). */
export function dataRows(page: Page) {
  return page.locator(BODY_ROWS);
}

/** Get column header cells. */
export function headerCells(page: Page) {
  return page.locator('tbw-grid [role="columnheader"]');
}

/** Get a specific header cell by column text. */
export function headerCell(page: Page, text: string) {
  return page.locator('tbw-grid [role="columnheader"]', { hasText: text });
}

/** Get a data cell at row/col indices (0-based, body rows only). */
export function cell(page: Page, rowIndex: number, colIndex: number) {
  return page.locator(BODY_ROWS).nth(rowIndex).locator('[role="gridcell"]').nth(colIndex);
}

/** Get all cells in a column by header text. */
export function columnCells(page: Page, headerText: string): Locator {
  return page.locator(`tbw-grid [role="gridcell"][data-field="${headerText.toLowerCase()}"]`);
}

/** Count visible data rows. */
export async function rowCount(page: Page): Promise<number> {
  return page.locator(BODY_ROWS).count();
}

/** Collect console errors during a callback. */
export async function collectConsoleErrors(page: Page, fn: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  page.on('console', handler);
  await fn();
  page.off('console', handler);
  return errors;
}

/** Assert no console errors occurred during page load. */
export async function assertNoErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  // Wait a beat for late errors
  await page.waitForTimeout(500);
  expect(errors, 'Console errors detected').toEqual([]);
}

/** Double-click a cell to start editing. */
export async function dblClickCell(page: Page, rowIndex: number, colIndex: number) {
  await cell(page, rowIndex, colIndex).dblclick();
  // Wait for editor to appear
  await page.waitForTimeout(200);
}

/** Click a cell once. */
export async function clickCell(page: Page, rowIndex: number, colIndex: number) {
  await cell(page, rowIndex, colIndex).click();
}

/** Type into the currently active editor and press Enter. */
export async function typeAndCommit(page: Page, value: string) {
  await page.keyboard.press('Control+a');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
}

/** Get text content of a cell. */
export async function cellText(page: Page, rowIndex: number, colIndex: number): Promise<string> {
  return (await cell(page, rowIndex, colIndex).textContent()) ?? '';
}

/** Right-click a cell to trigger context menu. */
export async function rightClickCell(page: Page, rowIndex: number, colIndex: number) {
  await cell(page, rowIndex, colIndex).click({ button: 'right' });
  await page.waitForTimeout(300);
}

/** Get sort indicator state of a header. */
export async function getSortDirection(page: Page, headerText: string): Promise<string | null> {
  const header = headerCell(page, headerText);
  return header.getAttribute('aria-sort');
}

/** Click a header to sort. */
export async function sortByColumn(page: Page, headerText: string) {
  await headerCell(page, headerText).click();
  await page.waitForTimeout(300);
}

/** Type into a filter input under a column header. */
export async function filterColumn(page: Page, fieldName: string, value: string) {
  const input = page.locator(`tbw-grid input[data-filter-field="${fieldName}"], tbw-grid .filter-row input`).first();
  await input.fill(value);
  await page.waitForTimeout(500); // debounce
}

/**
 * List of all demo slugs (auto-discovered at test time).
 * Matches the pattern used by the catch-all route.
 */
export const EXCLUDED_DEMOS = ['EmployeeManagementAllFeaturesDemo', 'EmployeeManagementGroupedDemo'];
