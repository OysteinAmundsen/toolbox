/**
 * Repoint every `node_modules/@toolbox-web/grid` an adapter build might resolve
 * at `dist/libs/grid`, so the build sees the freshly-built grid (subpath exports
 * and as-yet-unreleased types) rather than the published copy.
 *
 * Node module resolution walks up from the source file and uses the NEAREST
 * `node_modules`. Because each adapter declares `@toolbox-web/grid` as a
 * versioned dep (not `workspace:*`), `bun install` drops a real — therefore
 * stale — copy into `libs/<adapter>/node_modules/@toolbox-web/grid`, which
 * shadows the workspace-root symlink. Both locations MUST be repointed;
 * otherwise a build fails to see any grid API added since the last publish
 * (e.g. `TS2305: has no exported member 'PasteRejectedDetail'`).
 *
 * Angular needs this to build at all (ng-packagr resolves through Node).
 * React and Vue build fine without it because Vite honours the tsconfig
 * `paths`, but the stale copy still confuses Node-resolution-based tooling
 * (fallow, ESLint resolvers, IDE go-to-definition), so they run it too.
 *
 * Usage: `bun run tools/link-grid-dist.ts <adapter-dir>`
 *   e.g. `bun run tools/link-grid-dist.ts libs/grid-react`
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';

const adapterDirArg = process.argv[2];
if (!adapterDirArg) {
  console.error('❌ Usage: bun run tools/link-grid-dist.ts <adapter-dir>  (e.g. libs/grid-react)');
  process.exit(1);
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const adapterRoot = resolve(workspaceRoot, adapterDirArg);
const distGridPath = join(workspaceRoot, 'dist', 'libs', 'grid');

console.log('Workspace root:', workspaceRoot);
console.log('Looking for dist at:', distGridPath);

if (!existsSync(distGridPath)) {
  console.error('❌ dist/libs/grid does not exist. Run `bun nx build grid` first.');
  process.exit(1);
}

/** Point one `node_modules/@toolbox-web/grid` entry at dist/libs/grid via a junction. */
function linkToDist(gridPath: string): void {
  mkdirSync(dirname(gridPath), { recursive: true }); // ensure …/node_modules/@toolbox-web exists

  // Detect an existing entry (symlink, junction, or real dir), even if broken.
  let existing = false;
  try {
    const stats = lstatSync(gridPath);
    existing = true;
    if (stats.isSymbolicLink()) {
      const target = readlinkSync(gridPath);
      if (target.includes('dist/libs/grid') || target.includes('dist\\libs\\grid')) {
        console.log(`✓ ${gridPath} already points to dist`);
        return;
      }
    }
  } catch {
    existing = false; // nothing there
  }
  if (existing) rmSync(gridPath, { recursive: true, force: true });

  symlinkSync(distGridPath, gridPath, 'junction'); // 'junction' works on Windows without admin
  console.log(`✓ Linked ${gridPath} → dist/libs/grid`);
}

// The adapter-local copy is listed AFTER the root so the message order matches
// resolution order.
for (const gridPath of [
  join(workspaceRoot, 'node_modules', '@toolbox-web', 'grid'),
  join(adapterRoot, 'node_modules', '@toolbox-web', 'grid'),
]) {
  try {
    linkToDist(gridPath);
  } catch (error) {
    console.error(`❌ Failed to link ${gridPath}:`, error);
    process.exit(1);
  }
}
