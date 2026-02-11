/**
 * Watch library source files and rebuild + yalc push on changes.
 */
import { watch } from 'fs';
import { relative, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const DEBOUNCE_MS = 2000;
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.vue']);
const WATCH_DIRS = [
  'libs/grid/src',
  'libs/grid-angular/src',
  'libs/grid-react/src',
  'libs/grid-vue/src',
  'libs/themes',
];

let timer: ReturnType<typeof setTimeout> | null = null;
let building = false;

function run(cmd: string): boolean {
  const result = Bun.spawnSync(['bun', 'run', cmd], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, NX_DAEMON: 'false' },
  });
  return result.exitCode === 0;
}

function rebuild() {
  if (building) return;
  building = true;

  console.log('\n\x1b[36m[watch] Rebuilding...\x1b[0m\n');

  if (run('build:libs')) {
    console.log('\n\x1b[36m[watch] Pushing to yalc...\x1b[0m\n');
    run('link:push');
    console.log('\x1b[32m[watch] Done. Waiting for changes...\x1b[0m\n');
  } else {
    console.error('\n\x1b[31m[watch] Build failed. Waiting for changes...\x1b[0m\n');
  }

  building = false;
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.log('\x1b[36m[watch]\x1b[0m Watching libs for changes... (CTRL+C to stop)\n');

for (const dir of WATCH_DIRS) {
  const fullPath = resolve(ROOT, dir);
  try {
    watch(fullPath, { recursive: true }, (_event, filename) => {
      if (!filename || !EXTENSIONS.has(filename.slice(filename.lastIndexOf('.')))) return;
      console.log(`\x1b[33mchange\x1b[0m: ${relative(ROOT, resolve(fullPath, filename)).replace(/\\/g, '/')}`);
      if (timer) clearTimeout(timer);
      timer = setTimeout(rebuild, DEBOUNCE_MS);
    });
  } catch {
    console.warn(`\x1b[33m[watch]\x1b[0m Skipping ${dir} (not found)`);
  }
}
