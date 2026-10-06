import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { environment } from '../core/environment';
import { friendlyError } from '../core/notifications';
import { Icon } from '../shared/ui';
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icon],
  template: `<main class="login-page">
    <section class="login-story">
      <span class="login-brand-name">Lava Jato · Parada Obrigatória</span>
      <div>
        <span class="eyebrow">CUIDADO EM CADA DETALHE</span>
        <h1>Seu lava-jato.<br />Sua operação.<br /><em>Tudo em ordem.</em></h1>
        <p>
          Do primeiro atendimento ao fechamento do caixa, tenha uma visão clara do que acontece.
        </p>
        <div class="login-features">
          <span><app-icon name="car" /> Atendimento ágil</span
          ><span><app-icon name="cash" /> Controle do caixa</span
          ><span><app-icon name="chart" /> Gestão inteligente</span>
        </div>
      </div>
      <small>Parada Obrigatória · Gestão do lava-jato</small>
    </section>
    <section class="login-form-panel">
      <form class="login-form" [formGroup]="form" (ngSubmit)="submit()">
        <span class="eyebrow">BEM-VINDO À PARADA</span>
        <h2>
          {{
            auth.recovery()
              ? 'Defina sua nova senha'
              : recovering()
                ? 'Recuperar acesso'
                : 'Entre na sua conta'
          }}
        </h2>
        <p>
          {{
            recovering()
              ? 'Enviaremos um link para redefinir sua senha.'
              : 'Acesse o painel para começar o dia.'
          }}
        </p>
        @if (!auth.recovery()) {
          <label
            >E-mail<input
              type="email"
              formControlName="email"
              autocomplete="username"
              placeholder="seu@email.com"
          /></label>
        }
        @if (!recovering()) {
          <label
            >{{ auth.recovery() ? 'Nova senha' : 'Senha'
            }}<input
              type="password"
              formControlName="password"
              [attr.autocomplete]="auth.recovery() ? 'new-password' : 'current-password'"
              placeholder="Mínimo de 8 caracteres"
          /></label>
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
          {{
            busy()
              ? 'Aguarde…'
              : auth.recovery()
                ? 'Salvar nova senha'
                : recovering()
                  ? 'Enviar link'
                  : 'Entrar no sistema'
          }}<app-icon name="arrow" />
        </button>
        @if (!auth.recovery()) {
          <button type="button" class="text-button" (click)="toggleRecovery()">
            {{ recovering() ? 'Voltar ao login' : 'Esqueci minha senha' }}
          </button>
        }
        @if (auth.initialized() && !auth.client) {
          <div class="setup-note">
            Supabase ainda não configurado. Consulte o README para ativar o acesso seguro.
          </div>
        }
        @if (demoAllowed) {
          <div class="login-divider"><span>Conheça o sistema</span></div>
          <button type="button" class="button full" (click)="demo()">
            Abrir demonstração<app-icon name="arrow" />
          </button>
        }
        <small class="login-security"
          ><app-icon name="shield" /> Acesso restrito à equipe autorizada</small
        >
      </form>
    </section>
  </main>`,
})
export class Login {
  readonly auth = inject(Auth);
  readonly router = inject(Router);
  readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  readonly recovering = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly demoAllowed = environment.demo;
  toggleRecovery() {
    this.recovering.update((v) => !v);
    this.error.set('');
    this.message.set('');
  }
  demo() {
    this.auth.enterDemo();
    void this.router.navigateByUrl('/dashboard');
  }
  async submit() {
    this.error.set('');
    this.message.set('');
    const { email, password } = this.form.getRawValue();
    if (
      (!this.auth.recovery() && this.form.controls.email.invalid) ||
      (!this.recovering() && this.form.controls.password.invalid)
    ) {
      this.error.set('Informe um e-mail válido e uma senha de pelo menos 8 caracteres.');
      return;
    }
    this.busy.set(true);
    try {
      if (this.auth.recovery()) {
        await this.auth.changePassword(password);
        this.message.set('Senha alterada. Entre novamente.');
      } else if (this.recovering()) {
        await this.auth.recover(email);
        this.message.set('Se o e-mail estiver cadastrado, você receberá as instruções.');
      } else {
        await this.auth.login(email, password);
        await this.router.navigateByUrl(this.auth.role() === 'operador' ? '/fila' : '/dashboard');
      }
    } catch (e) {
      this.error.set(
        (e as Error).message === 'Perfil sem acesso'
          ? 'Sua conta ainda não tem um perfil ativo. Solicite acesso ao administrador.'
          : friendlyError(e),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
