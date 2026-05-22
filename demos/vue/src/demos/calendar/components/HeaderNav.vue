<script setup lang="ts">
import type { CalendarViewState } from '../composables/useKeyboardNav';

const props = defineProps<{
  state: CalendarViewState;
  years: number[];
  monthNames: readonly string[];
  onYearChange: (year: number) => void;
}>();

function handleYearChange(event: Event): void {
  props.onYearChange(Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="cal-header">
    <span class="cal-header__title">{{ props.monthNames[props.state.month] }}</span>
    <select class="cal-header__year" aria-label="Year" :value="props.state.year" @change="handleYearChange">
      <option v-for="year in props.years" :key="year" :value="year">{{ year }}</option>
    </select>
  </div>
</template>
