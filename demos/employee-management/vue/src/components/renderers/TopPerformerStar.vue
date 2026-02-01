<script setup lang="ts">
/**
 * TopPerformerStar - Star indicator for top performers
 * Matches React: TopPerformerStar.tsx
 */
defineProps<{
  value: boolean;
}>();
</script>

<template>
  <span :class="['top-performer-star', value ? 'top-performer-star--active' : 'top-performer-star--inactive']">{{
    value ? '★' : '☆'
  }}</span>
</template>
