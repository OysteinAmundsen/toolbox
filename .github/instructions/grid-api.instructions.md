---
applyTo: 'libs/grid/**'
---

# Grid API Guidelines

## API Stability & Breaking Changes

**`@toolbox-web/grid` is now a released library.** Avoid breaking changes to the public API.

**What constitutes a breaking change:**

- Removing or renaming exported types, interfaces, classes, or functions from `public.ts`
- Changing method signatures (adding required parameters, changing return types)
- Removing or renaming public properties/methods on `<tbw-grid>` element
- Removing or renaming CSS custom properties (theming variables)
- Changing event names or payload structures
- Removing or renaming plugin hook methods in `BaseGridPlugin`
- Changing the `disconnectSignal` contract (plugins depend on it for cleanup)

**What is NOT a breaking change:**

- Adding new optional properties, methods, or events
- Internal refactoring that doesn't affect public API
- Bug fixes (even if they change incorrect behavior)
- Adding new exports to `public.ts`
- Performance improvements
- New plugins or plugin features

**When breaking changes are unavoidable:**

1. Document clearly in PR description
2. Update CHANGELOG with migration guide
3. Consider deprecation period with console warnings before removal
4. Bump major version

## Features vs Plugins

There are two ways to enable grid capabilities. **Features** (recommended) use declarative config with tree-shakeable side-effect imports. **Plugins** (advanced) give direct class access for custom plugin development.

| Aspect       | Features (recommended)                          | Plugins (advanced)                                                      |
| ------------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| API          | `features: { selection: 'row' }`                | `plugins: [new SelectionPlugin({ mode: 'row' })]`                       |
| Import       | `import '@toolbox-web/grid/features/selection'` | `import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection'` |
| Dependencies | Auto-resolved                                   | Manual ordering                                                         |
| Use when     | Configuring grid capabilities                   | Building custom plugins, extending BaseGridPlugin                       |

There are **22 features** — one per plugin, ~200-300 bytes each. Framework adapters expose features as component props.

**Always prefer `getPluginByName()` over `getPlugin()`.** It avoids importing the plugin class and returns the actual instance.

## Plugin Development

See the `new-plugin` skill for the complete guide: file structure, hooks, event bus, query system, manifest, dependencies, and runtime config validation.
