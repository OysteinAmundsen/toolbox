import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bonus-slider-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bonus-slider-editor">
      <input
        #slider
        type="range"
        class="bonus-slider-editor__slider"
        [min]="minBonus()"
        [max]="maxBonus()"
        [(ngModel)]="currentValueModel"
        (change)="onCommit()"
        (keydown)="onKeyDown($event)"
      />
      <span class="bonus-slider-editor__display">
        <strong [class]="getColorClass()">{{ formatCurrency(currentValueModel) }}</strong>
        <small class="bonus-slider-editor__percent">({{ getPercent() }}%)</small>
      </span>
    </div>
  `,
  styles: [],
})
export class BonusSliderEditorComponent implements AfterViewInit {
  value = input<number>(0);
  salary = input<number>(100000);
  commit = output<number>();
  cancel = output<void>();
  slider = viewChild.required<ElementRef<HTMLInputElement>>('slider');

  currentValueModel = 0;
  minBonus = computed(() => Math.round(this.salary() * 0.02));
  maxBonus = computed(() => Math.round(this.salary() * 0.25));

  constructor() {
    effect(() => {
      this.currentValueModel = this.value() ?? Math.round(this.salary() * 0.1);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.slider().nativeElement.focus(), 0);
  }

  onCommit(): void {
    this.commit.emit(this.currentValueModel);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commit.emit(this.currentValueModel);
    } else if (event.key === 'Escape') {
      this.cancel.emit();
    }
  }

  getPercent(): string {
    return ((this.currentValueModel / this.salary()) * 100).toFixed(1);
  }

  getColorClass(): string {
    const percent = parseFloat(this.getPercent());
    if (percent >= 15) return 'bonus-slider-editor__value--high';
    if (percent >= 10) return 'bonus-slider-editor__value--medium';
    return 'bonus-slider-editor__value--low';
  }

  formatCurrency(value: number): string {
    return `$${value.toLocaleString()}`;
  }
}
