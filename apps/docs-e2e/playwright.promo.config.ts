import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const _dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4450;
const ASTRO_CLI = resolve(_dirname, '../../node_modules/astro/bin/astro.mjs');

/**
 * Promo recording config.
 *
 * Intentionally **standalone** rather than `defineConfig(baseConfig, …)`: that
 * merge does not let an override replace `webServer`, so the base config's
 * `astro dev` command kept winning.
 *
 * The overlay flag is set here rather than as a shell prefix so it behaves
 * identically under Git Bash, cmd.exe and the Nx target. Playwright evaluates
 * the config before loading any spec, so `PROMO` in `tests/promo/overlay.ts`
 * picks it up.
 */
process.env.PW_PROMO_OVERLAY = '1';

/**
 * The recording resolution, and the CSS viewport that produces it.
 *
 * The demos are authored for a docs page — a 350px-tall grid inside a 1080px
 * frame reads as a screenshot of a spec, not as a product. So the viewport is
 * deliberately *small*: at 1280x720 every element occupies 1.5× more of the
 * frame than it would at 1920x1080, and `tools/stitch-promo.ts` upscales the
 * clips to 1080p on the way into the reel.
 *
 * `video.size` MUST match the viewport. Playwright does not scale the screencast
 * up to a larger `video.size` — it pastes the 1280x720 capture into the top-left
 * of the bigger canvas and leaves the rest grey. `deviceScaleFactor` does not
 * change that; it only sharpens the raster that gets captured.
 *
 * Both have to be declared on the *project* as well as the top-level `use`,
 * because `devices['Desktop Chrome']` pins a project-level 1280x720 viewport at
 * `deviceScaleFactor: 1`, and project-level `use` always wins.
 *
 * The width is 1280 plus the 312px control rail. Scenes have to be able to
 * click the demo controls, so the rail cannot be hidden or moved off-screen —
 * it is parked in the overhang instead, and `tools/stitch-promo.ts` crops the
 * same 312px away. The delivered frame is a clean 1280x720 of grid only.
 */
const RAIL = 312;
const VIEWPORT = { width: 1280 + RAIL, height: 720 };
const SCALE = 1.5;
const VIDEO = { ...VIEWPORT };

/**
 * Watch the run by default — seeing the browser drive itself is half the point
 * of the promo suite. Set `PROMO_HEADLESS=1` (or run on CI) when you want the
 * frame guaranteed at exactly 1920x1080: a headed window is clamped to the host
 * display, so on a smaller screen the page renders smaller and the clip is
 * upscaled to `video.size`.
 */
const HEADLESS = process.env.PROMO_HEADLESS === '1' || !!process.env.CI;

export default defineConfig({
  testDir: resolve(_dirname, 'tests'),
  grep: /@promo/,
  // Scenes must record in declaration order so the clips can be stitched.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: resolve(_dirname, 'promo-output'),
  // The JSON report is what `tools/stitch-promo.ts` reads to recover clip order
  // and paths — the output directory names are hashed and unordered.
  reporter: [['list'], ['json', { outputFile: resolve(_dirname, 'promo-output/report.json') }]],

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI ? { channel: 'chrome' as const } : {}),
        viewport: VIEWPORT,
        deviceScaleFactor: SCALE,
      },
    },
  ],

  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: HEADLESS,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    // Per-protocol-call delay. Kept modest because it is also the frame time for
    // `glidePointer()` — crank it up and every cursor glide becomes glacial.
    // Scene pacing belongs in `beat()` / `clip()`.
    launchOptions: {
      slowMo: 60,
      // Put the window somewhere predictable and size it to the device-pixel
      // frame so the browser chrome does not eat into the recorded area.
      args: HEADLESS ? [] : ['--window-position=0,0', `--window-size=${VIDEO.width},${VIDEO.height}`],
    },
    video: { mode: 'on', size: VIDEO },
    screenshot: 'off',
    trace: 'off',
  },

  /*
   * Record against the built site: no HMR client, no dev overlay, minified
   * assets. `astro build` runs as a separate step in the Nx target.
   *
   * `preview` — not `dev`: Astro 7's dev command daemonizes (it prints
   * "Stop: astro dev stop" and forks), so the process Playwright tracks exits
   * instantly and it reports "Process from config.webServer exited early"
   * while a stray server keeps holding the port.
   *
   * The CLI is invoked through its .mjs entry rather than `bun astro` so there
   * is no bun shim in between for Playwright to lose track of.
   */
  webServer: {
    command: `node ${JSON.stringify(ASTRO_CLI)} preview --port ${PORT}`,
    cwd: resolve(_dirname),
    port: PORT,
    // Fail loudly rather than silently recording against a stale dev server.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
