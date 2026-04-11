---
applyTo: '{libs,apps,demos}/**/*.ts'
---

# Core Development Principles

Every change must consider these three pillars:

## Troubleshooting

When something fails unexpectedly, produces wrong output, or "works but looks wrong" — **check the pitfalls file first** (`grid-pitfalls.instructions.md`). It documents counterintuitive behaviors in the grid's DOM, rendering, and plugin system that are known time-wasters. Also check the relevant instruction files for the area you're working in (CSS, architecture, API) — many conventions exist because of past bugs.

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
- **Prefer indexed `for` loops on JS arrays in hot paths**: Use `for (let i = 0; i < arr.length; i++)` instead of `Array.forEach()`, `for...of`, `.filter().forEach()` chains on JavaScript arrays. These allocate closures or iterator objects. **Exception: NodeList/HTMLCollection** — `querySelectorAll().forEach()` is native C++ in the browser and is faster than JS-level indexed access via `collection[i]`. Do not replace NodeList `.forEach()` with indexed loops.
- **Keep `.map().join()` for string building**: V8's `.join()` is native C++ that pre-allocates the result. `+=` in a loop creates intermediate strings. Use `.map().join()` for building template strings.
- **Destructure DOM properties to cache layout reads**: `const { scrollTop, scrollHeight } = el` reads each property once. Inline access like `el.scrollTop < el.scrollHeight` may read the same getter multiple times.
- **Prefer `.slice()` over `[...arr]`**: Array spread creates an iterator; `.slice()` is a direct copy.

- **Use `Set` not `Array.includes()` for set-membership lookups** — Convert value arrays to a `Set` once for O(1) `.has()` lookups instead of O(n) `Array.includes()` per row
- **When adding a compiled fast-path, delegate the interpreted version** — Make `matchFoo` delegate to `compileFoo` (i.e. `return compileFoo(filter)(row)`) instead of maintaining parallel logic
- **Avoid literal security-sensitive tokens in source** — Static analysis scanners flag `fetch`, `eval`, `new Function`, `globalThis` regardless of context. Build blocklist regexes at runtime from encoded arrays (see `sanitize.ts`)

**When in doubt:** Smaller is better. Simpler is better. Faster is better.
