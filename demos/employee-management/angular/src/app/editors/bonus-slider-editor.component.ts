import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Employee } from '@demo/shared';
import { BaseGridEditor } from '@toolbox-web/grid-angular';

/**
 * Bonus slider editor extending BaseGridEditor.
 *
 * Demonstrates:
 * - Computed signals based on row() from base class
 * - Custom input (salary) in addition to inherited inputs
 * - Validation styling via isInvalid()
 */
@Component({
  selector: 'app-bonus-slider-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bonus-slider-editor">
      <input
        #slider
        type="range"
        class="bonus-slider-editor__slider"
        [class.is-invalid]="isInvalid()"
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
export class BonusSliderEditorComponent
  extends BaseGridEditor<Employee, number>
  implements AfterViewInit
{
  /** Legacy input for template-based usage (explicit salary override) */
  salary = input<number>();

  slider = viewChild.required<ElementRef<HTMLInputElement>>('slider');

  currentValueModel = 0;

  /**
   * Effective salary - prefers explicit `salary` input, falls back to row().salary
   */
  effectiveSalary = computed(() => {
    const explicitSalary = this.salary();
    if (explicitSalary !== undefined) return explicitSalary;

    const rowData = this.row();
    return rowData?.salary ?? 100000;
  });

  minBonus = computed(() => Math.round(this.effectiveSalary() * 0.02));
  maxBonus = computed(() => Math.round(this.effectiveSalary() * 0.25));

  constructor() {
    super();
    effect(() => {
      // Use currentValue() from base class (handles control vs value)
      this.currentValueModel = this.currentValue() ?? Math.round(this.effectiveSalary() * 0.1);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.slider().nativeElement.focus(), 0);
  }

  onCommit(): void {
    this.commitValue(this.currentValueModel);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commitValue(this.currentValueModel);
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  getPercent(): string {
    return ((this.currentValueModel / this.effectiveSalary()) * 100).toFixed(1);
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
