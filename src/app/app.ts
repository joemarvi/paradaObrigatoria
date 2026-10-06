import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Notifications } from './core/notifications';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />
    @if (notices.message()) {
      <div class="toast" [class.toast-error]="notices.error()" role="status" aria-live="polite">
        <span>{{ notices.message() }}</span
        ><button (click)="notices.clear()" aria-label="Fechar notificação">×</button>
      </div>
    }`,
})
export class App {
  readonly notices = inject(Notifications);
}
