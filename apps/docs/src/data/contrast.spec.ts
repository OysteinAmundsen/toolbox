import { describe, expect, it } from 'vitest';
import {
  CONTRAST_PAIRS,
  compositeColors,
  getContrastRatio,
  getRelativeLuminance,
  getWCAGLevel,
  parseColorToRGBA,
} from './contrast.js';

describe('parseColorToRGBA', () => {
  it('parses shorthand, full and 8-digit hex', () => {
    expect(parseColorToRGBA('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColorToRGBA('#3b82f6')).toEqual({ r: 59, g: 130, b: 246, a: 1 });
    expect(parseColorToRGBA('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
  });

  it('parses rgb() and rgba(), keeping the alpha channel', () => {
    expect(parseColorToRGBA('rgb(59, 130, 246)')).toEqual({ r: 59, g: 130, b: 246, a: 1 });
    expect(parseColorToRGBA('rgba(0, 0, 0, 0.05)')).toEqual({ r: 0, g: 0, b: 0, a: 0.05 });
  });

  it('parses the color(srgb …) form that color-mix() computes to', () => {
    expect(parseColorToRGBA('color(srgb 1 0.5 0)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseColorToRGBA('color(srgb 0 0 0 / 0.25)')).toEqual({ r: 0, g: 0, b: 0, a: 0.25 });
  });

  it('returns null for transparent, empty and unparseable values', () => {
    expect(parseColorToRGBA('transparent')).toBeNull();
    expect(parseColorToRGBA('')).toBeNull();
    expect(parseColorToRGBA('rebeccapurple')).toBeNull();
  });
});

describe('compositeColors', () => {
  it('passes an opaque color through untouched', () => {
    expect(compositeColors({ r: 10, g: 20, b: 30, a: 1 }, { r: 255, g: 255, b: 255 })).toEqual({ r: 10, g: 20, b: 30 });
  });

  it('blends a translucent color into its backdrop', () => {
    expect(compositeColors({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255 })).toEqual({
      r: 128,
      g: 128,
      b: 128,
    });
  });
});

describe('getRelativeLuminance', () => {
  it('anchors at the sRGB extremes', () => {
    expect(getRelativeLuminance(255, 255, 255)).toBeCloseTo(1, 5);
    expect(getRelativeLuminance(0, 0, 0)).toBeCloseTo(0, 5);
  });
});

describe('getContrastRatio', () => {
  it('reports 21:1 for black on white', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
  });

  it('is symmetric', () => {
    expect(getContrastRatio('#ffffff', '#3b82f6')).toBeCloseTo(getContrastRatio('#3b82f6', '#ffffff') as number, 6);
  });

  // The bug this module exists to prevent: a 5%-black row tint is a barely
  // tinted white surface, not a black one.
  it('composites a translucent background over the base instead of scoring it raw', () => {
    const composited = getContrastRatio('#212529', 'rgba(0, 0, 0, 0.05)', '#ffffff') as number;
    const raw = getContrastRatio('#212529', '#000000', '#ffffff') as number;
    expect(composited).toBeCloseTo(13.78, 1);
    expect(raw).toBeLessThan(2);
  });

  it('composites a translucent foreground over the resolved background', () => {
    const half = getContrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff') as number;
    expect(half).toBeCloseTo(getContrastRatio('#808080', '#ffffff') as number, 1);
  });

  it('falls back to white when no base is supplied', () => {
    expect(getContrastRatio('#000000', 'rgba(255, 255, 255, 0)')).toBeCloseTo(21, 2);
  });

  it('returns null when either color is unparseable', () => {
    expect(getContrastRatio('nope', '#ffffff')).toBeNull();
    expect(getContrastRatio('#ffffff', 'transparent')).toBeNull();
  });
});

describe('getWCAGLevel', () => {
  it('grades text against the AA and AAA bars', () => {
    expect(getWCAGLevel(7)).toBe('AAA');
    expect(getWCAGLevel(4.5)).toBe('AA');
    expect(getWCAGLevel(4.49)).toBe('AA-large');
    expect(getWCAGLevel(3)).toBe('AA-large');
    expect(getWCAGLevel(2.99)).toBe('fail');
  });

  it('grades non-text UI against SC 1.4.11 only', () => {
    expect(getWCAGLevel(3, true)).toBe('AA');
    expect(getWCAGLevel(2.99, true)).toBe('fail');
    // Nothing above 3:1 to earn, so a high ratio is still just a pass.
    expect(getWCAGLevel(21, true)).toBe('AA');
  });
});

describe('CONTRAST_PAIRS', () => {
  it('covers every pair the theme-contrast e2e gate asserts', () => {
    const pairs = CONTRAST_PAIRS.map((p) => `${p.foreground}|${p.background}`);
    expect(pairs).toEqual(
      expect.arrayContaining([
        '--tbw-color-fg|--tbw-color-panel-bg',
        '--tbw-color-fg|--tbw-color-bg',
        '--tbw-color-fg-muted|--tbw-color-panel-bg',
        '--tbw-color-header-fg|--tbw-color-header-bg',
        '--tbw-color-fg|--tbw-color-row-alt',
        '--tbw-color-fg|--tbw-color-row-hover',
        '--tbw-color-fg|--tbw-color-selection',
        '--tbw-color-accent-fg|--tbw-color-accent',
        '--tbw-color-accent-text|--tbw-color-bg',
        '--tbw-color-accent|--tbw-color-bg',
        '--tbw-color-border-strong|--tbw-color-bg',
      ]),
    );
  });

  it('marks only the focus ring and the strong border as non-text', () => {
    expect(CONTRAST_PAIRS.filter((p) => p.nonText).map((p) => p.name)).toEqual(['Focus Ring', 'Strong Border']);
  });

  it('gives every pair a unique name and a description', () => {
    const names = CONTRAST_PAIRS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(CONTRAST_PAIRS.every((p) => p.description.length > 0)).toBe(true);
  });
});
