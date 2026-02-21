---
name: debug-perf
description: Investigate and resolve performance issues in @toolbox-web/grid. Covers profiling, hot path analysis, virtualization tuning, and render scheduler optimization.
argument-hint: <symptom-description>
---

# Debug Performance Issues

Guide for investigating and resolving performance problems in the grid component.

## Step 1: Identify the Symptom

Common performance issues:

- **Slow scrolling** — too much work in scroll handler or virtualization
- **Slow initial render** — too many DOM nodes created upfront
- **Laggy interactions** — expensive event handlers blocking the main thread
- **Memory leaks** — listeners or DOM nodes not cleaned up
- **Layout thrashing** — reading then writing DOM in loops

## Step 2: Profile

> **Need general browser debugging?** (DOM inspection, console, screenshots, script evaluation)
> See the `debug-browser` skill for the full Chrome DevTools MCP workflow.

### Live Browser Profiling via Chrome DevTools MCP

The Chrome DevTools MCP server (pre-configured in `.vscode/mcp.json`) provides performance tracing tools that run against a live browser:

1. **Start a dev server** (see `debug-browser` skill for server table):

   ```bash
   bun nx serve docs          # Storybook on port 4400
   bun nx serve demo-angular   # Angular demo on port 4200
   ```

2. **Navigate** to the page with the performance issue:

   ```
   navigate_page → url: http://localhost:4200/
   ```

3. **Start a performance trace:**

   ```
   performance_start_trace
   ```

4. **Reproduce the issue** — use `click`, `press_key`, `fill`, `evaluate_script` to interact with the page.

5. **Stop the trace and analyze:**

   ```
   performance_stop_trace
   performance_analyze_insight
   ```

   The MCP server returns structured results including LCP, CLS, TTFB, render delay, forced reflows, DOM size analysis, and render-blocking resources.

6. **Targeted measurement via script evaluation** — for measuring specific code paths:

   ```javascript
   // Measure the cost of rows replacement
   () => {
     const grid = document.querySelector('tbw-grid');
     const start = performance.now();
     grid.rows = [...grid.rows]; // Trigger re-render
     return new Promise((resolve) => {
       requestAnimationFrame(() => {
         requestAnimationFrame(() => {
           resolve({ durationMs: performance.now() - start });
         });
       });
     });
   };
   ```

7. **Monkey-patch hot paths** to count executions or measure timings:
   ```javascript
   // Track how often renderVisibleRows is called and how long it takes
   () => {
     const grid = document.querySelector('tbw-grid');
     const original = grid.refreshVirtualWindow.bind(grid);
     window.__renderLogs = [];
     grid.refreshVirtualWindow = (force, skip) => {
       const start = performance.now();
       const result = original(force, skip);
       window.__renderLogs.push({
         force,
         duration: performance.now() - start,
         stack: new Error().stack?.split('\n').slice(1, 3).join('\n'),
       });
       return result;
     };
     return { patched: true };
   };
   ```

This approach is ideal for investigating **real-world scenarios** that are hard to reproduce in test environments — such as framework adapter interaction, Angular change detection overhead, or large dataset rendering.

### Playwright Trace Capture (CI-Friendly)

Playwright captures identical data to Chrome DevTools Performance tab, but scriptable and CI-friendly:

```typescript
// In a Playwright test or standalone script
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

// Start Chrome trace (same data as DevTools Performance tab)
await page.tracing.start({ screenshots: true, categories: ['devtools.timeline'] });
await page.goto('http://localhost:4400'); // Storybook or demo app
// ... reproduce the performance issue ...
await page.tracing.stop({ path: 'trace.json' });
await browser.close();
```

Then analyze with the project's trace analyzer:

```bash
# Extract long tasks, layout thrashing, forced reflows, scroll bottlenecks
node scripts/analyze-trace.mjs trace.json
```

The `scripts/analyze-trace.mjs` script reports:

