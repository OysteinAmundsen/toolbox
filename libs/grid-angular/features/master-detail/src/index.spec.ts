/**
 * Type and runtime tests for `@toolbox-web/grid-angular/features/master-detail`.
 *
 * Covers the v1.7.1 widening of `MasterDetailConfig.detailRenderer` to accept
 * an Angular component class, and the corresponding
 * `registerFeatureConfigPreprocessor('masterDetail', ...)` bridge.
 *
 * @vitest-environment jsdom
 */
import '@angular/compiler';
import { Component, type ComponentRef, type Type } from '@angular/core';
import { getFeatureConfigPreprocessor, type GridAdapter } from '@toolbox-web/grid-angular';
import { describe, expect, it, vi } from 'vitest';
import './index';
import type { MasterDetailConfig } from './index';

@Component({ standalone: true, template: '<span>detail</span>' })
class DetailComponent {}

function makeAdapter(): { adapter: GridAdapter; mount: ReturnType<typeof vi.fn> } {
  const hostElement = document.createElement('section');
  hostElement.className = 'mocked';
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

describe('master-detail preprocessor bridge', () => {
  it('accepts a component class as detailRenderer (type test)', () => {
    const cfg: MasterDetailConfig = { detailRenderer: DetailComponent };
    expect(cfg.detailRenderer).toBe(DetailComponent);
  });

  it('accepts a function renderer (type test)', () => {
    const cfg: MasterDetailConfig = { detailRenderer: () => document.createElement('div') };
    expect(typeof cfg.detailRenderer).toBe('function');
  });

  it('is registered and returns input unchanged for non-component-class renderer', () => {
    const pre = getFeatureConfigPreprocessor('masterDetail');
    expect(pre).toBeDefined();
    const { adapter } = makeAdapter();
    const cfg: MasterDetailConfig = { detailRenderer: () => document.createElement('div') };
    expect(pre!(cfg, adapter)).toBe(cfg);
  });

  it('bridges a component class to an HTMLElement-returning renderer', () => {
    const pre = getFeatureConfigPreprocessor('masterDetail');
    const { adapter, mount } = makeAdapter();
    const out = pre!({ detailRenderer: DetailComponent } satisfies MasterDetailConfig, adapter) as MasterDetailConfig;
    expect(typeof out.detailRenderer).toBe('function');
    const row = { id: 1 };
    const first = (out.detailRenderer as (r: unknown, i: number) => HTMLElement)(row, 0);
    const second = (out.detailRenderer as (r: unknown, i: number) => HTMLElement)(row, 0);
    expect(first).toBeInstanceOf(HTMLElement);
    expect(second).toBe(first); // cached per row
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it('passes through when config is undefined or boolean', () => {
    const pre = getFeatureConfigPreprocessor('masterDetail');
    const { adapter } = makeAdapter();
    expect(pre!(undefined, adapter)).toBe(undefined);
    expect(pre!(true, adapter)).toBe(true);
  });
});
