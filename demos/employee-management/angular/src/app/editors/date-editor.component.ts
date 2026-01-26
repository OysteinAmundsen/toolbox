import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseGridEditor } from '@toolbox-web/grid-angular';

/**
 * Date editor extending BaseGridEditor.
 *
 * Simple date picker that demonstrates minimal BaseGridEditor usage.
 */
@Component({
  selector: 'app-date-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <input
      #dateInput
      type="date"
      class="date-editor"
      [class.is-invalid]="isInvalid()"
      [(ngModel)]="currentValueModel"
      (change)="onCommit()"
      (keydown)="onKeyDown($event)"
    />
  `,
  styles: [
    `
      .date-editor.is-invalid {
        border-color: #dc3545;
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.25);
      }
    `,
  ],
})
export class DateEditorComponent extends BaseGridEditor<unknown, string> implements AfterViewInit {
  dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');

  currentValueModel = '';

  constructor() {
    super();
    effect(() => {
      this.currentValueModel = this.currentValue() || '';
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.dateInput().nativeElement.focus(), 0);
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
}
