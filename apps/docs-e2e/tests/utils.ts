import { type Locator, type Page, expect } from '@playwright/test';
import { type CardContent, PROMO, aim, beat, glidePointer, installOverlay, titleCard } from './promo/overlay';

export * from './promo/overlay';

/** Human-readable fallback title for a demo slug, used on the promo title card. */
function titleFromSlug(demoSlug: string): string {
  return (demoSlug.split('/').pop() ?? demoSlug)
    .replace(/\.[^.]+$/, '')
    .replace(/Demo$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
}

/**
 * Navigate to a demo page and wait for the grid to be ready.
 *
 * In promo mode this additionally installs the video overlay and pins a title
 * card; both are no-ops in a normal run. Prefer passing an explicit `title` —
 * slug-derived titles read like filenames, not like a product demo.
 *
 * `intro` raises the full-frame brand card before the grid is waited for, so the
 * unedited recording opens on the card instead of on a demo booting up. The
 * caller still has to hold and record it with `card()`.
 */
export async function openDemo(page: Page, demoSlug: string, title?: string, subtitle?: string, intro?: CardContent) {
  if (PROMO) await installOverlay(page);
  await page.goto(`/demo/${demoSlug}`);
  if (PROMO && intro) await page.evaluate((c) => window.__tbwPromo?.card(c), intro);
  if (PROMO) await titleCard(page, title ?? titleFromSlug(demoSlug), subtitle);
  await waitForGrid(page);
}

/** Wait for tbw-grid to render rows. */
export async function waitForGrid(page: Page, timeout = 15_000) {
  await page.waitForSelector('tbw-grid', { state: 'attached', timeout });
  // Wait for either data rows or card-mode content to appear
  await page
    .locator('tbw-grid [role="rowgroup"]:last-of-type [role="row"], tbw-grid .card-view')
    .first()
    .waitFor({ state: 'visible', timeout });
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

/**
 * Get a data cell by row index + column `field`.
 *
 * Prefer this over {@link cell} whenever a demo has an expand column, a checkbox
 * column, or reorderable columns — positional indices silently drift and the
 * assertion starts checking the wrong column.
 */
export function cellByField(page: Page, rowIndex: number, field: string): Locator {
  return dataRows(page).nth(rowIndex).locator(`[role="gridcell"][data-field="${field}"]`);
}

/** Read every visible cell value in a column as a number (strips currency/format chars). */
export async function numericColumn(page: Page, field: string): Promise<number[]> {
  const texts = await dataRows(page).locator(`[role="gridcell"][data-field="${field}"]`).allTextContents();
  return texts.map((t) => Number(t.replace(/[^0-9.-]/g, '')));
}

/**
 * Record every detail payload emitted by a grid event.
 *
 * Asserting on the public event is more meaningful — and far more stable — than
 * asserting on internal DOM classes, which is why selection/grouping/tree scenes
 * use this instead of poking at `.selected`.
 */
export async function captureGridEvent<T = unknown>(page: Page, eventName: string) {
  const key = `__tbwEvt_${eventName.replace(/[^a-z0-9]/gi, '_')}`;
  await page.evaluate(
    ([name, k]) => {
      const target = document.querySelector('tbw-grid');
      (window as unknown as Record<string, unknown[]>)[k] = [];
      target?.addEventListener(name, (e) => {
        (window as unknown as Record<string, unknown[]>)[k].push((e as CustomEvent).detail);
      });
    },
    [eventName, key],
  );

  const read = () => page.evaluate((k) => (window as unknown as Record<string, unknown[]>)[k] ?? [], key);
  return {
    all: () => read() as Promise<T[]>,
    last: async () => ((await read()) as T[]).at(-1),
    count: async () => (await read()).length,
  };
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
  const target = cell(page, rowIndex, colIndex);
  await aim(page, target, () => target.dblclick());
  // Wait for editor to appear
  await page.waitForTimeout(200);
}

/** Click a cell once. */
export async function clickCell(
  page: Page,
  rowIndex: number,
  colIndex: number,
  options?: Parameters<Locator['click']>[0],
) {
  const target = cell(page, rowIndex, colIndex);
  await aim(page, target, () => target.click(options));
}

/**
 * Type into the currently active editor and press Enter.
 *
 * In promo mode the value is typed one character at a time. Playwright's
 * default `type()` lands the whole string in a single frame, which reads as a
 * paste rather than as somebody editing a cell.
 */
export async function typeAndCommit(page: Page, value: string) {
  await page.keyboard.press('Control+a');
  if (PROMO) {
    await beat(page, 300);
    await page.keyboard.type(value, { delay: 85 });
    await beat(page, 700);
    await page.keyboard.press('Enter');
    await beat(page, 800);
    return;
  }
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
  const target = cell(page, rowIndex, colIndex);
  await aim(page, target, () => target.click({ button: 'right' }));
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
 * Resolve a demo control (checkbox / select / text input) by its declared name.
 *
 * `DemoControls.astro` puts `data-ctrl` on the input and `data-ctrl-name` on the
 * wrapper row, while `GridPlayground.astro` puts `data-ctrl-name` on the input
 * itself. Specs must use this helper rather than hand-rolling the selector — and
 * must never wrap the interaction in an `isVisible()` guard, which lets a broken
 * demo pass silently.
 */
export function control(page: Page, name: string): Locator {
  return page
    .locator(`[data-ctrl="${name}"]`)
    .or(page.locator(`input[data-ctrl-name="${name}"], select[data-ctrl-name="${name}"]`))
    .or(page.locator(`[data-ctrl-name="${name}"]`).locator('input, select'))
    .first();
}

/** Resolve one option of a radio-group control by name + value. */
export function controlOption(page: Page, name: string, value: string): Locator {
  return page
    .locator(`[data-ctrl="${name}"][value="${value}"]`)
    .or(page.locator(`[data-ctrl-name="${name}"] input[value="${value}"]`))
    .or(page.locator(`input[type="radio"][value="${value}"]`))
    .first();
}

/**
 * Flip a boolean demo control and wait for it to settle.
 *
 * The underlying `<input type="checkbox">` in `DemoControls.astro` is styled
 * `opacity: 0; width: 0; height: 0`, so `.check()` on it never becomes
 * actionable and hangs until the test times out. Click the visible `.dc-toggle`
 * track instead, then assert the input's state.
 */
export async function toggleControl(page: Page, name: string, on = true): Promise<void> {
  const input = control(page, name);
  if ((await input.isChecked()) === on) return;
  const track = page
    .locator(`.dc-row[data-ctrl-name="${name}"] .dc-toggle`)
    .or(page.locator(`label.dc-toggle:has(input[data-ctrl="${name}"])`))
    .first();
  await track.click();
  await expect(input).toBeChecked({ checked: on });
}

/**
 * Smooth, human-looking drag from one element to another.
 *
 * On camera the pointer is glided frame by frame, with a beat on the grab and
 * before the drop — `mouse.move(…, { steps })` alone fires every step instantly,
 * so the drag reads as a teleport. In CI it stays a plain three-call drag.
 *
 * Throws when either end has no bounding box — a silent no-op drag is the most
 * common way a reorder/range test stops testing anything.
 */
export async function dragBetween(page: Page, from: Locator, to: Locator, steps = 24) {
  // Both ends must have settled first: a drag issued while the grid is still
  // re-rendering resolves against a detached node and silently does nothing.
  await expect(from).toBeVisible();
  await expect(to).toBeVisible();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('dragBetween: source or target element has no bounding box');
  const [ax, ay] = [a.x + a.width / 2, a.y + a.height / 2];
  const [bx, by] = [b.x + b.width / 2, b.y + b.height / 2];

  if (PROMO) {
    await glidePointer(page, ax, ay);
    await beat(page, 350);
    await page.mouse.down();
    await beat(page, 250);
    await glidePointer(page, bx, by, 20);
    await beat(page, 450);
    await page.mouse.up();
    return;
  }

  await page.mouse.move(ax, ay, { steps: 8 });
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps });
  await page.mouse.up();
}

/**
 * Scroll by wheel over `target` in small increments.
 *
 * Never assign `scrollLeft`/`scrollTop` directly in a spec: it teleports (hiding
 * the smoothness virtualization is meant to demonstrate) and, if the container
 * selector is wrong, it scrolls nothing while the test still passes.
 *
 * In promo mode the wheel is driven from inside the page instead. `slowMo`
 * delays every `page.mouse.wheel` round-trip, capping real input at ~16 events
 * a second, so a long scroll lands as a 70px jump every third video frame. A
 * rAF loop dispatching the same `wheel` events pays the round-trip once and
 * moves a few pixels per frame — the grid's own handler (`touch-scroll.ts`)
 * runs either way, it just finally gets asked to scroll at frame rate.
 */
export async function wheelScroll(page: Page, target: Locator, deltaX: number, deltaY: number, steps = 20) {
  await target.hover();
  if (PROMO) {
    await smoothWheel(target, deltaX, deltaY);
    return;
  }
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(deltaX / steps, deltaY / steps);
    await page.waitForTimeout(16);
  }
}

