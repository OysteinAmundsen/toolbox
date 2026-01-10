const path = require('path');

/**
 * Custom esbuild plugin to resolve @toolbox-web packages to the dist folder.
 * This mimics what would happen when a user installs the packages from npm.
 */
const toolboxAliasPlugin = {
  name: 'toolbox-alias',
  setup(build) {
    // Resolve from tools folder (demos/employee-management/angular/tools -> workspace root is ../../../../)
    const distRoot = path.resolve(__dirname, '../../../../dist/libs');

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

    // Resolve @toolbox-web/grid-angular
    build.onResolve({ filter: /^@toolbox-web\/grid-angular$/ }, () => ({
      path: path.join(distRoot, 'grid-angular', 'index.js'),
    }));
  },
};

module.exports = toolboxAliasPlugin;
