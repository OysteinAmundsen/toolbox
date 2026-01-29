#!/usr/bin/env bun
/**
 * Validates that all feature files in adapter packages are properly exported.
 *
 * This script checks:
 * 1. All .ts files in src/features/ are listed in vite.config.mts entry points
 * 2. All entry points in vite.config.mts have corresponding .ts files
 * 3. Built dist/ contains all expected feature exports
 *
 * Run: bun tools/validate-feature-exports.ts
 * Or via Nx: bun nx run grid-react:validate-features
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join, resolve } from 'path';

interface ValidationResult {
  package: string;
  missingInViteConfig: string[];
  missingInSource: string[];
  missingInDist: string[];
}

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES = ['grid-react', 'grid-angular'] as const;

function getFeatureFilesFromSource(packageDir: string): Set<string> {
  const featuresDir = join(packageDir, 'src', 'features');
  if (!existsSync(featuresDir)) {
    console.error(`Features directory not found: ${featuresDir}`);
    process.exit(1);
  }

  const files = readdirSync(featuresDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.test.ts'))
    .map((f) => basename(f, '.ts'));

  return new Set(files);
}

function getFeatureEntriesFromViteConfig(packageDir: string): Set<string> {
  const viteConfigPath = join(packageDir, 'vite.config.mts');
  if (!existsSync(viteConfigPath)) {
    console.error(`Vite config not found: ${viteConfigPath}`);
    process.exit(1);
  }

  const content = readFileSync(viteConfigPath, 'utf-8');

  // Extract feature entries from the entry object
  // Matches patterns like: 'features/selection': 'src/features/selection.ts',
  const featureEntryRegex = /'features\/([^']+)':\s*'src\/features\/[^']+\.ts'/g;
  const entries = new Set<string>();

  let match;
  while ((match = featureEntryRegex.exec(content)) !== null) {
    entries.add(match[1]);
  }

  return entries;
}

function getBuiltFeatureFiles(packageDir: string): Set<string> {
  const distFeaturesDir = join(ROOT, 'dist', 'libs', basename(packageDir), 'features');
  if (!existsSync(distFeaturesDir)) {
    // Dist not built yet - skip this check
    return new Set();
  }

  const files = readdirSync(distFeaturesDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => basename(f, '.js'));

  return new Set(files);
}

function validatePackage(packageName: string): ValidationResult {
  const packageDir = join(ROOT, 'libs', packageName);

  const sourceFeatures = getFeatureFilesFromSource(packageDir);
  const viteEntries = getFeatureEntriesFromViteConfig(packageDir);
  const builtFeatures = getBuiltFeatureFiles(packageDir);

  // Files in source but not in vite config
  const missingInViteConfig = [...sourceFeatures].filter((f) => !viteEntries.has(f));

  // Entries in vite config but no source file
  const missingInSource = [...viteEntries].filter((f) => !sourceFeatures.has(f));

  // Files in source but not in dist (only check if dist exists)
  const missingInDist = builtFeatures.size > 0 ? [...sourceFeatures].filter((f) => !builtFeatures.has(f)) : [];

  return {
    package: packageName,
    missingInViteConfig,
    missingInSource,
    missingInDist,
  };
}

function main() {
  console.log('🔍 Validating feature exports for adapter packages...\n');

  let hasErrors = false;

  for (const pkg of PACKAGES) {
    const result = validatePackage(pkg);

    console.log(`📦 @toolbox-web/${result.package}`);

    if (result.missingInViteConfig.length > 0) {
      hasErrors = true;
      console.log(`  ❌ Missing in vite.config.mts entry points:`);
      result.missingInViteConfig.forEach((f) => {
        console.log(`     - 'features/${f}': 'src/features/${f}.ts'`);
      });
    }

    if (result.missingInSource.length > 0) {
      hasErrors = true;
      console.log(`  ❌ Entry in vite.config.mts but no source file:`);
      result.missingInSource.forEach((f) => {
        console.log(`     - features/${f}.ts`);
      });
    }

    if (result.missingInDist.length > 0) {
      hasErrors = true;
      console.log(`  ❌ Missing in built dist/features/:`);
      result.missingInDist.forEach((f) => {
        console.log(`     - ${f}.js`);
      });
    }

    if (
      result.missingInViteConfig.length === 0 &&
      result.missingInSource.length === 0 &&
      result.missingInDist.length === 0
    ) {
      console.log(`  ✅ All features properly configured`);
    }

    console.log();
  }

  if (hasErrors) {
    console.log('❌ Validation failed! Fix the issues above before publishing.');
    console.log('\n💡 Tip: Add missing features to the lib.entry object in vite.config.mts');
    process.exit(1);
  }

  console.log('✅ All feature exports validated successfully!');
}

main();
