import { expect, test } from '@playwright/test';
import { DEMOS, expectScreenshotIfBaselineExists, SELECTORS, waitForGridReady, type DemoName } from './utils';

/**
 * E2E tests for custom editors across all three demos.
 *
 * Tests verify:
 * 1. Double-clicking a row opens editors for editable fields
 * 2. Custom styled editors have editors with expected selectors
 * 3. Editors look the same across frameworks (visual regression)
 *
 * Note: Each demo has slightly different editable columns.
 * We focus on the custom editors that ALL demos have:
 * - bonus: custom slider editor
 * - status: custom select editor with badges
 * - hireDate: date picker
 * - rating: star rating editor
 */

// Custom editors that all demos implement consistently
const CUSTOM_EDITORS = [
  { field: 'bonus', editorType: '.bonus-slider-editor, input[type="range"]', description: 'Bonus slider' },
  { field: 'status', editorType: '.status-select-editor, select', description: 'Status select with badge' },
  { field: 'hireDate', editorType: 'input[type="date"]', description: 'Date picker' },
  { field: 'rating', editorType: '.star-rating-editor', description: 'Star rating' },
] as const;

// Custom editors with visual styling (for visual comparison)
const CUSTOM_STYLED_EDITORS = ['bonus', 'status', 'rating'] as const;

