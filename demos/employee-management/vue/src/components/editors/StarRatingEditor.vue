<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

/**
 * StarRatingEditor - Interactive 5-star rating editor with keyboard support
 * Matches React: StarRatingEditor.tsx
 */
const props = defineProps<{
  value: number;
}>();

const emit = defineEmits<{
  commit: [value: number];
  cancel: [];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const currentValue = ref(props.value ?? 3);
const stars = [1, 2, 3, 4, 5];

watch(
  () => props.value,
  (newValue) => {
    currentValue.value = newValue ?? 3;
  },
);

onMounted(() => {
  setTimeout(() => containerRef.value?.focus(), 0);
});

const handleStarClick = (star: number) => {
  currentValue.value = star;
  emit('commit', star);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowLeft' && currentValue.value > 1) {
    currentValue.value = Math.max(1, currentValue.value - 0.5);
  } else if (event.key === 'ArrowRight' && currentValue.value < 5) {
    currentValue.value = Math.min(5, currentValue.value + 0.5);
  } else if (event.key === 'Enter') {
    emit('commit', currentValue.value);
  } else if (event.key === 'Escape') {
    emit('cancel');
  }
};

const getStarClass = (star: number) => {
  return star <= currentValue.value
    ? 'star-rating-editor__star star-rating-editor__star--filled'
    : 'star-rating-editor__star star-rating-editor__star--empty';
};
</script>

<template>
  <div ref="containerRef" class="star-rating-editor" tabindex="0" @keydown="handleKeyDown">
    <span v-for="star in stars" :key="star" :class="getStarClass(star)" @click="handleStarClick(star)">
      {{ star <= Math.round(currentValue) ? '★' : '☆' }}
    </span>
    <span class="star-rating-editor__label">{{ currentValue.toFixed(1) }}</span>
  </div>
</template>
