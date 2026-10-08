-- Apply only after migrations 001–008. Secrets belong in Edge Functions, never Angular.
begin;
do $$ begin
 if to_regprocedure('public.portal_book(uuid,uuid,timestamptz,text)') is null then
  raise exception 'Pré-requisito ausente: aplique 001_schema e as migrations 002 a 008.';
 end if;
end $$;
create table public.appointment_payments (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null unique references public.appointments(id),
 request_id uuid not null unique,
 method text not null check(method in ('PIX','CREDITO','DEBITO')),
 amount numeric(12,2) not null check(amount>0),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','EXPIRED','REFUNDED','CHARGEBACK','REVIEW')),
 expires_at timestamptz not null,
 provider_preference_id text,
 checkout_started_at timestamptz,
 checkout_url text,
 provider_payment_id text unique,
 live_mode boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.appointment_payments enable row level security;
revoke all on public.appointment_payments from public,anon,authenticated;
grant select on public.appointment_payments to authenticated;
grant all on public.appointment_payments to service_role;
create policy own_booking_payment on public.appointment_payments for select to authenticated
 using(exists(select 1 from public.appointments a where a.id=appointment_id and a.customer_id=public.portal_customer_id()));
create policy staff_booking_payment on public.appointment_payments for select to authenticated
 using(public.has_role(array['administrador','gerente','atendente']::public.app_role[]));
create trigger online_payment_updated before update on public.appointment_payments for each row execute function public.touch_updated_at();

create function public.expire_booking_payments() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 perform pg_advisory_xact_lock(61006001);
 with expired as (
  update public.appointment_payments set status='EXPIRED'
  where status='PENDING' and expires_at<=now() returning appointment_id
 ) update public.appointments set status='CANCELADO'
 where id in(select appointment_id from expired) and status in('AGENDADO','CONFIRMADO');
 get diagnostics affected=row_count;
 return affected;
end $$;

create function public.portal_book_prepaid(vehicle_id uuid,service_id uuid,starts_at timestamptz,notes text,payment_method text,request_id uuid)
 returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.portal_customer_id(); aid uuid; total numeric;
begin
 if cid is null then raise exception 'Acesso não permitido'; end if;
 if payment_method not in('PIX','CREDITO','DEBITO') or payment_method is null or request_id is null then raise exception 'Forma de pagamento inválida'; end if;
 perform pg_advisory_xact_lock(61006001);
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended(request_id::text,61008009));
 select a.id into aid from public.appointment_payments p join public.appointments a on a.id=p.appointment_id
 where p.request_id=portal_book_prepaid.request_id and a.customer_id=cid;
 if aid is not null then return aid; end if;
 perform public.expire_booking_payments();
 select price into total from public.services where id=service_id and active for share;
 if total is null or total<=0 then raise exception 'Serviço indisponível'; end if;
 if starts_at<=now()+interval '1 minute' then raise exception 'Escolha um horário com pelo menos um minuto de antecedência'; end if;
 aid:=public.portal_book(vehicle_id,service_id,starts_at,notes);
 insert into public.appointment_payments(appointment_id,request_id,method,amount,expires_at)
 values(aid,request_id,payment_method,total,least(now()+interval '15 minutes',starts_at));
 return aid;
end $$;

-- Only the backend may apply a payment fetched directly from Mercado Pago.
create function public.apply_booking_payment(booking_id uuid,payment_id text,payment_status text,paid_amount numeric,paid_currency text,is_live boolean)
 returns text language plpgsql security definer set search_path='' as $$
declare p public.appointment_payments; a public.appointments; next_status text;
begin
 perform pg_advisory_xact_lock(61006001);
 if payment_id is null or payment_id !~ '^[0-9]+$' or payment_status is null then raise exception 'Pagamento inválido'; end if;
 select * into p from public.appointment_payments where appointment_id=booking_id for update;
 if not found then raise exception 'Pagamento não encontrado'; end if;
 select * into a from public.appointments where id=booking_id for update;
 if paid_currency<>'BRL' or paid_currency is null or paid_amount<>p.amount or paid_amount is null or is_live<>p.live_mode or is_live is null then
  raise exception 'Pagamento incompatível com o agendamento';
 end if;
 if p.provider_payment_id is not null and p.provider_payment_id<>payment_id then
  raise exception 'Agendamento já vinculado a outro pagamento';
 end if;
 next_status:=case payment_status when 'approved' then 'APPROVED' when 'rejected' then 'REJECTED' when 'cancelled' then 'REJECTED' when 'refunded' then 'REFUNDED' when 'charged_back' then 'CHARGEBACK' else 'PENDING' end;
 if next_status='PENDING' then return p.status; end if;
 if p.status in('REFUNDED','CHARGEBACK') then return p.status; end if;
 if p.status='REVIEW' and next_status not in('REFUNDED','CHARGEBACK') then return p.status; end if;
 if p.status='APPROVED' and next_status='REJECTED' then return p.status; end if;
 if next_status='APPROVED' and p.status<>'APPROVED' then
  if a.status not in('AGENDADO','CONFIRMADO') or p.expires_at<=now() or a.starts_at<=now() or not exists(select 1 from public.customers where id=a.customer_id and active) or not exists(select 1 from public.vehicles where id=a.vehicle_id and active) or not exists(select 1 from public.services where id=a.service_id and active) then
   next_status:='REVIEW';
  else
   update public.appointment_payments set status='APPROVED' where id=p.id;
   update public.appointments set status='CONFIRMADO' where id=booking_id;
  end if;
 end if;
 update public.appointment_payments set status=next_status,provider_payment_id=payment_id where id=p.id;
 if next_status in('REJECTED','REFUNDED','CHARGEBACK','REVIEW') then
  update public.appointments set status='CANCELADO' where id=booking_id and status in('AGENDADO','CONFIRMADO');
 end if;
 return next_status;
