import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_CONFIGURATION, Auth, authGuard, customerGuard } from './auth';
const router = {
  navigateByUrl: vi.fn(() => Promise.resolve(true)),
  createUrlTree: vi.fn(() => new UrlTree()),
};
function fakeClient(active = true, failLogin = false): SupabaseClient {
  return {
    auth: {
      signInWithPassword: vi.fn(async () =>
        failLogin
          ? { data: { user: null }, error: new Error('Invalid login credentials') }
          : { data: { user: { id: 'u1' } }, error: null },
      ),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'u1', name: 'Atendente', role: 'atendente', active },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}
describe('Autenticação e controle de acesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AUTH_CONFIGURATION,
          useValue: { supabaseUrl: '', supabaseAnonKey: '', demo: true },
        },
      ],
    });
  });
  it('não autentica um usuário sem sessão', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    expect(auth.authenticated()).toBe(false);
    expect(auth.allows(['administrador'])).toBe(false);
  });
  it('demonstração explícita não cria sessão Supabase e logout remove acesso', async () => {
    const auth = TestBed.inject(Auth);
    auth.enterDemo();
    expect(auth.demo()).toBe(true);
    expect(auth.authenticated()).toBe(true);
    expect(auth.user()).toBeNull();
    await auth.logout();
    expect(auth.authenticated()).toBe(false);
  });
  it('login utiliza o perfil do banco e não autoriza privilégios adicionais', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    auth.client = fakeClient();
    await auth.login('equipe@example.com', 'senha-teste');
    expect(auth.authenticated()).toBe(true);
    expect(auth.role()).toBe('atendente');
    expect(auth.allows(['administrador', 'gerente'])).toBe(false);
  });
  it('rejeita credenciais inválidas sem autenticar', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    auth.client = fakeClient(true, true);
    await expect(auth.login('equipe@example.com', 'senha-teste')).rejects.toThrow(
      'Invalid login credentials',
    );
    expect(auth.authenticated()).toBe(false);
  });
  it('perfil inativo encerra a sessão e impede login', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    auth.client = fakeClient(false);
    await expect(auth.login('equipe@example.com', 'senha-teste')).rejects.toThrow(
      'Perfil sem acesso',
    );
    expect(auth.authenticated()).toBe(false);
    expect(auth.user()).toBeNull();
  });
  it('guardas redirecionam anônimos e perfis sem permissão', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    const route = new ActivatedRouteSnapshot();
    route.data = { roles: ['gerente'] };
    await TestBed.runInInjectionContext(() => authGuard(route, {} as RouterStateSnapshot));
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/admin/login']);
    auth.client = fakeClient();
    await auth.login('equipe@example.com', 'senha-teste');
    await TestBed.runInInjectionContext(() => authGuard(route, {} as RouterStateSnapshot));
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/admin/fila']);
  });
  it('cliente autenticado não acessa a estrutura ou permissões da equipe', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    auth.user.set({ id: 'cliente' } as never);
    auth.customer.set({
      id: 'c1',
      name: 'Cliente',
      phone: '11987654321',
      active: true,
      created_at: '',
    });
    expect(auth.authenticated()).toBe(true);
    expect(auth.role()).toBe('cliente');
    expect(auth.allows(['administrador', 'gerente', 'atendente', 'operador'])).toBe(false);
    await TestBed.runInInjectionContext(() =>
      authGuard(new ActivatedRouteSnapshot(), {} as RouterStateSnapshot),
    );
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/cliente']);
    await auth.logout();
    expect(auth.customer()).toBeNull();
  });
  it('login de cliente recusa conta da equipe e retorna ao contexto público', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    auth.client = fakeClient();
    await expect(auth.customerLogin('equipe@example.com', 'senha-teste')).rejects.toThrow(
      'Acesso não permitido',
    );
    expect(auth.authenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenLastCalledWith('/cliente/entrar');
  });
  it('portal exige sessão de cliente e não mostra painel da equipe', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    const route = new ActivatedRouteSnapshot();
    await TestBed.runInInjectionContext(() => customerGuard(route, {} as RouterStateSnapshot));
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/cliente/entrar']);
    auth.client = fakeClient();
    await auth.login('equipe@example.com', 'senha-teste');
    await TestBed.runInInjectionContext(() => customerGuard(route, {} as RouterStateSnapshot));
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/']);
  });
  it('login administrativo recusa cliente mesmo com cadastro ativo', async () => {
    const auth = TestBed.inject(Auth);
    await auth.ready;
    const client = fakeClient();
    client.from = ((table: string) => ({
      select: () => ({
        eq: () =>
          table === 'customer_accounts'
            ? { maybeSingle: async () => ({ data: { customer_id: 'c1' }, error: null }) }
            : {
                single: async () =>
                  table === 'profiles'
                    ? { data: null, error: { code: 'PGRST116' } }
                    : { data: { id: 'c1', name: 'Cliente', active: true }, error: null },
              },
      }),
    })) as unknown as typeof client.from;
    auth.client = client;
    await expect(auth.login('cliente@example.com', 'senha-teste')).rejects.toThrow(
      'Perfil sem acesso',
    );
    expect(auth.user()).toBeNull();
    expect(auth.customer()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenLastCalledWith('/admin/login');
  });
});
