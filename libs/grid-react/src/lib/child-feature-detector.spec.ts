import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearChildFeatureDetectors,
  detectChildFeatures,
  registerChildFeatureDetector,
} from './child-feature-detector';

interface TestFeatures {
  alpha?: boolean;
  beta?: { value: number };
}

function MarkerAlpha() {
  return null;
}
MarkerAlpha.displayName = 'MarkerAlpha';

function MarkerBeta(_props: { value?: number }) {
  return null;
}
MarkerBeta.displayName = 'MarkerBeta';

describe('child-feature-detector (react)', () => {
  afterEach(() => {
    clearChildFeatureDetectors();
  });

  it('returns empty object when no detectors are registered', () => {
    const detected = detectChildFeatures<TestFeatures>(createElement(MarkerAlpha));
    expect(detected).toEqual({});
  });

  it('invokes the detector matching a child displayName and merges the result', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));
    registerChildFeatureDetector<TestFeatures>('MarkerBeta', (el) => ({
      beta: { value: (el.props as { value?: number }).value ?? 0 },
    }));

    const detected = detectChildFeatures<TestFeatures>([
      createElement(MarkerAlpha),
      createElement(MarkerBeta, { value: 7 }),
    ]);

    expect(detected).toEqual({ alpha: true, beta: { value: 7 } });
  });

  it('ignores children whose displayName has no registered detector', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    const detected = detectChildFeatures<TestFeatures>([createElement(MarkerAlpha), createElement(MarkerBeta)]);

    expect(detected).toEqual({ alpha: true });
  });

  it('replaces an existing detector when re-registering the same name (HMR)', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: false }));
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    const detected = detectChildFeatures<TestFeatures>(createElement(MarkerAlpha));

    expect(detected).toEqual({ alpha: true });
  });

  it('skips non-element children (strings, numbers, null)', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    const detected = detectChildFeatures<TestFeatures>(['plain text', 42, null, undefined, createElement(MarkerAlpha)]);

    expect(detected).toEqual({ alpha: true });
  });

  it('clearChildFeatureDetectors removes all detectors', () => {
    registerChildFeatureDetector<TestFeatures>('MarkerAlpha', () => ({ alpha: true }));

    clearChildFeatureDetectors();
    const detected = detectChildFeatures<TestFeatures>(createElement(MarkerAlpha));

    expect(detected).toEqual({});
  });
});
