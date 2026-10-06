import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../core/auth';
import { friendlyError } from '../core/notifications';
@Component({
  imports: [RouterLink, ReactiveFormsModule],
  template: `<main class="customer-login-page">
    <section class="customer-login-card">
      <a class="customer-login-brand" routerLink="/" aria-label="Voltar à home"
        ><img src="brand-logo.png" width="72" height="72" alt="Parada Obrigatória"
      /></a>
      <span class="eyebrow">SEU VEÍCULO EM BOAS MÃOS</span>
      <h1>Entre para agendar</h1>
      <p>Acesse seus veículos e agendamentos.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>E-mail<input type="email" formControlName="email" autocomplete="username" /></label
        ><label
          >Senha<input type="password" formControlName="password" autocomplete="current-password"
        /></label>
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <button
          class="button primary full"
          [disabled]="busy() || !auth.initialized() || !auth.client"
        >
          {{ busy() ? 'Aguarde…' : 'Entrar' }}</button
        ><a routerLink="/cliente/recuperar" class="text-button">Esqueci minha senha</a>
        <div class="customer-login-divider"><span>Primeira visita?</span></div>
        <a routerLink="/cliente/cadastro" class="button full customer-login-register"
          >Criar uma conta</a
        >
      </form>
    </section>
  </main>`,
})
export class CustomerLogin {
  readonly auth = inject(Auth);
  readonly router = inject(Router);
  readonly fb = inject(FormBuilder);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  async submit() {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.error.set('Informe seu e-mail e senha.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      await this.auth.customerLogin(v.email.trim(), v.password);
      await this.router.navigateByUrl('/cliente');
    } catch (e) {
      this.error.set(friendlyError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
