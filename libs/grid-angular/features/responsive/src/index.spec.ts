/**
 * Type and runtime tests for `@toolbox-web/grid-angular/features/responsive`.
 *
 * Covers the v1.8.0 widening of `ResponsivePluginConfig.cardRenderer` to accept
 * an Angular component class, and the corresponding
 * `registerFeatureConfigPreprocessor('responsive', ...)` bridge.
 *
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { Component, type ComponentRef, type Type } from '@angular/core';
import { getFeatureConfigPreprocessor, type GridAdapter } from '@toolbox-web/grid-angular';
import { describe, expect, it, vi } from 'vitest';
import './index';
import type { ResponsivePluginConfig } from './index';

@Component({ standalone: true, template: '<span>card</span>' })
class CardComponent {}

function makeAdapter(): { adapter: GridAdapter; mount: ReturnType<typeof vi.fn> } {
  const hostElement = document.createElement('section');
  const componentRef = {
    setInput: vi.fn(),
    changeDetectorRef: { detectChanges: vi.fn() },
  } as unknown as ComponentRef<unknown>;
  const mount = vi.fn(() => ({ hostElement, componentRef }));
  const adapter = {
    mountComponentRenderer: <TCtx>(_cls: Type<unknown>, _map: (ctx: TCtx) => Record<string, unknown>) =>
      mount as (ctx: TCtx) => { hostElement: HTMLElement; componentRef: ComponentRef<unknown> },
  } as unknown as GridAdapter;
  return { adapter, mount };
}

describe('responsive preprocessor bridge', () => {
  it('accepts a component class as cardRenderer (type test)', () => {
    const cfg: ResponsivePluginConfig = { cardRenderer: CardComponent };
    expect(cfg.cardRenderer).toBe(CardComponent);
  });

  it('accepts a function renderer (type test)', () => {
    const cfg: ResponsivePluginConfig = { cardRenderer: () => document.createElement('div') };
    expect(typeof cfg.cardRenderer).toBe('function');
  });

  it('is registered and returns input unchanged for non-component-class renderer', () => {
    const pre = getFeatureConfigPreprocessor('responsive');
    expect(pre).toBeDefined();
    const { adapter } = makeAdapter();
    const cfg: ResponsivePluginConfig = { cardRenderer: () => document.createElement('div') };
    expect(pre!(cfg, adapter)).toBe(cfg);
  });

  it('bridges a component class to an HTMLElement-returning renderer', () => {
    const pre = getFeatureConfigPreprocessor('responsive');
    const { adapter, mount } = makeAdapter();
    const out = pre!(
      { cardRenderer: CardComponent } satisfies ResponsivePluginConfig,
      adapter,
    ) as ResponsivePluginConfig;
    expect(typeof out.cardRenderer).toBe('function');
    const row = { id: 5 };
    const first = (out.cardRenderer as (r: unknown, i: number) => HTMLElement)(row, 0);
    const second = (out.cardRenderer as (r: unknown, i: number) => HTMLElement)(row, 0);
    expect(first).toBeInstanceOf(HTMLElement);
    expect(second).toBe(first);
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it('passes through when config is boolean or undefined', () => {
    const pre = getFeatureConfigPreprocessor('responsive');
    const { adapter } = makeAdapter();
    expect(pre!(undefined, adapter)).toBe(undefined);
    expect(pre!(true, adapter)).toBe(true);
  });
});
