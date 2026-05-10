<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

/**
 * StatusSelectEditor - Dropdown editor for employee status
 * Matches React: StatusSelectEditor.tsx
 */
const props = defineProps<{
  value: string;
}>();

const emit = defineEmits<{
  commit: [value: string];
  cancel: [];
}>();

const selectRef = ref<HTMLSelectElement | null>(null);
const currentValue = ref(props.value || 'Active');

const statusOptions = [
  { value: 'Active', icon: '✓' },
  { value: 'Remote', icon: '🏠' },
  { value: 'On Leave', icon: '🌴' },
  { value: 'Contract', icon: '📄' },
  { value: 'Terminated', icon: '✗' },
];

watch(
  () => props.value,
  (newValue) => {
    currentValue.value = newValue || 'Active';
  },
);

onMounted(() => {
  setTimeout(() => selectRef.value?.focus(), 0);
});

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  currentValue.value = target.value;
  emit('commit', target.value);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('cancel');
  }
};
</script>

<template>
  <div class="status-select-editor">
    <select
      ref="selectRef"
      :value="currentValue"
      class="status-select-editor__select"
      @change="handleChange"
      @keydown="handleKeyDown"
    >
      <option v-for="status in statusOptions" :key="status.value" :value="status.value">
        {{ status.icon }} {{ status.value }}
      </option>
    </select>
  </div>
</template>