end $$;
revoke all on function public.expire_booking_payments(),public.portal_book_prepaid(uuid,uuid,timestamptz,text,text,uuid),public.apply_booking_payment(uuid,text,text,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.portal_book_prepaid(uuid,uuid,timestamptz,text,text,uuid) to authenticated;
grant execute on function public.expire_booking_payments(),public.apply_booking_payment(uuid,text,text,numeric,text,boolean) to service_role;
create or replace function public.validate_appointment() returns trigger language plpgsql security definer set search_path='' as $$
declare capacity integer; occupied integer;
begin
 perform pg_advisory_xact_lock(61006001);
 if tg_op='UPDATE' then
  if new.status='CANCELADO' and old.vehicle_id=new.vehicle_id and old.customer_id=new.customer_id and old.service_id=new.service_id and old.starts_at=new.starts_at and old.duration_minutes=new.duration_minutes then return new; end if;
  if exists(select 1 from public.appointment_payments where appointment_id=old.id and status in('PENDING','APPROVED','REVIEW')) and (new.customer_id<>old.customer_id or new.vehicle_id<>old.vehicle_id or new.service_id<>old.service_id or new.starts_at<>old.starts_at or new.duration_minutes<>old.duration_minutes) then raise exception 'Reserva com pagamento online: solicite revisão antes de remarcar'; end if;
 end if;
 if new.status='CONFIRMADO' and exists(select 1 from public.appointment_payments where appointment_id=new.id and status='PENDING') then raise exception 'Aguarde a aprovação do pagamento online'; end if;
 if not exists(select 1 from public.vehicles where id=new.vehicle_id and customer_id=new.customer_id and active) then raise exception 'Veículo não pertence ao cliente'; end if;
 if not exists(select 1 from public.customers where id=new.customer_id and active) or not exists(select 1 from public.services where id=new.service_id and active) then raise exception 'Cliente ou serviço inativo'; end if;
 perform pg_advisory_xact_lock(61006001);
 if new.status in ('AGENDADO','CONFIRMADO','EM_ATENDIMENTO') then
 select appointment_capacity into capacity from public.business_settings limit 1;
 -- Count simultaneous bookings at each start boundary, rather than all overlapping bookings.
 select coalesce(max((select count(*) from public.appointments a where a.id<>new.id and a.status in ('AGENDADO','CONFIRMADO','EM_ATENDIMENTO') and a.starts_at<=boundary and a.starts_at+make_interval(mins=>a.duration_minutes)>boundary)),0) into occupied
 from (select new.starts_at as boundary union select starts_at from public.appointments where starts_at>=new.starts_at and starts_at<new.starts_at+make_interval(mins=>new.duration_minutes)) boundaries;
 if occupied>=capacity then raise exception 'Horário sem disponibilidade'; end if;
 end if;
 return new;
end; $$;

create or replace function public.portal_book(vehicle_id uuid,service_id uuid,starts_at timestamptz,notes text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.portal_customer_id(); duration integer; aid uuid;
begin
 perform public.expire_booking_payments();
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

create or replace function public.portal_cancel(appointment_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public.portal_customer_id();
begin
 perform pg_advisory_xact_lock(61006001);
 if exists(select 1 from public.appointment_payments p join public.appointments a on a.id=p.appointment_id where a.id=portal_cancel.appointment_id and a.customer_id=cid and p.status in('APPROVED','REVIEW')) then raise exception 'Entre em contato com a equipe para cancelar e solicitar revisão do pagamento'; end if;
 if cid is null then raise exception 'Acesso não permitido'; end if;
 update public.appointments a set status='CANCELADO' where a.id=appointment_id and a.customer_id=cid and a.starts_at>now() and a.status in ('AGENDADO','CONFIRMADO');
 if not found then raise exception 'Agendamento não pode ser cancelado'; end if;
end; $$;


create function public.claim_booking_checkout(booking_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.appointment_payments set checkout_started_at=now()
 where appointment_id=booking_id and status='PENDING' and expires_at>now()
 and provider_preference_id is null and (checkout_started_at is null or checkout_started_at<now()-interval '1 minute');
 return found;
end $$;
revoke all on function public.claim_booking_checkout(uuid) from public,anon,authenticated;
grant execute on function public.claim_booking_checkout(uuid) to service_role;

commit;
