/**
 * Cut the recorded promo scenes into one short, punchy reel.
 *
 * A promo run produces several minutes of footage: every scene is a full CI
 * test, complete with navigation, narration and assertions. Nobody watches that.
 * What sells the grid is a montage of *money shots* — the sort flipping, rows
 * collapsing under a filter, the table morphing into cards.
 *
 * Each scene therefore marks its money shot with `clip()` (see
 * `apps/docs-e2e/tests/promo/overlay.ts`), which records a `{label, startMs,
 * endMs}` window and attaches it to the test result as `promo-timeline`. This
 * script reads those windows out of `promo-output/report.json`, allocates a time
 * budget across them, trims each one out of its clip and concatenates the
 * result.
 *
 * Ordering comes from the report, not from globbing the output directory: the
 * directory names are hashed and carry no order, while the report lists specs in
 * declaration order. Within that, `intro` clips are hoisted to the front and
 * `outro` clips pushed to the back.
 *
 * Usage:
 *   bun run promo                 # record the clips
 *   bun run promo:stitch          # → promo-output/promo-reel.mp4  (≤30 s)
 *   bun run promo:stitch --max=45 # a longer cut
 *   bun run promo:stitch --full   # every scene end to end, untrimmed
 */
import { spawnSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'apps/docs-e2e/promo-output');
const reportPath = join(outputDir, 'report.json');
const workDir = join(outputDir, 'segments');

// #region Options

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: number) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.slice(name.length + 3)) : fallback;
};

const FULL = flag('full');
/** Total runtime of the reel. The whole point of the format is that it is short. */
const BUDGET = option('max', 30);
/**
 * Below this a cut reads as a glitch rather than as an edit. Raising it is not
 * how you slow the reel down — it only steals from the clips that earned their
 * time. Drop a scene with `reel: false` instead.
 */
const MIN_CLIP = option('min', 1.4);
/** Above this a single feature starts to outstay its welcome in a montage. */
const MAX_CLIP = option('clip', 2.8);
/** Output frame size. Matches `video.size` in `playwright.promo.config.ts`. */
const [WIDTH, HEIGHT] = [1920, 1080];
/**
 * Width of the control-rail overhang the promo viewport records but never
 * delivers. Must match `RAIL` in `playwright.promo.config.ts`: the rail has to
 * stay on-page and clickable for the scenes, so it is cropped off here instead.
 */
const RAIL_PX = 312;
const FPS = 30;
/**
 * Seconds of recording that follow the last timestamp a test takes, while the
 * fixture attaches the timeline and Playwright closes and flushes the context.
 *
 * Anchoring off the end rather than the start is deliberate. The recording's
 * first frame is not written at page creation but at first paint, so the head
 * offset swings by a second or more between a trivial demo and one that loads
 * 200 rows. The teardown tail does not depend on the page at all, so
 * `duration - spanMs - TAIL_S` recovers the head for each video individually.
 *
 * Measured across scenes at ~1.85s. If clips start landing on the caption that
 * follows the one they should show, this is the number to re-measure.
 */
const TAIL_S = 1.85;

const target = join(outputDir, FULL ? 'promo-full.mp4' : 'promo-reel.mp4');

// #endregion

// #region Report shapes (only the fields we need)

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

/** Mirrors `ClipMark` in `tests/promo/overlay.ts`. */
interface ClipMark {
  label: string;
  role: 'intro' | 'feature' | 'outro';
  weight: number;
  align: 'start' | 'middle' | 'end';
  minMs?: number;
  reel?: boolean;
  startMs: number;
  endMs: number;
}
interface Timeline {
  title: string;
  spanMs: number;
  marks: ClipMark[];
}

/** A marked window of a source video, resolved to absolute seconds. */
interface Segment {
  scene: string;
  label: string;
  role: ClipMark['role'];
  weight: number;
  align: ClipMark['align'];
  /** Guaranteed screen time, in seconds. Reserved before weights are applied. */
  min: number;
  video: string;
  from: number;
  to: number;
}

// #endregion

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

