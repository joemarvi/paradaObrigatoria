import {
  ApplicationConfig,
  ErrorHandler,
  Injectable,
  inject,
  provideBrowserGlobalErrorListeners,
  LOCALE_ID,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import pt from '@angular/common/locales/pt';
import { routes } from './app.routes';
import { Notifications } from './core/notifications';
registerLocaleData(pt);
@Injectable()
class AppErrorHandler implements ErrorHandler {
  private notices = inject(Notifications);
  handleError(error: unknown) {
    console.error(error);
    this.notices.show('Ocorreu um erro inesperado. Atualize a página e tente novamente.', true);
  }
}
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ],
};
