import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Auth } from '../core/auth';
import { Store } from '../core/store';
import { Icon } from '../shared/ui';
import { Notifications, friendlyError } from '../core/notifications';
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon, DatePipe],
  template: ` <div class="app-shell">
    @if (menu()) {
      <button class="sidebar-backdrop" aria-label="Fechar menu" (click)="menu.set(false)"></button>
    }
    <aside class="sidebar" [class.open]="menu()">
      <a
        routerLink="/dashboard"
        class="brand brand-sidebar"
        aria-label="Parada Obrigatória — início"
      >
        <img
          class="brand-logo"
          src="brand-logo.png"
          alt="Lava Jato Parada Obrigatória"
          width="112"
          height="112"
          fetchpriority="high"
        />
        <small>GESTÃO DO LAVA-JATO</small>
      </a>
      <div class="nav-caption">OPERAÇÃO</div>
      <nav aria-label="Navegação principal">
        @for (item of nav; track item.path) {
          @if (!item.manager || auth.allows(['administrador', 'gerente'])) {
            @if (auth.role() !== 'operador' || item.path === 'fila') {
              <a [routerLink]="'/' + item.path" routerLinkActive="active" (click)="menu.set(false)"
                ><app-icon [name]="item.icon" /><span>{{ item.label }}</span>
                @if (item.path === 'fila') {
                  <span class="nav-count" aria-hidden="true">{{ activeOrders() }}</span>
                }
              </a>
            }
          }
        }
      </nav>
      <div class="sidebar-footer">
        <span class="status-dot"></span
        >{{ auth.demo() ? 'Ambiente de demonstração' : 'Conectado ao Supabase'
        }}<small>Operação clara. Cuidado em cada detalhe.</small>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-start">
          <button class="icon-button mobile-menu" aria-label="Abrir menu" (click)="menu.set(true)">
            <app-icon name="menu" /></button
          ><span class="breadcrumb">Parada Obrigatória <span>/</span> Gestão</span>
        </div>
        <div class="topbar-end">
          <span class="today">{{ today | date: 'EEE, dd MMM' : '-0300' }}</span>
          <div class="user-avatar">{{ auth.name().slice(0, 1) }}</div>
          <div class="user-info">
            <strong>{{ auth.name() }}</strong
            ><small>{{ auth.role() }}</small>
          </div>
          <button class="icon-button" title="Sair" aria-label="Sair" (click)="logout()">
            <app-icon name="logout" />
          </button>
        </div>
      </header>
      @if (auth.demo()) {
        <div class="demo-banner">
          <app-icon name="shield" /> Demonstração • dados fictícios; alterações mantidas somente
          nesta sessão.
        </div>
      }
      @if (store.loading()) {
        <div class="loading-bar" role="status" aria-label="Carregando dados"></div>
      }
      @if (store.failed()) {
        <div class="alert danger">
          Não foi possível carregar os dados.<button class="button small" (click)="store.load()">
            Tentar novamente
          </button>
        </div>
      }
      @if (store.truncated().length) {
        <div class="alert warning">
          Parte dos registros ainda não foi carregada. Use “Carregar mais” nos cadastros. Relatórios
          consultam o período diretamente.
        </div>
      }
      <main id="main-content"><router-outlet /></main>
      <footer class="page-footer">
        Parada Obrigatória <span>Feito para cuidar da sua operação.</span>
      </footer>
    </div>
  </div>`,
})
export class Shell implements OnInit {
  readonly auth = inject(Auth);
  readonly store = inject(Store);
  readonly router = inject(Router);
  readonly notices = inject(Notifications);
  readonly menu = signal(false);
  readonly today = new Date();
  readonly nav = [
    { path: 'dashboard', label: 'Visão geral', icon: 'grid' },
    { path: 'fila', label: 'Fila de atendimento', icon: 'car' },
    { path: 'ordens-servico', label: 'Ordens de serviço', icon: 'orders' },
    { path: 'agendamentos', label: 'Agendamentos', icon: 'calendar' },
    { path: 'clientes', label: 'Clientes', icon: 'users' },
    { path: 'veiculos', label: 'Veículos', icon: 'car' },
    { path: 'servicos', label: 'Serviços', icon: 'wash', manager: true },
    { path: 'caixa', label: 'Caixa', icon: 'cash' },
    { path: 'pagamentos', label: 'Pagamentos', icon: 'cash' },
    { path: 'relatorios', label: 'Relatórios', icon: 'chart', manager: true },
    { path: 'funcionarios', label: 'Equipe', icon: 'users', manager: true },
    { path: 'configuracoes', label: 'Configurações', icon: 'settings', manager: true },
  ];
  ngOnInit() {
    void this.store.load();
  }
  activeOrders() {
    return this.store
      .db()
      .work_orders.filter((o) =>
        ['AGUARDANDO', 'EM_SERVICO', 'AGUARDANDO_PAGAMENTO'].includes(o.status),
      ).length;
  }
  async logout() {
    try {
      await this.auth.logout();
    } catch (e) {
      this.notices.show(friendlyError(e), true);
    }
  }
}
