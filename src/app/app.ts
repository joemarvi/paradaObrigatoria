import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Notifications } from './core/notifications';
import { Feedback, LoadingOverlay, PageLoadingState } from './shared/feedback';
@Component({
  selector: 'app-root',
  host: { '[attr.data-area]': 'area()' },
  imports: [RouterOutlet, Feedback, LoadingOverlay],
  template: `<router-outlet /><app-loading-overlay />
    @if (notices.message()) {
      <app-feedback
        [message]="notices.message()"
        [kind]="notices.error() ? 'error' : 'success'"
        (dismissed)="notices.clear()"
      />
    }`,
})
export class App {
  readonly notices = inject(Notifications);
  readonly area = signal(this.areaFor(location.pathname));
  private areaFor(url: string) {
    return /^\/admin(?:\/|$)/.test(url)
      ? 'admin'
      : /^\/cliente(?:\/|$)/.test(url)
        ? 'customer'
        : 'public';
  }
  constructor() {
    const loading = inject(PageLoadingState);
    const id = Symbol('navigation');
    const subscription = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.area.set(this.areaFor(event.urlAfterRedirects));
      if (event instanceof NavigationStart) loading.set(id, true);
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      )
        loading.set(id, false);
    });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      loading.set(id, false);
    });
  }
}
