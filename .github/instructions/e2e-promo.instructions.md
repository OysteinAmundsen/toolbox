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

## New scene checklist

Satisfy these seven first; the sections below explain why each one exists.

1. Import `test`/`expect` from `./fixture`, never from `@playwright/test`.
2. Open with `openDemo(page, slug, title, sub, intro)`.
3. Wrap the money shot in **exactly one** `clip()`.
4. Drive every interaction through `aim` / `glideClick` / `clickCell` / `dblClickCell` /
   `rightClickCell` — never a bare `locator.click()`.
5. Never ring anything in the control rail (`control`, `controlOption`, `toggleControl`).
6. Put the assertions **inside** the clip body, and assert the consequence, not the render.
7. Give the clip enough `holdMs` to be watchable — the edit can trim a window, never extend it.

The overlay/pacing API lives in `tests/promo/overlay.ts` and is **a no-op unless `PW_PROMO_OVERLAY=1`**:

| Helper                        | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `beat(page, ms)`              | Camera pacing only — never a correctness wait                                            |
| `say(page, text)`             | Caption band explaining the _intent_ of the next action                                  |
| `hush(page)`                  | Hide the caption                                                                         |
| `titleCard(page, main, sub)`  | Scene title (set automatically by `openDemo`)                                            |
| `aim(page, locator, body)`    | Ring `locator`, run `body`, drop the ring — the only sanctioned way to show intent       |
| `spotlight(page, locator)`    | Dim the page, ring the region of interest **and glide the pointer to it**; `null` clears |
| `clip(page, opts, body)`      | Mark `body` as a **money shot** — the window offered to `promo-cut.json`                 |
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
  Route new interactions through the helpers rather than calling `locator.click()` directly. This
  includes the mundane ones — a `radio.check()` or a bare `target.click()` on a plain `<input>`
  jumps the cursor across the frame in a single protocol move, and reads as a teleport.
- **Never travel away from a result the viewer has not seen yet.** The cursor leaving for the next
  target is what ends a shot, so the beat that lets the last action register has to come _before_
  the next `glideClick`, not after it. A `Ctrl+click` whose fifth selected row is on screen for two
  frames because the pointer immediately left for a mode switch has shown the viewer nothing.
- **Never ring anything in the control rail** (`control`, `controlOption`, `toggleControl`). The rail
  lives in the cropped overhang, so the ring would land off-frame and the viewer would see the whole
  picture dim with no visible hole.
- The scrim is the ring's own `box-shadow: 0 0 0 9999px`, clipped by `.tbw-promo-spot-wrap`, whose
  `top` is set to the title-band height. That keeps the demo name — the only on-screen text that
  says what is being shown — legible while the stage behind it dims. `.tbw-promo-root` is a
  `popover="manual"` element in the **top layer**, so this cannot be solved with `z-index`.
- Outside promo mode `aim` is a transparent pass-through, so CI keeps the assertions and none of the
  pauses.

## The edit list

`tools/stitch-promo.ts` produces two videos, and only one of them is an editorial decision:

| Command                | Output           | Contains                                             |
| ---------------------- | ---------------- | ---------------------------------------------------- |
| `bun run promo:stitch` | `promo-reel.mp4` | exactly what `apps/docs-e2e/promo-cut.json` says     |
| `bun run promo:full`   | `promo-full.mp4` | every scene recording, untrimmed, stream-copied      |
| `bun run promo:init`   | —                | re-derives `promo-cut.json`, **discarding the edit** |

**`promo-cut.json` is the edit, and it is checked in.** It is a flat `sequence` of
`{ scene, in, out, note?, skip? }`: play that scene's recording from `in` to `out` seconds, in
array order. Cards and feature clips are the same kind of entry — a card is just a window of the
hero recording — so reordering the reel, retiming a shot, or pointing two entries at different
moments of one recording is a JSON edit and **needs no re-record**. `scene` is the test title
(minus ` @promo`), because Playwright hashes the output directory names.

The stitcher derives the file on first run from the recorded `clip()` marks — cards first,
features in declaration order, punch and outro last, each entry spanning the full window its
`clip()` measured, pre-`skip`ped where the scene said `reel: false`. After that the JSON wins;
nothing about the reel is computed at stitch time. `--init` throws your edit away and starts over,
so treat it as destructive.

- **Import `test`/`expect` from `./fixture`, not `@playwright/test`.** The fixture calls
  `markPageStart` before the page is used and writes the clip timeline afterwards. Without it
  `clip()` records nothing and the scene never appears in a derived edit list.
- The timeline is attached **by `path`**, written via `testInfo.outputPath()`. An attachment
  created with `body:` is inlined as base64 by the JSON reporter and its `path` is omitted, so any
  tool reading `report.json` sees an attachment it cannot open.
- **Exactly one `clip()` per scene**, wrapping the single most persuasive moment. Everything else
  in the scene still runs and still asserts — it just is not offered to the edit. A second clip is
  not free: it is one more thing for whoever cuts the reel to triage.
- **A recorded window is raw material, not the edit.** `leadMs`/`holdMs` widen what gets filmed,
  and that is the only lever the specs have: no amount of retiming in `promo-cut.json` can extend
  a shot past the window `clip()` measured. If a moment always feels rushed, lengthen `holdMs` and
  re-record — do not expect the edit to rescue it. Two failures look identical on screen but are
  fixed in different places: a shot that _starts late_ is usually the edit, a shot that _ends before
  the result registers_ is always the recording.
