/// <reference types="vitest" />
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import cleanup from 'rollup-plugin-cleanup';
import { build, BuildOptions, defineConfig, LibraryOptions, Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { gzipSync } from 'zlib';
import { bundleBudget } from '../../tools/vite-bundle-budget';

// Read package.json version for build-time injection
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const gridVersion = pkg.version;

// Build-time defines. MUST be applied to the main config AND every nested
// programmatic build() below — those use `configFile: false`, so they do NOT
// inherit the top-level `define`. Without this, secondary entries
// (features/registry.js, plugins/*/index.js) ship the literal `__GRID_VERSION__`
// and fall back to 'dev' at runtime, collapsing per-version registry isolation
// into a single shared `@dev` symbol (gh: multi-version coexistence).
const gridDefine = { __GRID_VERSION__: JSON.stringify(gridVersion) };

const outDir = resolve(__dirname, '../../dist/libs/grid');
const pluginsDir = resolve(__dirname, 'src/lib/plugins');
const featuresDir = resolve(__dirname, 'src/lib/features');

/** Auto-discover plugin names from filesystem */
const pluginNames = readdirSync(pluginsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'all' && d.name !== 'shared')
  .map((d) => d.name);

/** Auto-discover feature module names from filesystem (all .ts files except registry and specs) */
const featureNames = readdirSync(featuresDir)
  .filter((f) => f.endsWith('.ts') && !f.includes('.spec.') && f !== 'registry.ts')
  .map((f) => f.replace('.ts', ''));

/** Convert plugin name to UMD global: "pinned-rows" -> "TbwGridPlugin_pinnedRows" */
const toUmdGlobal = (name: string) =>
  'TbwGridPlugin_' +
  name
    .split('-')
    .map((p, i) => (i === 0 ? p : p[0].toUpperCase() + p.slice(1)))
    .join('');

/** Format bytes to human-readable size */
const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} kB`);

/** Get file size with gzip */
const getFileSizes = (path: string) => {
  try {
    const content = readFileSync(path);
    return { size: content.length, gzip: gzipSync(content).length };
  } catch {
    return null;
  }
};

/** Shared build options factory */
const libBuild = (opts: { entry: string; outDir: string; lib: LibraryOptions } & Partial<BuildOptions>) =>
  build({
    configFile: false,
    logLevel: 'warn',
    define: gridDefine,
    build: { emptyOutDir: false, sourcemap: true, ...opts },
  });

/** Externalize core imports in plugin builds */
function externalizeCore(): Plugin {
  return {
    name: 'externalize-core',
    enforce: 'pre',
    resolveId(source, importer) {
      const norm = importer?.replace(/\\/g, '/');
      if (!norm?.includes('/plugins/')) return null;
      // Don't externalize utils/diagnostics — small utilities that should be inlined.
      if (source.endsWith('core/internal/utils') || source.endsWith('core/internal/diagnostics')) return null;
      if (source.startsWith('../../components/') || source.startsWith('../../../')) {
        return { id: '@toolbox-web/grid', external: true };
      }
      return null;
    },
  };
}

/** Copy theme CSS files to dist/themes from shared libs/themes */
function copyThemes(): Plugin {
  return {
    name: 'copy-themes',
    writeBundle() {
      const src = resolve(__dirname, '../../libs/themes');
      const dest = resolve(outDir, 'themes');
      try {
        mkdirSync(dest, { recursive: true });
        readdirSync(src)
          .filter((f) => f.endsWith('.css'))
          .forEach((f) => copyFileSync(resolve(src, f), resolve(dest, f)));
      } catch {
        /* ignore */
      }
    },
  };
}

/** Copy README.md to dist for npm publishing */
function copyReadme(): Plugin {
  return {
    name: 'copy-readme',
    writeBundle() {
      try {
        copyFileSync(resolve(__dirname, 'README.md'), resolve(outDir, 'README.md'));
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Copy package.json to dist for npm publishing and `yalc push`.
 * The inferred `@nx/vite/plugin` build does NOT emit a package.json (the old
 * `@nx/vite:build` executor did), and `link:push` skips any dist dir without one.
 */
function copyPackageJson(): Plugin {
  return {
    name: 'copy-package-json',
    writeBundle() {
      try {
        copyFileSync(resolve(__dirname, 'package.json'), resolve(outDir, 'package.json'));
      } catch {
        /* ignore */
      }
    },
  };
}

/** Build each plugin as separate ES/CJS modules (parallel, no dts - types bundled in main) */
function buildPluginModules(): Plugin {
  return {
    name: 'build-plugin-modules',
    async writeBundle() {
      // Pre-create ALL plugin directories synchronously before parallel builds
      // This eliminates race conditions when multiple parallel builds start simultaneously
      // First ensure the parent directories exist
      mkdirSync(resolve(outDir, 'lib/plugins'), { recursive: true });
      for (const name of pluginNames) {
        try {
          mkdirSync(resolve(outDir, `lib/plugins/${name}`), { recursive: true });
        } catch {
          // Ignore EEXIST errors from parallel operations
        }
      }

      // Build all plugins in parallel for speed (directories already exist)
      await Promise.all(
        pluginNames.map(async (name) => {
          const dir = resolve(outDir, `lib/plugins/${name}`);
          await build({
            configFile: false,
            logLevel: 'silent',
            define: gridDefine,
            plugins: [externalizeCore()],
            build: {
              outDir: dir,
              emptyOutDir: false,
              sourcemap: true,
              minify: 'terser',
              lib: {
                entry: resolve(pluginsDir, `${name}/index.ts`),
                formats: ['es'],
                fileName: () => 'index.js',
              },
            },
          });
        }),
      );

      // Print plugin sizes summary
      console.log('\n\x1b[36mPlugin modules:\x1b[0m');
      for (const name of pluginNames.sort()) {
        const esFile = resolve(outDir, `lib/plugins/${name}/index.js`);
        const sizes = getFileSizes(esFile);
        if (sizes) {
          const pad = name.padEnd(20);
          console.log(`  ${pad} ${formatSize(sizes.size).padStart(10)} │ gzip: ${formatSize(sizes.gzip)}`);
        }
      }
    },
  };
}

/** Externalize core + plugin imports in feature builds */
function externalizeForFeatures(): Plugin {
  return {
    name: 'externalize-for-features',
    enforce: 'pre',
    resolveId(source, importer) {
      const norm = importer?.replace(/\\/g, '/');
      if (!norm?.includes('/features/')) return null;

      // Don't externalize utils/diagnostics — small utilities that should be inlined.
      if (source.endsWith('core/internal/diagnostics') || source.endsWith('core/internal/utils')) return null;
      if (source.includes('/core/') || source.startsWith('../../core/') || source.startsWith('../core/')) {
        return { id: '@toolbox-web/grid', external: true };
      }

      // Plugin imports → @toolbox-web/grid/plugins/<name>
      const pluginMatch = source.match(/\/plugins\/([\w-]+)/);
      if (pluginMatch) {
        return { id: `@toolbox-web/grid/plugins/${pluginMatch[1]}`, external: true };
      }

      // Registry import from feature modules → @toolbox-web/grid/features/registry
      if (source === './registry' || source.endsWith('/features/registry')) {
        return { id: '@toolbox-web/grid/features/registry', external: true };
      }

      return null;
    },
  };
}

/** Build feature registry + feature modules as separate ES entry points (parallel) */
function buildFeatureModules(): Plugin {
  return {
    name: 'build-feature-modules',
    async writeBundle() {
      const featDir = resolve(outDir, 'lib/features');
      mkdirSync(featDir, { recursive: true });

      // Build registry first (features depend on it)
      await build({
        configFile: false,
        logLevel: 'silent',
        define: gridDefine,
        plugins: [externalizeForFeatures()],
        build: {
          outDir: featDir,
          emptyOutDir: false,
          sourcemap: true,
          minify: 'terser',
          lib: {
            entry: resolve(featuresDir, 'registry.ts'),
            formats: ['es'],
            fileName: () => 'registry.js',
          },
        },
      });

      // Build all feature modules in parallel
      await Promise.all(
        featureNames.map((name) =>
          build({
            configFile: false,
            logLevel: 'silent',
            define: gridDefine,
            plugins: [externalizeForFeatures()],
            build: {
              outDir: featDir,
              emptyOutDir: false,
              sourcemap: true,
              minify: 'terser',
              lib: {
                entry: resolve(featuresDir, `${name}.ts`),
                formats: ['es'],
                fileName: () => `${name}.js`,
              },
            },
          }),
        ),
      );

      // Print feature sizes summary
      console.log('\n\x1b[36mFeature modules:\x1b[0m');
      const registrySizes = getFileSizes(resolve(featDir, 'registry.js'));
      if (registrySizes) {
        console.log(
          `  ${'registry'.padEnd(20)} ${formatSize(registrySizes.size).padStart(10)} │ gzip: ${formatSize(registrySizes.gzip)}`,
        );
      }
      for (const name of featureNames.sort()) {
        const sizes = getFileSizes(resolve(featDir, `${name}.js`));
        if (sizes) {
          const pad = name.padEnd(20);
          console.log(`  ${pad} ${formatSize(sizes.size).padStart(10)} │ gzip: ${formatSize(sizes.gzip)}`);
        }
      }
    },
  };
}

/** Build UMD bundles for CDN usage */
function buildUmdBundles(): Plugin {
  return {
    name: 'build-umd-bundles',
    async writeBundle() {
      // Ensure base output directory exists (may not exist yet when writeBundle fires on CI)
      mkdirSync(outDir, { recursive: true });

      const umd = resolve(outDir, 'umd');
      const umdPlugins = resolve(umd, 'plugins');
      mkdirSync(umdPlugins, { recursive: true });

      // Core + All-in-one UMD
      await libBuild({
        outDir: umd,
        minify: 'terser',
        entry: '',
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'TbwGrid',
          formats: ['umd'],
          fileName: () => 'grid.umd.js',
        },
      });
      await libBuild({
        outDir: umd,
        minify: 'terser',
        entry: '',
        lib: {
          entry: resolve(__dirname, 'src/all.ts'),
          name: 'TbwGrid',
          formats: ['umd'],
          fileName: () => 'grid.all.umd.js',
        },
      });

      // Individual plugin UMDs (parallel)
      await Promise.all(
        pluginNames.map((name) =>
          build({
            configFile: false,
            logLevel: 'silent',
            define: gridDefine,
            build: {
              outDir: umdPlugins,
              emptyOutDir: false,
              sourcemap: true,
              minify: 'terser',
              lib: {
                entry: resolve(pluginsDir, `${name}/index.ts`),
                name: toUmdGlobal(name),
                formats: ['umd'],
                fileName: () => `${name}.umd.js`,
              },
              rollupOptions: {
                external: [/\.\.\/.*core/, /\.\.\/.*plugin/],
                output: {
                  globals: (id: string) => (id.includes('core') || id.includes('plugin') ? 'TbwGrid' : id),
                },
              },
            },
          }),
        ),
      );

      // Print UMD sizes summary
      console.log('\n\x1b[36mUMD bundles:\x1b[0m');
      for (const file of ['grid.umd.js', 'grid.all.umd.js']) {
        const sizes = getFileSizes(resolve(umd, file));
        if (sizes) {
          const pad = file.padEnd(20);
          console.log(`  ${pad} ${formatSize(sizes.size).padStart(10)} │ gzip: ${formatSize(sizes.gzip)}`);
        }
      }
      console.log('\n\x1b[36mUMD plugins:\x1b[0m');
      for (const name of pluginNames.sort()) {
        const sizes = getFileSizes(resolve(umdPlugins, `${name}.umd.js`));
        if (sizes) {
          const pad = `${name}.umd.js`.padEnd(25);
          console.log(`  ${pad} ${formatSize(sizes.size).padStart(10)} │ gzip: ${formatSize(sizes.gzip)}`);
        }
      }

      // Copy CDN usage README
      copyFileSync(resolve(__dirname, 'src/umd-readme.md'), resolve(umd, 'README.md'));
    },
  };
}

/**
 * Build the all-in-one ESM bundle (`all.js`) as a SEPARATE single-entry build.
 *
 * Vite 8 replaced Rollup with Rolldown, which — unlike Rollup with
 * `preserveEntrySignatures: 'allow-extension'` — hoists code shared between the
 * `index` and `all` entries into a common `aggregators-*.js` chunk when they are
 * built together, collapsing `index.js` into a ~1 kB re-export stub. That breaks
 * the self-contained-entry contract (multi-version `__GRID_VERSION__` isolation)
 * AND defeats the `index.js` bundle-budget / forbidden-symbol checks. Building
 * `all` on its own (one entry) leaves nothing to hoist, so both `index.js` and
 * `all.js` stay self-contained.
 */
function buildAllBundle(): Plugin {
  return {
    name: 'build-all-bundle',
    async writeBundle() {
      await build({
        configFile: false,
        logLevel: 'warn',
        define: gridDefine,
        build: {
          outDir,
          emptyOutDir: false,
          sourcemap: true,
          minify: 'terser',
          lib: {
            entry: resolve(__dirname, 'src/all.ts'),
            formats: ['es'],
            fileName: () => 'all.js',
          },
          rollupOptions: {
            plugins: [cleanup({ comments: 'none', extensions: ['ts', 'js'] })],
          },
          target: 'es2022',
        },
      });
      const sizes = getFileSizes(resolve(outDir, 'all.js'));
      if (sizes) {
        console.log('\n\x1b[36mAll-in-one bundle:\x1b[0m');
        console.log(
          `  ${'all.js'.padEnd(20)} ${formatSize(sizes.size).padStart(10)} │ gzip: ${formatSize(sizes.gzip)}`,
        );
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/grid',
  define: gridDefine,
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'),
      rollupTypes: false, // Disable type bundling to avoid import() resolution errors
      skipDiagnostics: false, // Fail build on TypeScript errors
    }),
    // Only run build-specific plugins during actual build, not during tests
    ...(command === 'build'
      ? [
          copyThemes(),
          copyReadme(),
          copyPackageJson(),
          buildPluginModules(),
          buildFeatureModules(),
          buildAllBundle(),
          buildUmdBundles(),
          bundleBudget({
            outDir,
            budgets: [
              // Core: warn at 45 kB gzip, hard fail at 50 kB gzip / 170 kB raw.
              // Keep core lean — push features to plugins unless they cost performance.
              { path: 'index.js', maxSize: 170 * 1024, maxGzip: 50 * 1024, warnGzip: 45 * 1024 },
              // Plugins: 55 kB raw ceiling. Editing is the outlier — it owns editors,
              // dirty tracking, validation, cell/row/grid modes, undo integration,
              // cascade, and focus management, and legitimately needs the headroom.
              // Most plugins sit well under this; keep pushing new surface behind
              // separate query types (zero core cost) rather than growing a plugin.
              { path: 'lib/plugins/*/index.js', maxSize: 55 * 1024 },
            ],
            // #259/#370 v3: the shell is opt-in and MUST tree-shake out of core.
            // Assert the shell *controller logic* never leaks into index.js. We key
            // on the public ShellPlugin method names — terser preserves property/
            // method names (only `mangle.properties` would rename them, which is off),
            // so these survive minification and uniquely identify the shell bundle.
            // Note: do NOT use `tbw-shell-header` (core dom-builder always emits that
            // structural placeholder div), the `ShellController`/`ShellPlugin` class
            // names (mangled away in both chunks), or `getToolPanels` (substring also
            // present in core) — all give false readings. See vite.config build proof.
            forbiddenSymbols: [
              {
                path: 'index.js',
                symbols: ['openToolPanel', 'registerHeaderContent', 'unregisterHeaderContent'],
                reason: 'shell must tree-shake out of core index.js (#259/#370)',
              },
            ],
          }),
        ]
      : []),
  ],
  build: {
    outDir,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    lib: {
      // Build ONLY the `index` (core) entry in the main build. With a single
      // entry Rolldown keeps it self-contained (no shared `aggregators-*` chunk),
      // so `index.js` is the full core again and the bundle-budget / forbidden-
      // symbol checks on it stay meaningful. The `all` bundle is built separately
      // (buildAllBundle) for the same self-containment reason.
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      plugins: [
        cleanup({
          comments: 'none', // Remove all comments
          extensions: ['ts', 'js'],
        }),
      ],
      output: {
        // Force each entry to be self-contained (duplicate shared code)
        manualChunks: undefined,
        chunkFileNames: undefined,
      },
      // This is the key: tell Rollup NOT to share code between entries
      preserveEntrySignatures: 'allow-extension',
      makeAbsoluteExternalsRelative: false,
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2022',
  },
  test: {
    name: '@toolbox-web/grid',
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
    setupFiles: ['./test/setup.ts'],
    reporters: process.env.CI
      ? [
          'default',
          ['github-actions', { jobSummary: { enabled: false } }],
          '../../tools/vitest-github-summary-reporter.ts',
        ]
      : ['default'],
    // Isolate test files to prevent module initialization race conditions
    isolate: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: '../../coverage/libs/grid',
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
}));
