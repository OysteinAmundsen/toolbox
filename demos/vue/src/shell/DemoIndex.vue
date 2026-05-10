<script setup lang="ts">
import { RouterLink } from 'vue-router';

defineProps<{
  entries: ReadonlyArray<{ path: string; label: string; description?: string }>;
}>();
</script>

<template>
  <main class="demo-index">
    <header class="demo-index-header">
      <h1>Toolbox Web — Vue Demos</h1>
      <p>Pick a demo below or navigate directly via URL.</p>
    </header>
    <ul class="demo-index-list">
      <li v-for="entry in entries" :key="entry.path" class="demo-index-card">
        <RouterLink :to="`/${entry.path}`" class="demo-index-link">
          <h2 class="demo-index-title">{{ entry.label }}</h2>
          <p v-if="entry.description" class="demo-index-description">{{ entry.description }}</p>
          <span class="demo-index-route">/{{ entry.path }}</span>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>
