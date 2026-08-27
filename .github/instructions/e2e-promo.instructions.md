---
applyTo: 'apps/docs-e2e/tests/promo/**'
---

# Promo Scene Authoring (`apps/docs-e2e/tests/promo/`, tag `@promo`)

> General docs-demo e2e conventions (structure, shared utilities, wait strategies, selectors,
> naming) live in `e2e-testing.instructions.md`, which also applies here. This file adds only the
> rules specific to promo scenes.

`tests/promo/hero.spec.ts` (one continuous analyst workflow on `EmployeeManagementAllFeaturesDemo`)
and `tests/promo/scenes.spec.ts` (one scene per capability) are **real CI tests that also record the
promo video**. They run in the normal suite at full speed; `playwright.promo.config.ts` only adds the
visual layer. See the `run-e2e` skill for the run command and config table.

The overlay/pacing API lives in `tests/promo/overlay.ts` and is **a no-op unless `PW_PROMO_OVERLAY=1`**:

| Helper                       | Purpose                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `beat(page, ms)`             | Camera pacing only — never a correctness wait                                            |
| `say(page, text)`            | Caption band explaining the _intent_ of the next action                                  |
| `hush(page)`                 | Hide the caption                                                                         |
| `titleCard(page, main, sub)` | Scene title (set automatically by `openDemo`)                                            |
| `spotlight(page, locator)`   | Dim the page, ring the region of interest **and glide the pointer to it**; `null` clears |

Rules — these are what separate a promo scene from a smoke screen:

1. **Assert the consequence, not the render.** `expect(grid(page)).toBeVisible()` as the only
   assertion proves nothing. Assert the new cell text, the new row count, the emitted event.
2. **No `if (await x.isVisible())` guards.** A missing control must fail. If a selector is
   uncertain, that is a signal to use `control(page, name)` / add a stable hook to the demo —
   not to skip the interaction.
3. **No `waitForTimeout` for correctness.** Use web-first assertions and `expect.poll`.
   `beat()` handles the camera. In particular, never assert a scroll-geometry identity
   (`scrollTop + clientHeight === scrollHeight`) after a fixed wait — with variable row heights
   (master-detail, tree, grouping) `scrollHeight` keeps growing as rows are measured, so the
   assertion is a race. Re-clamp inside `expect.poll` and assert the remaining gap instead.
4. **Never assign `scrollLeft` / `scrollTop`.** Use `wheelScroll()` — a teleport hides the
   smoothness virtualization is meant to demonstrate, and a wrong container selector scrolls
   nothing while the test still passes.
5. **Prefer public events over internal classes.** `captureGridEvent(page, 'selection-change')`
   is more meaningful and more stable than asserting on `.selected`.
6. **Use `cellByField()` over positional `cell()`** on demos with expand/checkbox/reorderable
   columns — indices silently drift onto the wrong column.
7. **Never call `.check()` on a `DemoControls.astro` boolean.** Its `<input type="checkbox">` is
   styled `opacity: 0; width: 0; height: 0`, so it never becomes actionable and the test hangs
   until timeout with no call log. Use `toggleControl()`, which clicks the visible `.dc-toggle`
   track and then asserts the input state. `check-group` controls render `data-ctrl-group`, not
   `data-ctrl` — only `controlOption(page, name, value)` reaches them.

Plugin-specific selector traps worth knowing before writing a scene:

| Plugin                | Trap                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pivot                 | Pivot cells have **no `data-field`** — `cellByField`/`columnCells`/`numericColumn` are dead; use `cell()` or `.pivot-label`                                                                                                                                                                                                                                                                                 |
| Tooltip               | The popover is appended to `document.body`, so the selector is page-level `.tbw-tooltip-popover`, never `tbw-grid .tbw-…`. It is also **hoverable** (`pointer-events: auto`, WCAG 2.2 SC 1.4.13), so an open tooltip intercepts `locator.hover()` on whatever it covers — Playwright retries until timeout with "intercepts pointer events". Press `Escape` and assert `toBeHidden()` between hover targets |
| Sticky rows           | Clones satisfy `dataRows()`/`rowCount()` — filter with `:not(.tbw-sticky-row)`. Changing a demo control rebuilds the config but **preserves** the scroll position — do not wait for the clone count to hit `0`, it only dips while the container is momentarily emptied. Stand-ins for rows never rendered in-window carry `data-synthetic-sticky-row`                                                      |
| Column virtualization | The plugin adds no classes — its signature is the inline `padding-left` on `.header-row` / `.data-grid-row`                                                                                                                                                                                                                                                                                                 |
| Pinned rows           | Existing `pinned-and-virtualization.spec.ts` selectors `.pinned-row, [data-pinned]` are vacuous; the real ones are `.tbw-aggregation-row[data-aggregation-id]` and `[data-pinned-row-id]`                                                                                                                                                                                                                   |
| Grouped columns       | `.group-end` closes **every** group, including the implicit one around ungrouped columns                                                                                                                                                                                                                                                                                                                    |
| Filtering             | Toggling "Select All" re-creates every `.tbw-filter-checkbox` (`innerHTML = ''` on the virtualized list). Assert `not.toBeChecked()` on the target **between** the two clicks, else the second click hits a detached node and Apply filters nothing                                                                                                                                                         |

Related: after Apply, the rows re-render asynchronously. `await panel` being hidden is not enough —
read the resulting cells through `expect.poll`, never a bare `allTextContents()`.
