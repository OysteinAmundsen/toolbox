<script setup lang="ts">
import { computed, onMounted, ref, useSlots, type VNode } from 'vue';
import { toolPanelRegistry, type ToolPanelContext } from './tool-panel-registry';

/**
 * Props for TbwGridToolPanel
 */
const props = withDefaults(
  defineProps<{
    /**
     * Unique identifier for this tool panel.
     */
    id: string;

    /**
     * Display title for the panel tab/button. Mapped to the `title` attribute
     * on the underlying `<tbw-grid-tool-panel>` element. This is the canonical
     * name — it matches the core grid contract and the React/Angular adapters.
     */
    title?: string;

    /**
     * Vue-only alias for {@link title}, accepted so existing templates keep
     * working. `title` wins when both are supplied. Prefer `title` for parity
     * with the core grid and the other adapters.
     */
    label?: string;

    /**
     * Icon for the panel tab (string or SVG).
     */
    icon?: string;

    /**
     * Tooltip text for the accordion header.
     */
    tooltip?: string;

    /**
     * Panel order priority. Lower values appear first.
     * @default 100
     */
    order?: number;
  }>(),
  {
    order: 100,
  },
);

const resolvedTitle = computed(() => props.title ?? props.label ?? '');

// Define slots with proper typing
defineSlots<{
  /** Tool panel content slot */
  default?: (props: ToolPanelContext) => VNode[];
}>();

// Template ref for the tool panel element
const panelRef = ref<HTMLElement | null>(null);
const slots = useSlots();

onMounted(() => {
  const element = panelRef.value;
  if (!element || !slots.default) return;

  // Register the slot renderer
  toolPanelRegistry.set(element, (ctx: ToolPanelContext) => {
    return slots.default?.(ctx);
  });
});
</script>

<template>
  <tbw-grid-tool-panel ref="panelRef" :id="id" :title="resolvedTitle" :icon="icon" :tooltip="tooltip" :order="order" />
</template>
