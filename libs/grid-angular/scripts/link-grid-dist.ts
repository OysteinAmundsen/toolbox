/**
 * Script to symlink @toolbox-web/grid from dist/ instead of the published npm
 * package, so ng-packagr resolves the freshly-built grid (with subpath exports
 * and as-yet-unreleased types) rather than a stale copy.
 *
 * ng-packagr resolves `@toolbox-web/grid` through node module resolution, which
 * walks up from the source file and uses the NEAREST `node_modules`. Because the
 * adapter declares `@toolbox-web/grid` as a versioned dep (not `workspace:*`),
 * `bun install` drops a real (published, therefore stale) copy into the
 * adapter-local `libs/grid-angular/node_modules/@toolbox-web/grid`, which shadows
 * the workspace-root symlink. So we MUST repoint BOTH locations at dist —
 * otherwise a build fails to see any grid API added since the last publish
 * (e.g. `TS2305: has no exported member 'PasteRejectedDetail'`).
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';

// Script is at libs/grid-angular/scripts/link-grid-dist.ts
const adapterRoot = resolve(import.meta.dirname, '..'); // libs/grid-angular
const workspaceRoot = resolve(import.meta.dirname, '../../..');
const distGridPath = join(workspaceRoot, 'dist', 'libs', 'grid');

console.log('Workspace root:', workspaceRoot);
console.log('Looking for dist at:', distGridPath);

// Ensure dist/libs/grid exists
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

// Repoint every location ng-packagr / Node might resolve first. The adapter-local
// copy is listed AFTER the root so the message order matches resolution order.
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