- Top 20 long tasks (>50ms)
- Layout/style recalculation frequency and cost
- Forced reflows (layout thrashing with stack traces)
- Scroll-related performance bottlenecks

You can also open `trace.json` in Chrome DevTools manually: DevTools → Performance → Load profile.

### E2E Performance Regression Tests

The project has a comprehensive e2e performance test suite at `e2e/tests/performance-regression.spec.ts` (700+ lines). Use it to:

```bash
# Run all performance tests
bun nx e2e e2e --grep="Performance"

# Run a specific test
bun nx e2e e2e --grep="scroll performance"
```

These tests enforce budgets for initial render, scrolling, sorting, filtering, and editing — and fail CI if a regression is detected.

### Performance API in Unit Tests

Use `performance.mark()` / `performance.measure()` in Vitest tests for micro-benchmarks:

```typescript
import { describe, it, expect } from 'vitest';

it('should render 10k rows within budget', async () => {
  const grid = document.createElement('tbw-grid');
  document.body.appendChild(grid);
  await waitUpgrade(grid);

  performance.mark('render-start');
  grid.rows = generateRows(10000);
  await grid.ready();
  performance.mark('render-end');

  performance.measure('render-time', 'render-start', 'render-end');
  const duration = performance.getEntriesByName('render-time')[0].duration;
  expect(duration).toBeLessThan(100); // ms budget
});
```

### Browser DevTools (Manual)

1. Open Chrome DevTools → Performance tab
2. Start recording, reproduce the issue, stop recording
3. Look for:
   - Long tasks (>50ms) in the main thread
   - Excessive layout/reflow (purple bars)
   - Excessive paint (green bars)
   - High JS heap growth over time (memory leak)

**Saving a trace for analysis:**

1. Record in DevTools Performance tab
2. Right-click the timeline → "Save profile..."
3. Run `node scripts/analyze-trace.mjs <saved-trace.json>`

### Vitest Profiling

```bash
# Run with Node profiling
node --prof node_modules/.bin/vitest run libs/grid/src/lib/core/internal/rows.spec.ts
```

> **Tip**: For complex investigations that span multiple tools (e.g., profiling in Chrome MCP → identifying code path → writing a targeted unit test → verifying fix in browser), combine the `debug-perf` and `debug-browser` skills.

## Step 3: Investigate Hot Paths

The grid has known hot paths that must be kept fast:

### Scroll Handler

- Location: `libs/grid/src/lib/core/grid.ts` (`#handleScroll`)
- Budget: < 1ms per scroll event
- Rules:
  - No allocations in scroll handler (reuse pooled event object)
  - No DOM queries — cache element references
  - No `requestAnimationFrame` calls — use scheduler
  - Minimize function calls

### Cell Rendering

- Location: `libs/grid/src/lib/core/internal/rows.ts`
- Rules:
  - Reuse row elements via row pool (`rowPool: HTMLElement[]`)
  - Minimize `createElement` calls
  - Use `textContent` over `innerHTML` when possible
  - Avoid `classList.add/remove` in loops — batch class changes

### Virtualization

- Location: `libs/grid/src/lib/core/internal/rows.ts` (`refreshVirtualWindow`)
- Rules:
  - Only render rows in the visible viewport + overscan
  - Default overscan: 8 rows
  - Use `transform: translateY()` for row positioning

### Render Scheduler

- Location: `libs/grid/src/lib/core/internal/render-scheduler.ts`
- All rendering goes through a **single RenderScheduler** — single RAF per frame
- Rules:
  - Single RAF per frame (batched)
  - Highest phase wins (merges multiple requests)
  - Use `this.#scheduler.requestPhase(RenderPhase.X, 'source')` to request renders
  - Never call `requestAnimationFrame` directly for rendering (exception: scroll hot path)

**Render Phases (deterministic execution order):**

