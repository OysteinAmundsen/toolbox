<script setup lang="ts">
defineProps<{
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
}>();
</script>

<template>
  <div class="cal-toolbar-nav">
    <button type="button" class="cal-header__btn" title="Previous month" aria-label="Previous month" @click="onPrev">
      ‹
    </button>
    <button type="button" class="cal-header__btn" title="Jump to current month" aria-label="Jump to current month" @click="onToday">
      Today
    </button>
    <button type="button" class="cal-header__btn" title="Next month" aria-label="Next month" @click="onNext">
      ›
    </button>
  </div>
</template>
