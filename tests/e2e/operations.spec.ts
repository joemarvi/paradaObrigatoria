import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/login/);
  await page.getByRole('button', { name: 'Abrir demonstração' }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
});
test('rotas e indicadores sem erros de execução', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [path, title] of [
    ['clientes', 'Clientes'],
    ['veiculos', 'Veículos'],
    ['servicos', 'Serviços'],
    ['funcionarios', 'Equipe'],
    ['agendamentos', 'Agendamentos'],
    ['ordens-servico', 'Ordens de serviço'],
    ['fila', 'Fila de atendimento'],
    ['pagamentos', 'Pagamentos'],
    ['caixa', 'Caixa'],
    ['relatorios', 'Relatórios'],
    ['configuracoes', 'Configurações'],
  ]) {
    await page.locator('nav').getByRole('link', { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/' + path + '$'));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('cadastro de cliente e veículo com busca e validação', async ({ page }) => {
  await page.locator('nav').getByRole('link', { name: 'Clientes', exact: true }).click();
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome completo').fill('Cliente Integração');
  await dialog.getByLabel('Telefone').fill('(11) 91234-5678');
  await dialog.getByLabel('CPF / CNPJ').fill('11111111111');
  await dialog.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(dialog.getByText('Informe um CPF ou CNPJ válido.')).toBeVisible();
  await dialog.getByLabel('CPF / CNPJ').fill('529.982.247-25');
  await dialog.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Pesquisar registros' }).fill('Cliente Integração');
  await expect(page.getByRole('cell', { name: 'Cliente Integração', exact: true })).toBeVisible();
  await page.locator('nav').getByRole('link', { name: 'Veículos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo veículo' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Cliente')
    .selectOption({ label: 'Cliente Integração' });
  await page.getByRole('dialog').getByLabel('Placa').fill('XYZ9A12');
  await page.getByRole('dialog').getByLabel('Marca').fill('Fiat');
  await page.getByRole('dialog').getByLabel('Modelo').fill('Argo');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Pesquisar registros' }).fill('(11) 91234-5678');
  await expect(page.getByText('XYZ9A12')).toBeVisible();
});
test('entrada, serviço, pagamento dividido, saída e fechamento do caixa', async ({ page }) => {
  await page.locator('nav').getByRole('link', { name: 'Ordens de serviço', exact: true }).click();
  await page.getByRole('button', { name: 'Nova entrada' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Veículo / placa').selectOption('v2');
  await dialog.getByLabel('Lavagem completa').check();
  await dialog.getByLabel('Desconto (R$)').fill('5');
  await dialog.getByRole('button', { name: 'Registrar entrada' }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.order-card').filter({ hasText: '#1043' });
  await card.getByRole('button', { name: 'Iniciar serviço' }).click();
  await card.getByRole('button', { name: 'Serviço concluído' }).click();
  await page.locator('nav').getByRole('link', { name: 'Pagamentos', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: '#1043' })
    .getByRole('button', { name: 'Receber' })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor (R$)', { exact: true }).fill('50');
  await dialog.getByLabel('Dividir entre duas formas de pagamento').check();
  await dialog.getByLabel('Segundo valor (R$)').fill('30');
  await dialog.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: '#1043' })).toHaveCount(2);
  await page.locator('nav').getByRole('link', { name: 'Ordens de serviço', exact: true }).click();
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: '#1043' })
    .getByRole('button', { name: 'Detalhes' })
    .click();
  await page.getByRole('button', { name: 'Registrar saída' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('nav').getByRole('link', { name: 'Caixa', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar caixa', exact: true }).click();
  await page.getByLabel('Dinheiro contado (R$)').fill('130');
  await page.getByRole('button', { name: 'Confirmar fechamento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir caixa', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'R$ 0,00', exact: true }).first()).toBeVisible();
});
test('agenda confirma, remarca e cancela com confirmação', async ({ page }) => {
  await page.locator('nav').getByRole('link', { name: 'Agendamentos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Veículo / cliente').selectOption('v3');
  await dialog.getByLabel('Serviço', { exact: false }).selectOption('s1');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await dialog.getByLabel('Data e horário').fill(tomorrow + 'T10:00');
  await dialog.getByLabel('Status').selectOption('CONFIRMADO');
  await dialog.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  const item = page.locator('.appointment-item').filter({ hasText: 'GHI7J89' });
  await item.getByRole('button', { name: 'Editar / remarcar' }).click();
  await page.getByLabel('Data e horário').fill(tomorrow + 'T11:00');
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(item).toContainText('11:00');
  await item.getByRole('button', { name: 'Editar / remarcar' }).click();
  await page.getByRole('button', { name: 'Cancelar agendamento', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(item).toContainText('Cancelado');
});
test('menu mobile, responsividade e proteção após sair', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.locator('nav').getByRole('link', { name: 'Fila de atendimento', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fila de atendimento', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/caixa');
  await expect(page).toHaveURL(/login/);
});
test('relatório permite filtros e exportação CSV', async ({ page }) => {
  await page.locator('nav').getByRole('link', { name: 'Relatórios', exact: true }).click();
  await expect(page.getByText('R$ 50,00', { exact: true }).first()).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('parada-obrigatoria-relatorio.csv');
});
test('layout nas resoluções solicitadas e foco do modal', async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 834, height: 1112 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.locator('nav').getByRole('link', { name: 'Clientes', exact: true }).click();
  const open = page.getByRole('button', { name: 'Novo cliente' });
  await open.click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(open).toBeFocused();
});
