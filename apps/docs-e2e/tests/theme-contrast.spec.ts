import { expect, test } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { openDemo } from './utils';

/**
 * WCAG contrast guard for the two accessibility themes.
 *
 * `dg-theme-contrast.css` and `dg-theme-large.css` are the grid's a11y-focused
 * themes, so every text/background pair they produce must clear WCAG 2.1
 * Level **AAA** (7:1) in both light and dark mode. Non-text UI colours (the
 * accent used for focus outlines, resize handles and sort indicators) only
 * need SC 1.4.11's 3:1.
 *
 * The ratios are measured in a real browser rather than by parsing the CSS,
 * because the tokens use `light-dark()` and `color-mix()` — only the engine
 * knows what they resolve to.
 */

const THEMES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../libs/themes');

const AAA = 7;
const NON_TEXT_MIN = 3;

/** Text foreground/background pairs — all must reach AAA. */
const TEXT_PAIRS: ReadonlyArray<readonly [name: string, fg: string, bg: string]> = [
  ['body text on panel', '--tbw-color-fg', '--tbw-color-panel-bg'],
  ['body text on grid bg', '--tbw-color-fg', '--tbw-color-bg'],
  ['muted text on panel', '--tbw-color-fg-muted', '--tbw-color-panel-bg'],
  ['header text', '--tbw-color-header-fg', '--tbw-color-header-bg'],
  ['text on alternating row', '--tbw-color-fg', '--tbw-color-row-alt'],
  ['text on hovered row', '--tbw-color-fg', '--tbw-color-row-hover'],
  ['text on selected row', '--tbw-color-fg', '--tbw-color-selection'],
  ['text on accent', '--tbw-color-accent-fg', '--tbw-color-accent'],
  ['accent text on grid bg', '--tbw-color-accent-text', '--tbw-color-bg'],
];

/** Non-text UI pairs — must reach SC 1.4.11's 3:1. */
const NON_TEXT_PAIRS: ReadonlyArray<readonly [name: string, fg: string, bg: string]> = [
  ['accent (focus ring) on grid bg', '--tbw-color-accent', '--tbw-color-bg'],
  ['strong border on grid bg', '--tbw-color-border-strong', '--tbw-color-bg'],
];

type Measured = Record<string, number>;

/**
 * Resolve every listed pair against the live grid element and return the
 * contrast ratio for each, keyed by pair name.
 */
async function measure(
  page: import('@playwright/test').Page,
  scheme: 'light' | 'dark',
  pairs: ReadonlyArray<readonly [string, string, string]>,
): Promise<Measured> {
  return page.evaluate(
    ({ scheme, pairs }) => {
      const host = document.querySelector('tbw-grid') as HTMLElement;
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
      host.appendChild(probe);
      host.style.colorScheme = scheme;
      void host.offsetHeight;

      const toRGB = (value: string): [number, number, number] | null => {
        const rgb = value.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
        if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
        // color-mix() resolves to color(srgb …) with 0-1 components.
        const srgb = value.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
        if (srgb) return [+srgb[1] * 255, +srgb[2] * 255, +srgb[3] * 255];
        return null;
      };
      const read = (name: string) => {
        probe.style.backgroundColor = '';
        probe.style.backgroundColor = `var(${name})`;
        void probe.offsetHeight;
        return toRGB(getComputedStyle(probe).backgroundColor);
      };
      const luminance = ([r, g, b]: [number, number, number]) => {
        const channel = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };

      const out: Record<string, number> = {};
      for (const [name, fgVar, bgVar] of pairs) {
        const fg = read(fgVar);
        const bg = read(bgVar);
        if (!fg || !bg) {
          out[name] = -1;
          continue;
        }
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        out[name] = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      host.style.removeProperty('color-scheme');
      probe.remove();
      return out;
    },
    { scheme, pairs: pairs as [string, string, string][] },
  );
}

for (const theme of ['contrast', 'large'] as const) {
  test.describe(`dg-theme-${theme} — WCAG contrast`, () => {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${scheme} mode meets AAA for text and 3:1 for non-text`, async ({ page }) => {
        await openDemo(page, 'IntroBasicDemo');
        await page.addStyleTag({ path: resolve(THEMES_DIR, `dg-theme-${theme}.css`) });

        const text = await measure(page, scheme, TEXT_PAIRS);
        for (const [name] of TEXT_PAIRS) {
          expect(text[name], `${name} (${scheme}) contrast ratio`).toBeGreaterThanOrEqual(AAA);
        }

        const nonText = await measure(page, scheme, NON_TEXT_PAIRS);
        for (const [name] of NON_TEXT_PAIRS) {
          expect(nonText[name], `${name} (${scheme}) contrast ratio`).toBeGreaterThanOrEqual(NON_TEXT_MIN);
        }
      });
    }
  });
}
