import { test, expect } from '@playwright/test';

test('cliente e administração têm paletas distintas ao trocar de área', async ({
  page,
}, testInfo) => {
  await page.route('https://portal-test.supabase.co/**', (route) => route.abort());
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/cliente/entrar');
    await expect(page.locator('app-root')).toHaveAttribute('data-area', 'customer');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toHaveCSS(
      'background-color',
      'rgb(0, 102, 173)',
    );
    await page.screenshot({ path: testInfo.outputPath(`cliente-${width}.png`), fullPage: true });
    await page.goto('/admin/login');
    await expect(page.locator('app-root')).toHaveAttribute('data-area', 'admin');
    await expect(page.locator('.button.primary').first()).toHaveCSS(
      'background-color',
      'rgb(109, 40, 217)',
    );
    await page.screenshot({
      path: testInfo.outputPath(`administracao-${width}.png`),
      fullPage: true,
    });
    await page.goto('/');
    await expect(page.locator('app-root')).toHaveAttribute('data-area', 'public');
    await expect(page.locator('.home-nav-access .home-button')).toHaveCSS(
      'background-color',
      'rgb(249, 211, 41)',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
