/**
 * Script to symlink @toolbox-web/grid from dist/ instead of libs/
 * This is needed for ng-packagr to properly resolve subpath exports
 */
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'fs';
import { join, resolve } from 'path';

// Script is at libs/grid-angular/scripts/link-grid-dist.ts
// Workspace root is 3 levels up
const workspaceRoot = resolve(import.meta.dirname, '../../..');
const nodeModulesPath = join(workspaceRoot, 'node_modules', '@toolbox-web');
const gridSymlink = join(nodeModulesPath, 'grid');
const distGridPath = join(workspaceRoot, 'dist', 'libs', 'grid');

console.log('Workspace root:', workspaceRoot);
console.log('Looking for dist at:', distGridPath);

// Ensure dist/libs/grid exists
if (!existsSync(distGridPath)) {
  console.error('❌ dist/libs/grid does not exist. Run `bun nx build grid` first.');
  process.exit(1);
}

// Create @toolbox-web directory if it doesn't exist
if (!existsSync(nodeModulesPath)) {
  mkdirSync(nodeModulesPath, { recursive: true });
}

// Remove existing symlink/directory
if (existsSync(gridSymlink)) {
  const stats = lstatSync(gridSymlink);
  if (stats.isSymbolicLink()) {
    const target = readlinkSync(gridSymlink);
    if (target.includes('dist/libs/grid') || target.includes('dist\\libs\\grid')) {
      console.log('✓ @toolbox-web/grid already points to dist');
      process.exit(0);
    }
  }
  rmSync(gridSymlink, { recursive: true, force: true });
}

// Create new symlink pointing to dist
try {
  symlinkSync(distGridPath, gridSymlink, 'junction'); // 'junction' works on Windows without admin
  console.log('✓ Linked @toolbox-web/grid → dist/libs/grid');
} catch (error) {
  console.error('❌ Failed to create symlink:', error);
  process.exit(1);
}
