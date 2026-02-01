<script setup lang="ts" generic="TRow = unknown">
import { onMounted, ref, useSlots, type VNode } from 'vue';
import { detailRegistry, type DetailPanelContext } from './detail-panel-registry';

/**
 * Props for TbwGridDetailPanel
 */
const props = withDefaults(
  defineProps<{
    /**
     * Whether to show the expand/collapse column.
     * @default true
     */
    showExpandColumn?: boolean;

    /**
     * Animation style for expand/collapse.
     * - 'slide': Smooth height animation (default)
     * - 'fade': Opacity transition
     * - false: No animation
     * @default 'slide'
     */
    animation?: 'slide' | 'fade' | false;
  }>(),
  {
    showExpandColumn: true,
    animation: 'slide',
  },
);

// Define slots with proper typing
defineSlots<{
  /** Detail panel content slot */
  default?: (props: DetailPanelContext<TRow>) => VNode[];
}>();

// Template ref for the detail element
const detailRef = ref<HTMLElement | null>(null);
const slots = useSlots();

onMounted(() => {
  const element = detailRef.value;
  if (!element || !slots.default) return;

  // Register the slot renderer
  detailRegistry.set(element, (ctx: DetailPanelContext<unknown>) => {
    return slots.default?.(ctx as DetailPanelContext<TRow>);
  });
});
</script>

<template>
  <tbw-grid-detail ref="detailRef" :show-expand-column="showExpandColumn" :animation="animation" />
</template>
