import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMOS } from './demos.registry';

@Component({
  selector: 'demo-index',
  standalone: true,
  imports: [RouterLink],
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  template: `
    <main class="demo-index">
      <header class="demo-index-header">
        <h1>Toolbox Web — Angular Demos</h1>
        <p>Pick a demo below or navigate directly via URL.</p>
      </header>
      <ul class="demo-index-list">
        @for (entry of demos; track entry.path) {
          <li class="demo-index-card">
            <a [routerLink]="['/', entry.path]" class="demo-index-link">
              <h2 class="demo-index-title">{{ entry.label }}</h2>
              @if (entry.description) {
                <p class="demo-index-description">{{ entry.description }}</p>
              }
              <span class="demo-index-route">/{{ entry.path }}</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `,
})
export class DemoIndexComponent {
  readonly demos = DEMOS;
}
