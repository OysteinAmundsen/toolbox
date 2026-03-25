---
applyTo: '{libs,apps,demos}/**/*.ts'
---

# Core Development Principles

Every change must consider these three pillars:

## Minimal Code, Maximum Performance

Write the least code that correctly solves the problem. Avoid over-engineering, unnecessary abstractions, and speculative features.

## Do It Right, Not Easy

Avoid shortcuts and quick hacks. Prefer correct, maintainable solutions even when they take longer.

## Maintainability

- **File size limit**: Keep files under ~2000 lines of code (excluding JSDoc/comments)
- **Single responsibility**: Each module/file should have one clear purpose
- **Extract pure functions**: Move logic to `internal/` modules when it doesn't require `this` access
- **Region organization**: Use `// #region` markers for navigation in large files
- **Clear naming**: Function names should describe what they do, not how

## Bundle Size

- **Core budget**: `index.js` must stay ≤170 kB (≤45 kB gzipped)
- **Plugin budget**: Each plugin ≤50 kB
- **Adapter budgets**: `grid-react/index.js` ≤50 kB, `grid-vue/index.js` ≤50 kB
- **Enforced automatically**: Vite `bundleBudget` plugin fails the build on violations (see `tools/vite-bundle-budget.ts`)
- **Tree-shakeable**: Features and plugins are separate entry points, not bundled in core
- **No dead code**: Remove unused functions, imports, and types immediately
- **Minimize abstraction overhead**: Prefer inline code over creating classes/wrappers for simple operations
- **Audit before adding**: New features must justify their byte cost

## Performance

- **Hot path awareness**: Scroll handlers, cell rendering, and virtualization are hot paths — optimize aggressively
- **Avoid allocations**: Reuse objects in loops (e.g., `#pooledScrollEvent`)
- **Batch DOM operations**: Use `requestAnimationFrame` via the scheduler, never direct RAF calls
- **Minimize DOM queries**: Cache element references, avoid `querySelector` in hot paths
- **Lazy initialization**: Defer work that isn't needed for first paint

**When in doubt:** Smaller is better. Simpler is better. Faster is better.
