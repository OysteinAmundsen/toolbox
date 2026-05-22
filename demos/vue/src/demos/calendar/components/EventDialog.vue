<script setup lang="ts">
import type { CalendarDay, CalendarEvent, CategoryId } from '@demo/shared/calendar';
import { CATEGORIES } from '@demo/shared/calendar';
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps<{
  day: CalendarDay | null;
}>();

const emit = defineEmits<{
  submit: [event: CalendarEvent, day: CalendarDay];
  close: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const title = ref('');
const category = ref<CategoryId>(CATEGORIES[0].id);
const startTime = ref('09:00');

const dateLabel = computed(() =>
  props.day?.date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
);

watch(
  () => props.day,
  async (day) => {
    const dialog = dialogRef.value;
    if (!dialog) return;
    if (!day) {
      if (dialog.open) dialog.close();
      return;
    }

    title.value = '';
    category.value = CATEGORIES[0].id;
    startTime.value = '09:00';
    if (!dialog.open) dialog.showModal();
    await nextTick();
    dialog.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
  },
);

function close(): void {
  emit('close');
}

function submit(): void {
  if (!props.day) return;
  emit(
    'submit',
    {
      id: `user-${crypto.randomUUID()}`,
      title: title.value.trim() || 'Untitled',
      category: category.value,
      startTime: startTime.value || '09:00',
    },
    props.day,
  );
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialogRef" class="cal-event-dialog" @close="close">
      <form method="dialog" class="cal-event-dialog__form" @submit.prevent="submit">
        <h2 class="cal-event-dialog__title">New entry — {{ dateLabel }}</h2>
        <label class="cal-event-dialog__field">
          <span>Title</span>
          <input v-model="title" type="text" name="title" required placeholder="e.g. Team sync" />
        </label>
        <label class="cal-event-dialog__field">
          <span>Category</span>
          <select v-model="category" name="category">
            <option v-for="entry in CATEGORIES" :key="entry.id" :value="entry.id">{{ entry.label }}</option>
          </select>
        </label>
        <label class="cal-event-dialog__field">
          <span>Start time</span>
          <input v-model="startTime" type="time" name="startTime" required />
        </label>
        <div class="cal-event-dialog__actions">
          <button type="button" class="cal-header__btn" @click="close">Cancel</button>
          <button type="submit" class="cal-header__btn cal-header__btn--primary">Add entry</button>
        </div>
      </form>
    </dialog>
  </Teleport>
</template>
