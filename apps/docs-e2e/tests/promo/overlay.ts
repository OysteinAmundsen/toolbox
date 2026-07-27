import { type Locator, type Page } from '@playwright/test';

/**
 * Promo mode — visual overlays and camera pacing for the promo video run.
 *
 * Everything in this module is a **no-op unless `PW_PROMO_OVERLAY=1`** (set by
 * `playwright.promo.config.ts`). That is deliberate: the promo specs are real CI
 * tests. Correctness must come from web-first assertions, never from the pacing
 * helpers here — so the same specs run at full speed in CI and slowly on camera.
 */
export const PROMO = process.env.PW_PROMO_OVERLAY === '1';

// #region Browser-side overlay

declare global {
  interface Window {
    __tbwPromo?: {
      caption(text: string | null): void;
      title(main: string, sub?: string | null): void;
      spotlight(rect: { x: number; y: number; width: number; height: number } | null): void;
    };
  }
}

/**
 * Installs the cursor / click-pulse / keycap / caption / title / spotlight layer.
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
         * Everything visual lives inside one top-layer popover. z-index alone is
         * not enough: the filtering plugin promotes its panel with
         * popover="manual", and the top layer sits above *every* z-index, so the
         * panel would render straight over the cursor. The UA stylesheet for
         * [popover] also imposes inset/margin/border/background, all reset here.
         */
        .tbw-promo-root {
          position: fixed; inset: 0; width: 100vw; height: 100vh;
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
          z-index: 2147483646; transition: transform 85ms ease;
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
        .tbw-promo-spot {
          border-radius: 10px;
          border: 2px solid rgba(255,119,67,0.95);
          box-shadow: 0 0 0 9999px rgba(6, 8, 12, 0.42);
          opacity: 0; z-index: 2147483641;
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
          padding: 14px 24px;
          background: rgba(10, 12, 16, 0.96); color: #fff;
          box-shadow: 0 8px 24px rgba(0,0,0,0.32);
        }
        .tbw-promo-title.show { display: block; }
        .tbw-promo-title b {
          display: block;
          font: 700 22px/1.25 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .tbw-promo-title span {
          display: block; margin-top: 2px; color: rgba(255,255,255,0.72);
          font: 500 14px/1.3 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .tbw-promo-caption {
          left: 50%; bottom: 46px; transform: translateX(-50%);
          max-width: min(78vw, 1000px); padding: 14px 26px; border-radius: 14px;
          background: rgba(10, 12, 16, 0.9); color: #fff; text-align: center;
          font: 600 22px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          box-shadow: 0 8px 24px rgba(0,0,0,0.32);
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
      const spot = make('tbw-promo-spot');
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
          titleEl.classList.add('show');
        },
        spotlight(rect) {
          if (!rect) {
            spot.classList.remove('show');
            return;
          }
          spot.style.left = `${rect.x - 6}px`;
          spot.style.top = `${rect.y - 6}px`;
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

/**
 * Show a caption explaining the *intent* of the next action, then hold.
 * This is what turns a screen recording into a promo. No-op outside promo mode.
 *
 * The default hold is sized for reading, not for the test. Reading speed is
 * roughly 15 characters/second for a first-time viewer glancing at a moving
 * screen, plus a beat to notice the caption appeared at all.
 */
export async function say(page: Page, text: string, holdMs?: number) {
  if (!PROMO) return;
  await page.evaluate((t) => window.__tbwPromo?.caption(t), text);
  await page.waitForTimeout(holdMs ?? Math.min(6500, 1300 + text.length * 65));
}

/** Hide the caption band. No-op outside promo mode. */
export async function hush(page: Page) {
  if (!PROMO) return;
  await page.evaluate(() => window.__tbwPromo?.caption(null));
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
 * it only has to read as deliberate. The time budget belongs to `say()`, where
 * the viewer is actually reading something.
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
  await moveTo(page, target);
  await beat(page, 250);
  await target.click(options);
  await beat(page, 800);
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
