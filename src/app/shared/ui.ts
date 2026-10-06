import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';
import { STATUS_LABELS } from '../core/models';
@Component({
  selector: 'app-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name()] ?? paths['grid']" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class Icon {
  readonly name = input('grid');
  readonly paths: Partial<Record<string, string>> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    car: 'M3 16v-5l3-6h12l3 6v5 M3 11h18 M5 16h14 M5 16v3H3v-3 M19 16v3h2v-3 M6 13h2 M16 13h2',
    users:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4',
    calendar: 'M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16 M8 15h2 M14 15h2',
    orders: 'M7 3h10v3H7z M7 5H4v16h16V5h-3 M8 11h8 M8 16h5',
    wash: 'M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z M9 16a3 3 0 0 0 3 3',
    cash: 'M3 5h18v14H3z M3 9h18 M7 14h3 M15 14h2',
    chart: 'M3 3v18h18 M7 17v-4 M12 17V8 M17 17V5',
    settings:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
    logout: 'M9 4H4v16h5 M14 7l5 5-5 5 M8 12h11',
    plus: 'M12 5v14 M5 12h14',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M17 17l4 4',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
    check: 'M5 12l4 4L19 6',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    close: 'M6 6l12 12 M18 6L6 18',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
    bell: 'M18 8a6 6 0 0 0-12 0v6l-2 3h16l-2-3V8 M10 21h4',
    shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3',
  };
}
@Component({
  selector: 'app-badge',
  template: `<span class="badge" [attr.data-status]="status()">{{
    labels[status()] ?? status()
  }}</span>`,
})
export class Badge {
  readonly status = input('');
  readonly labels = STATUS_LABELS;
}
@Component({
  selector: 'app-empty',
  imports: [Icon],
  template: `<div class="empty">
    <app-icon name="wash" />
    <h3>{{ title() }}</h3>
    <p>{{ description() }}</p>
  </div>`,
})
export class Empty {
  readonly title = input('Nenhum registro encontrado');
  readonly description = input('Comece cadastrando um registro ou ajuste os filtros.');
}
@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: `<button
      class="modal-backdrop"
      type="button"
      tabindex="-1"
      aria-label="Fechar janela"
      (click)="dismiss.emit()"
    ></button>
    <section
      class="modal"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      tabindex="-1"
      (keydown.escape)="dismiss.emit()"
    >
      <header>
        <h2>{{ title() }}</h2>
        <button class="icon-button" type="button" aria-label="Fechar" (click)="dismiss.emit()">
          <app-icon name="close" />
        </button>
      </header>
      <ng-content />
    </section>`,
})
export class Modal implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly dismiss = output<void>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = document.activeElement as HTMLElement | null;
  private readonly overflow = document.body.style.overflow;
  private readonly keyHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const items = Array.from(
      this.element.nativeElement
        .querySelector('.modal')!
        .querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
    ).filter((el) => el.getClientRects().length > 0);
    const first = items.at(0);
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  ngAfterViewInit() {
    document.body.style.overflow = 'hidden';
    this.element.nativeElement.addEventListener('keydown', this.keyHandler);
    queueMicrotask(() =>
      this.element.nativeElement
        .querySelector<HTMLElement>('.modal input, .modal select, .modal button')
        ?.focus(),
    );
  }
  ngOnDestroy() {
    document.body.style.overflow = this.overflow;
    this.element.nativeElement.removeEventListener('keydown', this.keyHandler);
    this.previous?.focus();
  }
}
