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

| Helper                        | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `beat(page, ms)`              | Camera pacing only — never a correctness wait                                            |
| `say(page, text)`             | Caption band explaining the _intent_ of the next action                                  |
| `hush(page)`                  | Hide the caption                                                                         |
| `titleCard(page, main, sub)`  | Scene title (set automatically by `openDemo`)                                            |
| `aim(page, locator, body)`    | Ring `locator`, run `body`, drop the ring — the only sanctioned way to show intent       |
| `spotlight(page, locator)`    | Dim the page, ring the region of interest **and glide the pointer to it**; `null` clears |
| `clip(page, opts, body)`      | Mark `body` as a **money shot** — the window the stitcher cuts into the 30 s reel        |
| `card(page, role, main, sub)` | Full-frame intro/outro title, recorded as its own clip                                   |

## The spotlight ring is action-scoped

The orange ring answers exactly one question — _where is the next thing going to happen?_ — so its
lifetime must equal the lifetime of the action it announces.

- **Never bracket a ring by hand.** Use `aim(page, target, () => …)`, or one of the helpers that
  already wraps it: `glideClick`, `clickCell`, `dblClickCell`, `rightClickCell`. `aim` clears the
  ring in a `finally`, so it cannot outlive its meaning even when the action throws. A hand-managed
  `spotlight(x)` … `spotlight(null)` pair always drifts: it stays on a header through the next two
  clicks, or sits over a filter panel that has already closed, and the reel reads as unedited.
- A bare `spotlight()` is only for holding a **result** on screen, not an intent.
- **Every click gets a ring, or none do.** An unringed click next to a ringed one reads as a bug.
  Route new interactions through the helpers rather than calling `locator.click()` directly.
- **Never ring anything in the control rail** (`control`, `controlOption`, `toggleControl`). The rail
  lives in the cropped overhang, so the ring would land off-frame and the viewer would see the whole
  picture dim with no visible hole.
- The scrim is the ring's own `box-shadow: 0 0 0 9999px`, clipped by `.tbw-promo-spot-wrap`, whose
  `top` is set to the title-band height. That keeps the demo name — the only on-screen text that
  says what is being shown — legible while the stage behind it dims. `.tbw-promo-root` is a
  `popover="manual"` element in the **top layer**, so this cannot be solved with `z-index`.
- Outside promo mode `aim` is a transparent pass-through, so CI keeps the assertions and none of the
  pauses.

## The 30-second reel

`tools/stitch-promo.ts` (`bun run promo:stitch`) reads `promo-output/report.json`, extracts one
window per `clip()` mark, and concatenates them into `promo-reel.mp4` under a hard 30 s budget.
`--full` instead concatenates the untrimmed scene videos into `promo-full.mp4`.

- **Import `test`/`expect` from `./fixture`, not `@playwright/test`.** The fixture calls
  `markPageStart` before the page is used and writes the clip timeline afterwards. Without it
  `clip()` records nothing and the scene is silently dropped from the reel.
- The timeline is attached **by `path`**, written via `testInfo.outputPath()`. An attachment
  created with `body:` is inlined as base64 by the JSON reporter and its `path` is omitted, so any
  tool reading `report.json` sees an attachment it cannot open.
- **Exactly one `clip()` per scene**, wrapping the single most persuasive moment. Everything else
  in the scene still runs and still asserts — it just does not reach the reel. Twenty-five scenes
  share 30 seconds; a second clip steals time from another feature.
- **The reel is curated, not exhaustive.** Thirty seconds only holds ~13 features at a watchable
  pace, so most scenes carry `reel: false` — they stay in CI and in `promo-full.mp4` but spend no
  reel seconds. Adding a scene back means taking one out. Do **not** try to buy pacing by raising
  `MIN_CLIP`; that only redistributes the same 30 seconds.
- **Assertions go inside the clip body.** `clip()` is a pass-through when `PROMO` is off, so the
  reel window and the CI assertion are the same code. A clip that wraps nothing but `beat()` is a
  bug.
- **`weight` is relative screen time**, not importance-as-you-feel-it. The allocator water-fills
  `MIN_CLIP`…`MAX_CLIP` by weight, so raising one weight shortens every other clip. A clip can
  never be given more than the window it actually recorded, so a scene whose action is a single
  click will sit at the floor no matter what weight it declares — lengthen `holdMs` instead.
- **`align`** picks which part of a long window survives the trim — `'end'` (default) keeps the
  result, `'start'` keeps the gesture. Use `'start'` only when the gesture _is_ the story.
- **`minMs` is a guaranteed floor**, reserved before weights are shared out. Only the brand cards
  use it (2000 ms each); every extra second here is a second taken from the features.
