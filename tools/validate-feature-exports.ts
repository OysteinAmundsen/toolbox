#!/usr/bin/env bun
/**
 * Validates that all feature files in adapter packages are properly exported.
 *
 * This script checks:
 * - grid-react: All .ts files in src/features/ are listed in vite.config.mts entry points
 * - grid-angular: All feature directories have ng-package.json (ng-packagr handles exports)
 * - Built dist/ contains all expected feature exports
 *
 * Run: bun tools/validate-feature-exports.ts
 * Or via Nx: bun nx run grid-react:validate-features
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';

interface ValidationResult {
  package: string;
  missingInConfig: string[];
  missingInSource: string[];
  missingInDist: string[];
}

const ROOT = resolve(import.meta.dirname, '..');

/**
 * Get feature names from grid-react's src/features/*.ts files
 */
function getReactFeatureFiles(packageDir: string): Set<string> {
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

/**
 * Get feature names from grid-angular's features/*/ng-package.json directories
 */
function getAngularFeatureFiles(packageDir: string): Set<string> {
  const featuresDir = join(packageDir, 'features');
  if (!existsSync(featuresDir)) {
    console.error(`Features directory not found: ${featuresDir}`);
    process.exit(1);
  }

  const entries = readdirSync(featuresDir).filter((entry) => {
    const entryPath = join(featuresDir, entry);
    const ngPackagePath = join(entryPath, 'ng-package.json');
    return statSync(entryPath).isDirectory() && existsSync(ngPackagePath);
  });

  return new Set(entries);
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

function getBuiltFeatureFilesReact(packageDir: string): Set<string> {
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

function getBuiltFeatureFilesAngular(packageDir: string): Set<string> {
  const distFeaturesDir = join(ROOT, 'dist', 'libs', basename(packageDir), 'features');
  if (!existsSync(distFeaturesDir)) {
    // Dist not built yet - skip this check
    return new Set();
  }

  // ng-packagr creates directories for each secondary entry point
  const entries = readdirSync(distFeaturesDir).filter((entry) => {
    const entryPath = join(distFeaturesDir, entry);
    return statSync(entryPath).isDirectory();
  });

  return new Set(entries);
}

function validateReactPackage(): ValidationResult {
  const packageDir = join(ROOT, 'libs', 'grid-react');

  const sourceFeatures = getReactFeatureFiles(packageDir);
  const viteEntries = getFeatureEntriesFromViteConfig(packageDir);
  const builtFeatures = getBuiltFeatureFilesReact(packageDir);

  // Files in source but not in vite config
  const missingInConfig = [...sourceFeatures].filter((f) => !viteEntries.has(f) && f !== 'index');

  // Entries in vite config but no source file
  const missingInSource = [...viteEntries].filter((f) => !sourceFeatures.has(f));

  // Files in source but not in dist (only check if dist exists)
  const missingInDist =
    builtFeatures.size > 0 ? [...sourceFeatures].filter((f) => !builtFeatures.has(f) && f !== 'index') : [];

  return {
    package: 'grid-react',
    missingInConfig,
    missingInSource,
    missingInDist,
  };
}

function validateAngularPackage(): ValidationResult {
  const packageDir = join(ROOT, 'libs', 'grid-angular');

  const sourceFeatures = getAngularFeatureFiles(packageDir);
  const builtFeatures = getBuiltFeatureFilesAngular(packageDir);

  // For Angular, ng-packagr auto-discovers secondary entry points from ng-package.json
  // No vite config to check - just verify source dirs have the required files
  const missingInConfig: string[] = [];
  for (const feature of sourceFeatures) {
    const indexPath = join(packageDir, 'features', feature, 'src', 'index.ts');
    if (!existsSync(indexPath)) {
      missingInConfig.push(feature);
    }
  }

  // Features in dist but not in source (unlikely but check anyway)
  const missingInSource = builtFeatures.size > 0 ? [...builtFeatures].filter((f) => !sourceFeatures.has(f)) : [];

  // Features in source but not in dist
  const missingInDist = builtFeatures.size > 0 ? [...sourceFeatures].filter((f) => !builtFeatures.has(f)) : [];

  return {
    package: 'grid-angular',
    missingInConfig,
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
