<script setup lang="ts">
import { computed } from 'vue';
import type { Employee } from '@demo/shared';
import { DEPARTMENTS } from '@demo/shared';

/**
 * AnalyticsPanel - Sidebar panel showing employee analytics
 * Matches React: AnalyticsPanel.tsx
 */
const props = defineProps<{
  rows: Employee[];
}>();

const totalEmployees = computed(() => props.rows.length);

const avgSalary = computed(() => {
  if (props.rows.length === 0) return 0;
  const sum = props.rows.reduce((acc, row) => acc + row.salary, 0);
  return Math.round(sum / props.rows.length);
});

const avgRating = computed(() => {
  if (props.rows.length === 0) return 0;
  const sum = props.rows.reduce((acc, row) => acc + row.rating, 0);
  return (sum / props.rows.length).toFixed(1);
});

const topPerformers = computed(() => {
  return props.rows.filter((row) => row.isTopPerformer).length;
});

const departmentBreakdown = computed(() => {
  const breakdown: Record<string, number> = {};
  for (const dept of DEPARTMENTS) {
    breakdown[dept] = props.rows.filter((row) => row.department === dept).length;
  }
  return breakdown;
});

const statusBreakdown = computed(() => {
  const breakdown: Record<string, number> = {};
  for (const row of props.rows) {
    breakdown[row.status] = (breakdown[row.status] || 0) + 1;
  }
  return breakdown;
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getPercentage = (count: number) => {
  if (totalEmployees.value === 0) return '0%';
  return `${Math.round((count / totalEmployees.value) * 100)}%`;
};
</script>

<template>
  <div class="analytics-panel">
    <div class="panel-header">
      <h3>Analytics</h3>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <span class="stat-value">{{ totalEmployees }}</span>
        <span class="stat-label">Total Employees</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ formatCurrency(avgSalary) }}</span>
        <span class="stat-label">Avg Salary</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ avgRating }}</span>
        <span class="stat-label">Avg Rating</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ topPerformers }}</span>
        <span class="stat-label">Top Performers</span>
      </div>
    </div>

    <div class="breakdown-section">
      <h4>By Department</h4>
      <div class="breakdown-list">
        <div v-for="(count, dept) in departmentBreakdown" :key="dept" class="breakdown-item">
          <span class="breakdown-label">{{ dept }}</span>
          <span class="breakdown-value">{{ count }} ({{ getPercentage(count) }})</span>
        </div>
      </div>
    </div>

    <div class="breakdown-section">
      <h4>By Status</h4>
      <div class="breakdown-list">
        <div v-for="(count, status) in statusBreakdown" :key="status" class="breakdown-item">
          <span class="breakdown-label">{{ status }}</span>
          <span class="breakdown-value">{{ count }} ({{ getPercentage(count) }})</span>
        </div>
      </div>
    </div>
  </div>
</template>
