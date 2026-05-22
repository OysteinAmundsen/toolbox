<script setup lang="ts">
import type { CalendarDay, CategoryId } from '@demo/shared/calendar';
import { CATEGORIES } from '@demo/shared/calendar';

const props = defineProps<{
  day: CalendarDay;
}>();

const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<
  CategoryId,
  string
>;
const DOT_CAP = 6;

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
</script>

<template>
  <div
    class="cal-cell"
    :class="{
      'cal-cell--out-of-month': !props.day.inMonth,
      'cal-cell--today': isToday(props.day.date),
    }"
  >
    <div class="cal-cell__date">{{ props.day.date.getDate() }}</div>
    <div class="cal-cell__events">
      <ul class="cal-cell__list">
        <li
          v-for="event in props.day.events"
          :key="event.id"
          class="cal-event"
          :class="`cal-event--${event.category}`"
          :title="`${event.startTime} — ${event.title} (${CATEGORY_LABEL[event.category]})`"
        >
          <span class="cal-event__time">{{ event.startTime }}</span>
          <span class="cal-event__title">{{ event.title }}</span>
        </li>
      </ul>
      <div class="cal-cell__dots">
        <span
          v-for="event in props.day.events.slice(0, DOT_CAP)"
          :key="event.id"
          class="cal-dot"
          :class="`cal-dot--${event.category}`"
          :title="`${event.startTime} — ${event.title}`"
        ></span>
        <span v-if="props.day.events.length > DOT_CAP" class="cal-dot__more">
          +{{ props.day.events.length - DOT_CAP }}
        </span>
      </div>
    </div>
  </div>
</template>
