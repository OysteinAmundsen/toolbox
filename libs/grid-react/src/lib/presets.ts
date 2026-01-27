/**
 * Preset configurations for common grid setups.
 *
 * Presets provide sensible defaults for common use cases, reducing boilerplate
 * while still allowing individual props to override preset values.
 *
 * @example
 * ```tsx
 * // Use full preset with custom selection mode
 * <DataGrid preset="full" selection="range" />
 * ```
 */

import type { FeatureProps, PresetName } from './feature-props';

/**
 * Minimal preset - basic column reordering only.
 * Good for simple read-only grids with no interaction features.
 */
const MINIMAL_PRESET: FeatureProps = {
  reorder: true,
};

/**
 * Standard preset - common interactive features.
 * Good for typical CRUD applications.
 */
const STANDARD_PRESET: FeatureProps = {
  reorder: true,
  selection: 'row',
  filtering: true,
  editing: 'dblclick',
  sorting: 'multi',
};

/**
 * Full preset - all common features enabled.
 * Good for power users who need all functionality.
 */
const FULL_PRESET: FeatureProps = {
  reorder: true,
  selection: 'row',
  filtering: true,
  editing: 'dblclick',
  sorting: 'multi',
  clipboard: true,
  contextMenu: true,
  undoRedo: true,
  visibility: true,
  export: true,
  print: true,
};

/**
 * Map of preset names to their configurations.
 */
export const PRESETS: Record<PresetName, FeatureProps> = {
  minimal: MINIMAL_PRESET,
  standard: STANDARD_PRESET,
  full: FULL_PRESET,
};

/**
 * Merges a preset with individual feature props.
 * Individual props always override preset values.
 * A value of `false` explicitly disables a feature from the preset.
 *
 * @param preset - Preset name or undefined
 * @param props - Individual feature props
 * @returns Merged feature props
 *
 * @example
 * ```tsx
 * // Full preset but disable editing
 * mergePresetWithProps('full', { editing: false })
 * // Result: all full features except editing
 * ```
 */
export function mergePresetWithProps<TRow = unknown>(
  preset: PresetName | undefined,
  props: FeatureProps<TRow>,
): FeatureProps<TRow> {
  // If no preset, just return the props
  if (!preset) {
    return props;
  }

  const presetConfig = PRESETS[preset];
  if (!presetConfig) {
    console.warn(`[grid-react] Unknown preset: "${preset}". Using props only.`);
    return props;
  }

  // Start with preset as base
  const merged = { ...presetConfig } as FeatureProps<TRow>;

  // Overlay individual props
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      // Explicit false disables the feature
      if (value === false) {
        delete (merged as Record<string, unknown>)[key];
      } else {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Gets the feature props for a given preset name.
 *
 * @param preset - Preset name
 * @returns Feature props for that preset, or empty object if not found
 */
export function getPreset<TRow = unknown>(preset: PresetName): FeatureProps<TRow> {
  return (PRESETS[preset] ?? {}) as FeatureProps<TRow>;
}

/**
 * Lists all available preset names.
 */
export function getPresetNames(): PresetName[] {
  return Object.keys(PRESETS) as PresetName[];
}
