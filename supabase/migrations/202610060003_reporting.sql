begin;
do $$
begin
 if to_regtype('public.app_role') is null or to_regclass('public.customers') is null then
  raise exception 'Pré-requisito ausente: execute 202610060001_schema.sql com sucesso antes desta migration.';
 end if;
 if to_regprocedure('public.require_role(public.app_role[])') is null then
  raise exception 'Pré-requisito ausente: execute 202610060002_operations.sql com sucesso antes desta migration.';
 end if;
end; $$;
create or replace function public.management_report(start_date date,end_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz; end_at timestamptz; result jsonb;
begin
 perform public.require_role(array['administrador','gerente']::public.app_role[]);
 if start_date is null or end_date is null or end_date<start_date or end_date-start_date>366 then raise exception 'Período inválido'; end if;
 start_at:=start_date::timestamp at time zone 'America/Sao_Paulo'; end_at:=(end_date+1)::timestamp at time zone 'America/Sao_Paulo';
 select jsonb_build_object(
 'revenue',(select coalesce(sum(amount),0) from public.payments where created_at>=start_at and created_at<end_at),
 'paidOrders',(select count(distinct work_order_id) from public.payments where created_at>=start_at and created_at<end_at),
 'completed',(select count(*) from public.work_orders where completed_at>=start_at and completed_at<end_at),
 'cancellations',(select count(*) from public.work_orders where status='CANCELADO' and updated_at>=start_at and updated_at<end_at),
 'customers',(select count(*) from public.customers where created_at>=start_at and created_at<end_at),
 'vehicles',(select count(*) from public.vehicles where created_at>=start_at and created_at<end_at),
 'services',coalesce((select jsonb_agg(s) from (select i.name,sum(i.quantity) as quantity,sum(i.quantity*i.unit_price) as total from public.work_order_items i join public.work_orders o on o.id=i.work_order_id where i.kind='SERVICO' and o.completed_at>=start_at and o.completed_at<end_at and o.status<>'CANCELADO' group by i.name order by quantity desc) s),'[]'::jsonb),
 'methods',coalesce((select jsonb_agg(m) from (select method as name,count(*) as quantity,sum(amount) as total from public.payments where created_at>=start_at and created_at<end_at group by method order by total desc) m),'[]'::jsonb),
 'employees',coalesce((select jsonb_agg(e) from (select coalesce(e.name,'Sem responsável') as name,count(*) as quantity,sum(o.total) as total from public.work_orders o left join public.employees e on e.id=o.employee_id where o.completed_at>=start_at and o.completed_at<end_at and o.status<>'CANCELADO' group by e.id,e.name order by quantity desc) e),'[]'::jsonb),
 'days',coalesce((select jsonb_agg(d) from (select (created_at at time zone 'America/Sao_Paulo')::date as name,count(*) as quantity,sum(amount) as total from public.payments where created_at>=start_at and created_at<end_at group by name order by name) d),'[]'::jsonb),
 'cash',coalesce((select jsonb_agg(c) from (select type as name,count(*) as quantity,sum(amount) as total from public.cash_movements where created_at>=start_at and created_at<end_at group by type order by type) c),'[]'::jsonb)
 ) into result; return result;
end; $$;
create or replace function public.dashboard_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Sao_Paulo')::date; start_at timestamptz; end_at timestamptz; rid uuid;
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 start_at:=today::timestamp at time zone 'America/Sao_Paulo';end_at:=(today+1)::timestamp at time zone 'America/Sao_Paulo';
 select id into rid from public.cash_registers where closed_at is null;
 return jsonb_build_object(
 'waiting',(select count(*) from public.work_orders where status='AGUARDANDO'),
 'inService',(select count(*) from public.work_orders where status='EM_SERVICO'),
 'ready',(select count(*) from public.work_orders where status='AGUARDANDO_PAGAMENTO' or (status='FINALIZADO' and exited_at is null)),
 'revenue',(select coalesce(sum(amount),0) from public.payments where created_at>=start_at and created_at<end_at),
 'paidOrders',(select count(distinct work_order_id) from public.payments where created_at>=start_at and created_at<end_at),
 'completed',(select count(*) from public.work_orders where completed_at>=start_at and completed_at<end_at),
 'serviceCount',(select coalesce(sum(i.quantity),0) from public.work_order_items i join public.work_orders o on o.id=i.work_order_id where i.kind='SERVICO' and o.completed_at>=start_at and o.completed_at<end_at and o.status<>'CANCELADO'),
 'appointments',(select count(*) from public.appointments where starts_at>=start_at and starts_at<end_at and status not in ('CANCELADO','NAO_COMPARECEU')),
 'balance',case when rid is null then 0 else public.register_balance(rid) end,
 'registerOpen',rid is not null,
 'services',coalesce((select jsonb_agg(s) from (select i.name,sum(i.quantity) as quantity,sum(i.quantity*i.unit_price) as total from public.work_order_items i join public.work_orders o on o.id=i.work_order_id where i.kind='SERVICO' and o.completed_at>=start_at and o.completed_at<end_at and o.status<>'CANCELADO' group by i.name order by quantity desc limit 5) s),'[]'::jsonb)
 );
end; $$;
revoke all on function public.management_report(date,date),public.dashboard_summary() from public, anon, authenticated;
grant execute on function public.management_report(date,date),public.dashboard_summary() to authenticated;
commit;