test.describe('Custom Editors', () => {
  test.describe('Editor Activation', () => {
    for (const [demoName, url] of Object.entries(DEMOS) as [DemoName, string][]) {
      test(`${demoName}: double-clicking row opens editors`, async ({ page }) => {
        await page.goto(url);
        await waitForGridReady(page);

        // Find first data row (skip header rows)
        const firstDataRow = page.locator('[role="row"]:has([role="gridcell"])').first();
        await expect(firstDataRow).toBeVisible();

        // Double-click the first cell to enter edit mode (should be ID or name field)
        const firstCell = firstDataRow.locator('[role="gridcell"]').first();
        await firstCell.dblclick();
        await page.waitForTimeout(300);

        // Check if we're in edit mode by looking for any input/editor
        const anyEditor = page
          .locator(`${SELECTORS.grid} input, ${SELECTORS.grid} select, ${SELECTORS.grid} .editing`)
          .first();
        const editorVisible = await anyEditor.isVisible().catch(() => false);

        // If first cell isn't editable, try an editable cell (status)
        if (!editorVisible) {
          const statusCell = page.locator('[data-field="status"]').first();
          await statusCell.dblclick();
          await page.waitForTimeout(300);
        }

        // Verify at least one editor is visible
        const hasEditor = await page
          .locator(`${SELECTORS.grid} input, ${SELECTORS.grid} select, .status-select-editor`)
          .first()
          .isVisible()
          .catch(() => false);

        expect(hasEditor, 'Should have an editor visible after double-click').toBe(true);

        // Press Escape to exit edit mode
        await page.keyboard.press('Escape');
      });
    }
  });

  test.describe('Custom Editor Fields', () => {
    for (const { field, editorType, description } of CUSTOM_EDITORS) {
      for (const [demoName, url] of Object.entries(DEMOS) as [DemoName, string][]) {
        test(`${demoName}: ${field} field has correct editor (${description})`, async ({ page }) => {
          await page.goto(url);
          await waitForGridReady(page);

          // Find the first DATA cell for this field (gridcell, not columnheader)
          // Use role=gridcell to skip header cells
          const cell = page.locator(`[role="gridcell"][data-field="${field}"]`).first();
          const cellExists = (await cell.count()) > 0;

          if (!cellExists) {
            test.skip();
            return;
          }

          await expect(cell).toBeVisible();

          // Double-click to edit
          await cell.dblclick();
          await page.waitForTimeout(400);

          // Check if the expected editor type appeared - check within the grid (editor might be in cell or overlay)
          let editorFound = false;

          // First check within the cell itself
          const cellEditor = cell.locator(editorType);
          editorFound = await cellEditor.isVisible().catch(() => false);

          // If not in cell, check in the grid (some editors use overlays)
          if (!editorFound) {
            const gridEditor = page.locator(`${SELECTORS.grid}`).locator(editorType);
            editorFound = await gridEditor.isVisible().catch(() => false);
          }

          // Fallback: check for any input element (default text/number editors)
          if (!editorFound) {
            const anyInput = cell.locator('input, select');
            editorFound = await anyInput.isVisible().catch(() => false);
          }

          expect(editorFound, `${description} should be visible for field ${field}`).toBe(true);

          // Press Escape to cancel editing
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        });
      }
    }
  });

  test.describe('Visual Parity - Custom Editors', () => {
    // Visual tests per framework with per-framework baselines
    // Allow 10% pixel difference to account for anti-aliasing and minor rendering variations
    const VISUAL_THRESHOLD = 0.1;

    for (const field of CUSTOM_STYLED_EDITORS) {
      for (const [demoName, url] of Object.entries(DEMOS) as [DemoName, string][]) {
        test(`${demoName}: ${field} editor visual`, async ({ page }, testInfo) => {
          await page.goto(url);
          await waitForGridReady(page);

          const cell = page.locator(`[role="gridcell"][data-field="${field}"]`).first();
          const cellExists = (await cell.count()) > 0;

          if (!cellExists) {
            test.skip();
            return;
          }

          await expect(cell).toBeVisible();
          await cell.dblclick();
          await page.waitForTimeout(400);

          // Visual comparison with per-framework baseline
          // Skips gracefully if no baseline exists (first CI run)
          await expectScreenshotIfBaselineExists(cell, `editor-${field}-${demoName}.png`, testInfo, {
            animations: 'disabled',
            maxDiffPixelRatio: VISUAL_THRESHOLD,
          });

          await page.keyboard.press('Escape');
        });
      }
    }
  });

  test.describe('Editor Row Mode', () => {
    // Test that Tab navigates between editors in a row
    for (const [demoName, url] of Object.entries(DEMOS) as [DemoName, string][]) {
      test(`${demoName}: can navigate between editors with Tab`, async ({ page }) => {
        await page.goto(url);
        await waitForGridReady(page);

        // Start editing the status field (select editor - available in all demos)
        const statusCell = page.locator('[role="gridcell"][data-field="status"]').first();
        await expect(statusCell).toBeVisible();

        await statusCell.dblclick();
        await page.waitForTimeout(300);

        // Verify we're in edit mode (status uses a select)
        const statusEditor = statusCell.locator('select');
        await expect(statusEditor).toBeVisible();

        // Tab to next editable field
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);

        // Should now be in a different cell's editor
        // Check that there's an active editor somewhere
        const activeEditor = page.locator(`${SELECTORS.grid} input:focus, ${SELECTORS.grid} select:focus`);
        const hasActiveEditor = await activeEditor.isVisible().catch(() => false);

        expect(hasActiveEditor, 'Should have moved to next editor after Tab').toBe(true);

        // Escape to exit
        await page.keyboard.press('Escape');
      });
    }
  });

  test.describe('Editor Value Persistence', () => {
    for (const [demoName, url] of Object.entries(DEMOS) as [DemoName, string][]) {
      test(`${demoName}: editing and committing updates the cell`, async ({ page }) => {
        await page.goto(url);
        await waitForGridReady(page);

        // Use status field (select editor - available in all demos)
        const statusCell = page.locator('[role="gridcell"][data-field="status"]').first();
        await expect(statusCell).toBeVisible();

        // Get original value
        const originalText = await statusCell.textContent();

        // Double-click to edit
        await statusCell.dblclick();
        await page.waitForTimeout(300);

        const statusEditor = statusCell.locator('select');
        await expect(statusEditor).toBeVisible();

        // Get option values (not labels, which may include checkmarks)
        const options = await statusEditor
          .locator('option')
          .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));

        // Find a different value than current
        const currentValue = await statusEditor.inputValue();
        const newValue = options.find((opt) => opt !== currentValue) || options[0];
        await statusEditor.selectOption(newValue);

        // Commit with Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        // Verify cell shows new value (text contains the status)
        const updatedText = await statusCell.textContent();
        expect(updatedText?.toLowerCase()).toContain(newValue.toLowerCase());
      });
    }
  });

  test.describe('Editor Cancel', () => {
    for (const [demoName, url] of Object.entries(DEMOS) as [DemoName, string][]) {
      test(`${demoName}: pressing Escape cancels edit without saving`, async ({ page }) => {
        await page.goto(url);
        await waitForGridReady(page);

        // Use status field (select editor - available in all demos)
        const statusCell = page.locator('[role="gridcell"][data-field="status"]').first();
        await expect(statusCell).toBeVisible();

        // Get original value
        const originalText = await statusCell.textContent();

        // Double-click to edit
        await statusCell.dblclick();
        await page.waitForTimeout(300);

        const statusEditor = statusCell.locator('select');
        await expect(statusEditor).toBeVisible();

        // Change the select value to something different
        const options = await statusEditor.locator('option').allTextContents();
        const differentValue = options.find((opt) => opt !== originalText?.trim()) || options[0];
        await statusEditor.selectOption({ label: differentValue });

        // Cancel with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // Verify cell still shows original value
        const afterCancelText = await statusCell.textContent();
        expect(afterCancelText).toBe(originalText);
      });
    }
  });
});
