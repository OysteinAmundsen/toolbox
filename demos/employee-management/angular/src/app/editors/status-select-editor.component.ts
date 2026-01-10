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

interface StatusConfig {
  bg: string;
  text: string;
  icon: string;
}

@Component({
  selector: 'app-status-select-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="status-select-editor">
      <select
        #selectEl
        class="status-select-editor__select"
        [(ngModel)]="currentValueModel"
        (change)="onCommit()"
        (keydown)="onKeyDown($event)"
      >
        @for (status of statuses; track status) {
          <option [value]="status">{{ statusConfig[status].icon }} {{ status }}</option>
        }
      </select>
    </div>
  `,
  styles: [],
})
export class StatusSelectEditorComponent implements AfterViewInit {
  value = input<string>('Active');
  commit = output<string>();
  cancel = output<void>();
  selectEl = viewChild.required<ElementRef<HTMLSelectElement>>('selectEl');

  currentValueModel = 'Active';
  readonly statuses = ['Active', 'Remote', 'On Leave', 'Contract', 'Terminated'];
  readonly statusConfig: Record<string, StatusConfig> = {
    Active: { bg: '#d4edda', text: '#155724', icon: '✓' },
    Remote: { bg: '#cce5ff', text: '#004085', icon: '🏠' },
    'On Leave': { bg: '#fff3cd', text: '#856404', icon: '🌴' },
    Contract: { bg: '#e2e3e5', text: '#383d41', icon: '📄' },
    Terminated: { bg: '#f8d7da', text: '#721c24', icon: '✗' },
  };

  constructor() {
    effect(() => {
      this.currentValueModel = this.value() || 'Active';
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.selectEl().nativeElement.focus(), 0);
  }

  onCommit(): void {
    this.commit.emit(this.currentValueModel);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel.emit();
    }
  }
}
