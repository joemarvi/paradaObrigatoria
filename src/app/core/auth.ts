import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from './environment';
import { Profile, Role } from './models';
export const AUTH_CONFIGURATION = new InjectionToken<{
  supabaseUrl: string;
  supabaseAnonKey: string;
  demo: boolean;
}>('Auth public configuration', { providedIn: 'root', factory: () => environment });
@Injectable({ providedIn: 'root' })
export class Auth {
  client: SupabaseClient | null = null;
  readonly initialized = signal(false);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly demo = signal(false);
  readonly recovery = signal(false);
  readonly authenticated = computed(
    () => this.demo() || (!!this.user() && !!this.profile()?.active),
  );
  readonly role = computed<Role>(() =>
    this.demo() ? 'administrador' : (this.profile()?.role ?? 'operador'),
  );
  readonly name = computed(() =>
    this.demo() ? 'Demonstração' : (this.profile()?.name ?? 'Usuário'),
  );
  private readonly config = inject(AUTH_CONFIGURATION);
  private readonly router = inject(Router);
  readonly ready: Promise<void>;
  constructor() {
    this.ready = this.initialize().finally(() => this.initialized.set(true));
  }
  private subscribe() {
    this.client?.auth.onAuthStateChange((event, session) => {
      this.user.set(session?.user ?? null);
      if (!session) {
        this.profile.set(null);
        if (!this.demo()) void this.router.navigateByUrl('/login');
      }
      if (event === 'PASSWORD_RECOVERY') {
        this.recovery.set(true);
        void this.router.navigateByUrl('/login');
      }
      if (session)
        setTimeout(() => {
          void this.loadProfile(session.user.id);
        }, 0);
    });
  }
  private async initialize() {
    if (!this.config.supabaseUrl) return;
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    this.subscribe();
    const { data, error } = await this.client.auth.getSession();
    if (error) return;
    this.user.set(data.session?.user ?? null);
    if (data.session) await this.loadProfile(data.session.user.id);
  }
  private async loadProfile(id: string) {
    const { data, error } = await this.client!.from('profiles').select('*').eq('id', id).single();
    if (error) {
      this.profile.set(null);
      return;
    }
    this.profile.set(data as Profile);
  }
  async login(email: string, password: string) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user.set(data.user);
    await this.loadProfile(data.user.id);
    if (!this.profile()?.active) {
      await this.logout();
      throw new Error('Perfil sem acesso');
    }
  }
  enterDemo() {
    if (this.config.demo && !this.client) {
      this.demo.set(true);
    }
  }
  async logout() {
    if (this.client) {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    }
    this.user.set(null);
    this.profile.set(null);
    this.demo.set(false);
    this.recovery.set(false);
    await this.router.navigateByUrl('/login');
  }
  async recover(email: string) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + '/login',
    });
    if (error) throw error;
  }
  async changePassword(password: string) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
    this.recovery.set(false);
    await this.logout();
  }
  allows(roles: Role[]) {
    return this.authenticated() && roles.includes(this.role());
  }
}
export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  if (!auth.authenticated()) return router.createUrlTree(['/login']);
  const roles = route.data['roles'] as Role[] | undefined;
  return !roles || auth.allows(roles) ? true : router.createUrlTree(['/fila']);
};
