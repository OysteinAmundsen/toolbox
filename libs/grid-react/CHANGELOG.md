# Changelog

## [0.0.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-react-0.0.2...grid-react-0.0.3) (2026-01-12)


### Bug Fixes

* **docs:** update README files for grid-angular, grid-react, and grid with new features and sponsorship links ([6b12d8a](https://github.com/OysteinAmundsen/toolbox/commit/6b12d8a01e4da19ff602af6ce896170239c44367))
* **shell:** escape HTML in shell header title to prevent XSS vulnerabilities ([6b12d8a](https://github.com/OysteinAmundsen/toolbox/commit/6b12d8a01e4da19ff602af6ce896170239c44367))

## [0.0.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-react-0.0.1...grid-react-0.0.2) (2026-01-12)


### Bug Fixes

* **eslint:** resolve module-boundaries rule performance issue ([55f17fa](https://github.com/OysteinAmundsen/toolbox/commit/55f17fa03e12f3bc7199fcd8daf966a856d55b57))
* resolve lint errors and improve package documentation ([2847835](https://github.com/OysteinAmundsen/toolbox/commit/2847835a3275e5df53a40e1868020d83c7a9406f))

## 0.0.1 (Unreleased)

### Features

- Initial release of `@toolbox-web/grid-react`
- `DataGrid` component - React wrapper for `<tbw-grid>` web component
- `GridColumn` component - Declarative column configuration with render props
- `useGrid` hook - Programmatic access to grid instance
- `useGridEvent` hook - Type-safe event subscriptions with automatic cleanup
- `ReactGridAdapter` - Framework adapter for React component rendering
- Full TypeScript support with generics for row types
- Custom cell renderer support via children render prop
- Custom cell editor support with commit/cancel handlers
- Support for injecting custom styles into grid shadow DOM
- Automatic adapter registration
