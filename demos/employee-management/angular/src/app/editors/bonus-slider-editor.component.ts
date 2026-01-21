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
import type { Employee } from '@demo/shared';
import type { ColumnConfig } from '@toolbox-web/grid';
import type { AngularCellEditor } from '@toolbox-web/grid-angular';

/**
 * Bonus slider editor component that can be used either via:
 * 1. Template syntax (*tbwEditor) with explicit `salary` input
 * 2. Component-class column config implementing `AngularCellEditor`
 *
 * When used via component-class config, it reads `salary` from the `row()` input.
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
  implements AngularCellEditor<Employee, number>, AfterViewInit
{
  // AngularCellEditor interface inputs
  value = input<number>(0);
  row = input<Employee>();
  column = input<ColumnConfig<Employee>>();

  // Legacy input for template-based usage
  salary = input<number>();

  // Outputs for commit/cancel
  commit = output<number>();
  cancel = output<void>();

  slider = viewChild.required<ElementRef<HTMLInputElement>>('slider');

  currentValueModel = 0;

  /**
   * Effective salary - prefers explicit `salary` input, falls back to row.salary
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
    effect(() => {
      this.currentValueModel = this.value() ?? Math.round(this.effectiveSalary() * 0.1);
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
