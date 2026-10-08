import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageLoadingState } from './shared/feedback';
import { App } from './app';
import { Notifications } from './core/notifications';
describe('Feedback da aplicação', () => {
  it('mostra uma mensagem amigável e permite dispensá-la', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const f = TestBed.createComponent(App);
    const n = TestBed.inject(Notifications);
    n.show('Registro salvo.');
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Registro salvo.');
    expect(f.nativeElement.querySelector('[role=dialog]')).not.toBeNull();
    (f.nativeElement.querySelector('.feedback-actions button') as HTMLButtonElement).click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role=dialog]')).toBeNull();
  });
  it('mantém um único spinner até todas as operações terminarem', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    const loading = TestBed.inject(PageLoadingState);
    const first = Symbol();
    const second = Symbol();
    loading.set(first, true);
    loading.set(second, true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.page-loading-overlay').length).toBe(1);
    loading.set(first, false);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.page-loading-overlay')).not.toBeNull();
    loading.set(second, false);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.page-loading-overlay')).toBeNull();
  });
});
