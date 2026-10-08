import {
  Component,
  Injectable,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Icon, Modal } from './ui';

@Injectable({ providedIn: 'root' })
export class FeedbackQueue {
  private readonly entries = signal<symbol[]>([]);
  readonly current = computed(() => this.entries().at(-1));
  add(id: symbol) {
    this.entries.update((entries) => [...entries.filter((entry) => entry !== id), id]);
  }
  remove(id: symbol) {
    this.entries.update((entries) => entries.filter((entry) => entry !== id));
  }
}

@Component({
  selector: 'app-feedback',
  imports: [Icon, Modal],
  template: `@if (!closed() && queue.current() === id) {
    <app-modal
      [title]="
        kind() === 'success'
          ? 'Tudo Certo'
          : kind() === 'error'
            ? 'Revise as Informações'
            : 'Atenção'
      "
      (dismiss)="close()"
    >
      <div class="feedback-content" [attr.data-kind]="kind()">
        <span class="feedback-icon"
          ><app-icon [name]="kind() === 'success' ? 'check' : 'bell'"
        /></span>
        <div role="status">
          <p>{{ message() }}</p>
          <ng-content />
        </div>
      </div>
      <div class="feedback-actions">
        <button type="button" class="button primary" (click)="close()">Entendi</button>
      </div>
    </app-modal>
  }`,
})
export class Feedback {
  readonly queue = inject(FeedbackQueue);
  readonly id = Symbol();
  readonly message = input('');
  readonly kind = input<'success' | 'error' | 'warning'>('warning');
  readonly dismissed = output<void>();
  readonly closed = signal(false);
  constructor() {
    effect((onCleanup) => {
      if (!this.closed()) this.queue.add(this.id);
      onCleanup(() => this.queue.remove(this.id));
    });
    effect(() => {
      this.message();
      this.closed.set(false);
    });
  }
  close() {
    this.closed.set(true);
    this.dismissed.emit();
  }
}

@Injectable({ providedIn: 'root' })
export class PageLoadingState {
  private readonly sources = signal(new Set<symbol>());
  readonly active = computed(() => this.sources().size > 0);
  set(id: symbol, active: boolean) {
    this.sources.update((current) => {
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

@Component({ selector: 'app-page-loading', template: '' })
export class PageLoading {
  readonly active = input(false);
  private readonly state = inject(PageLoadingState);
  private readonly id = Symbol();
  constructor() {
    effect((onCleanup) => {
      this.state.set(this.id, this.active());
      onCleanup(() => this.state.set(this.id, false));
    });
  }
}

@Component({
  selector: 'app-loading-overlay',
  template: `@if (state.active()) {
    <div class="page-loading-overlay" role="status" aria-live="polite" aria-label="Carregando">
      <div class="page-loading-card">
        <div class="page-spinner" aria-hidden="true"><span></span><span></span><span></span></div>
        <strong>Carregando</strong>
        <p>Aguarde um instante…</p>
      </div>
    </div>
  }`,
})
export class LoadingOverlay {
  readonly state = inject(PageLoadingState);
}
