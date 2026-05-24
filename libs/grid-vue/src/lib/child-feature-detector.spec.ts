import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import {
  clearChildFeatureDetectors,
  detectChildFeatures,
  registerChildFeatureDetector,
} from './child-feature-detector';

interface TestFeatures {
  alpha?: boolean;
  beta?: { value: number };
}

const MarkerAlpha = {
  __name: 'MarkerAlpha',
  setup() {
    return () => null;
  },
};

const MarkerBeta = {
  __name: 'MarkerBeta',
  props: { value: { type: Number, default: 0 } },
  setup() {
    return () => null;
  },
};

describe('child-feature-detector (vue)', () => {
  afterEach(() => {
    clearChildFeatureDetectors();
  });

  it('returns empty object when no detectors are registered', () => {
    const detected = detectChildFeatures<TestFeatures>([h(MarkerAlpha)]);
    expect(detected).toEqual({});
  });

  it('returns empty object when vnodes is undefined', () => {
    expect(detectChildFeatures<TestFeatures>(undefined)).toEqual({});
  });

  it('invokes the detector matching a child component name and merges the result', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));
    registerChildFeatureDetector<TestFeatures>('MarkerBeta', (vnode) => ({
      beta: { value: (vnode.props as { value?: number } | null)?.value ?? 0 },
    }));

    const detected = detectChildFeatures<TestFeatures>([h(MarkerAlpha), h(MarkerBeta, { value: 7 })]);

    expect(detected).toEqual({ alpha: true, beta: { value: 7 } });
  });

  it('replaces an existing detector when re-registering the same name (HMR)', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: false }));
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    const detected = detectChildFeatures<TestFeatures>([h(MarkerAlpha)]);

    expect(detected).toEqual({ alpha: true });
  });

  it('skips intrinsic-element vnodes (string type)', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    const detected = detectChildFeatures<TestFeatures>([h('div'), h(MarkerAlpha)]);

    expect(detected).toEqual({ alpha: true });
  });

  it('clearChildFeatureDetectors removes all detectors', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    clearChildFeatureDetectors();
    const detected = detectChildFeatures<TestFeatures>([h(MarkerAlpha)]);

    expect(detected).toEqual({});
  });
});
