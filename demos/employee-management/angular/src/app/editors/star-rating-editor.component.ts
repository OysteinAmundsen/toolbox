import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Employee } from '@demo/shared';
import type { ColumnConfig } from '@toolbox-web/grid';
import type { AngularCellEditor } from '@toolbox-web/grid-angular';

/**
 * Star rating editor implementing AngularCellEditor interface.
 * Can be used via template syntax (*tbwEditor) or component-class column config.
 */
@Component({
  selector: 'app-star-rating-editor',
  imports: [CommonModule],
  template: `
    <div class="star-rating-editor" #container tabindex="0" (keydown)="onKeyDown($event)">
      @for (star of stars; track star) {
        <span
          class="star-rating-editor__star"
          [class.star-rating-editor__star--filled]="star <= currentValue()"
          [class.star-rating-editor__star--empty]="star > currentValue()"
          (click)="onStarClick(star)"
        >
          {{ star <= Math.round(currentValue()) ? '★' : '☆' }}
        </span>
      }
      <span class="star-rating-editor__label">{{ currentValue().toFixed(1) }}</span>
    </div>
  `,
  styles: [],
})
export class StarRatingEditorComponent
  implements AngularCellEditor<Employee, number>, AfterViewInit
{
  // AngularCellEditor interface inputs
  value = input<number>(3);
  row = input<Employee>();
  column = input<ColumnConfig<Employee>>();

  // Outputs for commit/cancel
  commit = output<number>();
  cancel = output<void>();

  container = viewChild.required<ElementRef<HTMLDivElement>>('container');

  currentValue = signal(3);
  readonly stars = [1, 2, 3, 4, 5];
  readonly Math = Math;

  constructor() {
    effect(() => {
      this.currentValue.set(this.value() ?? 3);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.container().nativeElement.focus(), 0);
  }

  onStarClick(star: number): void {
    this.currentValue.set(star);
    this.commit.emit(star);
  }

  onKeyDown(event: KeyboardEvent): void {
    const current = this.currentValue();
    if (event.key === 'ArrowLeft' && current > 1) {
      this.currentValue.set(Math.max(1, current - 0.5));
    } else if (event.key === 'ArrowRight' && current < 5) {
      this.currentValue.set(Math.min(5, current + 0.5));
    } else if (event.key === 'Enter') {
      this.commit.emit(this.currentValue());
    } else if (event.key === 'Escape') {
      this.cancel.emit();
    }
  }
}
