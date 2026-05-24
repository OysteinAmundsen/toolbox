// @internal Types-only barrel: pulls core feature modules onto ng-packagr's type
// graph so FeatureConfig augmentations merge before emit. See
// .github/knowledge/adapters-angular.md ("FeatureName derivation"). Use `//` not
// `/** */` — terser preserves JSDoc in the fesm bundle (~1.5 KiB cost).