- **Both reels open on the brand card.** `openDemo(page, slug, title, sub, intro)` raises the
  full-frame card right after `goto()` — before the grid is waited for. `--full` then starts that
  recording _at_ the card rather than prepending a copy of it; a prepended copy cuts back to the
  same card a beat later and reads as a stutter. `card()` holds it ~1 s either side of the
  recorded window, because the window is mapped by arithmetic rather than a frame-accurate
  timestamp and may drift.
- Clip windows are mapped onto the recording with `duration - spanMs - TAIL_S`. The recording's
  first frame is written at **first paint**, not at page creation, so the head offset varies by a
  second between a trivial demo and one that loads 200 rows — only the teardown tail is stable
  enough to anchor on. If clips start landing on the caption _after_ the one they should show,
  re-measure `TAIL_S` in `tools/stitch-promo.ts`.
- **Clips are joined with a cross-dissolve** (`XFADE`, 0.28 s), and the reel opens and closes on
  black. `xfade` overlaps its inputs, so the budget handed to `allocate()` is grown by
  `(n-1) * XFADE` to still land on 30 s. Only the reel dissolves — `--full` stays a stream copy,
  which is why it can join five minutes of footage in seconds. `--xfade=0` gives hard cuts back.

## Motion has to survive 30 fps

`slowMo: 60` delays **every** Playwright input round-trip, which caps real input at ~16 events a
second. Anything animated by repeated input therefore moves in 70 ms hops — two video frames of
nothing, then a jump — and reads as judder no matter how smooth the component itself is.

- **Never drive a scroll with a loop of `page.mouse.wheel`.** `wheelScroll()` switches to a rAF
  ramp dispatched inside the page when `PROMO` is set: one round-trip, then eased `WheelEvent`s at
  frame rate. The grid's own handler (`core/internal/touch-scroll.ts`) adds `deltaY` straight to
  the faux scrollbar, so the synthetic events take exactly the same path — the judder was never
  the grid. Outside promo mode the helper keeps the trusted-input loop so CI still tests real
  wheel events.
- **The promo cursor is interpolated by CSS**, not by more `mouse.move` calls. `left`/`top` carry
  a 90 ms linear transition so the slowMo-spaced hops smooth into a glide. Adding frames to
  `glidePointer` cannot help — each extra frame costs another 60 ms.


## Promo stage CSS (`overlay.ts`)

Promo mode restyles the bare demo page into a product shot. Four constraints are load-bearing:

1. **Never put a raw backtick in the stage CSS** — including inside a comment. The whole
   stylesheet is a JS template literal, so one unescaped backtick breaks the file at parse time
   and every promo test errors with `Missing semicolon` before a single one runs.
2. **Body-level rules must exclude `[popover]` and `dialog`.** The filter panel, context menu and
   tooltip are appended to `<body>`, so a bare `body > *` rule gives them stage padding and
   `display: flex` — they balloon and swallow the clicks aimed at the grid underneath.
3. **The stage element must stay stretched.** An `auto` inline margin makes it shrink-to-fit its
   max-content width, which removes the horizontal overflow the column-virtualization and
   pinned-column scenes depend on — those tests then fail with `scrollLeft` stuck at 0. A scene
   that narrows the demo centres _that element_, not the stage.
4. **The control rail lives in a 312px overhang that never reaches the frame.** The recording
   viewport is `1280 + 312`; the stage reserves `padding-right: 336px`; `.demo-controls` is
   `position: fixed; right: 0; width: 312px`, so it sits entirely outside the delivered 1280;
   and `tools/stitch-promo.ts` crops exactly `RAIL_PX = 312` off the right before scaling. Three
   numbers — `RAIL` in `playwright.promo.config.ts`, the CSS reservation, and `RAIL_PX` — move
   together or the rail leaks into the frame.

   The rail is parked, not hidden, on purpose. `display: none` hangs the scenes that click it,
   `pointer-events: none` breaks actionability, and moving it off-screen makes Playwright fail to
   scroll it into view. Parking + cropping is the only variant where every control stays clickable.

   The reservation has to live **inside** the main `body > :not(…)` stage rule. Split out as its
   own selector it loses `:not(script):not(style)`, scores lower than the `padding` shorthand
   above it, and is silently dropped — the grid then renders 1548px wide underneath the rail and
   clicks near its right edge fail with `<div class="demo-controls"> intercepts pointer events`.

Nothing in the stage is `display: none` except non-interactive chrome (control descriptions), because
every control a scene clicks has to stay actionable — otherwise the test hangs instead of failing.

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
