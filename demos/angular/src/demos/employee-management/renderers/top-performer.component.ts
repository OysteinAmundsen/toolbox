import { Component, input } from '@angular/core';

@Component({
  selector: 'app-top-performer',
  template: `
    <span
      class="top-performer-star"
      [class.top-performer-star--active]="value()"
      [class.top-performer-star--inactive]="!value()"
    >
      {{ value() ? '★' : '☆' }}
    </span>
  `,
  styles: [],
})
export class TopPerformerComponent {
  value = input<boolean>(false);
}
