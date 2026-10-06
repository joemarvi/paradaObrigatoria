begin;
create function public.finance_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rid uuid; today date:=(now() at time zone 'America/Sao_Paulo')::date; start_at timestamptz; end_at timestamptz;
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 select id into rid from public.cash_registers where closed_at is null;
 start_at:=today::timestamp at time zone 'America/Sao_Paulo';end_at:=(today+1)::timestamp at time zone 'America/Sao_Paulo';
 return jsonb_build_object(
 'balance',case when rid is null then 0 else public.register_balance(rid) end,
 'received',(select coalesce(sum(amount),0) from public.payments where created_at>=start_at and created_at<end_at),
 'pendingAmount',(select coalesce(sum(o.total-coalesce(p.paid,0)),0) from public.work_orders o left join (select work_order_id,sum(amount) as paid from public.payments group by work_order_id) p on p.work_order_id=o.id where o.status='AGUARDANDO_PAGAMENTO'),
 'pendingCount',(select count(*) from public.work_orders where status='AGUARDANDO_PAGAMENTO'),
 'paidByOrder',coalesce((select jsonb_object_agg(p.id,p.paid) from (select o.id,coalesce(sum(p.amount),0) as paid from public.work_orders o left join public.payments p on p.work_order_id=o.id where o.status='AGUARDANDO_PAGAMENTO' group by o.id) p),'{}'::jsonb)
 );
end; $$;
revoke all on function public.finance_summary() from public, anon, authenticated;
grant execute on function public.finance_summary() to authenticated;
commit;
