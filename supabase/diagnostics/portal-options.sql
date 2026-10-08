-- Read-only. Run in the SQL Editor of the application's Supabase project.
-- Counts do not expose customer contact details.
select 'clientes ativos' as item, count(*) as total from public.customers where active
union all
select 'vínculos de clientes', count(*) from public.customer_accounts
union all
select 'veículos ativos', count(*) from public.vehicles where active
union all
select 'serviços ativos', count(*) from public.services where active;

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname='public'
  and tablename in ('customers','customer_accounts','vehicles','services','appointments')
order by tablename, policyname;

select to_regprocedure('public.portal_customer_id()') as portal_customer_function,
       to_regprocedure('public.register_customer(text,text)') as registration_function;
