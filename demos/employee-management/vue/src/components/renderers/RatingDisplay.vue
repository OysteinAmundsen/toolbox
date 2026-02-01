<script setup lang="ts">
import { computed } from 'vue';

/**
 * RatingDisplay - Color-coded rating display
 * Matches React: RatingDisplay.tsx
 */
const props = defineProps<{
  value: number;
}>();

const displayValue = computed(() => (props.value ?? 0).toFixed(1));

const levelClass = computed(() => {
  const value = props.value ?? 0;
  const level = value >= 4.5 ? 'high' : value >= 3.5 ? 'medium' : 'low';
  return `rating-display--${level}`;
});
</script>

<template>
  <span :class="['rating-display', levelClass]">{{ displayValue }} ★</span>
</template>
