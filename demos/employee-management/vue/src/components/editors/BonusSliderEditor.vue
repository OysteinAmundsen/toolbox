<script setup lang="ts">
import { ref, watch, computed } from 'vue';

/**
 * BonusSliderEditor - Slider editor for bonus percentage
 * Matches React: BonusSliderEditor.tsx
 */
const props = defineProps<{
  value: number;
}>();

const emit = defineEmits<{
  commit: [value: number];
  cancel: [];
}>();

const currentValue = ref(props.value || 0);

watch(
  () => props.value,
  (newValue) => {
    currentValue.value = newValue || 0;
  },
);

const displayValue = computed(() => `${currentValue.value}%`);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  currentValue.value = Number(target.value);
};

const handleChange = () => {
  emit('commit', currentValue.value);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('cancel');
  } else if (event.key === 'Enter') {
    emit('commit', currentValue.value);
  }
};
</script>

<template>
  <div class="bonus-slider-editor" @keydown="handleKeyDown">
    <input type="range" :value="currentValue" min="0" max="50" step="1" @input="handleInput" @change="handleChange" />
    <span class="value-display">{{ displayValue }}</span>
  </div>
</template>
