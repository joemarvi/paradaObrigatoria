import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
    (f.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('.toast')).toBeNull();
  });
});
