<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

/**
 * DateEditor - Date picker editor
 * Matches React: DateEditor.tsx
 */
const props = defineProps<{
  value: string;
}>();

const emit = defineEmits<{
  commit: [value: string];
  cancel: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const currentValue = ref(props.value || '');

watch(
  () => props.value,
  (newValue) => {
    currentValue.value = newValue || '';
  },
);

onMounted(() => {
  inputRef.value?.focus();
});

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('commit', target.value);
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
  <input
    ref="inputRef"
    type="date"
    :value="currentValue"
    class="date-editor"
    @change="handleChange"
    @keydown="handleKeyDown"
  />
</template>
