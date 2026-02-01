<script setup lang="ts">
import { computed } from 'vue';
import type { Employee } from '@demo/shared';

/**
 * DetailPanel - Master-detail panel showing employee details
 * Matches React: DetailPanel.tsx
 */
const props = defineProps<{
  row: Employee;
}>();

// Use actual data from Employee
const activeProjects = computed(() => props.row.activeProjects);
const recentReviews = computed(() => props.row.performanceReviews.slice(-4));

const getScoreClass = (score: number): string => {
  const level = score >= 4 ? 'high' : score >= 3 ? 'medium' : 'low';
  return `review-card__score--${level}`;
};
</script>

<template>
  <div class="detail-panel">
    <div class="detail-grid">
      <div class="detail-section">
        <h4 class="detail-section__title">Active Projects</h4>
        <table class="detail-table">
          <thead>
            <tr class="detail-table__header">
              <th class="detail-table__header-cell">ID</th>
              <th class="detail-table__header-cell">Project</th>
              <th class="detail-table__header-cell">Role</th>
              <th class="detail-table__header-cell">Hours</th>
              <th class="detail-table__header-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in activeProjects" :key="project.id" class="detail-table__row">
              <td class="detail-table__cell">{{ project.id }}</td>
              <td class="detail-table__cell">{{ project.name }}</td>
              <td class="detail-table__cell">{{ project.role }}</td>
              <td class="detail-table__cell">{{ project.hoursLogged }}h</td>
              <td class="detail-table__cell">
                <span :class="`project-status project-status--${project.status}`">{{ project.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="detail-section">
        <h4 class="detail-section__title">Performance Reviews</h4>
        <div class="reviews-grid">
          <div v-for="review in recentReviews" :key="`${review.quarter}-${review.year}`" class="review-card">
            <div class="review-card__period">{{ review.quarter }} {{ review.year }}</div>
            <div :class="['review-card__score', getScoreClass(review.score)]">{{ review.score.toFixed(1) }}</div>
            <div class="review-card__notes">{{ review.notes }}</div>
          </div>
        </div>
        <div class="skills-container">
          <h4 class="detail-section__title">Skills</h4>
          <span v-for="skill in row.skills" :key="skill" class="skill-tag">{{ skill }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
