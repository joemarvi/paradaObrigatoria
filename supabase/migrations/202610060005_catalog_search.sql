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
create function public.search_catalog(table_name text,term text default '',active_filter text default 'all',page_number integer default 1) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare source text; search_expression text; status_expression text; condition text; rows jsonb; total bigint;
begin
 if table_name not in ('customers','vehicles','services','employees','service_categories') or page_number<1 or page_number>100000 or length(term)>100 then raise exception 'Consulta inválida'; end if;
 if table_name in ('services','employees','service_categories') then
 perform public.require_role(array['administrador','gerente']::public.app_role[]);
 else perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);end if;
 source:=format('public.%I t',table_name);
 search_expression:=case table_name
 when 'customers' then 'concat_ws('' '',t.name,t.phone,t.document,t.email,t.whatsapp)'
 when 'vehicles' then 'concat_ws('' '',t.plate,t.brand,t.model,c.name,c.phone)'
 when 'services' then 'concat_ws('' '',t.name,t.description)'
 when 'employees' then 'concat_ws('' '',t.name,t.position,t.phone,t.email)'
 else 't.name' end;
 if table_name='vehicles' then source:=source||' join public.customers c on c.id=t.customer_id';end if;
 status_expression:=case when table_name='service_categories' then 'true' else '($2=''all'' or t.active=($2=''active''))' end;
 condition:=search_expression||' ilike $1 and '||status_expression;
 execute 'select count(*) from '||source||' where '||condition into total using '%'||term||'%',active_filter;
 execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select t.* from '||source||' where '||condition||' order by t.created_at desc,t.id desc limit 12 offset $3) r'
 into rows using '%'||term||'%',active_filter,(page_number-1)*12;
 return jsonb_build_object('rows',rows,'total',total);
end; $$;
-- Invoker function calls the role check; it is safe and contains no data output.
grant execute on function public.require_role(public.app_role[]) to authenticated;
revoke all on function public.search_catalog(text,text,text,integer) from public, anon, authenticated;
grant execute on function public.search_catalog(text,text,text,integer) to authenticated;
commit;
