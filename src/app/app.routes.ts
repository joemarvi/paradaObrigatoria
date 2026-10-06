import { Routes } from '@angular/router';
import { authGuard } from './core/auth';
const office = ['administrador', 'gerente', 'atendente'];
const management = ['administrador', 'gerente'];
export const routes: Routes = [
  {
    path: 'cliente',
    loadComponent: () => import('./pages/customer-portal').then((m) => m.CustomerPortal),
  },
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home').then((m) => m.Home) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [authGuard],
        data: { roles: office },
        loadComponent: () => import('./features/dashboard').then((m) => m.Dashboard),
      },
      ...['clientes', 'veiculos', 'servicos', 'funcionarios', 'categorias'].map((path) => ({
        path,
        canActivate: [authGuard],
        data: {
          roles: ['servicos', 'funcionarios', 'categorias'].includes(path) ? management : office,
        },
        loadComponent: () => import('./features/catalog').then((m) => m.Catalog),
      })),
      {
        path: 'ordens-servico',
        canActivate: [authGuard],
        data: { roles: office },
        loadComponent: () => import('./features/orders').then((m) => m.Orders),
      },
      { path: 'fila', loadComponent: () => import('./features/orders').then((m) => m.Orders) },
      {
        path: 'agendamentos',
        canActivate: [authGuard],
        data: { roles: office },
        loadComponent: () => import('./features/appointments').then((m) => m.Appointments),
      },
      {
        path: 'pagamentos',
        canActivate: [authGuard],
        data: { roles: office },
        loadComponent: () => import('./features/finance').then((m) => m.Finance),
      },
      {
        path: 'caixa',
        canActivate: [authGuard],
        data: { roles: office },
        loadComponent: () => import('./features/finance').then((m) => m.Finance),
      },
      {
        path: 'relatorios',
        canActivate: [authGuard],
        data: { roles: management },
        loadComponent: () => import('./features/reports').then((m) => m.Reports),
      },
      {
        path: 'configuracoes',
        canActivate: [authGuard],
        data: { roles: management },
        loadComponent: () => import('./features/settings').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', loadComponent: () => import('./pages/not-found').then((m) => m.NotFound) },
];
