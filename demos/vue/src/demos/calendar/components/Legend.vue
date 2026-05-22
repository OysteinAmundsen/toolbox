<script setup lang="ts">
import { CATEGORIES } from '@demo/shared/calendar';
</script>

<template>
  <div class="cal-legend">
    <span v-for="category in CATEGORIES" :key="category.id" class="cal-legend__item">
      <span class="cal-legend__swatch" :style="{ background: `var(--cal-cat-${category.id})` }"></span>
      <span>{{ category.label }}</span>
    </span>
  </div>
</template>
