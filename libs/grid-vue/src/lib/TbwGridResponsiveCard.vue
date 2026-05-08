<script setup lang="ts" generic="TRow = unknown">
import { computed, onMounted, ref, useSlots, type VNode } from 'vue';
import { cardRegistry, type ResponsiveCardContext } from './responsive-card-registry';

/**
 * Props for TbwGridResponsiveCard
 */
const props = withDefaults(
  defineProps<{
    /**
     * Card row height in pixels.
     * Use 'auto' for dynamic height based on content.
     * @default 'auto'
     */
    cardRowHeight?: number | 'auto';
  }>(),
  {
    cardRowHeight: 'auto',
  },
);

// Define slots with proper typing
defineSlots<{
  /** Card content slot */
  default?: (props: ResponsiveCardContext<TRow>) => VNode[];
}>();

// Template ref for the card element
const cardRef = ref<HTMLElement | null>(null);
const slots = useSlots();

// Mirror cardRowHeight to the kebab-cased attribute the ResponsivePlugin reads.
// Vue's `:card-row-height` binding sets the property on the custom element, whose
// type is `number | 'auto'` (see TbwGridResponsiveCardElement); pass the union
// through unchanged.
const cardRowHeightAttr = computed<number | 'auto'>(() => props.cardRowHeight);

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
  <tbw-grid-responsive-card ref="cardRef" :card-row-height="cardRowHeightAttr" />
</template>
