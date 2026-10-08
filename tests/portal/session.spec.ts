import { test, expect } from '@playwright/test';

for (const restoredExpired of [false, true]) {
  test(
    restoredExpired
      ? 'sessão antiga expirada não é restaurada após reabrir o portal'
      : 'cliente inativo por oito minutos perde sessão e retorna ao login',
    async ({ page }) => {
      await page.clock.install();
      const user = {
        id: '00000000-0000-4000-8000-000000000088',
        email: 'cliente@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: {},
        app_metadata: {},
      };
      await page.addInitScript(
        ({ user, restoredExpired }) => {
          localStorage.setItem(
            'sb-portal-test-auth-token',
            JSON.stringify({
              access_token: 'test-token',
              refresh_token: 'test-refresh',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              expires_in: 3600,
              token_type: 'bearer',
              user,
            }),
          );
          if (restoredExpired)
            localStorage.setItem(
              `session-activity:https://portal-test.supabase.co:${user.id}`,
              String(Date.now() - 9 * 60000),
            );
        },
        { user, restoredExpired },
      );
      await page.route('https://portal-test.supabase.co/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        let result: unknown = [];
        if (path.endsWith('/profiles')) result = null;
        else if (path.endsWith('/customer_accounts')) result = { customer_id: 'c1' };
        else if (path.endsWith('/customers'))
          result = { id: 'c1', name: 'Cliente Teste', active: true };
        else if (path.endsWith('/user')) result = user;
        else if (path.endsWith('/logout')) result = {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(result),
        });
      });
      await page.goto('/cliente');
      if (!restoredExpired) {
        await expect(page.getByRole('heading', { name: 'Olá, Cliente Teste' })).toBeVisible();
        await page.clock.fastForward(8 * 60000);
      }
      await expect(page).toHaveURL(/\/cliente\/entrar$/);
      await expect(page.getByRole('heading', { name: 'Entre para Agendar' })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('sb-portal-test-auth-token')))
        .toBeNull();
    },
  );
}
