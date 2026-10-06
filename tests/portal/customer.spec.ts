import { test, expect } from '@playwright/test';
test('cliente confirma cadastro, entra, cadastra veículo, agenda e cancela', async ({ page }) => {
  const user = {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'cliente@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: { customer_name: 'Cliente Teste', customer_phone: '11987654321' },
    app_metadata: {},
    created_at: new Date().toISOString(),
  };
  const customer = { id: 'c1', name: 'Cliente Teste', phone: '11987654321', active: true };
  let registered = false;
  const vehicles: Record<string, unknown>[] = [];
  const appointments: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const startsAt = new Date(Date.now() + 86400000).toISOString();
  await page.route('https://portal-test.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = route.request().postDataJSON();
    let result: unknown;
    if (path.includes('/auth/v1/signup')) {
      calls.push('signup');
      expect(body.options).toBeUndefined();
      result = { user, session: null };
    } else if (path.includes('/auth/v1/token'))
      result = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user,
      };
    else if (path.includes('/auth/v1/user')) result = user;
    else if (path.includes('/auth/v1/logout')) result = {};
    else if (path.endsWith('/profiles')) {
      await route.fulfill({
        status: 406,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST116', message: '0 rows' }),
      });
      return;
    } else if (path.endsWith('/customer_accounts'))
      result = registered ? { customer_id: 'c1' } : null;
    else if (path.endsWith('/customers')) result = customer;
    else if (path.endsWith('/vehicles')) result = vehicles;
    else if (path.endsWith('/services'))
      result = [{ id: 's1', name: 'Lavagem', price: 85, duration_minutes: 60, active: true }];
    else if (path.endsWith('/appointments')) result = appointments;
    else if (path.endsWith('/rpc/register_customer')) {
      registered = true;
      calls.push('register');
      result = 'c1';
    } else if (path.endsWith('/rpc/portal_add_vehicle')) {
      calls.push('vehicle');
      vehicles.push({
        id: 'v1',
        customer_id: 'c1',
        plate: body.vehicle_plate,
        brand: body.vehicle_brand,
        model: body.vehicle_model,
        color: body.vehicle_color,
        active: true,
      });
      result = 'v1';
    } else if (path.endsWith('/rpc/portal_book')) {
      calls.push('book');
      expect(body.customer_id).toBeUndefined();
      expect(body.duration_minutes).toBeUndefined();
      appointments.push({
        id: 'a1',
        customer_id: 'c1',
        vehicle_id: 'v1',
        service_id: 's1',
        starts_at: body.starts_at,
        duration_minutes: 60,
        status: 'AGENDADO',
      });
      result = 'a1';
    } else if (path.endsWith('/rpc/portal_cancel')) {
      calls.push('cancel');
      appointments[0]['status'] = 'CANCELADO';
      result = null;
    } else throw new Error(`Unexpected request ${path}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/cliente/);
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agendar atendimento' })).toHaveCount(0);
  await page.getByLabel('Nome completo').fill('Cliente Teste');
  await page.getByLabel('Telefone').fill('11987654321');
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-teste-123');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('confirmar');
  expect(calls).toEqual(['signup']);
  await page.getByLabel('Senha', { exact: true }).fill('senha-teste-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Complete seu cadastro' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Cliente Teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar veículo' }).click();
  await page.getByLabel('Placa', { exact: true }).fill('ABC1D23');
  await page.getByLabel('Marca', { exact: true }).fill('Ford');
  await page.getByLabel('Modelo', { exact: true }).fill('Ka');
  await page.getByLabel('Cor', { exact: true }).fill('Branco');
  await page.getByRole('button', { name: 'Salvar veículo' }).click();
  await page.getByRole('combobox', { name: 'Veículo', exact: true }).selectOption('v1');
  await page.getByRole('combobox', { name: 'Serviço', exact: true }).selectOption('s1');
  await page
    .getByLabel('Data e horário')
    .fill(new Date(Date.parse(startsAt) - 3 * 3600000).toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Agendar atendimento' }).click();
  await expect(page.getByText('Agendamento realizado!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Agendamento cancelado.', { exact: true })).toBeVisible();
  expect(calls).toEqual(['signup', 'register', 'vehicle', 'book', 'cancel']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entre para agendar' })).toBeVisible();
});
