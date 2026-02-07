/// <reference types="vitest" />
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import cleanup from 'rollup-plugin-cleanup';
import { build, BuildOptions, defineConfig, LibraryOptions, Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { gzipSync } from 'zlib';

// Read package.json version for build-time injection
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const gridVersion = pkg.version;

const outDir = resolve(__dirname, '../../dist/libs/grid');
const pluginsDir = resolve(__dirname, 'src/lib/plugins');

/** Auto-discover plugin names from filesystem */
const pluginNames = readdirSync(pluginsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'all')
  .map((d) => d.name);

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
  build({ configFile: false, logLevel: 'warn', build: { emptyOutDir: false, sourcemap: true, ...opts } });

/** Externalize core imports in plugin builds */
function externalizeCore(): Plugin {
  return {
    name: 'externalize-core',
    enforce: 'pre',
    resolveId(source, importer) {
      const norm = importer?.replace(/\\/g, '/');
      if (!norm?.includes('/plugins/')) return null;
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

/** Build each plugin as separate ES/CJS modules (parallel, no dts - types bundled in main) */
function buildPluginModules(): Plugin {
  return {
    name: 'build-plugin-modules',
    async closeBundle() {
      // Build all plugins in parallel for speed
      await Promise.all(
        pluginNames.map(async (name) => {
          const dir = resolve(outDir, `lib/plugins/${name}`);
          mkdirSync(dir, { recursive: true });
          await build({
            configFile: false,
            logLevel: 'silent',
            plugins: [externalizeCore()],
            build: {
              outDir: dir,
              emptyOutDir: false,
              sourcemap: true,
              minify: 'esbuild',
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

/** Build UMD bundles for CDN usage */
function buildUmdBundles(): Plugin {
  return {
    name: 'build-umd-bundles',
    async closeBundle() {
      const umd = resolve(outDir, 'umd');
      const umdPlugins = resolve(umd, 'plugins');
      mkdirSync(umdPlugins, { recursive: true });

      // Core + All-in-one UMD
      await libBuild({
        outDir: umd,
        minify: 'esbuild',
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
        minify: 'esbuild',
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
            build: {
              outDir: umdPlugins,
              emptyOutDir: false,
              sourcemap: true,
              minify: 'esbuild',
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

export default defineConfig(({ command }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/grid',
  define: {
    __GRID_VERSION__: JSON.stringify(gridVersion),
  },
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'),
      rollupTypes: false, // Disable type bundling to avoid import() resolution errors
      skipDiagnostics: false, // Fail build on TypeScript errors
    }),
    // Only run build-specific plugins during actual build, not during tests
    ...(command === 'build' ? [copyThemes(), copyReadme(), buildPluginModules(), buildUmdBundles()] : []),
  ],
  build: {
    outDir,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        all: resolve(__dirname, 'src/all.ts'),
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
        compact: true,
        // Force each entry to be self-contained (duplicate shared code)
        manualChunks: undefined,
        chunkFileNames: undefined,
      },
      // This is the key: tell Rollup NOT to share code between entries
      preserveEntrySignatures: 'allow-extension',
      makeAbsoluteExternalsRelative: false,
    },
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2022',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    // Isolate test files to prevent module initialization race conditions
    isolate: true,
    coverage: { provider: 'v8', reporter: ['text', 'html', 'lcov'], reportsDirectory: '../../coverage/libs/grid' },
  },
}));
