import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Injectable,
  Type,
} from '@angular/core';

export interface MountedComponent<T> {
  componentRef: ComponentRef<T>;
  destroy: () => void;
}

@Injectable({ providedIn: 'root' })
export class MountIntoContainer {
  private appRef = inject(ApplicationRef);
  private environmentInjector = inject(EnvironmentInjector);

  mount<T>(container: HTMLElement, component: Type<T>): MountedComponent<T> {
    container.replaceChildren();

    const componentRef = createComponent(component, {
      environmentInjector: this.environmentInjector,
    });

    this.appRef.attachView(componentRef.hostView);
    container.appendChild(componentRef.location.nativeElement);

    let destroyed = false;

    return {
      componentRef,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        this.appRef.detachView(componentRef.hostView);
        componentRef.destroy();
        container.replaceChildren();
      },
    };
  }
}
