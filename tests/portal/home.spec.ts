import { test, expect } from '@playwright/test';
test('home pública apresenta serviços, preços e contatos sem consultar dados internos', async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://portal-test.supabase.co/**', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bem Cuidado.');
  const careCards = page.locator('.home-care-card');
  await expect(careCards).toHaveCount(4);
  for (const title of [
    'Lavagem Completa',
    'Aspiração Interna',
    'Polimento e Cera',
    'Limpeza de Rodas e Pneus',
  ]) {
    await expect(careCards.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  for (const photo of await careCards.locator('img').all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        photo.evaluate(
          (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }

  await page.evaluate(() => document.fonts.ready);
  const typography = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: [400, 500, 600, 700].every((weight) =>
      document.fonts.check(`${weight} 16px "IBM Plex Sans"`, 'Agendar'),
    ),
  }));
  expect(typography.family).toContain('IBM Plex Sans');
  expect(typography.loaded).toBe(true);

  for (const name of ['Lavagem Americana Simples', 'Lavagem SUV', 'Caminhonete', 'Moto']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  for (const price of ['60,00', '70,00', '80,00', '35,00']) {
    await expect(page.locator('.home-price strong').filter({ hasText: price })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: '(61) 99137-9913' })).toHaveAttribute(
    'href',
    'https://wa.me/5561991379913',
  );
  await expect(page.getByRole('link', { name: '(61) 99170-5891' })).toHaveAttribute(
    'href',
    'https://wa.me/5561991705891',
  );
  await expect(page.getByText('Em frente ao Posto Tiquira.', { exact: false })).toBeVisible();
  for (const [width, height] of [
    [1440, 900],
    [834, 1112],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: testInfo.outputPath('home-' + width + '.png'),
        fullPage: true,
      });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await expect(page.getByText('Acesso da equipe')).toHaveCount(0);
  await page.getByRole('link', { name: 'Agendar meu atendimento' }).click();
  await expect(page).toHaveURL(/cliente/);
  await expect(page.getByRole('heading', { name: 'Entre para Agendar' })).toBeVisible();
  await page.goto('/admin/caixa');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
});

test('login, cadastro e acesso administrativo têm formulários e navegação separados', async ({
  page,
}) => {
  await page.route('https://portal-test.supabase.co/**', (route) => route.abort());
  await page.goto('/cliente/entrar');
  await expect(page.getByRole('heading', { name: 'Entre para Agendar' })).toBeVisible();
  await expect(page.locator('nav, .portal-header')).toHaveCount(0);
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [375, 667],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    expect(layout.width, JSON.stringify({ width, height, layout })).toBeLessThanOrEqual(width);
    expect(layout.height, JSON.stringify({ width, height, layout })).toBeLessThanOrEqual(height);
  }

  await expect(page.getByLabel('Nome completo')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Criar conta', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Criar uma conta' }).click();
  await expect(page).toHaveURL(/cliente\/cadastro/);
  await expect(page.getByLabel('Nome completo')).toBeVisible();
  await expect(page.getByLabel('Confirme sua senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await page.goto('/cliente/recuperar');
  await expect(page.getByRole('heading', { name: 'Recuperar Acesso' })).toBeVisible();
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
  await expect(page.locator('a[href^="/cliente"]')).toHaveCount(0);
  await expect(page.getByText(/Sou cliente/)).toHaveCount(0);
  await expect(page.getByLabel('Nome completo')).toHaveCount(0);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Essa parada não existe.' })).toBeVisible();
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
});

test('cadastro compacto sem navbar ou rolagem e botões de acesso adjacentes', async ({ page }) => {
  await page.route('https://portal-test.supabase.co/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.home-nav nav')).toHaveCSS('text-transform', 'capitalize');
  await expect(
    page.locator('.home-nav-access').getByRole('link', { name: 'Entrar', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.home-nav-access').getByRole('link', { name: 'Agendar', exact: true }),
  ).toBeVisible();
  await page.goto('/cliente/cadastro');
  await expect(page.getByRole('heading', { name: 'Crie sua Conta' })).toBeVisible();
  await expect(page.locator('nav, .portal-header')).toHaveCount(0);
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [390, 844],
    [375, 667],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(dimensions.scrollWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(width);
    expect(dimensions.scrollHeight, JSON.stringify(dimensions)).toBeLessThanOrEqual(height);
  }
});

test('menus da home navegam às seções e às páginas de acesso', async ({ page }) => {
  await page.route('https://portal-test.supabase.co/**', (route) => route.abort());
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Serviços e preços', exact: true }).click();
    await expect
      .poll(() =>
        page.locator('#servicos').evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
      )
      .toBeLessThan(80);
    await page.locator('.home-nav').scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: 'Onde estamos', exact: true }).click();
    await expect(page.locator('#contato')).toBeInViewport();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    for (const [name, destination] of [
      ['Criar conta', '/cliente/cadastro'],
      ['Entrar', '/cliente/entrar'],
      ['Agendar', '/cliente/entrar'],
    ]) {
      await page.goto('/');
      await page.locator('.home-nav').getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(destination + '$'));
    }
  }
});

test('sessão administrativa não devolve menus de acesso do cliente para a home', async ({
  page,
}) => {
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'equipe@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: {},
    app_metadata: {},
  };
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
    const path = new URL(route.request().url()).pathname;
    const result = path.endsWith('/profiles')
      ? { id: user.id, name: 'Equipe', role: 'administrador', active: true }
      : user;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
  for (const [name, destination, title] of [
    ['Entrar', '/cliente/entrar', 'Entre para Agendar'],
    ['Agendar', '/cliente/entrar', 'Entre para Agendar'],
    ['Criar conta', '/cliente/cadastro', 'Crie sua Conta'],
  ]) {
    await page.goto('/');
    await page.locator('.home-nav').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(destination + '$'));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  }
});
