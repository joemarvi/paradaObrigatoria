import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_CONFIGURATION, Auth, authGuard } from './auth';
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
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/login']);
    auth.client = fakeClient();
    await auth.login('equipe@example.com', 'senha-teste');
    await TestBed.runInInjectionContext(() => authGuard(route, {} as RouterStateSnapshot));
    expect(router.createUrlTree).toHaveBeenLastCalledWith(['/fila']);
  });
});
