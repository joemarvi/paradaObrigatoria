import { EmailInputDirective } from '../shared/input-mask';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../core/auth';
import { friendlyError } from '../core/notifications';
@Component({
  imports: [EmailInputDirective, RouterLink, ReactiveFormsModule],
  template: `<main class="customer-portal">
    <header class="portal-header"><a routerLink="/">Parada Obrigatória · Voltar à home</a></header>
    <section class="panel portal-card">
      <h1>{{ auth.recovery() ? 'Defina sua Nova Senha' : 'Recuperar Acesso' }}</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        @if (auth.recovery()) {
          <label
            >Nova senha<input
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="new-password"
              placeholder="Mínimo de 8 caracteres"
          /></label>
        } @else {
          <label>E-mail<input type="email" formControlName="email" autocomplete="email" /></label>
        }
        @if (auth.recovery()) {
          <label class="password-toggle"
            ><input
              type="checkbox"
              [checked]="showPassword()"
              (change)="showPassword.set($any($event.target).checked)"
            />Mostrar senha</label
          >
        }
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        @if (message()) {
          <p class="alert success" role="status">{{ message() }}</p>
        }
        <button
          class="button primary full"
          [disabled]="busy() || !auth.initialized() || !auth.client"
        >
          {{ auth.recovery() ? 'Salvar nova senha' : 'Enviar link' }}</button
        ><a routerLink="/cliente/entrar" class="text-button">Voltar ao login</a>
      </form>
    </section>
  </main>`,
})
export class CustomerRecovery {
  readonly auth = inject(Auth);
  readonly fb = inject(FormBuilder);
  readonly showPassword = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  async submit() {
    if (this.busy()) return;
    if ((this.auth.recovery() ? this.form.controls.password : this.form.controls.email).invalid) {
      this.error.set('Preencha o campo corretamente.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.auth.recovery())
        await this.auth.changePassword(this.form.controls.password.value, '/cliente/entrar');
      else {
        await this.auth.recover(this.form.controls.email.value.trim(), '/cliente/recuperar');
        this.message.set('Se o e-mail estiver cadastrado, você receberá as instruções.');
      }
    } catch (e) {
      this.error.set(friendlyError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
