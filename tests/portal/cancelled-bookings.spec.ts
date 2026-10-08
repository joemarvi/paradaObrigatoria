import { test, expect } from '@playwright/test';

test('cliente vê somente reserva ativa mesmo quando a resposta contém canceladas', async ({
  page,
}) => {
  const user = {
    id: '00000000-0000-4000-8000-000000000077',
    email: 'cliente@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: {},
    app_metadata: {},
  };
  const bookings = ['CANCELADO', 'AGENDADO'].map((status, index) => ({
    id: `a${index}`,
    customer_id: 'c1',
    vehicle_id: 'v1',
    service_id: 's1',
    starts_at: '2030-10-08T12:00:00Z',
    duration_minutes: 60,
    status,
  }));
  await page.addInitScript(
    ({ user }) => {
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
    },
    { user },
  );
  await page.route('https://portal-test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let result: unknown = [];
    if (path.endsWith('/profiles')) result = null;
    else if (path.endsWith('/customer_accounts')) result = { customer_id: 'c1' };
    else if (path.endsWith('/customers'))
      result = { id: 'c1', name: 'Cliente Teste', active: true };
    else if (path.endsWith('/user')) result = user;
    else if (path.endsWith('/vehicles'))
      result = [{ id: 'v1', plate: 'JEJ0872', model: '2026', active: true }];
    else if (path.endsWith('/services'))
      result = [{ id: 's1', name: 'Lavagem', price: 85, duration_minutes: 60, active: true }];
    else if (path.endsWith('/appointments')) {
      expect(url.searchParams.get('status')).toBe('neq.CANCELADO');
      result = bookings;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
  await page.goto('/cliente');
  await expect(page.getByRole('heading', { name: 'Meus Agendamentos' })).toBeVisible();
  await expect(page.getByText('Agendado', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Cancelado', { exact: true })).toHaveCount(0);
  const newBooking = page
    .locator('.portal-welcome')
    .getByRole('button', { name: 'Novo Agendamento' });
  await newBooking.hover();
  await expect(newBooking).toHaveCSS('background-color', 'rgb(0, 72, 127)');
  await expect(newBooking).toHaveCSS('color', 'rgb(255, 255, 255)');
  await newBooking.click();
  await expect(page).toHaveURL(/\/cliente$/);
  await expect(page.locator('#portal-booking')).toBeInViewport();
  await expect(page.getByRole('combobox', { name: 'Veículo', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByText('Agendado', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Cancelado', { exact: true })).toHaveCount(0);
  expect(bookings).toHaveLength(2);
  expect(bookings[0].status).toBe('CANCELADO');
});
