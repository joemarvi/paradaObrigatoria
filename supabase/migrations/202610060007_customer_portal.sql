begin;
do $$ begin
 if to_regprocedure('public.finance_summary()') is null or to_regclass('public.parada_audit_logs') is null then
  raise exception 'Pré-requisito ausente: execute 001_schema e as migrations 002 a 006 antes do portal do cliente.';
 end if;
end; $$;
-- Customer identities do not grant any staff role.
create table public.customer_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 customer_id uuid not null unique references public.customers(id),
 created_at timestamptz not null default now()
);
alter table public.customer_accounts enable row level security;
revoke all on public.customer_accounts from public, anon, authenticated;
grant select on public.customer_accounts to authenticated;
create policy own_customer_account on public.customer_accounts for select to authenticated using(user_id=auth.uid());
create function public.portal_customer_id() returns uuid language sql stable security definer set search_path='' as $$
 select a.customer_id from public.customer_accounts a join public.customers c on c.id=a.customer_id
 where a.user_id=auth.uid() and c.active and not exists(select 1 from public.profiles where id=auth.uid());
$$;
create policy portal_customer_read on public.customers for select to authenticated using(id=public.portal_customer_id());
create policy portal_vehicle_read on public.vehicles for select to authenticated using(customer_id=public.portal_customer_id());
create policy portal_appointment_read on public.appointments for select to authenticated using(customer_id=public.portal_customer_id());
create policy portal_service_read on public.services for select to authenticated using(active and public.portal_customer_id() is not null);

create function public.register_customer(customer_name text,customer_phone text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; uid uuid:=auth.uid();
begin
 if uid is null or exists(select 1 from public.profiles where id=uid) then raise exception 'Acesso não permitido'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,61006007));
 select customer_id into cid from public.customer_accounts where user_id=uid;
 if cid is not null then return cid; end if;
 if customer_name is null or length(trim(customer_name)) not between 2 and 120 or customer_phone is null or customer_phone !~ '^[0-9]{10,11}$' then raise exception 'Informe nome e telefone válidos'; end if;
 -- Never claim an existing customer by email, phone or user-controlled metadata.
 insert into public.customers(name,phone) values(trim(customer_name),customer_phone) returning id into cid;
 insert into public.customer_accounts(user_id,customer_id) values(uid,cid);
 return cid;
end; $$;
create function public.portal_add_vehicle(vehicle_plate text,vehicle_brand text,vehicle_model text,vehicle_color text default '',vehicle_type text default 'carro') returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.portal_customer_id(); vid uuid;
begin
 if cid is null then raise exception 'Acesso não permitido'; end if;
 if vehicle_brand is null or vehicle_model is null or length(trim(vehicle_brand)) not between 2 and 80 or length(trim(vehicle_model)) not between 2 and 100 or length(coalesce(vehicle_color,''))>50 then raise exception 'Informe marca, modelo e cor válidos'; end if;
 insert into public.vehicles(customer_id,plate,brand,model,color,type)
 values(cid,upper(regexp_replace(vehicle_plate,'[^A-Za-z0-9]','','g')),trim(vehicle_brand),trim(vehicle_model),nullif(trim(vehicle_color),''),vehicle_type) returning id into vid;
 return vid;
end; $$;
create function public.portal_book(vehicle_id uuid,service_id uuid,starts_at timestamptz,notes text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.portal_customer_id(); duration integer; aid uuid;
begin
 if cid is null then raise exception 'Acesso não permitido'; end if;
 if starts_at is null or starts_at<=now() or starts_at>now()+interval '365 days' then raise exception 'Escolha um horário futuro nos próximos 365 dias'; end if;
 if length(coalesce(notes,''))>1000 then raise exception 'Observações devem ter até 1000 caracteres'; end if;
 if not exists(select 1 from public.vehicles v where v.id=vehicle_id and v.customer_id=cid and v.active) then raise exception 'Veículo não pertence ao cliente'; end if;
 select s.duration_minutes into duration from public.services s where s.id=service_id and s.active;
 if duration is null then raise exception 'Serviço indisponível'; end if;
 insert into public.appointments(customer_id,vehicle_id,service_id,starts_at,duration_minutes,status,notes)
 values(cid,vehicle_id,service_id,starts_at,duration,'AGENDADO',notes) returning id into aid;
 return aid;
end; $$;
create function public.portal_cancel(appointment_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.portal_customer_id();
begin
 if cid is null then raise exception 'Acesso não permitido'; end if;
 update public.appointments a set status='CANCELADO' where a.id=appointment_id and a.customer_id=cid and a.starts_at>now() and a.status in ('AGENDADO','CONFIRMADO');
 if not found then raise exception 'Agendamento não pode ser cancelado'; end if;
end; $$;
revoke all on function public.portal_customer_id(),public.register_customer(text,text),public.portal_add_vehicle(text,text,text,text,text),public.portal_book(uuid,uuid,timestamptz,text),public.portal_cancel(uuid) from public,anon,authenticated;
grant execute on function public.portal_customer_id(),public.register_customer(text,text),public.portal_add_vehicle(text,text,text,text,text),public.portal_book(uuid,uuid,timestamptz,text),public.portal_cancel(uuid) to authenticated;
commit;
