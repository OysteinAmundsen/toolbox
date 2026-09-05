import { type Locator, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'fs/promises';

/**
 * Promo mode — cinematic staging, visual overlays and camera pacing.
 *
 * Everything in this module is a **no-op unless `PW_PROMO_OVERLAY=1`** (set by
 * `playwright.promo.config.ts`). That is deliberate: the promo specs are real CI
 * tests. Correctness must come from web-first assertions, never from the pacing
 * helpers here — so the same specs run at full speed in CI and slowly on camera.
 *
 * Two artefacts come out of a promo run:
 *  - the **video**, recorded by Playwright, covering the whole test; and
 *  - the **timeline** ({@link clip}) — the `{label, startMs, endMs}` windows
 *    marking the money shots inside that video.
 *
 * `tools/stitch-promo.ts` reads the timeline to cut a ≤30 s reel out of several
 * minutes of footage. A scene without a `clip()` contributes nothing to the reel.
 */
export const PROMO = process.env.PW_PROMO_OVERLAY === '1';

// #region Timeline (money-shot markers)

/** Where a clip lands in the stitched reel. Features keep declaration order. */
export type ClipRole = 'intro' | 'feature' | 'outro';

export interface ClipOptions {
  /** Short, punchy label. It is on screen for barely a second in the reel — keep it under ~44 chars. */
  label: string;
  /** Relative share of the reel's time budget. 1 = normal, 2 = twice as long. */
  weight?: number;
  /** Ordering bucket. Intros play first, outros last, features in declaration order. */
  role?: ClipRole;
  /** Which end of the window survives when the reel budget is tighter than the window. */
  align?: 'start' | 'middle' | 'end';
  /** Guaranteed screen time in the reel, taken off the top before weights are applied. */
  minMs?: number;
  /**
   * Set `false` to keep the clip out of the short reel. The scene still runs, still
   * asserts, and still appears in `--full` — it just does not spend reel seconds.
   */
  reel?: boolean;
  /** Extra hold after the action — for transitions that keep animating. */
  holdMs?: number;
  /** Lead-in before the action, so the "before" state registers. */
  leadMs?: number;
}

/** One recorded window, in milliseconds relative to {@link markPageStart}. */
export interface ClipMark extends Required<Omit<ClipOptions, 'holdMs' | 'leadMs'>> {
  startMs: number;
  endMs: number;
}

interface Timeline {
  startedAt: number;
  /** Wall-clock span of the whole test — the stitcher uses it to align marks to the video. */
  spanMs: number;
  marks: ClipMark[];
}

const timelines = new WeakMap<Page, Timeline>();

/**
 * Anchor the timeline to (approximately) the first recorded video frame.
 *
 * Playwright starts the screencast when the page is created and exposes no
 * timestamp for it, so the promo fixture calls this as early as it can. The
 * residual lead-in is recovered in the stitcher from the real video duration:
 * `lead = duration - spanMs - tail`.
 */
export function markPageStart(page: Page) {
  if (PROMO) timelines.set(page, { startedAt: Date.now(), spanMs: 0, marks: [] });
}

/**
 * Attach the recorded windows to the test result so the stitcher can find them.
 * Called by the promo fixture; specs never call this directly.
 */
export async function attachPromoTimeline(page: Page, testInfo: TestInfo) {
  const timeline = timelines.get(page);
  if (!PROMO || !timeline) return;
  timeline.spanMs = Date.now() - timeline.startedAt;
  // Attach by `path`, not `body`: the JSON reporter inlines a body attachment as
  // base64 and omits `path` entirely, and the stitcher resolves everything —
  // video included — through `path`.
  const file = testInfo.outputPath('promo-timeline.json');
  await writeFile(file, JSON.stringify({ title: testInfo.title, ...timeline }, null, 2), 'utf8');
  await testInfo.attach('promo-timeline', { contentType: 'application/json', path: file });
}

/**
 * Mark the *money shot* of a scene and narrate it.
 *
 * Wrap the single interaction whose visible result sells the feature — the sort
 * flipping the column, rows collapsing under a filter, the table morphing into
 * cards. `body` runs identically in CI (this is a plain pass-through when promo
 * mode is off), so the assertions inside it stay real tests.
 *
 * ```ts
 * await clip(page, 'Sort by any column', async () => {
 *   await salary.click();
 *   await expect(salary).toHaveAttribute('aria-sort', 'descending');
 * });
 * ```
 *
 * One clip per scene is the target: the 30-second budget is split across every
 * clip in the run, so a second clip halves what the first one gets.
 */
export async function clip<T>(page: Page, label: string | ClipOptions, body: () => Promise<T>): Promise<T> {
  if (!PROMO) return body();

  const opts: ClipOptions = typeof label === 'string' ? { label } : label;
  const timeline = timelines.get(page);

  // The lead-in is inside the window on purpose: the caption needs to be
  // readable before the action starts, and a window barely longer than the
  // gesture leaves the stitcher nothing to spend the reel budget on.
  if (opts.label) await setCaption(page, opts.label);
  const startMs = Date.now();
  await beat(page, opts.leadMs ?? 600);

  const result = await body();
  await beat(page, opts.holdMs ?? 1400);

  timeline?.marks.push({
    label: opts.label,
    role: opts.role ?? 'feature',
    weight: opts.weight ?? 1,
    align: opts.align ?? 'end',
    minMs: opts.minMs ?? 0,
    reel: opts.reel ?? true,
    startMs: startMs - timeline.startedAt,
    endMs: Date.now() - timeline.startedAt,
  });
  return result;
}

// #endregion

// #region Browser-side overlay

declare global {
  interface Window {
    __tbwPromo?: {
      caption(text: string | null): void;
      title(main: string, sub?: string | null): void;
      card(main: string | null, sub?: string | null): void;
      spotlight(rect: { x: number; y: number; width: number; height: number } | null): void;
    };
  }
}

/**
 * Installs the cinematic stage plus the cursor / click-pulse / keycap / caption /
 * title / spotlight layer.
 *
 * Registered via `addInitScript`, so it re-mounts automatically on every
 * navigation. Safe to call more than once per page.
 */
export async function installOverlay(page: Page) {
  const flag = '__tbwPromoOverlayInstalled';
  const marked = page as unknown as Record<string, unknown>;
  if (marked[flag]) return;
  marked[flag] = true;

  await page.addInitScript(() => {
    const mount = () => {
      if (window.__tbwPromo || !document.body) return;

      const style = document.createElement('style');
      style.textContent = `
        /*
         * ── Stage ────────────────────────────────────────────────────────────
         * The e2e harness renders each demo into a bare white page with 16px of
         * padding, so on camera a 350px-tall grid floats in an ocean of nothing.
         * These rules reframe the same DOM as a product shot: dark surround, the
         * grid claiming the frame, and the demo's control panel pinned right as
         * an inspector rail.
         *
         * Nothing here is \`display: none\` — every control a scene clicks has to
         * stay actionable, or the test would hang instead of fail.
         *
         * WARNING: this CSS lives inside a template literal, so a bare backtick
         * anywhere below — including in a comment — terminates the string and
         * breaks the whole file at parse time. Escape it, or write around it.
         */
        html { background: #06080c; }
        body {
          margin: 0; padding: 0; min-height: 100vh;
          display: flex; flex-direction: column;
          background: radial-gradient(130% 120% at 50% -10%, #1d2635 0%, #0a0d14 55%, #06080c 100%);
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        /*
         * The demo root — everything at body level that is not ours.
         *
         * The [popover] and dialog exclusions MUST stay. The filter panel, the
         * context menu and the tooltip are all popovers parented to <body>, so
         * without them a popover inherits the stage's flex + padding, balloons
         * to fill the frame and then swallows the clicks aimed at its own
         * contents ("<div popover> intercepts pointer events").
         */
        body > :not(.tbw-promo-root):not(.tbw-promo-title):not(script):not(style):not([popover]):not(dialog) {
          flex: 1 1 auto;
          display: flex; flex-direction: column; justify-content: center;
          /*
           * Must stay stretched: an auto inline margin would make this flex item
           * shrink-to-fit its max-content width, which silently removes the
           * horizontal overflow the virtualization and pinned-column scenes
           * depend on. Scenes that narrow the demo centre it themselves.
           */
          margin: 0; padding: 18px 22px 22px;
          /*
           * The inspector rail lives in the 312px overhang that the stitcher
           * crops away, so it never reaches the delivered frame. It cannot
           * simply be hidden: scenes click these controls, and anything moved
           * off-screen or given pointer-events: none stops being actionable.
           * The reservation is unconditional — demos without controls have to
           * line up with the same crop. It also has to live *inside* this rule:
           * a separate selector without :not(script):not(style) scores lower
           * than the shorthand above and is silently overridden.
           */
          padding-right: 336px;
          min-height: 0;
        }
        /*
         * Let the grid claim the frame instead of its authored 350px, but cap it
         * so the demo stays a *composition* — grid centred, dark bands above and
         * below — rather than edge-to-edge table.
         */
        body > :not(.tbw-promo-root):not(.tbw-promo-title):not([popover]):not(dialog) tbw-grid {
          flex: 0 1 auto; height: 100%; min-height: 0; max-height: 560px;
          border-radius: 10px; overflow: hidden;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
        }
        /*
         * The rail itself. Fixed to the right edge of the viewport, which is
         * exactly the overhang the stitcher discards.
         */
        .demo-controls {
          position: fixed !important; top: 0; right: 0; bottom: 0; width: 312px;
          margin: 0 !important; border-radius: 0 !important;
          overflow: auto; z-index: 40; font-size: 12px;
          background: rgba(10, 13, 19, 0.95) !important;
          border: 0 !important; border-left: 1px solid rgba(255, 255, 255, 0.09) !important;
          color: rgba(255, 255, 255, 0.86) !important;
          box-shadow: -18px 0 40px rgba(0, 0, 0, 0.45);
        }
        .demo-controls :where(span, label, div, output, legend) { color: inherit !important; }
        /*
         * The rail is set dressing — nobody reads a 12px help paragraph at 30 fps,
         * and on a 312px rail the descriptions wrap into slivers that make the
         * whole panel look broken. Hidden, not removed: no scene clicks one.
         */
        .demo-controls .dc-desc { display: none !important; }
        .demo-controls .dc-section-label { color: rgba(255, 119, 67, 0.9) !important; }

        /*
         * Several demos print an event log under the grid. On a dark stage that
         * is a glaring white slab competing with the grid, so dim it into the
         * background — it still proves the events fire, quietly.
         */
        .log-panel, .event-log {
          background: rgba(10, 13, 19, 0.72) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
          color: rgba(255, 255, 255, 0.55) !important;
        }
        .log-panel { max-height: 92px; overflow: hidden; }
        .log-panel :where(strong, span, div, button) { color: inherit !important; }

        /*
         * ── Overlay layer ────────────────────────────────────────────────────
         * Everything visual lives inside one top-layer popover. z-index alone is
         * not enough: the filtering plugin promotes its panel with
         * popover="manual", and the top layer sits above *every* z-index, so the
         * panel would render straight over the cursor. The UA stylesheet for
         * [popover] also imposes inset/margin/border/background, all reset here.
         */
        .tbw-promo-root {
          position: fixed; inset: 0 312px 0 0; width: auto; height: 100vh;
          margin: 0; border: 0; padding: 0; background: transparent;
          overflow: visible; pointer-events: none;
        }
        .tbw-promo-root::backdrop { background: transparent; }
        .tbw-promo-layer { position: absolute; pointer-events: none; z-index: 2147483640; }
        .tbw-promo-cursor {
          width: 20px; height: 28px;
          background: linear-gradient(150deg, #161616 0%, #070707 52%, #000 100%);
          clip-path: polygon(0 0, 0 85%, 27% 64%, 43% 100%, 57% 92%, 42% 57%, 100% 57%);
          box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 8px 18px rgba(0,0,0,0.34);
          transform: translate(-2px, -2px); transform-origin: 0 0;
          z-index: 2147483646;
          /*
           * left/top are set from a mousemove listener, and slowMo spaces those
           * ~70ms apart — two video frames of nothing, then a jump. Interpolating
           * between the hops is what makes the pointer read as a glide.
           */
          transition: transform 85ms ease, left 90ms linear, top 90ms linear;
        }
        .tbw-promo-cursor.down { transform: translate(-2px, -2px) scale(0.86); }
        .tbw-promo-click {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,119,67,0.95); transform: translate(-50%, -50%);
          z-index: 2147483645; animation: tbw-promo-click 420ms ease-out forwards;
        }
        @keyframes tbw-promo-click {
          0% { opacity: 0.95; width: 14px; height: 14px; }
          100% { opacity: 0; width: 60px; height: 60px; }
        }
        /*
         * The dim is the ring's own 9999px box-shadow, so it is clipped to this
         * wrapper rather than to the frame. The wrapper starts below the title
         * band, which has to stay legible — it is the only thing on screen that
         * says what the demo is.
         */
        .tbw-promo-spot-wrap { left: 0; right: 0; bottom: 0; overflow: hidden; z-index: 2147483641; }
        .tbw-promo-spot {
          border-radius: 10px;
          border: 2px solid rgba(255,119,67,0.95);
          box-shadow: 0 0 0 9999px rgba(6, 8, 12, 0.42);
          opacity: 0;
          transition: opacity 220ms ease, top 260ms ease, left 260ms ease, width 260ms ease, height 260ms ease;
        }
        .tbw-promo-spot.show { opacity: 1; }
        /*
         * The title card is deliberately **in-flow**, not a fixed overlay: it
         * has to push the page down rather than sit on top of the demo's own
         * heading and controls, which it would otherwise hide.
         */
        .tbw-promo-title {
          display: none;
          align-items: baseline; gap: 14px;
          padding: 13px 26px;
          background: linear-gradient(90deg, rgba(255,119,67,0.16) 0%, rgba(10,12,16,0) 62%), rgba(9, 11, 16, 0.97);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .tbw-promo-title.show { display: flex; }
        /* Sit above the inspector rail, and keep the brand chip out of the crop. */
        .tbw-promo-title { position: relative; z-index: 60; padding-right: 338px; }
        body:has(.tbw-promo-title.show) .demo-controls { top: 54px; }
        .tbw-promo-title b {
          font: 700 21px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          letter-spacing: -0.01em;
        }
        .tbw-promo-title span {
          color: rgba(255,255,255,0.6);
          font: 500 14px/1.3 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .tbw-promo-title i {
          margin-left: auto; font-style: normal; color: rgba(255,119,67,0.92);
          font: 600 13px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          letter-spacing: 0.06em;
        }
        .tbw-promo-caption {
          left: 50%; bottom: 40px; transform: translateX(-50%);
          max-width: min(86vw, 1180px); padding: 15px 32px; border-radius: 999px;
          background: rgba(8, 10, 15, 0.93); color: #fff; text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font: 650 26px/1.3 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          letter-spacing: -0.015em;
          box-shadow: 0 12px 34px rgba(0,0,0,0.5);
          z-index: 2147483647; opacity: 0; transition: opacity 180ms ease;
        }
        .tbw-promo-caption.show { opacity: 1; }
        .tbw-promo-keys {
          left: 50%; bottom: 122px; transform: translateX(-50%);
          padding: 8px 16px; border-radius: 999px;
          background: rgba(255, 119, 67, 0.95); color: #10131a;
          font: 700 16px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          letter-spacing: 0.04em; white-space: nowrap;
          box-shadow: 0 6px 16px rgba(0,0,0,0.26);
          z-index: 2147483647; opacity: 0; transition: opacity 120ms ease;
        }
        .tbw-promo-keys.show { opacity: 1; }
        /* Full-frame card — the opening and closing titles of the stitched reel. */
        .tbw-promo-card {
          inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 16px;
          background: radial-gradient(115% 110% at 50% 32%, #1e2839 0%, #0a0d14 58%, #05070b 100%);
          color: #fff; text-align: center;
          opacity: 0; z-index: 2147483644; transition: opacity 260ms ease;
        }
        .tbw-promo-card.show { opacity: 1; }
        /*
         * A card is a full-frame title, so nothing from the demo underneath may
         * bleed through — including the synthetic cursor, which otherwise parks
         * itself in a corner of an otherwise clean brand shot.
         */
        .tbw-promo-root:has(.tbw-promo-card.show) :is(.tbw-promo-cursor, .tbw-promo-keys, .tbw-promo-spot, .tbw-promo-caption) {
          opacity: 0 !important;
        }
        .tbw-promo-card b {
          font: 800 76px/1.05 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          letter-spacing: -0.035em;
          background: linear-gradient(96deg, #ffffff 10%, #ff7743 105%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .tbw-promo-card span {
          font: 500 28px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          color: rgba(255,255,255,0.7); max-width: 46ch;
        }
        .tbw-promo-card em {
          font-style: normal;
          font: 600 16px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,119,67,0.92);
        }
      `;
      document.head?.appendChild(style);

      const root = document.createElement('div');
      root.className = 'tbw-promo-root';
      root.setAttribute('popover', 'manual');
      document.body.appendChild(root);

      /**
       * Re-assert the overlay's place in the top layer. Ordering there is by
       * *most recently shown*, so any popover the grid opens afterwards would
       * otherwise sit on top of the cursor.
       */
      const raise = () => {
        try {
          if (root.matches(':popover-open')) root.hidePopover();
          root.showPopover();
        } catch {
          /* popover unsupported — the z-index fallback still applies */
        }
      };
      raise();
      // `toggle` does not bubble, but capture-phase listeners still see it.
      document.addEventListener(
        'toggle',
        (ev) => {
          if (ev.target !== root && (ev as ToggleEvent).newState === 'open') raise();
        },
        true,
      );

      const make = (cls: string) => {
        const el = document.createElement('div');
        el.className = `tbw-promo-layer ${cls}`;
        root.appendChild(el);
        return el;
      };

      const cursor = make('tbw-promo-cursor');
      cursor.style.left = '16px';
      cursor.style.top = '16px';
      const spotWrap = make('tbw-promo-spot-wrap');
      const spot = make('tbw-promo-spot');
      spotWrap.appendChild(spot);
      const cardEl = make('tbw-promo-card');
      const captionEl = make('tbw-promo-caption');
      const keysEl = make('tbw-promo-keys');

      // In-flow banner — prepended to <body> so it displaces the page instead
      // of overlapping it. Deliberately *not* a `.tbw-promo-layer`.
      const titleEl = document.createElement('div');
      titleEl.className = 'tbw-promo-title';
      document.body.insertBefore(titleEl, document.body.firstChild);

      // ── Cursor tracking (eased follow so motion reads as human) ──
      let curX = 16;
      let curY = 16;
      let tgtX = 16;
      let tgtY = 16;
      let raf = 0;
      const paint = () => {
        const dx = tgtX - curX;
        const dy = tgtY - curY;
        curX += dx * 0.25;
        curY += dy * 0.25;
        cursor.style.left = `${curX}px`;
        cursor.style.top = `${curY}px`;
        if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) {
          curX = tgtX;
          curY = tgtY;
          cursor.style.left = `${curX}px`;
          cursor.style.top = `${curY}px`;
          raf = 0;
          return;
        }
        raf = requestAnimationFrame(paint);
      };
      const snap = (x: number, y: number) => {
        curX = tgtX = x;
        curY = tgtY = y;
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      };

      const track = (ev: MouseEvent | DragEvent) => {
        // Chromium reports 0/0 on the terminal drag events; honouring those
        // would snap the cursor into the top-left corner at the end of a drag.
        if (!ev.clientX && !ev.clientY) return;
        tgtX = ev.clientX;
        tgtY = ev.clientY;
        if (!raf) raf = requestAnimationFrame(paint);
      };

      // Capture phase throughout: drag implementations routinely
      // `stopPropagation()`, which would otherwise freeze the cursor.
      addEventListener('mousemove', track, { passive: true, capture: true });
      // The reorder plugins use **native HTML5 drag and drop**
      // (`draggable="true"` + `dragstart`/`dragover`). While a native drag is in
      // flight the browser fires no `mousemove` at all, so without these two the
      // cursor sits frozen at the grab point for the whole drag.
      addEventListener('drag', track, { passive: true, capture: true });
      addEventListener('dragover', track, { passive: true, capture: true });

      addEventListener(
        'mousedown',
        (ev) => {
          snap(ev.clientX, ev.clientY);
          cursor.classList.add('down');
        },
        { passive: true, capture: true },
      );
      const release = () => cursor.classList.remove('down');
      addEventListener('mouseup', release, { passive: true, capture: true });
      addEventListener('dragend', release, { passive: true, capture: true });
      addEventListener('drop', release, { passive: true, capture: true });
      addEventListener(
        'click',
        (ev) => {
          snap(ev.clientX, ev.clientY);
          const pulse = document.createElement('div');
          pulse.className = 'tbw-promo-layer tbw-promo-click';
          pulse.style.left = `${ev.clientX}px`;
          pulse.style.top = `${ev.clientY}px`;
          root.appendChild(pulse);
          setTimeout(() => pulse.remove(), 500);
        },
        { passive: true, capture: true },
      );

      // ── Keycap readout ──
      // Printable characters accumulate into a running string so that typing a
      // word reads as typing, rather than as a single key flickering 16 times.
      let keyTimer = 0;
      let typed = '';
      addEventListener(
        'keydown',
        (ev) => {
          if (ev.repeat) return;
          const chord = ev.metaKey || ev.ctrlKey || ev.altKey;
          let label: string;
          if (!chord && ev.key.length === 1) {
            typed += ev.key === ' ' ? ' ' : ev.key;
            label = typed;
          } else {
            typed = '';
            const parts: string[] = [];
            if (ev.metaKey) parts.push('Cmd');
            if (ev.ctrlKey) parts.push('Ctrl');
            if (ev.altKey) parts.push('Alt');
            if (ev.shiftKey) parts.push('Shift');
            if (!['Meta', 'Control', 'Alt', 'Shift'].includes(ev.key)) {
              parts.push(ev.key === ' ' ? 'Space' : ev.key.length === 1 ? ev.key.toUpperCase() : ev.key);
            }
            if (!parts.length) return;
            label = parts.join(' + ');
          }
          keysEl.textContent = label;
          keysEl.classList.add('show');
          clearTimeout(keyTimer);
          keyTimer = setTimeout(() => {
            keysEl.classList.remove('show');
            typed = '';
          }, 1600) as unknown as number;
        },
        { passive: true, capture: true },
      );

      window.__tbwPromo = {
        caption(text) {
          if (text) {
            captionEl.textContent = text;
            captionEl.classList.add('show');
          } else {
            captionEl.classList.remove('show');
          }
        },
        title(main, sub) {
          titleEl.innerHTML = '';
          const b = document.createElement('b');
          b.textContent = main;
          titleEl.appendChild(b);
          if (sub) {
            const s = document.createElement('span');
            s.textContent = sub;
            titleEl.appendChild(s);
          }
          const brand = document.createElement('i');
          brand.textContent = 'toolboxjs.com';
          titleEl.appendChild(brand);
          titleEl.classList.add('show');
        },
        card(main, sub) {
          if (!main) {
            cardEl.classList.remove('show');
            return;
          }
          cardEl.innerHTML = '';
          const kicker = document.createElement('em');
          kicker.textContent = '@toolbox-web/grid';
          const b = document.createElement('b');
          b.textContent = main;
          cardEl.append(kicker, b);
          if (sub) {
            const s = document.createElement('span');
            s.textContent = sub;
            cardEl.appendChild(s);
          }
          cardEl.classList.add('show');
        },
        spotlight(rect) {
          if (!rect) {
            spot.classList.remove('show');
            return;
          }
          // Ring coordinates are viewport-relative; the wrapper is not.
          const inset = titleEl.classList.contains('show') ? titleEl.getBoundingClientRect().height : 0;
          spotWrap.style.top = `${inset}px`;
          spot.style.left = `${rect.x - 6}px`;
          spot.style.top = `${rect.y - 6 - inset}px`;
          spot.style.width = `${rect.width + 12}px`;
          spot.style.height = `${rect.height + 12}px`;
          spot.classList.add('show');
        },
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }
  });
}

// #endregion

// #region Pacing & narration (promo-only, no-op in CI)

/**
 * Camera pacing only. **Never** use this to wait for correctness — use a
 * web-first `expect()` for that. No-op outside promo mode.
 */
export async function beat(page: Page, ms = 1100) {
  if (PROMO) await page.waitForTimeout(ms);
}

/** Set the caption band without holding. Internal to {@link say} and {@link clip}. */
async function setCaption(page: Page, text: string | null) {
  await page.evaluate((t) => window.__tbwPromo?.caption(t), text);
}

/**
 * Show a caption explaining the *intent* of the next action, then hold.
 *
 * This is connective narration for the long-form cut. The **reel** only ever
 * shows {@link clip} labels, so a `say()` outside a clip window costs wall-clock
 * without appearing in the 30-second edit — keep them short and few.
 */
export async function say(page: Page, text: string, holdMs?: number) {
  if (!PROMO) return;
  await setCaption(page, text);
  await page.waitForTimeout(holdMs ?? Math.min(3400, 700 + text.length * 36));
}

/** Hide the caption band. No-op outside promo mode. */
export async function hush(page: Page) {
  if (!PROMO) return;
  await setCaption(page, null);
}

/**
 * Pin the scene title card. Rendered as an in-flow banner at the top of the
 * page, so it displaces content instead of covering it. No-op outside promo
 * mode.
 */
export async function titleCard(page: Page, main: string, sub?: string) {
  if (!PROMO) return;
  await page.evaluate(([m, s]) => window.__tbwPromo?.title(m as string, s), [main, sub ?? null]);
}

/**
 * Full-frame branded card, recorded as an `intro`/`outro` clip so the stitcher
 * can bookend the reel with it.
 *
 * The card stays up for roughly a second either side of the recorded window.
 * Clip windows are mapped onto the video by arithmetic, not by a frame-accurate
 * timestamp, so without that padding a few hundred milliseconds of drift puts
 * the demo page — rather than the brand card — at the head of the reel.
 *
 * No-op outside promo mode — which is why the caller must still assert something
 * real around it, exactly like any other scene.
 */
export async function card(page: Page, role: 'intro' | 'outro', main: string, sub?: string) {
  if (!PROMO) return;
  await page.evaluate(([m, s]) => window.__tbwPromo?.card(m as string, s), [main, sub ?? null]);
  await beat(page, 950);
  await clip(page, { label: '', role, weight: 1.3, align: 'middle', minMs: 2000, leadMs: 0, holdMs: 900 }, async () => {
    await beat(page, 1500);
  });
  await beat(page, 950);
  await page.evaluate(() => window.__tbwPromo?.card(null));
  await beat(page, 250);
}

/** Last known pointer position per page — Playwright does not expose it. */
const pointer = new WeakMap<Page, { x: number; y: number }>();

/**
 * Move the pointer along an eased path, one protocol call per frame.
 *
 * `page.mouse.move(x, y, { steps })` dispatches every step back-to-back with no
 * delay, so the travel is over in milliseconds — which is why unassisted drags
 * look like teleports on camera. Issuing separate `move` calls lets `slowMo`
 * space them out into visible motion.
 *
 * Frame count is deliberately low. Travel is *connective tissue*, not content:
 * it only has to read as deliberate. The time budget belongs to `clip()`, where
 * the viewer is actually being shown something.
 */
export async function glidePointer(page: Page, toX: number, toY: number, frames = 11) {
  const from = pointer.get(page) ?? { x: toX, y: toY };
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    // ease-in-out: accelerate away, settle onto the target
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(from.x + (toX - from.x) * e, from.y + (toY - from.y) * e);
  }
  pointer.set(page, { x: toX, y: toY });
}

