import { webcrypto as crypto } from 'node:crypto';
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
async function bootstrap(target) {
  await target.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant all on sequences to anon,authenticated;alter default privileges in schema public grant all on functions to anon,authenticated;`,
  );
}
before(async () => {
  await bootstrap(db);
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
  assert.equal((await db.query('select * from public.parada_audit_logs')).rows.length, 0);
  await asUser(ids.admin);
  const r = (await db.query("select public.management_report('2026-01-01','2026-12-31') as data"))
    .rows[0].data;
  assert.equal(Number(r.revenue), 80);
  assert.equal(r.completed, 1);
  assert.ok((await db.query('select * from public.parada_audit_logs')).rows.length > 5);
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

function migrationSql(file) {
  return readFileSync('supabase/migrations/' + file, 'utf8').replace(
    'create extension if not exists pgcrypto;',
    '',
  );
}
test('migrations dependentes falham cedo quando o schema está ausente', async () => {
  const target = new PGlite();
  try {
    await bootstrap(target);
    for (const file of readdirSync('supabase/migrations').sort().slice(1)) {
      await assert.rejects(target.exec(migrationSql(file)), /Pré-requisito ausente.*001_schema/);
      await target.exec('rollback');
    }
    assert.equal(
      (await target.query("select to_regprocedure('public.finance_summary()') as fn")).rows[0].fn,
      null,
    );
  } finally {
    await target.close();
  }
});
test('recupera colisão de audit_logs e funções previamente criadas sem alterar dados ou permissões existentes', async () => {
  const target = new PGlite();
  try {
    await bootstrap(target);
    await target.exec(`create table public.audit_logs(id bigint generated always as identity, payload text);
      insert into public.audit_logs(payload) values ('histórico existente');
      revoke all on public.audit_logs from authenticated;
      grant select on public.audit_logs to anon;`);
    const legacy = (
      await target.query(
        "select relacl::text as acl from pg_class where oid='public.audit_logs'::regclass",
      )
    ).rows[0].acl;
    const files = readdirSync('supabase/migrations').sort();
    // Reproduce the original collision and its transaction rollback.
    await assert.rejects(
      target.exec(migrationSql(files[0]).replaceAll('parada_audit_logs', 'audit_logs')),
      /relation "audit_logs" already exists/,
    );
    await target.exec('rollback');
    assert.equal(
      (
        await target.query(
          "select to_regtype('public.app_role') as role, to_regclass('public.customers') as customers",
        )
      ).rows[0].role,
      null,
    );
    assert.equal(
      (await target.query("select to_regclass('public.customers') as customers")).rows[0].customers,
      null,
    );
    // These signatures were left behind by the successful 003 and 006 runs.
    await target.exec(`create function public.management_report(start_date date,end_date date) returns jsonb language plpgsql as $$begin return '{}'::jsonb; end$$;
      create function public.dashboard_summary() returns jsonb language plpgsql as $$begin return '{}'::jsonb; end$$;
      create function public.finance_summary() returns jsonb language plpgsql as $$begin return '{}'::jsonb; end$$;`);
    for (const file of files) await target.exec(migrationSql(file));
    assert.equal(
      (await target.query('select payload from public.audit_logs')).rows[0].payload,
      'histórico existente',
    );
    assert.equal(
      (
        await target.query(
          "select relacl::text as acl from pg_class where oid='public.audit_logs'::regclass",
        )
      ).rows[0].acl,
      legacy,
    );
    assert.equal(
      (
        await target.query(
          "select has_sequence_privilege('anon','public.audit_logs_id_seq','USAGE') as allowed",
        )
      ).rows[0].allowed,
      true,
    );
    await target.exec(
      `insert into auth.users values ('${ids.admin}'); insert into public.profiles(id,name,role) values ('${ids.admin}','Administrador','administrador');`,
    );
    await target.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.admin]);
    await target.exec('set role authenticated');
    const result = (
      await target.query(
        'select public.management_report(current_date,current_date) as report, public.dashboard_summary() as dashboard, public.finance_summary() as finance',
      )
    ).rows[0];
    assert.equal(result.finance.balance, 0);
    assert.ok(Object.keys(result.report).length > 0);
    assert.ok(Object.keys(result.dashboard).length > 0);
    assert.ok((await target.query('select * from public.parada_audit_logs')).rows.length > 0);
  } finally {
    await target.close();
  }
});

const portalUser = '00000000-0000-4000-8000-000000000004';
const otherPortalUser = '00000000-0000-4000-8000-000000000005';
let portalCustomer, portalVehicle, portalAppointment;
test('cadastro público cria apenas vínculo de cliente e é idempotente', async () => {
  await asUser(null, 'anon');
  await assert.rejects(
    db.query("select public.register_customer('Cliente','11987654321')"),
    /permission denied/,
  );
  await asUser(ids.admin);
  await assert.rejects(
    db.query("select public.register_customer('Equipe','11987654321')"),
    /Acesso não permitido/,
  );
  await db.exec('reset role');
  await db.exec(`insert into auth.users values ('${portalUser}'),('${otherPortalUser}')`);
  await asUser(portalUser);
  await assert.rejects(
    db.query("select public.register_customer('X','123')"),
    /nome e telefone válidos/,
  );
  portalCustomer = (
    await db.query("select public.register_customer('Cliente do portal','11987654321') as id")
  ).rows[0].id;
  assert.equal(
    (await db.query("select public.register_customer('Outro nome','11987654321') as id")).rows[0]
      .id,
    portalCustomer,
  );
  assert.equal((await db.query('select * from public.customers')).rows.length, 1);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  await assert.rejects(
    db.query(
      `insert into public.profiles(id,name,role) values ('${portalUser}','Invasor','administrador')`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.query('update public.customer_accounts set customer_id=$1', [ids.customer]),
    /permission denied/,
  );
});
test('cliente cadastra somente veículo próprio e não altera operações internas', async () => {
  await asUser(portalUser);
  portalVehicle = (
    await db.query(
      "select public.portal_add_vehicle('DEF-4G56','Ford','Ka','Branco','carro') as id",
    )
  ).rows[0].id;
  const vehicles = (await db.query('select * from public.vehicles')).rows;
  assert.equal(vehicles.length, 1);
  assert.equal(vehicles[0].customer_id, portalCustomer);
  assert.equal(vehicles[0].plate, 'DEF4G56');
  assert.equal((await db.query('select * from public.work_orders')).rows.length, 0);
  assert.equal((await db.query('select * from public.payments')).rows.length, 0);
  await assert.rejects(db.query('select public.open_register(0)'), /Acesso não permitido/);
  await assert.rejects(
    db.query(
      "insert into public.appointments(customer_id,vehicle_id,service_id,starts_at,duration_minutes) values ($1,$2,$3,now()+interval '30 days',60)",
      [portalCustomer, portalVehicle, ids.service],
    ),
    /row-level security/,
  );
});
test('agendamento do cliente usa duração do catálogo e rejeita veículo alheio, passado e excesso de capacidade', async () => {
  await asUser(portalUser);
  await assert.rejects(
    db.query("select public.portal_book($1,$2,now()+interval '300 days','')", [
      ids.vehicle,
      ids.service,
    ]),
    /Veículo não pertence/,
  );
  await assert.rejects(
    db.query("select public.portal_book($1,$2,now()-interval '1 day','')", [
      portalVehicle,
      ids.service,
    ]),
    /horário futuro/,
  );
  const query =
    "select public.portal_book($1,$2,date_trunc('day',now())+interval '300 days 12 hours','') as id";
  portalAppointment = (await db.query(query, [portalVehicle, ids.service])).rows[0].id;
  const a = (await db.query('select * from public.appointments')).rows[0];
  assert.equal(a.customer_id, portalCustomer);
  assert.equal(a.status, 'AGENDADO');
  assert.equal(a.duration_minutes, 60);
  await db.query(query, [portalVehicle, ids.service]);
  await assert.rejects(
    db.query(query, [portalVehicle, ids.service]),
    /Horário sem disponibilidade/,
  );
  assert.equal((await db.query('select * from public.appointments')).rows.length, 2);
});
test('outro cliente não lê nem cancela agendamentos alheios; equipe visualiza a reserva', async () => {
  await asUser(otherPortalUser);
  await db.query("select public.register_customer('Segundo cliente','11999999999')");
  assert.equal((await db.query('select * from public.vehicles')).rows.length, 0);
  assert.equal((await db.query('select * from public.appointments')).rows.length, 0);
  await assert.rejects(
    db.query('select public.portal_cancel($1)', [portalAppointment]),
    /não pode ser cancelado/,
  );
  await asUser(ids.attendant);
  assert.equal(
    (await db.query('select customer_id from public.appointments where id=$1', [portalAppointment]))
      .rows[0].customer_id,
    portalCustomer,
  );
  await asUser(portalUser);
  await db.query('select public.portal_cancel($1)', [portalAppointment]);
  assert.equal(
    (await db.query('select status from public.appointments where id=$1', [portalAppointment]))
      .rows[0].status,
    'CANCELADO',
  );
  await assert.rejects(
    db.query('select public.portal_cancel($1)', [portalAppointment]),
    /não pode ser cancelado/,
  );
});
let prepaidBooking;
const prepaidRequest = '00000000-0000-4000-8000-000000000099';
test('pré-pagamento usa preço do banco, preserva idempotência e isola acesso', async () => {
  await asUser(portalUser);
  const args = [portalVehicle, ids.service, 'PIX', prepaidRequest];
  const sql =
    "select public.portal_book_prepaid($1,$2,date_trunc('day',now())+interval '310 days 12 hours','',$3,$4) as id";
  prepaidBooking = (await db.query(sql, args)).rows[0].id;
  assert.equal((await db.query(sql, args)).rows[0].id, prepaidBooking);
  const p = (
    await db.query('select * from public.appointment_payments where appointment_id=$1', [
      prepaidBooking,
    ])
  ).rows[0];
  const service = (await db.query('select price from public.services where id=$1', [ids.service]))
    .rows[0];
  assert.equal(Number(p.amount), Number(service.price));
  assert.equal(p.status, 'PENDING');
  await assert.rejects(
    db.query("update public.appointment_payments set status='APPROVED'"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select public.apply_booking_payment($1,'123','approved',$2,'BRL',false)", [
      prepaidBooking,
      p.amount,
    ]),
    /permission denied/,
  );
  await asUser(otherPortalUser);
  assert.equal((await db.query('select * from public.appointment_payments')).rows.length, 0);
  await asUser(ids.admin);
  await assert.rejects(
    db.query("update public.appointments set status='CONFIRMADO' where id=$1", [prepaidBooking]),
    /Aguarde a aprovação/,
  );
});
test('webhook valida valor/moeda/modo; aprovação confirma reserva e é idempotente', async () => {
  await db.exec('reset role');
  const p = (
    await db.query('select * from public.appointment_payments where appointment_id=$1', [
      prepaidBooking,
    ])
  ).rows[0];
  const sql = "select public.apply_booking_payment($1,'123',$2,$3,$4,$5) as status";
  for (const args of [
    [prepaidBooking, 'approved', Number(p.amount) + 1, 'BRL', false],
    [prepaidBooking, 'approved', p.amount, 'USD', false],
    [prepaidBooking, 'approved', p.amount, 'BRL', true],
  ])
    await assert.rejects(db.query(sql, args), /incompatível/);
  assert.equal(
    (await db.query(sql, [prepaidBooking, 'approved', p.amount, 'BRL', false])).rows[0].status,
    'APPROVED',
  );
  assert.equal(
    (await db.query(sql, [prepaidBooking, 'approved', p.amount, 'BRL', false])).rows[0].status,
    'APPROVED',
  );
  assert.equal(
    (await db.query(sql, [prepaidBooking, 'pending', p.amount, 'BRL', false])).rows[0].status,
    'APPROVED',
  );
  assert.equal(
    (await db.query('select status from public.appointments where id=$1', [prepaidBooking])).rows[0]
      .status,
    'CONFIRMADO',
  );
  await asUser(portalUser);
  await assert.rejects(
    db.query('select public.portal_cancel($1)', [prepaidBooking]),
    /Entre em contato/,
  );
  await asUser(ids.admin);
  await assert.rejects(
    db.query("update public.appointments set starts_at=starts_at+interval '1 hour' where id=$1", [
      prepaidBooking,
    ]),
    /solicite revisão/,
  );
});
test('checkout bloqueia criação concorrente e vencimento libera horário sem garantir aprovação tardia', async () => {
  await asUser(portalUser);
  const aid = (
    await db.query(
      "select public.portal_book_prepaid($1,$2,date_trunc('day',now())+interval '320 days 12 hours','','CREDITO',$3) as id",
      [portalVehicle, ids.service, crypto.randomUUID()],
    )
  ).rows[0].id;
  await db.exec('reset role');
  assert.equal(
    (await db.query('select public.claim_booking_checkout($1) as claimed', [aid])).rows[0].claimed,
    true,
  );
  assert.equal(
    (await db.query('select public.claim_booking_checkout($1) as claimed', [aid])).rows[0].claimed,
    false,
  );
  await db.query(
    "update public.appointment_payments set expires_at=now()-interval '1 second' where appointment_id=$1",
    [aid],
  );
  await asUser(portalUser);
  await db.query(
    "select public.portal_book($1,$2,date_trunc('day',now())+interval '320 days 12 hours','')",
    [portalVehicle, ids.service],
  );
  assert.equal(
    (await db.query('select status from public.appointments where id=$1', [aid])).rows[0].status,
    'CANCELADO',
  );
  await db.exec('reset role');
  const amount = (
    await db.query('select amount from public.appointment_payments where appointment_id=$1', [aid])
  ).rows[0].amount;
  assert.equal(
    (
      await db.query(
        "select public.apply_booking_payment($1,'456','approved',$2,'BRL',false) as status",
        [aid, amount],
      )
    ).rows[0].status,
    'REVIEW',
  );
  assert.equal(
    (await db.query('select status from public.appointments where id=$1', [aid])).rows[0].status,
    'CANCELADO',
  );
});
test('reembolso integral remove confirmação e não pode ser revertido por webhook antigo', async () => {
  await db.exec('reset role');
  const amount = (
    await db.query('select amount from public.appointment_payments where appointment_id=$1', [
      prepaidBooking,
    ])
  ).rows[0].amount;
  const sql = "select public.apply_booking_payment($1,'123',$2,$3,'BRL',false) as status";
  assert.equal(
    (await db.query(sql, [prepaidBooking, 'refunded', amount])).rows[0].status,
    'REFUNDED',
  );
  assert.equal(
    (await db.query(sql, [prepaidBooking, 'approved', amount])).rows[0].status,
    'REFUNDED',
  );
  assert.equal(
    (await db.query('select status from public.appointments where id=$1', [prepaidBooking])).rows[0]
      .status,
    'CANCELADO',
  );
});
test('cliente desativado perde acesso ao portal e às reservas', async () => {
  await asUser(ids.admin);
  await db.query('update public.customers set active=false where id=$1', [portalCustomer]);
  await asUser(portalUser);
  assert.equal((await db.query('select * from public.appointments')).rows.length, 0);
  assert.equal((await db.query('select * from public.services')).rows.length, 0);
  await assert.rejects(
    db.query("select public.portal_add_vehicle('GHI7J89','Ford','Ka')"),
    /Acesso não permitido/,
  );
});

test('migration 008 remove somente o bloqueio legado e não cria perfil administrativo', async () => {
  const target = new PGlite();
  try {
    await bootstrap(target);
    for (const file of readdirSync('supabase/migrations')
      .sort()
      .filter((f) => !f.includes('008_customer_signup'))) {
      await target.exec(
        readFileSync('supabase/migrations/' + file, 'utf8').replace(
          'create extension if not exists pgcrypto;',
          '',
        ),
      );
    }
    await target.exec(`create function public.create_user_profile() returns trigger language plpgsql as $$begin raise exception using errcode='42501',message='Master provisioning required'; end$$;
      create constraint trigger on_auth_user_created after insert on auth.users deferrable initially deferred for each row execute function public.create_user_profile();`);
    await assert.rejects(
      target.exec(`insert into auth.users values ('${ids.customer}')`),
      /Master provisioning required/,
    );
    const migration = readFileSync('supabase/migrations/202610070008_customer_signup.sql', 'utf8');
    await target.exec(migration);
    await target.exec(migration);
    await target.exec(`insert into auth.users values ('${ids.customer}')`);
    assert.equal((await target.query('select * from public.profiles')).rows.length, 0);
    assert.equal((await target.query('select * from public.customer_accounts')).rows.length, 0);
    await target.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.customer]);
    await target.exec('set role authenticated');
    await target.query("select public.register_customer('Cliente de teste','61999998888')");
    assert.equal((await target.query('select * from public.customer_accounts')).rows.length, 1);
    assert.equal((await target.query('select * from public.profiles')).rows.length, 0);
    await target.exec('reset role');
    await target.exec(readFileSync('supabase/diagnostics/rollback-customer-signup.sql', 'utf8'));
    await assert.rejects(
      target.exec(`insert into auth.users values ('${ids.service}')`),
      /Master provisioning required/,
    );
  } finally {
    await target.close();
  }
});

test('confirmação cria uma única OS na fila e cancelamento preserva o histórico', async () => {
  await asUser(ids.admin);
  const booking = crypto.randomUUID();
  await db.query(
    `insert into public.appointments(id,customer_id,vehicle_id,service_id,starts_at,duration_minutes,status)
    values($1,$2,$3,$4,now()+interval '250 days',60,'AGENDADO')`,
    [booking, ids.customer, ids.vehicle, ids.service],
  );
  assert.equal(
    (await db.query('select id from public.work_orders where appointment_id=$1', [booking])).rows
      .length,
    0,
  );
  await db.query("update public.appointments set status='CONFIRMADO' where id=$1", [booking]);
  const order = (
    await db.query('select * from public.work_orders where appointment_id=$1', [booking])
  ).rows[0];
  assert.equal(order.status, 'AGUARDANDO');
  assert.equal(order.customer_id, ids.customer);
  assert.equal(order.vehicle_id, ids.vehicle);
  const price = (await db.query('select price from public.services where id=$1', [ids.service]))
    .rows[0].price;
  assert.equal(Number(order.total), Number(price));
  assert.equal(
    (await db.query('select * from public.work_order_items where work_order_id=$1', [order.id]))
      .rows.length,
    1,
  );
  await db.query(
    "update public.appointments set status='CONFIRMADO', starts_at=starts_at+interval '1 hour' where id=$1",
    [booking],
  );
  assert.equal(
    (await db.query('select id from public.work_orders where appointment_id=$1', [booking])).rows
      .length,
    1,
  );
  const updated = (
    await db.query('select expected_at from public.work_orders where id=$1', [order.id])
  ).rows[0];
  assert.equal(
    new Date(updated.expected_at).getTime() - new Date(order.expected_at).getTime(),
    3600000,
  );
  await db.query("select public.transition_order($1,'EM_SERVICO')", [order.id]);
  await assert.rejects(
    db.query("update public.appointments set status='CANCELADO' where id=$1", [booking]),
    /não pode ser cancelada/,
  );
  await db.exec('reset role');
  await db.query("update public.work_orders set status='AGUARDANDO' where id=$1", [order.id]);
  await asUser(ids.admin);
  await db.query("update public.appointments set status='CANCELADO' where id=$1", [booking]);
  assert.equal(
    (await db.query('select status from public.work_orders where id=$1', [order.id])).rows[0]
      .status,
    'CANCELADO',
  );
  await assert.rejects(
    db.query("update public.appointments set status='CONFIRMADO' where id=$1", [booking]),
    /OS cancelada/,
  );
  await assert.rejects(
    db.query('select public.ensure_appointment_work_order($1)', [booking]),
    /permission denied/,
  );
});

test('migration da fila recupera confirmados sem exigir pagamentos online', async () => {
  const target = new PGlite();
  try {
    await bootstrap(target);
    for (const file of readdirSync('supabase/migrations')
      .sort()
      .filter((f) => !f.includes('009_') && !f.includes('010_'))) {
      await target.exec(
        readFileSync('supabase/migrations/' + file, 'utf8').replace(
          'create extension if not exists pgcrypto;',
          '',
        ),
      );
    }
    await target.exec(`insert into public.customers(id,name,phone) values('${ids.customer}','Cliente','11987654321');
      insert into public.vehicles(id,customer_id,plate,brand,model) values('${ids.vehicle}','${ids.customer}','ABC1D23','Marca','Modelo');
      insert into public.services(id,name,price,duration_minutes) values('${ids.service}','Lavagem',85,60);
      insert into public.appointments(customer_id,vehicle_id,service_id,starts_at,duration_minutes,status) values('${ids.customer}','${ids.vehicle}','${ids.service}',now()+interval '1 day',60,'CONFIRMADO');`);
    await target.exec(
      readFileSync('supabase/migrations/202610080010_appointment_work_orders.sql', 'utf8'),
    );
    const orders = (await target.query('select * from public.work_orders')).rows;
    assert.equal(orders.length, 1);
    assert.equal(orders[0].status, 'AGUARDANDO');
    assert.equal(orders[0].created_by, null);
    assert.equal(Number(orders[0].total), 85);
  } finally {
    await target.close();
  }
});
