<script setup lang="ts">
import type { Employee } from '@demo/shared';

/**
 * ResponsiveEmployeeCard - Card layout for responsive/mobile view
 * Matches React: ResponsiveEmployeeCard.tsx
 */
defineProps<{
  row: Employee;
}>();

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatRating = (rating: number) => {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
};
</script>

<template>
  <div class="responsive-card">
    <div class="card-header">
      <div class="employee-name">
        <span v-if="row.isTopPerformer" class="top-performer">⭐</span>
        {{ row.firstName }} {{ row.lastName }}
      </div>
      <span :class="['status-badge', `status-badge--${row.status.toLowerCase().replace(/\s+/g, '-')}`]">
        {{ row.status }}
      </span>
    </div>

    <div class="card-body">
      <div class="card-row">
        <span class="card-label">Title</span>
        <span class="card-value">{{ row.title }}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Department</span>
        <span class="card-value">{{ row.department }}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Team</span>
        <span class="card-value">{{ row.team }}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Email</span>
        <span class="card-value email">{{ row.email }}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Salary</span>
        <span class="card-value">{{ formatCurrency(row.salary) }}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Rating</span>
        <span class="card-value rating">{{ formatRating(row.rating) }}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Location</span>
        <span class="card-value">{{ row.location }}</span>
      </div>
    </div>
  </div>
</template>
