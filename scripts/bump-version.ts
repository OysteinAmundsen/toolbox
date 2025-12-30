#!/usr/bin/env bun
/**
 * Version bump script for syncing versions across packages.
 * Also regenerates the changelog from conventional commits.
 *
 * Usage:
 *   bun scripts/bump-version.ts patch   # 0.0.1 -> 0.0.2
 *   bun scripts/bump-version.ts minor   # 0.0.1 -> 0.1.0
 *   bun scripts/bump-version.ts major   # 0.0.1 -> 1.0.0
 *   bun scripts/bump-version.ts 1.2.3   # Set explicit version
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..');
const PACKAGES = [resolve(ROOT, 'package.json'), resolve(ROOT, 'libs/grid/package.json')];
const CHANGELOG_PATH = resolve(ROOT, 'libs/grid/CHANGELOG.md');

type BumpType = 'patch' | 'minor' | 'major';

function parseVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version.split('.').map(Number);
  return [major || 0, minor || 0, patch || 0];
}

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(current);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function isValidVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v);
}

function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error('Usage: bun scripts/bump-version.ts <patch|minor|major|x.y.z>');
    process.exit(1);
  }

  // Read current version from root package.json
  const rootPkg = JSON.parse(readFileSync(PACKAGES[0], 'utf-8'));
  const currentVersion = rootPkg.version;

  // Determine new version
  let newVersion: string;
  if (['patch', 'minor', 'major'].includes(arg)) {
    newVersion = bumpVersion(currentVersion, arg as BumpType);
  } else if (isValidVersion(arg)) {
    newVersion = arg;
  } else {
    console.error(`Invalid version or bump type: ${arg}`);
    console.error('Use: patch, minor, major, or a valid semver (e.g., 1.2.3)');
    process.exit(1);
  }

  console.log(`\nBumping version: ${currentVersion} → ${newVersion}\n`);

  // Update all package.json files
  for (const pkgPath of PACKAGES) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkg.version = newVersion;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✓ ${pkgPath.replace(ROOT, '.')}`);
  }

  // Regenerate changelog - prepend only the latest release to existing content
  // -r 1 = generate only 1 release (the new one)
  // -s = write to the same file (prepend mode with -i)
  console.log('\nUpdating changelog...');
  try {
    execSync(`bunx conventional-changelog -p angular -i "${CHANGELOG_PATH}" -s -r 1`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log(`  ✓ ${CHANGELOG_PATH.replace(ROOT, '.')}`);
  } catch (error) {
    console.warn('  ⚠ Changelog generation failed (continuing anyway)');
  }

  console.log(`\nVersion updated to ${newVersion}`);
  console.log('Run: git add -A && git commit -m "chore: release v' + newVersion + '"');
}

main();
