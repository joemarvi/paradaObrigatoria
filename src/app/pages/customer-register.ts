import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '../core/auth';
import { phoneValidator } from '../core/domain';
import { friendlyError } from '../core/notifications';
@Component({
  imports: [RouterLink, ReactiveFormsModule],
  template: `<main class="customer-portal">
    <header class="portal-header">
      <a routerLink="/" class="brand"
        ><img
          class="brand-logo"
          src="brand-logo.png"
          width="64"
          height="64"
          alt="Parada Obrigatória"
        /><strong>Parada Obrigatória</strong></a
      ><a routerLink="/">Voltar à home</a>
    </header>
    <section class="panel portal-card">
      <h1>Crie sua conta</h1>
      <p>Cadastre-se para agendar o cuidado do seu veículo.</p>
      @if (message()) {
        <p class="alert success" role="status">{{ message() }}</p>
        <a routerLink="/cliente/entrar" class="button primary">Entrar na minha conta</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label
            >Nome completo<input
              formControlName="name"
              autocomplete="name"
              maxlength="120" /></label
          ><label>Telefone<input type="tel" formControlName="phone" autocomplete="tel" /></label
          ><label>E-mail<input type="email" formControlName="email" autocomplete="email" /></label
          ><label
            >Senha<input
              type="password"
              formControlName="password"
              autocomplete="new-password"
              placeholder="Mínimo de 8 caracteres" /></label
          ><label
            >Confirme sua senha<input
              type="password"
              formControlName="confirmation"
              autocomplete="new-password"
          /></label>
          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }
          <button
            class="button primary full"
            [disabled]="busy() || !auth.initialized() || !auth.client"
          >
            {{ busy() ? 'Aguarde…' : 'Criar conta' }}</button
          ><a routerLink="/cliente/entrar" class="text-button">Já tenho conta</a>
        </form>
      }
    </section>
  </main>`,
})
export class CustomerRegister {
  readonly auth = inject(Auth);
  readonly router = inject(Router);
  readonly fb = inject(FormBuilder);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: ['', [Validators.required, phoneValidator]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', Validators.required],
  });
  async submit() {
    if (this.busy()) return;
    const v = this.form.getRawValue();
    if (this.form.invalid) {
      this.error.set('Preencha seus dados e uma senha de pelo menos 8 caracteres.');
      return;
    }
    if (v.password !== v.confirmation) {
      this.error.set('As senhas devem ser iguais.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const session = await this.auth.signUpCustomer(
        v.name.trim(),
        v.phone.replace(/\D/g, ''),
        v.email.trim(),
        v.password,
      );
      this.form.controls.password.reset();
      this.form.controls.confirmation.reset();
      if (session) await this.router.navigateByUrl('/cliente');
      else
        this.message.set(
          'Confira seu e-mail para confirmar o cadastro. Depois entre com seu e-mail e senha.',
        );
    } catch (e) {
      this.error.set(friendlyError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
