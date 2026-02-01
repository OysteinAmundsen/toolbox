<script setup lang="ts" generic="TRow = unknown">
import { onMounted, ref, useSlots, type VNode } from 'vue';
import { cardRegistry, type ResponsiveCardContext } from './responsive-card-registry';

/**
 * Props for TbwGridResponsiveCard
 */
const props = defineProps<{
  // Currently no additional props needed
}>();

// Define slots with proper typing
defineSlots<{
  /** Card content slot */
  default?: (props: ResponsiveCardContext<TRow>) => VNode[];
}>();

// Template ref for the card element
const cardRef = ref<HTMLElement | null>(null);
const slots = useSlots();

onMounted(() => {
  const element = cardRef.value;
  if (!element || !slots.default) return;

  // Register the slot renderer
  cardRegistry.set(element, (ctx: ResponsiveCardContext<unknown>) => {
    return slots.default?.(ctx as ResponsiveCardContext<TRow>);
  });
});
</script>

<template>
  <tbw-grid-responsive-card ref="cardRef" />
</template>
