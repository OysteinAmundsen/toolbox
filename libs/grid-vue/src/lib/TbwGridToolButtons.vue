<script setup lang="ts">
import { type VNode } from 'vue';

/**
 * Props for TbwGridToolButtons
 */
defineProps<{
  // Currently no additional props needed
}>();

// Define slots with proper typing
defineSlots<{
  /** Tool button content slot */
  default?: () => VNode[];
}>();
</script>

<template>
  <tbw-grid-tool-buttons>
    <slot />
  </tbw-grid-tool-buttons>
</template>