/**
 * Duration of a video, in seconds.
 *
 * Read through ffmpeg rather than ffprobe: ffprobe ships alongside ffmpeg in
 * every distribution this script looks for except `ffmpeg-static`, which
 * deliberately omits it, while `-f null -` works everywhere.
 */
function durationOf(ffmpeg: string, file: string): number {
  const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const last = [...(probe.stderr ?? '').matchAll(/time=(\d+):(\d\d):(\d\d(?:\.\d+)?)/g)].at(-1);
  if (!last) throw new Error(`could not determine the duration of ${file}`);
  return Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
}

/**
 * Spread `budget` seconds across the segments.
 *
 * Water-filling rather than a flat split: a clip is never stretched past the
 * window the scene actually marked (capped at {@link MAX_CLIP}) and never
 * squeezed below {@link MIN_CLIP} or its own `min`, and whatever a clamped clip
 * gives back is redistributed by weight to the ones that can still use it.
 */
function allocate(segments: Segment[], budget: number): number[] {
  const natural = segments.map((s) => Math.max(Math.min(s.to - s.from, MAX_CLIP), s.min));
  let floor = MIN_CLIP;
  let floors = segments.map((s) => Math.max(floor, s.min));
  const floorSum = floors.reduce((sum, f) => sum + f, 0);
  if (floorSum > budget) {
    floor = Math.max(0.5, budget / segments.length);
    floors = segments.map(() => floor);
    console.warn(
      `! ${segments.length} clips do not fit in ${budget}s at ${MIN_CLIP}s each — dropping the floor to ${floor.toFixed(2)}s.\n` +
        `  Cut a scene back to one clip(), or raise the budget with --max=<seconds>.`,
    );
  }

  const weightSum = segments.reduce((sum, s) => sum + s.weight, 0);
  let durations = segments.map((s) => (budget * s.weight) / weightSum);
  for (let pass = 0; pass < 6; pass++) {
    durations = durations.map((d, i) => Math.min(Math.max(d, floors[i]), Math.max(natural[i], floors[i])));
    const slack = budget - durations.reduce((sum, d) => sum + d, 0);
    if (Math.abs(slack) < 0.05) break;
    const movable = segments
      .map((s, i) => ({ i, weight: s.weight }))
      .filter(({ i }) => (slack > 0 ? durations[i] < natural[i] : durations[i] > floors[i]));
    if (!movable.length) break;
    const movableWeight = movable.reduce((sum, m) => sum + m.weight, 0);
    for (const { i, weight } of movable) durations[i] += (slack * weight) / movableWeight;
  }
  return durations;
}

// #region Collect

if (!existsSync(reportPath)) {
  console.error(`No ${reportPath}.\nRecord the clips first:  bun run promo`);
  process.exit(1);
}

