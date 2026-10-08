-- Read-only: locate the hosted rule that raises "Master provisioning required".
-- Run in the SQL Editor of the affected Supabase project.
select
  n.nspname as function_schema,
  p.proname as function_name,
  p.oid::regprocedure::text as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prokind = 'f'
  and p.prosrc ilike '%Master provisioning required%';

-- Show user-defined triggers on auth.users and triggers invoking the matching rule.
select
  tn.nspname as table_schema,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  t.tgdeferrable as deferrable,
  t.tginitdeferred as initially_deferred,
  pg_get_triggerdef(t.oid) as trigger_definition,
  fn.nspname as function_schema,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace tn on tn.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace fn on fn.oid = p.pronamespace
where not t.tgisinternal
  and ((tn.nspname = 'auth' and c.relname = 'users')
    or p.prosrc ilike '%Master provisioning required%')
order by table_schema, table_name, trigger_name;
