---
applyTo: '{libs,apps,demos}/**/*.ts'
---

# Core Development Principles

Every change must consider these three pillars.

## Priority Hierarchy

When the constraints below conflict, resolve them in this order. A higher-priority concern wins over a lower-priority one.

| Rank  | Concern                      | Why it sits here                                                                                 |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| **1** | Correctness                  | A wrong answer faster, smaller, or cleaner is still wrong. Never trade correctness for anything. |
| **2** | Bundle size (hard budgets)   | Hard budgets in `tools/vite-bundle-budget.ts` fail the build. Non-negotiable.                    |
| **3** | Hot-path runtime performance | Scroll, cell rendering, and virtualization paths gate the library's value proposition.           |
| **4** | Maintainability              | Default tiebreaker for everything not on a hot path or near a budget ceiling.                    |
| **5** | Developer convenience        | Last. Never justification for shortcuts that hurt 1–4.                                           |

**Trade-off rules:**

- **Performance vs. maintainability** — prefer maintainability **unless** the code is on a documented hot path (scroll, cell render, virtualization, render scheduler tick) **or** the perf gap is measurable and material in a benchmark.
- **Bundle size vs. maintainability** — if a change pushes `index.js` over the 45 kB gzipped soft warning, prefer the smaller implementation; if it would breach 50 kB gzipped, the smaller implementation is mandatory.
- **Bundle size vs. performance** — ship the perf optimisation only if it fits the budget. If it doesn't, find a smaller form (lazy-load, plugin entry point, simpler algorithm).
- **Speed of delivery vs. anything above** — never. "It was faster to write" is not a valid justification.

The sections below detail the constraints feeding into each rank.

## Troubleshooting

When something fails unexpectedly, produces wrong output, or "works but looks wrong" — **check the pitfalls file first** (`grid-pitfalls.instructions.md`). It documents counterintuitive behaviors in the grid's DOM, rendering, and plugin system that are known time-wasters. Also check the relevant instruction files for the area you're working in (CSS, architecture, API) — many conventions exist because of past bugs.

## Minimal Code, Maximum Performance

Write the least code that correctly solves the problem. Avoid over-engineering, unnecessary abstractions, and speculative features.

## Do It Right, Not Easy

Avoid shortcuts and quick hacks. Prefer correct, maintainable solutions even when they take longer **to develop** — a slower implementation that produces a smaller bundle, faster runtime, and clearer code at the call site is the right trade. Do not trade runtime performance, bundle size, or correctness for development speed.

## Maintainability

- **File size limit**: Keep files under ~2000 lines of code (excluding JSDoc/comments)
- **Single responsibility**: Each module/file should have one clear purpose
- **Extract pure functions**: Move logic to `internal/` modules when it doesn't require `this` access
- **Region organization**: Use `// #region` markers for navigation in large files
- **Clear naming**: Function names should describe what they do, not how

## Bundle Size

- **Core budget**: `index.js` must stay ≤170 kB raw and ≤50 kB gzipped (build fails); a warning fires at 45 kB gzipped — treat that as the design target, not the limit
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

**When in doubt:** Smaller is better. Simpler is better. Faster is better. When two of those pull in opposite directions, fall back to the **Priority Hierarchy** at the top of this file: correctness > bundle size > hot-path performance > maintainability > developer convenience.
