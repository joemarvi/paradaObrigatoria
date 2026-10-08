import { expect, test } from '@playwright/test';

test('validação administrativa usa modal e retorna ao formulário', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'Abrir demonstração' }).click();
  await page.locator('nav').getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  const feedback = page.getByRole('dialog', { name: 'Revise as Informações' });
  await expect(feedback).toContainText('Nome completo');
  await expect(feedback).toContainText('Telefone');
  await feedback.getByRole('button', { name: 'Entendi' }).click();
  await expect(feedback).toHaveCount(0);
  await expect(page.getByRole('dialog').getByLabel('Nome completo')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
