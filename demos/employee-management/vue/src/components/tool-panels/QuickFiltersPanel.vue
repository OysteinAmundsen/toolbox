<script setup lang="ts">
import { ref } from 'vue';
import { DEPARTMENTS } from '@demo/shared';

/**
 * QuickFiltersPanel - Sidebar panel with quick filter buttons
 * Matches React: QuickFiltersPanel.tsx
 */
const emit = defineEmits<{
  'filter-change': [filters: Record<string, unknown>];
}>();

const selectedDepartment = ref<string | null>(null);
const selectedStatus = ref<string | null>(null);
const selectedRating = ref<number | null>(null);

const statuses = ['Active', 'On Leave', 'Terminated', 'Probation', 'Contract'];
const ratings = [1, 2, 3, 4, 5];

const toggleDepartment = (dept: string) => {
  selectedDepartment.value = selectedDepartment.value === dept ? null : dept;
  emitFilters();
};

const toggleStatus = (status: string) => {
  selectedStatus.value = selectedStatus.value === status ? null : status;
  emitFilters();
};

const toggleRating = (rating: number) => {
  selectedRating.value = selectedRating.value === rating ? null : rating;
  emitFilters();
};

const clearAll = () => {
  selectedDepartment.value = null;
  selectedStatus.value = null;
  selectedRating.value = null;
  emitFilters();
};

const emitFilters = () => {
  emit('filter-change', {
    department: selectedDepartment.value,
    status: selectedStatus.value,
    rating: selectedRating.value,
  });
};
</script>

<template>
  <div class="quick-filters-panel">
    <div class="panel-header">
      <h3>Quick Filters</h3>
      <button class="clear-btn" @click="clearAll">Clear All</button>
    </div>

    <div class="filter-section">
      <h4>Department</h4>
      <div class="filter-buttons">
        <button
          v-for="dept in DEPARTMENTS"
          :key="dept"
          :class="['filter-btn', { active: selectedDepartment === dept }]"
          @click="toggleDepartment(dept)"
        >
          {{ dept }}
        </button>
      </div>
    </div>

    <div class="filter-section">
      <h4>Status</h4>
      <div class="filter-buttons">
        <button
          v-for="status in statuses"
          :key="status"
          :class="['filter-btn', { active: selectedStatus === status }]"
          @click="toggleStatus(status)"
        >
          {{ status }}
        </button>
      </div>
    </div>

    <div class="filter-section">
      <h4>Rating</h4>
      <div class="filter-buttons">
        <button
          v-for="rating in ratings"
          :key="rating"
          :class="['filter-btn', { active: selectedRating === rating }]"
          @click="toggleRating(rating)"
        >
          {{ '★'.repeat(rating) }}
        </button>
      </div>
    </div>
  </div>
</template>