| Phase            | Value | Work Performed                            |
| ---------------- | ----- | ----------------------------------------- |
| `STYLE`          | 1     | Plugin `afterRender()` hooks only         |
| `VIRTUALIZATION` | 2     | Recalculate virtual window                |
| `HEADER`         | 3     | Re-render header row                      |
| `ROWS`           | 4     | Rebuild row model                         |
| `COLUMNS`        | 5     | Process columns, update CSS template      |
| `FULL`           | 6     | Merge effective config + all lower phases |

**Pipeline order**: `mergeConfig → processRows → processColumns → renderHeader → virtualWindow → afterRender`

## Step 4: Common Fixes

### Reduce Allocations

```typescript
// ❌ Bad — creates new object every scroll
onScroll() {
  const event = { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft };
  this.notify(event);
}

// ✅ Good — reuse pooled object
#pooledEvent = { scrollTop: 0, scrollLeft: 0 };
onScroll() {
  this.#pooledEvent.scrollTop = el.scrollTop;
  this.#pooledEvent.scrollLeft = el.scrollLeft;
  this.notify(this.#pooledEvent);
}
```

### Batch DOM Operations

```typescript
// ❌ Bad — causes layout thrashing
cells.forEach((cell) => {
  const width = cell.offsetWidth; // READ (forces layout)
  cell.style.width = width + 'px'; // WRITE (invalidates layout)
});

// ✅ Good — batch reads then writes
const widths = cells.map((cell) => cell.offsetWidth); // All READS
cells.forEach((cell, i) => {
  cell.style.width = widths[i] + 'px'; // All WRITES
});
```

### Use the Scheduler

```typescript
// ❌ Bad — direct RAF call
requestAnimationFrame(() => this.render());

// ✅ Good — use scheduler (batches with other requests)
this.#scheduler.requestPhase(RenderPhase.ROWS, 'myFeature');
```

### Lazy Initialization

```typescript
// ❌ Bad — compute upfront even if not needed
class MyPlugin {
  #expensiveData = computeExpensiveData();
}

// ✅ Good — compute on first access
class MyPlugin {
  #expensiveData?: Data;
  get expensiveData() {
    return (this.#expensiveData ??= computeExpensiveData());
  }
}
```

## Step 5: Benchmark

After fixing, verify the improvement:

1. **Playwright trace comparison** — Capture traces before/after the fix and compare with `node scripts/analyze-trace.mjs`
2. **Run e2e performance tests** — `bun nx e2e e2e --grep="Performance"` (enforces budgets, catches regressions)
3. **Run unit tests** to verify no regressions — `bun nx test grid`
4. **Check bundle size** hasn't increased — `bun nx build grid` (core ≤ 170 kB, gzip ≤ 45 kB)
5. **Add a performance test** if the fix addresses a new hot path not yet covered by `e2e/tests/performance-regression.spec.ts`

## Performance Budget Summary

| Metric                      | Target                  |
| --------------------------- | ----------------------- |
| Scroll handler              | < 1ms per event         |
| Initial render (1000 rows)  | < 50ms                  |
| Cell render (single)        | < 0.1ms                 |
| Bundle size (core)          | ≤ 170 kB (≤ 45 kB gzip) |
| Row virtualization overscan | 8 rows default          |

## Key Files to Investigate

| Area              | File                                                  |
| ----------------- | ----------------------------------------------------- |
| Scroll handling   | `libs/grid/src/lib/core/grid.ts`                      |
| Row rendering     | `libs/grid/src/lib/core/internal/rows.ts`             |
| Virtualization    | `libs/grid/src/lib/core/internal/rows.ts`             |
| Render scheduling | `libs/grid/src/lib/core/internal/render-scheduler.ts` |
| Column processing | `libs/grid/src/lib/core/internal/columns.ts`          |
| Sticky columns    | `libs/grid/src/lib/core/internal/sticky.ts`           |
| Resize observer   | `libs/grid/src/lib/core/internal/resize.ts`           |
