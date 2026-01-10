import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <input
      #dateInput
      type="date"
      class="date-editor"
      [(ngModel)]="currentValueModel"
      (change)="onCommit()"
      (keydown)="onKeyDown($event)"
    />
  `,
  styles: [],
})
export class DateEditorComponent implements AfterViewInit {
  value = input<string>('');
  commit = output<string>();
  cancel = output<void>();
  dateInput = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');

  currentValueModel = '';

  constructor() {
    effect(() => {
      this.currentValueModel = this.value() || '';
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.dateInput().nativeElement.focus(), 0);
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
}
