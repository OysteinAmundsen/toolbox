import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-rating-display',
  template: `<span class="rating-display" [class]="levelClass()">{{ displayValue() }} ★</span>`,
  styles: [],
})
export class RatingDisplayComponent {
  value = input<number>(0);

  displayValue = computed(() => (this.value() ?? 0).toFixed(1));

  levelClass = computed(() => {
    const v = this.value() ?? 0;
    const level = v >= 4.5 ? 'high' : v >= 3.5 ? 'medium' : 'low';
    return `rating-display--${level}`;
  });
}
