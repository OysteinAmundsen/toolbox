import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, effect, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Employee } from '@demo/shared';
import { BaseGridEditor } from '@toolbox-web/grid-angular';

interface StatusConfig {
  bg: string;
  text: string;
  icon: string;
}

/**
 * Status select editor extending BaseGridEditor.
 *
 * Demonstrates how to build custom editors using the base class:
 * - Inherits value, row, column, control inputs
 * - Inherits commit, cancel outputs
 * - Uses currentValue() computed signal for value resolution
 * - Uses isInvalid(), isDirty() for validation styling
 * - Overrides getErrorMessage() for custom error messages
 */
@Component({
  selector: 'app-status-select-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="status-select-editor" [class.has-control]="control()">
      <select
        #selectEl
        class="status-select-editor__select"
        [class.is-invalid]="isInvalid()"
        [class.is-dirty]="isDirty()"
        [(ngModel)]="currentValueModel"
        (change)="onCommit()"
        (keydown)="onKeyDown($event)"
      >
        @for (status of statuses; track status) {
          <option [value]="status">{{ statusConfig[status].icon }} {{ status }}</option>
        }
      </select>
      @if (hasErrors()) {
        <div class="status-select-editor__error">
          {{ firstErrorMessage() }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      .status-select-editor__select.is-invalid {
        border-color: #dc3545;
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.25);
      }
      .status-select-editor__select.is-dirty {
        border-left: 3px solid #ffc107;
      }
      .status-select-editor__error {
        color: #dc3545;
        font-size: 11px;
        margin-top: 2px;
      }
    `,
  ],
})
export class StatusSelectEditorComponent
  extends BaseGridEditor<Employee, string>
  implements AfterViewInit
{
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
    super();
    // Sync currentValueModel with the resolved value (from control or input)
    effect(() => {
      const value = this.currentValue();
      this.currentValueModel = value || 'Active';
    });
  }

  /**
   * Override to provide custom error messages for status-specific validation.
   */
  protected override getErrorMessage(errorKey: string, errorValue?: unknown): string {
    if (errorKey === 'invalidStatus') return 'Invalid status value';
    return super.getErrorMessage(errorKey, errorValue);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.selectEl().nativeElement.focus(), 0);
  }

  onCommit(): void {
    this.commitValue(this.currentValueModel);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
    }
  }
}
