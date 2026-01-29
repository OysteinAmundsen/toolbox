import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Custom esbuild plugin to resolve @toolbox-web packages.
 *
 * Supports two modes controlled by the `USE_DIST` environment variable:
 *
 * - **Source mode (default)**: Resolves all packages to source files for fast HMR
 * - **Dist mode (`USE_DIST=true`)**: Resolves @toolbox-web/grid to dist (validates published package),
 *   but keeps @toolbox-web/grid-angular from source (Angular needs to AOT compile it)
 *
 * Also handles ?inline CSS imports (Vite syntax) for esbuild compatibility.
 */
const toolboxAliasPlugin = {
  name: 'toolbox-alias',
  setup(build) {
    // Resolve from tools folder (demos/employee-management/angular/tools -> workspace root is ../../../..)
    const workspaceRoot = path.resolve(__dirname, '../../../..');
    const libsRoot = path.join(workspaceRoot, 'libs');
    const distRoot = path.join(workspaceRoot, 'dist/libs');

    // Check if we should use built dist packages for the core grid
    const useDist = process.env.USE_DIST === 'true';

    if (useDist) {
      console.log(
        '🔧 Angular demo running in DIST mode - @toolbox-web/grid from dist/, grid-angular from source (AOT)',
      );
    }

    // Handle ?inline CSS imports (Vite syntax) - load as text string
    build.onResolve({ filter: /\.css\?inline$/ }, (args) => {
      // Remove the ?inline suffix to get the actual file path
      const cssPath = args.path.replace('?inline', '');
      // Resolve relative to the importer
      const resolvedPath = path.resolve(path.dirname(args.importer), cssPath);
      return {
        path: resolvedPath,
        namespace: 'inline-css',
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'inline-css' }, async (args) => {
      const contents = fs.readFileSync(args.path, 'utf8');
      return {
        contents: `export default ${JSON.stringify(contents)};`,
        loader: 'js',
      };
    });

    // Resolve @toolbox-web/grid
    build.onResolve({ filter: /^@toolbox-web\/grid$/ }, () => ({
      path: useDist
        ? path.join(distRoot, 'grid', 'index.js')
        : path.join(libsRoot, 'grid', 'src', 'index.ts'),
    }));

    // Resolve @toolbox-web/grid/all
    build.onResolve({ filter: /^@toolbox-web\/grid\/all$/ }, () => ({
      path: useDist
        ? path.join(distRoot, 'grid', 'all.js')
        : path.join(libsRoot, 'grid', 'src', 'all.ts'),
    }));

    // Resolve @toolbox-web/grid/* (plugins, etc.)
    build.onResolve({ filter: /^@toolbox-web\/grid\/(.+)$/ }, (args) => {
      const subpath = args.path.replace('@toolbox-web/grid/', '');
      // Handle plugins/* specially
      if (subpath.startsWith('plugins/')) {
        const pluginName = subpath.replace('plugins/', '');
        return {
          path: useDist
            ? path.join(distRoot, 'grid', 'lib', 'plugins', pluginName, 'index.js')
            : path.join(libsRoot, 'grid', 'src', 'lib', 'plugins', pluginName, 'index.ts'),
        };
      }
      return {
        path: useDist
          ? path.join(distRoot, 'grid', subpath, 'index.js')
          : path.join(libsRoot, 'grid', 'src', subpath, 'index.ts'),
      };
    });

    // Resolve @toolbox-web/grid-angular - ALWAYS from source
    // Angular components must be AOT compiled with the application.
    // The grid-angular package exports Angular directives that need ngc compilation,
    // so even in dist mode we use source files that Angular can compile.
    build.onResolve({ filter: /^@toolbox-web\/grid-angular$/ }, () => ({
      path: path.join(libsRoot, 'grid-angular', 'src', 'index.ts'),
    }));

    // Resolve @toolbox-web/grid-angular/features/* - ALWAYS from source (same reason)
    build.onResolve({ filter: /^@toolbox-web\/grid-angular\/features\/(.+)$/ }, (args) => {
      const feature = args.path.replace('@toolbox-web/grid-angular/features/', '');
      return {
        path: path.join(libsRoot, 'grid-angular', 'features', feature, 'src', 'index.ts'),
      };
    });
  },
};

export default toolboxAliasPlugin;
