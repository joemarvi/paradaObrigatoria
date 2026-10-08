-- Manual rollback of migration 008. This restores the old signup block.
-- Run only if reverting the decision to allow public customer registration.
begin;
create constraint trigger on_auth_user_created
 after insert on auth.users
 deferrable initially deferred
 for each row execute function public.create_user_profile();
commit;