- **Re-recording invalidates the timings.** `in`/`out` are offsets into a specific `video.webm`; a
  new run shifts them. After changing pacing in a spec, re-derive with `bun run promo:init` and
  re-apply manual trims. Hand-tune the JSON _after_ the recording is right, not before.
- **`reel: false` only seeds `skip`.** It is a hint for the _first_ derivation, not a permanent
  exclusion; after that the JSON decides. Deleting an entry and setting `"skip": true` differ only
  in whether the timings survive for later.
- **Assertions go inside the clip body.** `clip()` is a pass-through when `PROMO` is off, so the
  recorded window and the CI assertion are the same code. A clip that wraps nothing but `beat()`
  is a bug.
- **Consecutive cards must chain.** `card(..., { chain: true })` fades the card's _content_ out and
  holds the black frame, so a pair reads card → black → card. Without it the whole frame drops
  between the two titles and the demo page flashes through for a few hundred milliseconds — the
  most visible blemish in the long cut, and the one thing a title sequence cannot get away with.
  The **last** card of a chain leaves `chain` unset: it is the one that cuts to the demo.
- **Every cut opens on the brand card.** `openDemo(page, slug, title, sub, intro)` raises the
  full-frame card right after `goto()` — before the grid is waited for. `--full` then starts that
  recording _at_ the card rather than prepending a copy of it; a prepended copy cuts back to the
  same card a beat later and reads as a stutter. `card()` holds it ~1 s either side of the
  recorded window, because the derived window is mapped by arithmetic rather than a frame-accurate
  timestamp and may drift.
- Derived windows are mapped onto the recording with `duration - spanMs - TAIL_S`. The recording's
  first frame is written at **first paint**, not at page creation, so the head offset varies by a
  second between a trivial demo and one that loads 200 rows — only the teardown tail is stable
  enough to anchor on. This only affects `--init`; once the numbers are in `promo-cut.json` they
  are used as written. If a _freshly derived_ list lands on the caption _after_ the one it should
  show, re-measure `TAIL_S` in `tools/stitch-promo.ts`.
- **Clips are joined with a cross-dissolve** (`XFADE`, 0.3 s), and the reel opens and closes on
  black. `xfade` overlaps its inputs, so the reel runs `(n-1) * XFADE` seconds shorter than the sum
  of its `in`/`out` spans. Only the reel dissolves — `--full` stays a stream copy, which is why it
  can join five minutes of footage in seconds. `--xfade=0` gives hard cuts back.

## The reel is an argument, not a spec sheet

A montage of features only proves the grid _has_ them. Every competitor also has them, so a viewer
who already uses one has been given no reason to switch. The differentiators — MIT licence, no
wrapper package, under 50 kB gzipped — are invisible on screen and must be **stated**, or nobody
derives them from watching a table sort.

The reel is therefore three acts, enforced by `ClipRole` and the `rank` map in `stitch-promo.ts`
(`intro` → `feature` → `punch` → `outro`; features keep declaration order within their band):

- **Act 1 — the hook.** The brand card, then a `code` card showing the entire integration. "One
  component" is a claim until the viewer sees how little markup it takes; that frame is the one
  people screenshot.
- **Act 2 — the evidence.** The feature clips. Their `label` is the caption, so write it as a
  **claim, not a description of what is on screen** — the viewer can already see the click. Every
  feature that is commonly paywalled carries the same `— usually a paid add-on` suffix; the
  repetition is the point, and it sets up Act 3.
- **Act 3 — the argument.** One `punch` card that names what the drumbeat was doing, then the
  outro with the install line.

- **Never name a competitor.** Comparative claims about a named product invite a legal argument we
  have no interest in having, and the reel does not need one — "usually a paid add-on" is an
  accurate statement about the market and lands the same point. Keep it descriptive of the
  category, never of a vendor.

- **A `main` line must survive being read alone.** Most viewers read the headline and nothing else,
  so it can never be the half of a sentence that the `sub` reverses. "All of that is paid." is
  factually about the competition and disastrous in isolation — it reads as our price. State the
  claim about _us_ in `main` ("All of that is free.") and leave the contrast to `sub`.

- **Every claim has to be literally true, not just directionally true.** A card is the one place
  in the reel with no demo behind it to keep it honest, and a punchy line is exactly where an
  inaccuracy hides. "No licence" was shorthand for "no licence fee" and read as "unlicensed" —
  which is both false and the opposite of the selling point, since MIT _is_ the selling point.
  Say "no licence fee", "no licence key", "MIT".

- **Captions live under ~44 characters.** Longer wraps to two lines and steals reading time from a
  ~2 s clip. `— usually a paid add-on` is 23 of those, so the feature name gets the rest.
- **`card(page, role, content, readMs)`** takes a `CardContent`: `main`, `sub`, `kicker` (small
  uppercase line, defaults to the package name) and `code` (rendered as a syntax-tinted `<pre>` by
  a three-token regex — tags orange, attribute names white, string values blue). No highlighter is
  pulled in for this; if the code card ever needs real highlighting, it is the wrong card.

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
2. **Body-level rules must exclude `[popover]`, `dialog` and `[class^='tbw-']`.** The filter panel,
   context menu, tooltip and row-drag badge are all appended to `<body>`, so a bare `body > *` rule
   treats them as demo roots: they inherit `display: flex` and the 336px rail reservation, and
   render as a mostly-empty box with the content crammed into one corner. Popovers additionally
   balloon and swallow the clicks aimed at the grid underneath. Match the `tbw-` class prefix
   rather than naming each surface — the next plugin to park something on `<body>` would otherwise
   reintroduce the bug silently, and no demo root carries a `tbw-` class (`tbw-grid` is an element
   name, not one).
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