const ffmpeg = resolveFfmpeg();
if (!ffmpeg) {
  console.error(
    [
      'ffmpeg was not found. Install it either way:',
      '  winget install Gyan.FFmpeg      # system-wide',
      '  bun add -d ffmpeg-static        # repo-local',
    ].join('\n'),
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { suites?: PwSuite[] };
const segments: Segment[] = [];
const scenesWithoutClips: string[] = [];

for (const suite of report.suites ?? []) {
  for (const spec of collectSpecs(suite)) {
    const attachments = spec.tests?.[0]?.results?.[0]?.attachments ?? [];
    const video = attachments.find((a) => a.name === 'video');
    if (!video?.path || !existsSync(video.path)) continue;
    const scene = spec.title.replace(/\s*@promo\s*$/, '');

    const timelinePath = attachments.find((a) => a.name === 'promo-timeline')?.path;
    const timeline: Timeline | null =
      timelinePath && existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : null;

    /*
     * Map the marks onto the video. Both ends of the file extend past what the
     * test measured, and only the tail is predictable — see TAIL_S.
     */
    const duration = durationOf(ffmpeg, video.path);
    const lead = timeline ? duration - timeline.spanMs / 1000 - TAIL_S : 0;
    const windowOf = (mark: ClipMark) => {
      const from = Math.max(0, Math.min(duration, lead + mark.startMs / 1000));
      return { from, to: Math.max(from + 0.2, Math.min(duration, lead + mark.endMs / 1000)) };
    };

    if (FULL) {
      /*
       * Raw recordings back to back, so the head would otherwise be a demo
       * booting up. Start the recording that owns the intro card *at* the card
       * instead of prepending a copy — a prepended copy cuts back to the same
       * card a beat later, which reads as a stutter.
       */
      const intro = timeline?.marks.find((m) => m.role === 'intro');
      segments.push({
        scene,
        label: scene,
        role: 'feature',
        weight: 1,
        align: 'start',
        min: 0,
        video: video.path,
        from: intro ? windowOf(intro).from : 0,
        to: duration,
      });
      continue;
    }

    if (!timeline?.marks?.length) {
      scenesWithoutClips.push(scene);
      continue;
    }

    for (const mark of timeline.marks) {
      if (mark.reel === false) continue;
      segments.push({
        scene,
        label: mark.label,
        role: mark.role,
        weight: mark.weight,
        align: mark.align,
        min: (mark.minMs ?? 0) / 1000,
        video: video.path,
        ...windowOf(mark),
      });
    }
  }
}

if (!segments.length) {
  console.error(
    FULL
      ? 'The report contains no video attachments. Did the run fail before recording?'
      : 'No clip() windows were recorded. Wrap each scene’s money shot in clip() — see tests/promo/overlay.ts.',
  );
  process.exit(1);
}

// Intros first, outros last, features in declaration order.
const rank = { intro: 0, feature: 1, outro: 2 };
segments.sort((a, b) => rank[a.role] - rank[b.role]);

// #endregion

// #region Cut

const durations = FULL ? segments.map((s) => s.to - s.from) : allocate(segments, BUDGET);

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

console.log(`${segments.length} clips → ${target}`);
const parts: string[] = [];

for (const [i, segment] of segments.entries()) {
  const length = durations[i];
  // Which part of the marked window survives the trim. `end` is the default,
  // because the payoff — the re-sorted rows, the collapsed groups — lands there.
  const slack = Math.max(0, segment.to - segment.from - length);
  const offset = segment.align === 'start' ? 0 : segment.align === 'middle' ? slack / 2 : slack;
  const from = segment.from + offset;

  // Two-stage seek: a fast keyframe seek on the input, then an exact one on the
  // output. Input-only seeking snaps to the nearest keyframe, which in a
  // screencast can be seconds away.
  const coarse = Math.max(0, from - 3);
  const part = join(workDir, `seg-${String(i).padStart(2, '0')}.mp4`);
  // Drop the control-rail overhang the promo viewport carries — see RAIL_PX.
  const crop = `crop=in_w-${RAIL_PX}:in_h:0:0`;
  const scale = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease`;
  const pad = `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=#06080c`;
  const cut = spawnSync(
    ffmpeg,
    [
      '-y',
      '-v',
      'error',
      '-ss',
      coarse.toFixed(3),
      '-i',
      segment.video,
      '-ss',
      (from - coarse).toFixed(3),
      '-t',
      length.toFixed(3),
      // Normalise everything so the concat demuxer can stream-copy the parts.
      '-vf',
      `${crop},${scale},${pad},fps=${FPS},format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-an',
      part,
    ],
    { stdio: 'inherit' },
  );
  if (cut.status !== 0) process.exit(cut.status ?? 1);

  parts.push(part);
  console.log(
    `  ${String(i + 1).padStart(2)}. ${length.toFixed(2)}s  ${segment.label || `[${segment.role}]`}  (${segment.scene})`,
  );
}

const listPath = join(workDir, 'concat.txt');
writeFileSync(listPath, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

const concat = spawnSync(
  ffmpeg,
  ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', target],
  { stdio: 'inherit' },
);
if (concat.status !== 0) process.exit(concat.status ?? 1);

if (scenesWithoutClips.length) {
  console.warn(`\n! ${scenesWithoutClips.length} scene(s) marked no clip() and are missing from the reel:`);
  for (const scene of scenesWithoutClips) console.warn(`    ${scene}`);
}
console.log(`\n${target}  —  ${durations.reduce((sum, d) => sum + d, 0).toFixed(1)}s`);

// #endregion
