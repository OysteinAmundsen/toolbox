/**
 * Watch library sources and incrementally rebuild + `yalc push` the affected
 * library on change. Pairs with `bun run dev` (initial build + push, then this).
 *
 * Why this is shaped the way it is — three bugs the old version had:
 *   1. Spawned the build with `Bun.spawnSync(['bun', 'run', ...])`. On Windows,
 *      Bun-spawning-Bun for a long-running child is killed mid-run with exit 58
 *      (see build-and-deploy.md INVARIANT). The build never finished, so the
 *      watcher "never worked". FIX: spawn via `node:child_process`, never Bun.
 *   2. Rebuilt ALL four libs with `--skip-nx-cache` on every debounce, which was
 *      so slow it looked hung. FIX: rebuild only the changed project, WITH the
 *      Nx cache (unchanged inputs = instant cache hit).
 *   3. Dropped edits saved while a build was running (`if (building) return`).
 *      FIX: queue changed projects in `pending` and re-flush until drained.
 */
import { spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DEBOUNCE_MS = 300;
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.vue', '.mjs']);

// Watched dir (relative to ROOT) → Nx project to (re)build. `themes` has no
// build target and is bundled into `grid` at build time, so theme edits
// rebuild `grid`. Order matters: most-specific prefixes first.
const DIR_TO_PROJECT: ReadonlyArray<{ dir: string; project: string }> = [
  { dir: 'libs/grid-angular/src', project: 'grid-angular' },
  { dir: 'libs/grid-react/src', project: 'grid-react' },
  { dir: 'libs/grid-vue/src', project: 'grid-vue' },
  { dir: 'libs/grid/src', project: 'grid' },
  { dir: 'libs/themes', project: 'grid' },
];

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

/** Run a command via node's spawn (NOT Bun's — see bug #1 above). */
function run(cmd: string, args: string[]): boolean {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NX_DAEMON: 'false' },
  });
  return result.status === 0;
}

/** Rebuild a single project, then yalc-push its dist. */
function buildAndPush(project: string): void {
  console.log(`\n\x1b[36m[watch] Rebuilding ${project}...\x1b[0m`);
  if (!run('bun', ['nx', 'build', project, '--output-style=stream'])) {
    console.error(`\x1b[31m[watch] Build failed for ${project}. Waiting...\x1b[0m\n`);
    return;
  }
  console.log(`\x1b[36m[watch] yalc push ${project}...\x1b[0m`);
  run('bash', ['-c', `cd "dist/libs/${project}" && bunx yalc push --sig`]);
  console.log(`\x1b[32m[watch] ${project} done.\x1b[0m\n`);
}

/** Drain the pending set, including edits that arrive mid-build (bug #3). */
function flush(): void {
  if (flushing) return;
  flushing = true;
  while (pending.size > 0) {
    const projects = [...pending];
    pending.clear();
    for (const project of projects) buildAndPush(project);
  }
  flushing = false;
  console.log('\x1b[2m[watch] Waiting for changes...\x1b[0m');
}

function projectFor(relPath: string): string | null {
  const norm = relPath.split(sep).join('/');
  for (const { dir, project } of DIR_TO_PROJECT) {
    if (norm === dir || norm.startsWith(`${dir}/`)) return project;
  }
  return null;
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.log('\x1b[36m[watch]\x1b[0m Watching libs for changes... (CTRL+C to stop)\n');

const watchedDirs = [...new Set(DIR_TO_PROJECT.map((d) => d.dir))];
for (const dir of watchedDirs) {
  const fullPath = resolve(ROOT, dir);
  try {
    watch(fullPath, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const name = filename.toString();
      if (!EXTENSIONS.has(name.slice(name.lastIndexOf('.')))) return;
      const relPath = relative(ROOT, resolve(fullPath, name));
      const project = projectFor(relPath);
      if (!project) return;
      console.log(`\x1b[33mchange\x1b[0m: ${relPath.split(sep).join('/')} → ${project}`);
      pending.add(project);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    });
  } catch {
    console.warn(`\x1b[33m[watch]\x1b[0m Skipping ${dir} (not found)`);
  }
}
