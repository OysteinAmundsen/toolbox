import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, effect, ElementRef, signal, viewChild } from '@angular/core';
import type { Employee } from '@demo/shared';
import { BaseGridEditor } from '@toolbox-web/grid-angular';

/**
 * Star rating editor extending BaseGridEditor.
 *
 * Demonstrates:
 * - Using currentValue() from base class
 * - Local signal for UI state
 * - Keyboard navigation
 */
@Component({
  selector: 'app-star-rating-editor',
  imports: [CommonModule],
  template: `
    <div class="star-rating-editor" #container tabindex="0" (keydown)="onKeyDown($event)">
      @for (star of stars; track star) {
        <span
          class="star-rating-editor__star"
          [class.star-rating-editor__star--filled]="star <= ratingValue()"
          [class.star-rating-editor__star--empty]="star > ratingValue()"
          (click)="onStarClick(star)"
        >
          {{ star <= Math.round(ratingValue()) ? '★' : '☆' }}
        </span>
      }
      <span class="star-rating-editor__label">{{ ratingValue().toFixed(1) }}</span>
    </div>
  `,
  styles: [],
})
export class StarRatingEditorComponent
  extends BaseGridEditor<Employee, number>
  implements AfterViewInit
{
  container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  /** Local signal for UI state during editing */
  ratingValue = signal(3);
  readonly stars = [1, 2, 3, 4, 5];
  readonly Math = Math;

  constructor() {
    super();
    // Sync from base class currentValue (handles control vs value)
    effect(() => {
      this.ratingValue.set(this.currentValue() ?? 3);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.container().nativeElement.focus(), 0);
  }

  onStarClick(star: number): void {
    this.ratingValue.set(star);
    this.commitValue(star);
  }

  onKeyDown(event: KeyboardEvent): void {
    const current = this.ratingValue();
    if (event.key === 'ArrowLeft' && current > 1) {
      this.ratingValue.set(Math.max(1, current - 0.5));
    } else if (event.key === 'ArrowRight' && current < 5) {
      this.ratingValue.set(Math.min(5, current + 0.5));
    } else if (event.key === 'Enter') {
      this.commitValue(this.ratingValue());
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }
}
