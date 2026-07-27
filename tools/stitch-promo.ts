/**
 * Stitch the per-scene promo clips into a single video.
 *
 * Reads `apps/docs-e2e/promo-output/report.json` (written by the JSON reporter
 * in `playwright.promo.config.ts`) rather than globbing the output directory:
 * the directory names are hashed and carry no ordering, while the report lists
 * the tests in declaration order — hero first, then the capability reel.
 *
 * Usage:
 *   bun run promo          # record the clips
 *   bun run promo:stitch   # concatenate them into promo-output/promo.webm
 */
import { spawnSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'apps/docs-e2e/promo-output');
const reportPath = join(outputDir, 'report.json');
const listPath = join(outputDir, 'concat.txt');
const target = join(outputDir, 'promo.webm');

interface PwAttachment {
  name: string;
  path?: string;
}
interface PwResult {
  attachments?: PwAttachment[];
}
interface PwTest {
  results?: PwResult[];
}
interface PwSpec {
  title: string;
  tests?: PwTest[];
}
interface PwSuite {
  specs?: PwSpec[];
  suites?: PwSuite[];
}

/** Depth-first walk keeps specs in declaration order across nested describes. */
function collectSpecs(suite: PwSuite, into: PwSpec[] = []): PwSpec[] {
  for (const spec of suite.specs ?? []) into.push(spec);
  for (const child of suite.suites ?? []) collectSpecs(child, into);
  return into;
}

/**
 * ffmpeg is not a project dependency — it is only needed for this one optional
 * step. Look for it via `$FFMPEG`, on PATH, in the winget install location
 * (`winget install Gyan.FFmpeg` does NOT put it on PATH for already-open shells),
 * or as the `ffmpeg-static` package if the user chose to install it.
 */
function resolveFfmpeg(): string | null {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.status === 0) return 'ffmpeg';
  const winget = process.env.LOCALAPPDATA
    ? globSync(
        join(process.env.LOCALAPPDATA, 'Microsoft/WinGet/Packages/Gyan.FFmpeg*/*/bin/ffmpeg.exe').replace(/\\/g, '/'),
      )[0]
    : undefined;
  if (winget) return winget;
  const staticBin = join(root, 'node_modules/ffmpeg-static/ffmpeg.exe');
  if (existsSync(staticBin)) return staticBin;
  const staticNix = join(root, 'node_modules/ffmpeg-static/ffmpeg');
  if (existsSync(staticNix)) return staticNix;
  return null;
}

if (!existsSync(reportPath)) {
  console.error(`No ${reportPath}.\nRecord the clips first:  bun run promo`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { suites?: PwSuite[] };
const clips: { title: string; path: string }[] = [];
for (const suite of report.suites ?? []) {
  for (const spec of collectSpecs(suite)) {
    const video = spec.tests?.[0]?.results?.[0]?.attachments?.find((a) => a.name === 'video');
    if (video?.path && existsSync(video.path)) clips.push({ title: spec.title, path: video.path });
  }
}

if (!clips.length) {
  console.error('The report contains no video attachments. Did the run fail before recording?');
  process.exit(1);
}

const ffmpeg = resolveFfmpeg();
if (!ffmpeg) {
  console.error(
    [
      'ffmpeg was not found. Install it either way:',
      '  winget install Gyan.FFmpeg      # system-wide',
      '  bun add -d ffmpeg-static        # repo-local',
      '',
      `Clips to stitch, in order:\n${clips.map((c, i) => `  ${i + 1}. ${c.title}`).join('\n')}`,
    ].join('\n'),
  );
  process.exit(1);
}

// The concat demuxer copies streams verbatim — every clip comes out of the same
// Playwright encoder, so no re-encode is needed and the join is lossless.
writeFileSync(listPath, clips.map((c) => `file '${c.path.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

console.log(`Stitching ${clips.length} clips:`);
for (const [i, clip] of clips.entries()) console.log(`  ${i + 1}. ${clip.title}`);

const run = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', target], {
  stdio: 'inherit',
});
if (run.status !== 0) process.exit(run.status ?? 1);

console.log(`\n${target}`);