/** Eased, frame-rate wheel ramp dispatched inside the page. See {@link wheelScroll}. */
async function smoothWheel(target: Locator, deltaX: number, deltaY: number) {
  const distance = Math.hypot(deltaX, deltaY);
  const ms = Math.min(2600, Math.max(700, distance * 1.6));
  await target.evaluate(
    (host, { dx, dy, duration }) => {
      // The wheel listener sits on the content element, and events bubble up, not down.
      const el = host.querySelector('.tbw-grid-content') ?? host.querySelector('.tbw-grid-root') ?? host;
      return new Promise<void>((done) => {
        const start = performance.now();
        let sentX = 0;
        let sentY = 0;
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          const [x, y] = [dx * eased, dy * eased];
          el.dispatchEvent(
            new WheelEvent('wheel', { deltaX: x - sentX, deltaY: y - sentY, bubbles: true, cancelable: true }),
          );
          [sentX, sentY] = [x, y];
          if (t < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    },
    { dx: deltaX, dy: deltaY, duration: ms },
  );
}

/**
 * List of all demo slugs (auto-discovered at test time).
 * Matches the pattern used by the catch-all route.
 */
export const EXCLUDED_DEMOS = [
  'EmployeeManagementAllFeaturesDemo',
  'EmployeeManagementGroupedDemo',
  'PerformanceComparisonDemo',
];
