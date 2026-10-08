import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SessionActivity } from './session-activity';
import { environment } from './environment';
import { Customer, Profile, Role } from './models';
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
  readonly customer = signal<Customer | null>(null);
  readonly demo = signal(false);
  readonly recovery = signal(false);
  readonly authenticated = computed(
    () => this.demo() || (!!this.user() && (!!this.profile()?.active || !!this.customer()?.active)),
  );
  readonly role = computed<Role>(() =>
    this.demo()
      ? 'administrador'
      : this.customer()
        ? 'cliente'
        : (this.profile()?.role ?? 'operador'),
  );
  readonly name = computed(() =>
    this.demo() ? 'Demonstração' : (this.profile()?.name ?? this.customer()?.name ?? 'Usuário'),
  );
  private readonly config = inject(AUTH_CONFIGURATION);
  private readonly router = inject(Router);
  private readonly activity = inject(SessionActivity);
  private expiring: Promise<void> | null = null;
  readonly ready: Promise<void>;
  constructor() {
    this.ready = this.initialize().finally(() => this.initialized.set(true));
  }
  private subscribe() {
    this.client?.auth.onAuthStateChange((event, session) => {
      if (this.expiring && session) return;
      if (this.user()?.id !== session?.user.id) {
        this.profile.set(null);
        this.customer.set(null);
      }
      this.user.set(session?.user ?? null);
      if (!session) {
        this.activity.stop();
        this.profile.set(null);
        this.customer.set(null);
        if (event === 'SIGNED_OUT' && !this.demo() && !this.expiring)
          void this.router.navigateByUrl(
            this.router.url.startsWith('/cliente') ? '/cliente/entrar' : '/admin/login',
          );
      }
      if (event === 'PASSWORD_RECOVERY') {
        this.recovery.set(true);
        void this.router.navigateByUrl(
          location.pathname.startsWith('/cliente') || this.router.url.startsWith('/cliente')
            ? '/cliente/recuperar'
            : '/admin/login',
        );
      }
      if (session)
        setTimeout(() => {
          void this.loadProfile(session.user.id).then(() => {
            if (this.user()?.id === session.user.id) this.monitorSession();
          });
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
    if (data.session) {
      await this.loadProfile(data.session.user.id);
      this.monitorSession();
    }
  }
  private monitorSession(fresh = false): boolean {
    const user = this.user();
    if (!user) return true;
    return this.activity.start(
      this.config.supabaseUrl || 'demo',
      user.id,
      () => {
        if (!this.expiring)
          this.expiring = this.expireSession().finally(() => {
            this.expiring = null;
          });
      },
      fresh,
    );
  }
  private async expireSession() {
    const redirect =
      this.profile() || this.demo() || this.router.url?.startsWith('/admin')
        ? '/admin/login'
        : '/cliente/entrar';
    this.user.set(null);
    this.profile.set(null);
    this.customer.set(null);
    this.recovery.set(false);
    this.demo.set(false);
    // Clear the persisted token even when the network cannot revoke the refresh token.
    if (this.config.supabaseUrl) {
      const key = `sb-${new URL(this.config.supabaseUrl).hostname.split('.')[0]}-auth-token`;
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}-code-verifier`);
        localStorage.removeItem(`${key}-user`);
      } catch {
        /* Storage may be disabled. */
      }
    }
    await this.router.navigateByUrl(redirect);
    try {
      await this.client?.auth.signOut({ scope: 'local' });
    } catch {
      /* Local access is already cleared. */
    }
  }
  private profileLoad: Promise<void> = Promise.resolve();
  private loadProfile(id: string): Promise<void> {
    const task = this.profileLoad.then(() => this.fetchProfile(id));
    this.profileLoad = task.catch(() => undefined);
    return task;
  }
  private async fetchProfile(id: string) {
    const { data, error } = await this.client!.from('profiles').select('*').eq('id', id).single();
    let customer: Customer | null = null;
    if (error || !data) {
      const account = await this.client!.from('customer_accounts')
        .select('customer_id')
        .eq('user_id', id)
        .maybeSingle();
      if (account.data) {
        const result = await this.client!.from('customers')
          .select('*')
          .eq('id', account.data.customer_id)
          .single();
        customer = result.data as Customer | null;
      }
    }
    if (this.user()?.id !== id) return;
    this.profile.set(error ? null : (data as Profile));
    this.customer.set(customer);
  }
  async login(email: string, password: string) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user.set(data.user);
    this.monitorSession(true);
    await this.loadProfile(data.user.id);
    if (!this.profile()?.active) {
      await this.logout();
      throw new Error('Perfil sem acesso');
    }
  }
  async signUpCustomer(name: string, phone: string, email: string, password: string) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: location.origin + '/cliente',
        data: { customer_name: name, customer_phone: phone },
      },
    });
    if (error) throw error;
    if (data.session) {
      this.user.set(data.user);
      this.monitorSession(true);
      await this.completeCustomerRegistration(name, phone);
    }
    return !!data.session;
  }
  async completeCustomerRegistration(name: string, phone: string) {
    if (!this.client || !this.user()) throw new Error('Acesso não permitido');
    const { error } = await this.client.rpc('register_customer', {
      customer_name: name,
      customer_phone: phone,
    });
    if (error) throw error;
    await this.loadProfile(this.user()!.id);
  }
  async customerLogin(email: string, password: string) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user.set(data.user);
    this.monitorSession(true);
    await this.loadProfile(data.user.id);
    if (this.profile()) {
      await this.logout('/cliente/entrar');
      throw new Error('Acesso não permitido');
    }
  }
  enterDemo() {
    if (this.config.demo && !this.client) {
      this.demo.set(true);
    }
  }
  async logout(redirect = '/admin/login') {
    if (this.client) {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    }
    this.activity.stop();
    this.user.set(null);
    this.profile.set(null);
    this.customer.set(null);
    this.demo.set(false);
    this.recovery.set(false);
    await this.router.navigateByUrl(redirect);
  }
  async recover(email: string, redirect = '/admin/login') {
    if (!this.client) throw new Error('Supabase não configurado');
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + redirect,
    });
    if (error) throw error;
  }
  async changePassword(password: string, redirect = '/admin/login') {
    if (!this.client) throw new Error('Supabase não configurado');
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
    this.recovery.set(false);
    await this.logout(redirect);
  }
  allows(roles: Role[]) {
    return this.authenticated() && roles.includes(this.role());
  }
}
export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  if (auth.customer()) return router.createUrlTree(['/cliente']);
  if (!auth.authenticated()) return router.createUrlTree(['/admin/login']);
  const roles = route.data['roles'] as Role[] | undefined;
  return !roles || auth.allows(roles) ? true : router.createUrlTree(['/admin/fila']);
};

export const customerGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  if (auth.profile() || auth.demo()) return router.createUrlTree(['/cliente/entrar']);
  return auth.user() ? true : router.createUrlTree(['/cliente/entrar']);
};

export const customerAccessGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  if (auth.profile() || auth.demo()) return true;
  if (auth.user() && !route.data['recovery']) return router.createUrlTree(['/cliente']);
  return true;
};

// Keep signed-in customers in their portal when following a public-home link.
export const customerLandingGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  return auth.user() && !auth.profile() && !auth.demo() ? router.createUrlTree(['/cliente']) : true;
};
