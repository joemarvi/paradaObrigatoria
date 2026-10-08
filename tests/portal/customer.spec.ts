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
      await new Promise((resolve) => setTimeout(resolve, 1200));
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
    else if (path.endsWith('/appointment_payments')) result = [];
    else if (path.endsWith('/appointments')) {
      expect(url.searchParams.get('status')).toBe('neq.CANCELADO');
      result = appointments;
    } else if (path.endsWith('/rpc/register_customer')) {
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
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page).toHaveURL(/cliente\/cadastro/);
  await expect(page.getByRole('heading', { name: 'Crie sua Conta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agendar atendimento' })).toHaveCount(0);
  await page.getByLabel('Nome completo').fill('Cliente Teste');
  await page.getByLabel('Telefone').fill('11987654321');
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-teste-123');
  await page.getByLabel('Confirme sua senha').fill('senha-teste-123');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  const spinner = page.locator('.page-loading-card');
  await expect(spinner).toBeVisible();
  const bounds = await spinner.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('confirmar');
  expect(calls).toEqual(['signup']);
  await page.getByRole('button', { name: 'Entendi', exact: true }).click();
  await page.getByRole('link', { name: 'Entrar na minha conta' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-teste-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Complete seu Cadastro' })).toBeVisible();
  await page.getByLabel('Nome completo').fill('Cliente Teste');
  await page.getByLabel('Telefone').fill('11987654321');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Cliente Teste' })).toBeVisible();
  await expect(page.locator('.portal-account-name')).toHaveText('Cliente Teste');
  await page.getByLabel('Minha Conta: Cliente Teste', { exact: true }).click();
  await page.getByRole('link', { name: 'Página Inicial', exact: true }).click();
  await expect(page).toHaveURL(/\/cliente$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/cliente$/);
  await page.getByRole('button', { name: 'Adicionar veículo' }).click();
  await page.getByLabel('Placa', { exact: true }).fill('ABC1D23');
  await page.getByLabel('Marca', { exact: true }).fill('Ford');
  await page.getByLabel('Modelo', { exact: true }).fill('Ka');
  await page.getByLabel('Cor', { exact: true }).fill('Branco');
  await page.getByRole('button', { name: 'Salvar veículo' }).click();
  await page.getByRole('button', { name: 'Entendi', exact: true }).click();
  await page.getByRole('combobox', { name: 'Veículo', exact: true }).selectOption('v1');
  await page.getByRole('combobox', { name: 'Serviço', exact: true }).selectOption('s1');
  await page
    .getByLabel('Data e horário')
    .fill(new Date(Date.parse(startsAt) - 3 * 3600000).toISOString().slice(0, 16));
  await page.getByRole('button', { name: 'Agendar atendimento' }).click();
  await expect(
    page.getByText('Agendamento realizado! Aguarde a confirmação da equipe.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Entendi', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Agendamento cancelado.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Entendi', exact: true }).click();
  await expect(page.locator('.portal-appointment')).toHaveCount(0);
  expect(appointments[0]['status']).toBe('CANCELADO');
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.locator('.portal-appointment')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Seu Próximo Cuidado Está por Vir' }),
  ).toBeVisible();
  expect(calls).toEqual(['signup', 'register', 'vehicle', 'book', 'cancel']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Minha Conta: Cliente Teste', { exact: true }).click();
  await page.getByRole('button', { name: 'Dados do Cliente', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(user.email);
  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.getByLabel('Minha Conta: Cliente Teste', { exact: true }).click();
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Alterar sua Senha');
  await page.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await page.getByLabel('Minha Conta: Cliente Teste', { exact: true }).click();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Entre para Agendar' })).toBeVisible();
});

test('pré-pagamento envia somente IDs, permite retomar checkout e não garante pelo retorno', async ({
  page,
}) => {
  const user = {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'cliente@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: { customer_name: 'Cliente Teste' },
    app_metadata: {},
  };
  const bookingId = '00000000-0000-4000-8000-000000000099';
  let booked = false;
  let checkoutAttempts = 0;
  const startsAt = new Date(Date.now() + 86400000).toISOString();
  await page.route('https://portal-test.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    let result: unknown;
    if (path.endsWith('/token'))
      result = {
        access_token: 'test-token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user,
      };
    else if (path.endsWith('/user')) result = user;
    else if (path.endsWith('/profiles')) result = null;
    else if (path.endsWith('/customer_accounts')) result = { customer_id: 'c1' };
    else if (path.endsWith('/customers'))
      result = { id: 'c1', name: 'Cliente Teste', active: true };
    else if (path.endsWith('/vehicles'))
      result = [{ id: 'v1', plate: 'ABC1D23', brand: 'Ford', model: 'Ka', active: true }];
    else if (path.endsWith('/services'))
      result = [{ id: 's1', name: 'Lavagem', price: 85, duration_minutes: 60, active: true }];
    else if (path.endsWith('/appointments'))
      result = booked
        ? [
            {
              id: bookingId,
              vehicle_id: 'v1',
              service_id: 's1',
              status: 'AGENDADO',
              starts_at: startsAt,
            },
          ]
        : [];
    else if (path.endsWith('/appointment_payments'))
      result = booked
        ? [
            {
              appointment_id: bookingId,
              method: 'PIX',
              amount: 85,
              status: 'PENDING',
              expires_at: new Date(Date.now() + 900000).toISOString(),
              live_mode: false,
            },
          ]
        : [];
    else if (path.endsWith('/rpc/portal_book_prepaid')) {
      expect(body.payment_method).toBe('PIX');
      expect(body.request_id).toMatch(/^[a-f0-9-]{36}$/);
      expect(body.amount).toBeUndefined();
      expect(body.customer_id).toBeUndefined();
      booked = true;
      result = bookingId;
    } else if (path.endsWith('/functions/v1/mercadopago-checkout')) {
      expect(body).toEqual({ appointment_id: bookingId });
      checkoutAttempts++;
      if (checkoutAttempts === 1) {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporariamente indisponível' }),
        });
        return;
      }
      result = { checkout_url: 'https://www.mercadopago.com.br/checkout/test' };
    } else throw new Error(`Unexpected request ${path}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
  await page.route('https://www.mercadopago.com.br/checkout/test', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Checkout de Teste</h1>' }),
  );
  await page.goto('/cliente/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-teste-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Olá, Cliente Teste' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Veículo', exact: true }).selectOption('v1');
  await page.getByRole('combobox', { name: 'Serviço', exact: true }).selectOption('s1');
  await page
    .getByLabel('Data e horário')
    .fill(new Date(Date.parse(startsAt) - 3 * 3600000).toISOString().slice(0, 16));
  await page.getByLabel('Quando Pagar').selectOption('ONLINE');
  await expect(page.getByText('Ambiente de Teste:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Agendar Atendimento' }).click();
  await expect(page.getByRole('dialog')).toContainText('Use Continuar Pagamento');
  await page.getByRole('button', { name: 'Entendi' }).click();
  await page.getByRole('button', { name: 'Continuar Pagamento' }).click();
  await expect(page).toHaveURL('https://www.mercadopago.com.br/checkout/test');
  await page.goto('/cliente?pagamento=retorno&status=approved');
  await expect(page.getByText('Aguardando Pagamento', { exact: false })).toBeVisible();
  await expect(
    page.getByText('Pagamento Aprovado · Reserva Garantida', { exact: false }),
  ).toHaveCount(0);
});
