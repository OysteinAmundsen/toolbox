import { test as base } from '@playwright/test';
import { attachPromoTimeline, installOverlay, markPageStart } from './overlay';

/**
 * Test object for promo scenes.
 *
 * Promo specs must import `test` from here rather than from `@playwright/test`,
 * because two things have to happen around every promo test and neither belongs
 * in the spec body:
 *
 * 1. **Anchoring.** Playwright starts the video when the page is created and
 *    never tells us when that was. {@link markPageStart} stamps the earliest
 *    moment we can observe, and the residual lead-in is recovered in
 *    `tools/stitch-promo.ts` from the real video duration.
 * 2. **Attaching.** The `clip()` windows recorded during the test are written to
 *    the result as a `promo-timeline` attachment, which is the only way the
 *    stitcher can find the money shots inside a multi-minute clip.
 *
 * Both are no-ops when `PW_PROMO_OVERLAY` is unset, so these specs behave
 * exactly like any other test in the normal CI run.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    markPageStart(page);
    await installOverlay(page);
    await use(page);
    await attachPromoTimeline(page, testInfo);
  },
});

export { expect } from '@playwright/test';
