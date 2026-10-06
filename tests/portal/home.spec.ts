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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bem cuidado.');
  for (const name of ['Lavagem americana simples', 'Lavagem SUV', 'Caminhonete', 'Moto']) {
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
  await expect(page.getByRole('heading', { name: 'Entre para agendar' })).toBeVisible();
  await page.goto('/admin/caixa');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
});

test('login, cadastro e acesso administrativo têm formulários e navegação separados', async ({
  page,
}) => {
  await page.route('https://portal-test.supabase.co/**', (route) => route.abort());
  await page.goto('/cliente/entrar');
  await expect(page.getByRole('heading', { name: 'Entre para agendar' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Recuperar acesso' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
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
