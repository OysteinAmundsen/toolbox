/**
 * Types-only barrel that pulls every core `@toolbox-web/grid/features/*`
 * module into the Angular adapter's type graph so ng-packagr's partial
 * compilation can see the `FeatureConfig` augmentations they declare.
 *
 * Each core feature module contains a `declare module '../core/types' {
 *   interface FeatureConfig { ... } }` block. Module augmentations merge into
 * `FeatureConfig` only when the augmenting module is part of the TypeScript
 * program. The other adapters (React/Vue) get this transitively through
 * their `src/features/*.ts` per-feature helpers (which `import` the core
 * feature for runtime side effects). Angular's adapter doesn't have those
 * helpers — feature secondary entries are per-feature directives that don't
 * touch the core feature registry — so without this barrel, ng-packagr emits
 * `feature-registry.d.ts` with `FeatureName = Exclude<keyof FeatureConfig,
 * '__brand'>` collapsed to `never`, breaking every directive input that
 * accepts a feature name.
 *
 * `import type` is used so this barrel emits zero runtime code (the file is
 * elided entirely by tsc when only type usages remain) — the sole purpose is
 * to put the feature modules on the type-resolution path.
 *
 * If you add a new feature to `libs/grid/src/lib/features/`, append the
 * matching `import type` line here. The `feature-registry.spec.ts` superset
 * check will fail to compile if a previously-accepted name disappears.
 *
 * @packageDocumentation
 * @internal
 */
