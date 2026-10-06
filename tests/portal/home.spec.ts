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
  await page.getByRole('link', { name: 'Agendar meu atendimento' }).click();
  await expect(page).toHaveURL(/cliente/);
  await expect(page.getByRole('heading', { name: 'Crie sua conta' })).toBeVisible();
  await page.goto('/caixa');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('heading', { name: 'Entre na sua conta' })).toBeVisible();
});
