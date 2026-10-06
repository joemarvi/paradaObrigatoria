-- Single business, closed provisioning: users are invited by the owner in Supabase.
begin;
create extension if not exists pgcrypto;
create type public.app_role as enum ('administrador','gerente','atendente','operador');
create type public.order_status as enum ('AGUARDANDO','EM_SERVICO','AGUARDANDO_PAGAMENTO','FINALIZADO','CANCELADO');
create type public.appointment_status as enum ('AGENDADO','CONFIRMADO','EM_ATENDIMENTO','CONCLUIDO','CANCELADO','NAO_COMPARECEU');
create type public.payment_method as enum ('DINHEIRO','PIX','DEBITO','CREDITO','TRANSFERENCIA','OUTROS');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(trim(name))>1), role public.app_role not null default 'operador',
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>1),
 document text unique check(document is null or document ~ '^([0-9]{11}|[0-9]{14})$'),
 phone text not null check(phone ~ '^[0-9]{10,11}$'), whatsapp text check(whatsapp is null or whatsapp ~ '^[0-9]{10,11}$'),
 email text, address text, notes text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
 plate text not null unique check(plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'), brand text not null, model text not null,
 year integer check(year between 1900 and 2200), color text, type text not null default 'carro' check(type in ('carro','SUV','caminhonete','moto','van','outro')),
 notes text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.service_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.services (
 id uuid primary key default gen_random_uuid(), category_id uuid references public.service_categories(id), name text not null,
 description text, price numeric(12,2) not null check(price>=0), duration_minutes integer not null check(duration_minutes between 1 and 1440),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.employees (
 id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id), name text not null, phone text,
 email text, position text not null, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.work_orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 customer_id uuid not null references public.customers(id), vehicle_id uuid not null references public.vehicles(id),
 employee_id uuid references public.employees(id), status public.order_status not null default 'AGUARDANDO',
 discount numeric(12,2) not null default 0 check(discount>=0), surcharge numeric(12,2) not null default 0 check(surcharge>=0),
 total numeric(12,2) not null check(total>=0), notes text, fuel_level text, vehicle_condition text, belongings text,
 entered_at timestamptz not null default now(), expected_at timestamptz, completed_at timestamptz, exited_at timestamptz,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expected_at is null or expected_at>=entered_at)
);
create table public.work_order_items (
 id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id), service_id uuid references public.services(id),
 name text not null, kind text not null default 'SERVICO' check(kind in ('SERVICO','PRODUTO')),
 quantity integer not null default 1 check(quantity>0), unit_price numeric(12,2) not null check(unit_price>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id), vehicle_id uuid not null references public.vehicles(id),
 service_id uuid not null references public.services(id), starts_at timestamptz not null, duration_minutes integer not null check(duration_minutes>0),
 status public.appointment_status not null default 'AGENDADO', notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cash_registers (
 id uuid primary key default gen_random_uuid(), opened_by uuid not null default auth.uid() references public.profiles(id),
 opened_at timestamptz not null default now(), opening_amount numeric(12,2) not null check(opening_amount>=0),
 closed_at timestamptz, closed_by uuid references public.profiles(id), closing_amount numeric(12,2), expected_amount numeric(12,2),
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_open_register on public.cash_registers ((true)) where closed_at is null;
create table public.payments (
 id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id),
 cash_register_id uuid not null references public.cash_registers(id), amount numeric(12,2) not null check(amount>0),
 method public.payment_method not null, recorded_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cash_movements (
 id uuid primary key default gen_random_uuid(), cash_register_id uuid not null references public.cash_registers(id),
 payment_id uuid unique references public.payments(id), type text not null check(type in ('ABERTURA','VENDA','SANGRIA','DESPESA','REFORCO','FECHAMENTO')),
 amount numeric(12,2) not null check(amount>=0), description text not null, recorded_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_settings (
 id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton),
 name text not null default 'Parada Obrigatória', phone text, whatsapp text, address text,
 opening_hours text not null default 'Seg–Sáb, 08h às 18h', appointment_capacity integer not null default 2 check(appointment_capacity>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.business_settings default values;
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
 action text not null, entity text not null, record_id uuid not null, created_at timestamptz not null default now()
);
create index customers_search on public.customers(lower(name));
create index customers_phone on public.customers(phone);
create index vehicles_customer on public.vehicles(customer_id);
create index orders_status_entry on public.work_orders(status,entered_at desc);
create index orders_customer on public.work_orders(customer_id,entered_at desc);
create index orders_vehicle on public.work_orders(vehicle_id);
create index orders_employee on public.work_orders(employee_id);
create index items_order on public.work_order_items(work_order_id);
create index appointments_date on public.appointments(starts_at,status);
create index appointments_vehicle on public.appointments(vehicle_id);
create index appointments_customer on public.appointments(customer_id);
create index payments_date on public.payments(created_at);
create index payments_order on public.payments(work_order_id);
create index cash_movements_register on public.cash_movements(cash_register_id,created_at);
create index audit_date on public.audit_logs(created_at desc);

create function public.has_role(roles public.app_role[]) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active and role=any(roles));
$$;
revoke all on function public.has_role(public.app_role[]) from public, anon, authenticated;
grant execute on function public.has_role(public.app_role[]) to authenticated;
create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(actor_id,action,entity,record_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id));
 return coalesce(new,old);
