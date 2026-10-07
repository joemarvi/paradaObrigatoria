import { expect, test } from '@playwright/test';

test('cadastro aplica máscara ao digitar e colar e bloqueia letras', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/cliente/cadastro');
  const phone = page.getByLabel('Telefone');
  await expect(phone).toHaveAttribute('placeholder', '(00) 00000-0000');
  await expect(page.getByLabel('E-mail')).toHaveAttribute('placeholder', '@teste.com');
  await phone.pressSequentially('abc11987654321xyz');
  await expect(phone).toHaveValue('(11) 98765-4321');
  await phone.fill('abc21999998888xyz');
  await expect(phone).toHaveValue('(21) 99999-8888');
  expect(errors).toEqual([]);
});
