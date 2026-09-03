/**
 * WCAG contrast maths for the Theme Builder's accessibility panel.
 *
 * This mirrors `measure()` in `apps/docs-e2e/tests/theme-contrast.spec.ts`, which
 * is the gate that fails CI. The two must agree: a panel that reports a pair as
 * passing when the gate fails it is worse than no panel at all.
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ContrastPair {
  name: string;
  description: string;
  foreground: string;
  background: string;
  /** Held to SC 1.4.11's 3:1 rather than the text bars. */
  nonText?: boolean;
}

/** Every pair the CI gate asserts, in the order the panel renders them. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  {
    name: 'Body Text',
    description: 'Primary text on panel background',
    foreground: '--tbw-color-fg',
    background: '--tbw-color-panel-bg',
  },
  {
    name: 'Body on Grid',
    description: 'Primary text on the grid background',
    foreground: '--tbw-color-fg',
    background: '--tbw-color-bg',
  },
  {
    name: 'Muted Text',
    description: 'Secondary text on panel background',
    foreground: '--tbw-color-fg-muted',
    background: '--tbw-color-panel-bg',
  },
  {
    name: 'Header Text',
    description: 'Header text on header background',
    foreground: '--tbw-color-header-fg',
    background: '--tbw-color-header-bg',
  },
  {
    name: 'Alt Row Text',
    description: 'Text on an alternating row',
    foreground: '--tbw-color-fg',
    background: '--tbw-color-row-alt',
  },
  {
    name: 'Hover Row Text',
    description: 'Text on hovered row',
    foreground: '--tbw-color-fg',
    background: '--tbw-color-row-hover',
  },
  {
    name: 'Selected Row Text',
    description: 'Text on selected row',
    foreground: '--tbw-color-fg',
    background: '--tbw-color-selection',
  },
  {
    name: 'Accent Contrast',
    description: 'Text on accent-colored background',
    foreground: '--tbw-color-accent-fg',
    background: '--tbw-color-accent',
  },
  {
    name: 'Accent Text',
    description: 'Accent-colored text on the grid background',
    foreground: '--tbw-color-accent-text',
    background: '--tbw-color-bg',
  },
  {
    name: 'Focus Ring',
    description: 'Focus ring against the grid background (SC 1.4.11, 3:1)',
    foreground: '--tbw-color-accent',
    background: '--tbw-color-bg',
    nonText: true,
  },
  {
    name: 'Strong Border',
    description: 'Editor/input border against the grid background (SC 1.4.11, 3:1)',
    foreground: '--tbw-color-border-strong',
    background: '--tbw-color-bg',
    nonText: true,
  },
];

/** Accepts hex, `rgb()`/`rgba()` and the `color(srgb …)` form `color-mix()` computes to. */
export function parseColorToRGBA(color: string): RGBA | null {
  if (!color || color === 'transparent') return null;

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
    return null;
  }

  const rgb = color.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgb) {
    return {
      r: parseFloat(rgb[1]),
      g: parseFloat(rgb[2]),
      b: parseFloat(rgb[3]),
      a: rgb[4] === undefined ? 1 : parseFloat(rgb[4]),
    };
  }

  const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i);
  if (srgb) {
    return {
      r: Math.round(parseFloat(srgb[1]) * 255),
      g: Math.round(parseFloat(srgb[2]) * 255),
      b: Math.round(parseFloat(srgb[3]) * 255),
      a: srgb[4] === undefined ? 1 : parseFloat(srgb[4]),
    };
  }

  return null;
}

/** Paints `fg` over `bg` using `fg`'s alpha. */
export function compositeColors(
  fg: RGBA,
  bg: { r: number; g: number; b: number },
): { r: number; g: number; b: number } {
  if (fg.a >= 1) return { r: fg.r, g: fg.g, b: fg.b };
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
  };
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Row tints and selection fills are translucent overlays, so the ratio that
 * matters is the one actually painted: `background` over `base`, then
 * `foreground` over that. Scoring the raw token instead reads
 * `rgba(0,0,0,0.05)` as pure black.
 */
export function getContrastRatio(fg: string, bg: string, base?: string): number | null {
  const fgRgba = parseColorToRGBA(fg);
  const bgRgba = parseColorToRGBA(bg);
  if (!fgRgba || !bgRgba) return null;

  const baseRgba = (base && parseColorToRGBA(base)) || { r: 255, g: 255, b: 255, a: 1 };
  const effectiveBg = compositeColors(bgRgba, baseRgba);
  const effectiveFg = compositeColors(fgRgba, effectiveBg);

  const l1 = getRelativeLuminance(effectiveFg.r, effectiveFg.g, effectiveFg.b);
  const l2 = getRelativeLuminance(effectiveBg.r, effectiveBg.g, effectiveBg.b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export type WCAGLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

export function getWCAGLevel(ratio: number, nonText = false): WCAGLevel {
  // SC 1.4.11 holds non-text UI to 3:1, with nothing above it to earn.
  if (nonText) return ratio >= 3 ? 'AA' : 'fail';
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}