end; $$;
do $$ declare t text; begin
 foreach t in array array['profiles','customers','vehicles','service_categories','services','employees','work_orders','work_order_items','appointments','cash_registers','payments','cash_movements','business_settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create trigger updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);
 end loop;
end; $$;
alter table public.audit_logs enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() or public.has_role(array['administrador','gerente']::public.app_role[]));
create policy manage_profiles on public.profiles for all to authenticated using(public.has_role(array['administrador']::public.app_role[])) with check(public.has_role(array['administrador']::public.app_role[]));
-- No automatic profile trigger: no self registration, no privilege escalation through user metadata.
do $$ declare t text; begin
 foreach t in array array['customers','vehicles','services','service_categories','employees','appointments','work_orders','work_order_items','business_settings'] loop
 execute format('create policy staff_read on public.%I for select to authenticated using(public.has_role(array[''administrador'',''gerente'',''atendente'',''operador'']::public.app_role[]))',t);
 end loop;
 foreach t in array array['customers','vehicles','appointments'] loop
 execute format('create policy office_insert on public.%I for insert to authenticated with check(public.has_role(array[''administrador'',''gerente'',''atendente'']::public.app_role[]))',t);
 execute format('create policy office_update on public.%I for update to authenticated using(public.has_role(array[''administrador'',''gerente'',''atendente'']::public.app_role[])) with check(public.has_role(array[''administrador'',''gerente'',''atendente'']::public.app_role[]))',t);
 end loop;
 foreach t in array array['services','service_categories','employees','business_settings'] loop
 execute format('create policy management_insert on public.%I for insert to authenticated with check(public.has_role(array[''administrador'',''gerente'']::public.app_role[]))',t);
 execute format('create policy management_update on public.%I for update to authenticated using(public.has_role(array[''administrador'',''gerente'']::public.app_role[])) with check(public.has_role(array[''administrador'',''gerente'']::public.app_role[]))',t);
 end loop;
 foreach t in array array['payments','cash_registers','cash_movements'] loop
 execute format('create policy finance_read on public.%I for select to authenticated using(public.has_role(array[''administrador'',''gerente'',''atendente'']::public.app_role[]))',t);
 end loop;
end; $$;
create policy audit_read on public.audit_logs for select to authenticated using(public.has_role(array['administrador','gerente']::public.app_role[]));
-- RPC only writes for monetary and order state operations. Immutable history.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update on public.profiles,public.customers,public.vehicles,public.services,public.service_categories,public.employees,public.appointments,public.business_settings to authenticated;
revoke insert,update,delete on public.work_orders,public.work_order_items,public.payments,public.cash_registers,public.cash_movements,public.audit_logs from authenticated;
commit;
