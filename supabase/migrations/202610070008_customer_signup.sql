-- The hosted project is dedicated to Parada Obrigatória.
-- Remove only the legacy master-provisioning trigger; retain its function and data.
begin;
do $$
declare legacy record;
begin
 if to_regclass('public.customer_accounts') is null
    or to_regprocedure('public.register_customer(text,text)') is null then
   raise exception 'Pré-requisito ausente: aplique 001_schema e as migrations 002 a 007_customer_portal antes de 008_customer_signup.';
 end if;
 select n.nspname as function_schema, p.proname as function_name,
        p.prosrc as function_source, t.tgdeferrable, t.tginitdeferred
 into legacy
 from pg_trigger t
 join pg_proc p on p.oid=t.tgfoid
 join pg_namespace n on n.oid=p.pronamespace
 where t.tgrelid='auth.users'::regclass
   and t.tgname='on_auth_user_created' and not t.tgisinternal;
 if not found then return; end if;
 if legacy.function_schema <> 'public' or legacy.function_name <> 'create_user_profile'
    or position('Master provisioning required' in legacy.function_source)=0
    or not legacy.tgdeferrable or not legacy.tginitdeferred then
   raise exception 'Trigger on_auth_user_created diferente do diagnosticado. Revise sua definição antes de alterar.';
 end if;
 execute 'drop trigger on_auth_user_created on auth.users';
end $$;
commit;
