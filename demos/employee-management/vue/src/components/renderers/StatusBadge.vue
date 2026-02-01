<script setup lang="ts">
/**
 * StatusBadge - Color-coded status badge renderer
 * Matches React: StatusBadge.tsx
 */
defineProps<{
  value: string;
}>();
</script>

<template>
  <span :class="['status-badge', value ? `status-badge--${value.toLowerCase().replace(/\s+/g, '-')}` : '']">
    {{ value }}
  </span>
</template>