/**
 * Glide the pointer to the centre of `target` without clicking.
 *
 * `locator.click()` jumps the mouse straight to the element in a single
 * protocol move, so on camera the cursor teleports. Call this first — or use
 * `glideClick()` — whenever the *approach* is part of what is being shown.
 * No-op outside promo mode.
 */
export async function moveTo(page: Page, target: Locator, frames = 11) {
  if (!PROMO) return;
  const box = await target.boundingBox();
  if (!box) return;
  await glidePointer(page, box.x + box.width / 2, box.y + box.height / 2, frames);
}

/**
 * Approach `target`, click it, then hold so the result can register. Outside
 * promo mode this is a plain `locator.click()`, so the assertion semantics are
 * identical in CI.
 */
export async function glideClick(page: Page, target: Locator, options?: Parameters<Locator['click']>[0]) {
  await aim(page, target, () => target.click(options));
  await beat(page, 600);
}

/**
 * Ring `target`, run the action, drop the ring.
 *
 * The ring answers one question — *where is the next thing going to happen?* —
 * so it is scoped to the action and cleared the moment the action returns. Set
 * by hand it always outlives its meaning: it stays on a header through the next
 * two clicks, or sits over a filter panel that has already closed, and the reel
 * reads as unedited. Prefer this (or `glideClick`) over calling `spotlight()`
 * directly; a bare `spotlight()` is for holding a *result* on screen, not an
 * intent.
 *
 * Outside promo mode it is a transparent pass-through, so CI keeps the same
 * assertions and none of the pauses.
 */
export async function aim<T>(page: Page, target: Locator, body: () => Promise<T>): Promise<T> {
  if (!PROMO) return body();
  await spotlight(page, target);
  await beat(page, 260);
  try {
    return await body();
  } finally {
    await spotlight(page, null);
  }
}

/**
 * Dim the page and ring `target` so the viewer's eye lands in the right place.
 * Pass `null` to clear. No-op outside promo mode.
 *
 * The pointer is glided to the ring as well. Without that the ring reads as an
 * unexplained orange box somewhere else on screen; moving the cursor there makes
 * the two cues a single gesture — "the mouse is going *here*, watch *this*".
 */
export async function spotlight(page: Page, target: Locator | null) {
  if (!PROMO) return;
  const rect = target ? await target.boundingBox() : null;
  await page.evaluate((r) => window.__tbwPromo?.spotlight(r), rect);
  if (rect) await glidePointer(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

// #endregion
