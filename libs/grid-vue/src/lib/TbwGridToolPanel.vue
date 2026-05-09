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
     * on the underlying `<tbw-grid-tool-panel>` element (matches React/Angular
     * adapters and the core grid contract).
     */
    title?: string;

    /**
     * @deprecated Use `title` instead. Kept as a fallback for existing
     * templates; will be removed in a future major version.
     */
    label?: string;

    /**
     * Icon for the panel tab (string or SVG).
     */
    icon?: string;

    /**
     * Position of the panel.
     * @default 'right'
     */
    position?: 'left' | 'right';

    /**
     * Width of the panel when open.
     * @default '250px'
     */
    width?: string;
  }>(),
  {
    position: 'right',
    width: '250px',
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
  <tbw-grid-tool-panel
    ref="panelRef"
    :id="id"
    :title="resolvedTitle"
    :icon="icon"
    :position="position"
    :width="width"
  />
</template>
