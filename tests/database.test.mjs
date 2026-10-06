import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  operator: '00000000-0000-4000-8000-000000000002',
  attendant: '00000000-0000-4000-8000-000000000003',
  customer: '00000000-0000-4000-8000-000000000011',
  vehicle: '00000000-0000-4000-8000-000000000012',
  service: '00000000-0000-4000-8000-000000000013',
};
async function asUser(id, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
  await db.exec(`set role ${role}`);
}
before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant all on sequences to anon,authenticated;alter default privileges in schema public grant all on functions to anon,authenticated;`,
  );
  for (const file of readdirSync('supabase/migrations').sort()) {
    // PGlite has gen_random_uuid built in, but not the optional pgcrypto extension.
    const sql = readFileSync('supabase/migrations/' + file, 'utf8').replace(
      'create extension if not exists pgcrypto;',
      '',
    );
    await db.exec(sql);
  }
  await db.exec(
    `insert into auth.users values ('${ids.admin}'),('${ids.operator}'),('${ids.attendant}');insert into public.profiles(id,name,role) values('${ids.admin}','Administrador','administrador'),('${ids.operator}','Operador','operador'),('${ids.attendant}','Atendente','atendente');insert into public.customers(id,name,phone) values('${ids.customer}','Cliente de teste','11987654321');insert into public.vehicles(id,customer_id,plate,brand,model) values('${ids.vehicle}','${ids.customer}','ABC1D23','Marca','Modelo');insert into public.services(id,name,price,duration_minutes) values('${ids.service}','Lavagem',85,60);`,
  );
});
after(async () => await db.close());
let orderId;
test('anônimo não lê dados operacionais', async () => {
  await asUser(null, 'anon');
  await assert.rejects(db.query('select * from public.customers'), /permission denied/);
});
test('operador consulta fila mas não lê pagamentos ou promove seu perfil', async () => {
  await asUser(ids.operator);
  assert.equal((await db.query('select * from public.customers')).rows.length, 1);
  assert.equal((await db.query('select * from public.payments')).rows.length, 0);
  assert.equal(
    (
      await db.query("update public.profiles set role='administrador' where id=$1 returning id", [
        ids.operator,
      ])
    ).rows.length,
    0,
  );
  await assert.rejects(db.query('select public.open_register(100)'), /Acesso não permitido/);
  await assert.rejects(
    db.query("insert into public.customers(name,phone) values('Bloqueado','11987654321')"),
    /row-level security/,
  );
});
test('atendente cria OS e snapshot de preço não muda com catálogo', async () => {
  await asUser(ids.attendant);
  const payload = {
    customer_id: ids.customer,
    vehicle_id: ids.vehicle,
    service_ids: [ids.service],
    discount: 5,
    surcharge: 0,
  };
  orderId = (
    await db.query('select public.create_work_order($1::jsonb) as id', [JSON.stringify(payload)])
  ).rows[0].id;
  assert.equal(
    Number(
      (await db.query('select total from public.work_orders where id=$1', [orderId])).rows[0].total,
    ),
    80,
  );
  await asUser(ids.admin);
  await db.query('update public.services set price=100 where id=$1', [ids.service]);
  assert.equal(
    Number(
      (
        await db.query('select unit_price from public.work_order_items where work_order_id=$1', [
          orderId,
        ])
      ).rows[0].unit_price,
    ),
    85,
  );
});
test('cliente e veículo incompatíveis não deixam OS parcial', async () => {
  await asUser(ids.attendant);
  const before = (await db.query('select count(*) as n from public.work_orders')).rows[0].n;
  await assert.rejects(
    db.query('select public.create_work_order($1::jsonb)', [
      JSON.stringify({
        customer_id: ids.admin,
        vehicle_id: ids.vehicle,
        service_ids: [ids.service],
      }),
    ]),
    /Veículo e cliente inválidos/,
  );
  assert.equal((await db.query('select count(*) as n from public.work_orders')).rows[0].n, before);
});
test('ordem só avança pelas etapas permitidas e operador não cancela', async () => {
  await asUser(ids.operator);
  await assert.rejects(
    db.query("select public.transition_order($1,'FINALIZADO')", [orderId]),
    /Transição/,
  );
  await assert.rejects(
    db.query("select public.transition_order($1,'CANCELADO')", [orderId]),
    /Acesso/,
  );
  await db.query("select public.transition_order($1,'EM_SERVICO')", [orderId]);
  await db.query("select public.transition_order($1,'AGUARDANDO_PAGAMENTO')", [orderId]);
});
test('pagamento exige caixa, valida saldo e é atômico', async () => {
  await asUser(ids.attendant);
  await assert.rejects(
    db.query('select public.record_payment($1,$2::jsonb)', [
      orderId,
      JSON.stringify([{ amount: 80, method: 'PIX' }]),
    ]),
    /Abra o caixa/,
  );
  await db.query('select public.open_register(100)');
  await assert.rejects(db.query('select public.open_register(10)'), /unique/);
  await assert.rejects(
    db.query('select public.record_payment($1,$2::jsonb)', [
      orderId,
      JSON.stringify([
        { amount: 50, method: 'PIX' },
        { amount: 31, method: 'DINHEIRO' },
      ]),
    ]),
    /Pagamento superior/,
  );
  assert.equal((await db.query('select * from public.payments')).rows.length, 0);
  await db.query('select public.record_payment($1,$2::jsonb)', [
    orderId,
    JSON.stringify([
      { amount: 50, method: 'PIX' },
      { amount: 30, method: 'DINHEIRO' },
    ]),
  ]);
  assert.equal(
    (await db.query('select status from public.work_orders where id=$1', [orderId])).rows[0].status,
    'FINALIZADO',
  );
  await assert.rejects(
    db.query('select public.record_payment($1,$2::jsonb)', [
      orderId,
      JSON.stringify([{ amount: 1, method: 'PIX' }]),
    ]),
    /Ordem não disponível/,
  );
});
test('financeiro não pode ser escrito diretamente e saída exige pagamento', async () => {
  await asUser(ids.attendant);
  await assert.rejects(db.query('update public.payments set amount=1'), /permission denied/);
  await db.query('select public.release_vehicle($1)', [orderId]);
  assert.ok(
    (await db.query('select exited_at from public.work_orders where id=$1', [orderId])).rows[0]
      .exited_at,
  );
});
test('saldo considera dinheiro e caixa fechado rejeita movimentos', async () => {
  await asUser(ids.attendant);
  await assert.rejects(
    db.query("select public.move_cash('SANGRIA',131,'Retirada')"),
    /Saldo insuficiente/,
  );
  await db.query("select public.move_cash('SANGRIA',20,'Retirada')");
  await db.query("select public.close_register(110,'Conferido')");
  const r = (await db.query('select expected_amount,closing_amount from public.cash_registers'))
    .rows[0];
  assert.equal(Number(r.expected_amount), 110);
  assert.equal(Number(r.closing_amount), 110);
  await assert.rejects(db.query("select public.move_cash('REFORCO',10,'Troco')"), /Caixa fechado/);
});
test('capacidade de agenda e relacionamento validados no banco', async () => {
  await asUser(ids.attendant);
  const values = [ids.customer, ids.vehicle, ids.service];
  await db.query(
    "insert into public.appointments(customer_id,vehicle_id,service_id,starts_at,duration_minutes) values($1,$2,$3,'2026-10-07T14:00:00-03:00',60)",
    values,
  );
  await db.query(
    "insert into public.appointments(customer_id,vehicle_id,service_id,starts_at,duration_minutes) values($1,$2,$3,'2026-10-07T14:30:00-03:00',60)",
    values,
  );
  await assert.rejects(
    db.query(
      "insert into public.appointments(customer_id,vehicle_id,service_id,starts_at,duration_minutes) values($1,$2,$3,'2026-10-07T14:45:00-03:00',60)",
      values,
    ),
    /Horário sem disponibilidade/,
  );
});
test('relatórios agregam pagamentos e somente gerência acessa auditoria', async () => {
  await asUser(ids.attendant);
  await assert.rejects(
    db.query("select public.management_report('2026-10-01','2026-10-31')"),
    /Acesso não permitido/,
  );
  assert.equal((await db.query('select * from public.audit_logs')).rows.length, 0);
  await asUser(ids.admin);
  const r = (await db.query("select public.management_report('2026-01-01','2026-12-31') as data"))
    .rows[0].data;
  assert.equal(Number(r.revenue), 80);
  assert.equal(r.completed, 1);
  assert.ok((await db.query('select * from public.audit_logs')).rows.length > 5);
});
test('CPF/CNPJ inválido e placa inválida são rejeitados pelo banco', async () => {
  await asUser(ids.attendant);
  await assert.rejects(
    db.query(
      "insert into public.customers(name,phone,document) values('Inválido','11987654321','11111111111')",
    ),
    /document_checksum/,
  );
  await assert.rejects(
    db.query(
      "insert into public.vehicles(customer_id,plate,brand,model) values($1,'INVALIDA','Marca','Modelo')",
      [ids.customer],
    ),
    /check constraint/,
  );
  assert.equal(
    (
      await db.query(
        "select public.valid_document('52998224725') as cpf,public.valid_document('11222333000181') as cnpj",
      )
    ).rows[0].cpf,
    true,
  );
  assert.equal(
    (await db.query("select public.valid_document('11222333000181') as cnpj")).rows[0].cnpj,
    true,
  );
});
test('busca paginada encontra veículo por telefone do cliente e rejeita tabelas fora da lista', async () => {
  await asUser(ids.attendant);
  const data = (
    await db.query("select public.search_catalog('vehicles','11987654321','active',1) as data")
  ).rows[0].data;
  assert.equal(data.total, 1);
  assert.equal(data.rows[0].plate, 'ABC1D23');
  await assert.rejects(
    db.query("select public.search_catalog('payments','', 'all',1)"),
    /Consulta inválida/,
  );
  await asUser(ids.operator);
  await assert.rejects(
    db.query("select public.search_catalog('customers','', 'all',1)"),
    /Acesso não permitido/,
  );
});
test('perfil inativo perde acesso aos dados e às operações', async () => {
  await asUser(ids.admin);
  await db.query('update public.profiles set active=false where id=$1', [ids.operator]);
  await asUser(ids.operator);
  assert.equal((await db.query('select * from public.work_orders')).rows.length, 0);
  await assert.rejects(
    db.query("select public.transition_order($1,'EM_SERVICO')", [orderId]),
    /Acesso não permitido/,
  );
  await asUser(ids.admin);
  await db.query('update public.profiles set active=true where id=$1', [ids.operator]);
  await assert.rejects(
    db.query('update public.profiles set active=false where id=$1', [ids.admin]),
    /próprias permissões/,
  );
});
test('cortesia percorre execução e encerra sem pagamento artificial', async () => {
  await asUser(ids.attendant);
  const oid = (
    await db.query('select public.create_work_order($1::jsonb) as id', [
      JSON.stringify({
        customer_id: ids.customer,
        vehicle_id: ids.vehicle,
        service_ids: [ids.service],
        discount: 100,
        surcharge: 0,
      }),
    ])
  ).rows[0].id;
  await assert.rejects(
    db.query('select public.settle_free_order($1)', [oid]),
    /Ordem não disponível/,
  );
  await db.query("select public.transition_order($1,'EM_SERVICO')", [oid]);
  await db.query("select public.transition_order($1,'AGUARDANDO_PAGAMENTO')", [oid]);
  await db.query('select public.settle_free_order($1)', [oid]);
  assert.equal(
    (await db.query('select status from public.work_orders where id=$1', [oid])).rows[0].status,
    'FINALIZADO',
  );
  assert.equal(
    (await db.query('select * from public.payments where work_order_id=$1', [oid])).rows.length,
    0,
  );
});
test('grants padrão do Supabase não expõem auxiliares ou exclusão de histórico', async () => {
  await asUser(null, 'anon');
  await assert.rejects(
    db.query('select public.register_balance($1)', [ids.admin]),
    /permission denied/,
  );
  await asUser(ids.operator);
  await assert.rejects(
    db.query('select public.register_balance($1)', [ids.admin]),
    /permission denied/,
  );
  await asUser(ids.admin);
  await assert.rejects(
    db.query('delete from public.profiles where id=$1', [ids.operator]),
    /permission denied/,
  );
});
test('totais financeiros e pagamentos parciais independem de paginação', async () => {
  await asUser(ids.attendant);
  await db.query('select public.open_register(100)');
  const oid = (
    await db.query('select public.create_work_order($1::jsonb) as id', [
      JSON.stringify({
        customer_id: ids.customer,
        vehicle_id: ids.vehicle,
        service_ids: [ids.service],
        discount: 0,
        surcharge: 0,
      }),
    ])
  ).rows[0].id;
  await db.query("select public.transition_order($1,'EM_SERVICO')", [oid]);
  await db.query("select public.transition_order($1,'AGUARDANDO_PAGAMENTO')", [oid]);
  await db.query('select public.record_payment($1,$2::jsonb)', [
    oid,
    JSON.stringify([{ amount: 30, method: 'DINHEIRO' }]),
  ]);
  await db.query(
    "select public.move_cash('REFORCO',0.01,'Teste de escala') from generate_series(1,205)",
  );
  const summary = (await db.query('select public.finance_summary() as data')).rows[0].data;
  assert.equal(summary.balance, 132.05);
  assert.equal(summary.pendingAmount, 70);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.paidByOrder[oid], 30);
});
