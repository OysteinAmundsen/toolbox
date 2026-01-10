import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Custom esbuild plugin to resolve @toolbox-web packages to the dist folder.
 * This mimics what would happen when a user installs the packages from npm.
 *
 * Also handles ?inline CSS imports (Vite syntax) for esbuild compatibility.
 */
const toolboxAliasPlugin = {
  name: 'toolbox-alias',
  setup(build) {
    // Resolve from tools folder (demos/employee-management/angular/tools -> workspace root is ../../../../)
    const distRoot = path.resolve(__dirname, '../../../../dist/libs');

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
      path: path.join(distRoot, 'grid', 'index.js'),
    }));

    // Resolve @toolbox-web/grid/all
    build.onResolve({ filter: /^@toolbox-web\/grid\/all$/ }, () => ({
      path: path.join(distRoot, 'grid', 'all.js'),
    }));

    // Resolve @toolbox-web/grid/* (plugins, etc.)
    build.onResolve({ filter: /^@toolbox-web\/grid\/(.+)$/ }, (args) => {
      const subpath = args.path.replace('@toolbox-web/grid/', '');
      return {
        path: path.join(distRoot, 'grid', subpath, 'index.js'),
      };
    });

    // NOTE: @toolbox-web/grid-angular is NOT aliased here.
    // It imports from source via tsconfig paths, allowing Angular AOT compilation.
  },
};

export default toolboxAliasPlugin;
