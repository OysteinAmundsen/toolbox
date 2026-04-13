---
applyTo: '**/*.ts'
---

# TypeScript Conventions

## No `as unknown as` Casts

**Never use `as unknown as T` anywhere in the codebase.** This is a type-safety escape hatch that hides real type problems. When you encounter existing `as unknown as` casts, refactor them to use proper typing instead.

**Common patterns and their fixes:**

| Bad pattern                                  | Proper fix                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `grid as unknown as HTMLElement`             | Use `grid._hostElement` (typed property on `InternalGrid`)                                           |
| `this.grid as unknown as HTMLElement`        | Use `this.gridElement` (typed getter on `BaseGridPlugin`)                                            |
| `value as unknown as TargetType`             | Add a properly typed property/method, or narrow with type guards                                     |
| `config as unknown as ExtendedConfig`        | Use generic parameters or add properly typed overloads                                               |
| `(el as unknown as TbwGrid).effectiveConfig` | Use `'effectiveConfig' in el` narrowing (avoids circular imports in internal helpers like `aria.ts`) |

**Why this matters:**

- `as unknown as` silences **all** type checking — the compiler can't catch real bugs
- It hides structural mismatches that should be fixed at the type level
- It makes refactoring dangerous (rename a property and the cast still compiles)

**When you see `as unknown as` in existing code:** Refactor it immediately if the fix is small and localized. For larger refactors, note it as tech debt but don't leave new instances.

**Acceptable casts:** `as T` (direct assertion) is fine when TypeScript's inference is genuinely too narrow (e.g., after a type guard, or when the DOM API returns a broader type). The key distinction: `as T` requires structural compatibility; `as unknown as T` bypasses it entirely.

## Code Organization with Region Markers

Use `// #region Name` and `// #endregion` markers to organize code into collapsible sections in VS Code. This improves navigation and maintainability in large files.

**When to add regions:**

- Files over ~200 lines should have logical sections marked with regions
- Group related functionality: imports, types, constants, state, lifecycle, methods, etc.
- Plugin files: separate hooks, state, event handlers, utilities
- Type files: separate interfaces, types, enums, constants

**Region naming conventions:**

```typescript
// #region Imports
import { ... } from '...';
// #endregion

// #region Types & Interfaces
interface MyConfig { ... }
// #endregion

// #region Private State
#state = {};
// #endregion

// #region Lifecycle Methods
connectedCallback() { ... }
// #endregion

// #region Public API
getData() { ... }
// #endregion
```

**Existing files with regions** (use as reference):

- `grid.ts` - 20 regions (lifecycle, plugin system, rendering, etc.)
- `config-manager.ts` - 13 regions
- `plugin-manager.ts` - 11 regions
- `types.ts` - 25 regions (interfaces, types, events, etc.)
- All internal helpers in `core/internal/` have regions

## Naming & Visibility

| Prefix/Tag             | Meaning                                 | In API Docs? |
| ---------------------- | --------------------------------------- | ------------ |
| `#`                    | ES private field (truly private)        | No           |
| `__`                   | Deeply internal (implementation detail) | No           |
| `_`                    | Protected/plugin-accessible state       | Yes          |
| `@internal Plugin API` | Plugin hook/method                      | Yes          |
| `@internal` (alone)    | Internal, not for plugins               | No           |
| (no prefix)            | Public API                              | Yes          |

## Dead Code Removal

See the `bundle-check` skill for the full dead code removal checklist, tools, and process.
