import { describe, expect, it } from 'vitest';
import {
  assertAdapterConformance,
  CORE_CONSUMED_ADAPTER_METHODS,
  reportAdapterConformance,
} from './adapter-conformance';
import type { FrameworkAdapter } from './types';

function makeFullAdapter(): FrameworkAdapter {
  return {
    canHandle: () => true,
    createRenderer: () => undefined,
    createEditor: () => undefined,
    processConfig: (c) => c,
    getTypeDefault: () => undefined,
    createToolPanelRenderer: () => undefined,
    parseDetailElement: () => undefined,
    parseResponsiveCardElement: () => undefined,
    releaseCell: () => undefined,
    unmount: () => undefined,
    beginBatch: () => undefined,
    endBatch: () => undefined,
  };
}

describe('adapter-conformance', () => {
  it('lists every method the grid core can consume', () => {
    // Protects against accidental removal of a check — each method name
    // should be present. Adding a new hook will require updating this list.
    expect(CORE_CONSUMED_ADAPTER_METHODS).toEqual([
      'canHandle',
      'createRenderer',
      'createEditor',
      'processConfig',
      'getTypeDefault',
      'createToolPanelRenderer',
      'parseDetailElement',
      'parseResponsiveCardElement',
      'releaseCell',
      'unmount',
      'beginBatch',
      'endBatch',
    ]);
  });

  it('reports a fully-implemented adapter as having no missing methods', () => {
    const report = reportAdapterConformance(makeFullAdapter());
    expect(report.missing).toEqual([]);
    expect(report.implemented.length).toBe(CORE_CONSUMED_ADAPTER_METHODS.length);
  });

  it('reports missing hooks by name', () => {
    const adapter = makeFullAdapter();
    delete (adapter as Partial<FrameworkAdapter>).createToolPanelRenderer;
    delete (adapter as Partial<FrameworkAdapter>).parseDetailElement;

    const report = reportAdapterConformance(adapter);
    expect(report.missing).toEqual(['createToolPanelRenderer', 'parseDetailElement']);
  });

  it('captures the adapter constructor name in the report', () => {
    class MyAdapter implements FrameworkAdapter {
      canHandle() {
        return true;
      }
      createRenderer() {
        return undefined;
      }
      createEditor() {
        return undefined;
      }
    }

    const report = reportAdapterConformance(new MyAdapter());
    expect(report.name).toBe('MyAdapter');
  });

  it('assertAdapterConformance passes silently when every hook is present', () => {
    expect(() => assertAdapterConformance(makeFullAdapter())).not.toThrow();
  });

  it('assertAdapterConformance throws a descriptive error listing missing hooks', () => {
    const adapter = makeFullAdapter();
    delete (adapter as Partial<FrameworkAdapter>).createToolPanelRenderer;

    expect(() => assertAdapterConformance(adapter)).toThrow(/createToolPanelRenderer/);
    expect(() => assertAdapterConformance(adapter)).toThrow(/missing FrameworkAdapter hook/);
  });
});
