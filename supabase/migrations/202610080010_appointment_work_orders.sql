-- Independent of optional payment migration 009; apply after schema and portal migrations.
begin;
do $$ begin
 if to_regclass('public.work_orders') is null or to_regclass('public.appointments') is null then
  raise exception 'Pré-requisito ausente: aplique 001_schema e as migrations 002 a 008';
 end if;
end $$;
alter table public.work_orders add column appointment_id uuid unique references public.appointments(id);
-- Automatic confirmations (e.g. a verified payment webhook) have no staff actor.
alter table public.work_orders alter column created_by drop not null;

create function public.ensure_appointment_work_order(booking_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.appointments; s public.services; oid uuid; actor uuid; price numeric;
begin
 select * into a from public.appointments where id=booking_id for update;
 if not found or a.status<>'CONFIRMADO' then raise exception 'Agendamento não está confirmado'; end if;
 select id into oid from public.work_orders where appointment_id=a.id;
 if oid is not null then
  if exists(select 1 from public.work_orders where id=oid and status='CANCELADO') then
   raise exception 'Não é possível confirmar um agendamento com OS cancelada';
  end if;
  update public.work_orders set expected_at=a.starts_at+make_interval(mins=>a.duration_minutes),
   entered_at=least(entered_at,a.starts_at),notes=a.notes where id=oid and status='AGUARDANDO';
  return oid;
 end if;
 select * into s from public.services where id=a.service_id;
 if not found then raise exception 'Serviço indisponível'; end if;
 price:=s.price;
 if to_regclass('public.appointment_payments') is not null then
  execute 'select amount from public.appointment_payments where appointment_id=$1 and status=''APPROVED''' into price using a.id;
  price:=coalesce(price,s.price);
 end if;
 select id into actor from public.profiles where id=auth.uid() and active;
 insert into public.work_orders(appointment_id,customer_id,vehicle_id,total,notes,entered_at,expected_at,created_by)
 values(a.id,a.customer_id,a.vehicle_id,price,a.notes,least(now(),a.starts_at),a.starts_at+make_interval(mins=>a.duration_minutes),actor)
 returning id into oid;
 insert into public.work_order_items(work_order_id,service_id,name,unit_price)
 values(oid,s.id,s.name,price);
 return oid;
end $$;
revoke all on function public.ensure_appointment_work_order(uuid) from public,anon,authenticated;

create function public.sync_appointment_work_order() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and exists(select 1 from public.work_orders where appointment_id=new.id)
  and (new.customer_id,new.vehicle_id,new.service_id) is distinct from (old.customer_id,old.vehicle_id,old.service_id) then
  raise exception 'Agendamento com OS não permite alterar cliente, veículo ou serviço';
 end if;
 if new.status='CONFIRMADO' then
  perform public.ensure_appointment_work_order(new.id);
 elsif new.status in('CANCELADO','NAO_COMPARECEU') then
  if exists(select 1 from public.work_orders o where o.appointment_id=new.id and o.status<>'CANCELADO' and (o.status<>'AGUARDANDO' or exists(select 1 from public.payments p where p.work_order_id=o.id))) then
   raise exception 'Esta ordem não pode ser cancelada';
  end if;
  update public.work_orders set status='CANCELADO' where appointment_id=new.id and status='AGUARDANDO';
 end if;
 return new;
end $$;
revoke all on function public.sync_appointment_work_order() from public,anon,authenticated;
create trigger appointment_work_order after insert or update on public.appointments
 for each row execute function public.sync_appointment_work_order();

-- Repair existing confirmed bookings, without duplicating orders linked by this migration.
do $$ declare a record; begin
 for a in select id from public.appointments where status='CONFIRMADO' loop
  perform public.ensure_appointment_work_order(a.id);
 end loop;
end $$;
commit;
