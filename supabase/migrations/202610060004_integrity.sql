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
create function public.valid_document(document text) returns boolean language plpgsql immutable set search_path='' as $$
declare n integer; i integer; s integer; digit integer; weight integer;
begin
 if document is null or document='' then return true; end if;
 if document !~ '^([0-9]{11}|[0-9]{14})$' or document ~ '^([0-9])\1+$' then return false; end if;
 n:=length(document);
 if n=11 then
 for i in 9..10 loop
 s:=0;for digit in 1..i loop s:=s+substring(document,digit,1)::integer*(i+2-digit);end loop;
 digit:=(s*10)%11;if digit=10 then digit:=0;end if;
 if digit<>substring(document,i+1,1)::integer then return false;end if;
 end loop;
 else
 for i in 12..13 loop
 s:=0;weight:=i-7;for digit in 1..i loop s:=s+substring(document,digit,1)::integer*weight;weight:=case when weight=2 then 9 else weight-1 end;end loop;
 digit:=case when s%11<2 then 0 else 11-s%11 end;
 if digit<>substring(document,i+1,1)::integer then return false;end if;
 end loop;
 end if;return true;
end; $$;
alter table public.customers add constraint document_checksum check(public.valid_document(document));
alter table public.customers add constraint customer_email_format check(email is null or email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.vehicles add constraint vehicle_brand_name check(length(trim(brand))>1 and length(trim(model))>1);
alter table public.employees add constraint employee_name check(length(trim(name))>1 and length(trim(position))>1);
alter table public.services add constraint service_name check(length(trim(name))>1);
alter table public.service_categories add constraint category_name check(length(trim(name))>1);
alter table public.business_settings add constraint settings_valid check(length(trim(name))>1 and length(trim(opening_hours))>0 and appointment_capacity<=50);
create function public.protect_own_access() returns trigger language plpgsql set search_path='' as $$
begin if new.id=auth.uid() and (new.role<>old.role or not new.active) then raise exception 'Não altere suas próprias permissões'; end if;return new;end; $$;
create trigger own_access before update on public.profiles for each row execute function public.protect_own_access();
create function public.assign_order_employee(order_id uuid,employee_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 if not exists(select 1 from public.employees e where e.id=employee_id and e.active) then raise exception 'Funcionário inativo'; end if;
 update public.work_orders o set employee_id=assign_order_employee.employee_id where o.id=order_id and o.status in ('AGUARDANDO','EM_SERVICO');
 if not found then raise exception 'Ordem não disponível para atribuição'; end if;
end; $$;
create function public.settle_free_order(order_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 update public.work_orders set status='FINALIZADO' where id=order_id and status='AGUARDANDO_PAGAMENTO' and total=0;
 if not found then raise exception 'Ordem não disponível para cortesia'; end if;
end; $$;
revoke all on function public.assign_order_employee(uuid,uuid),public.settle_free_order(uuid) from public, anon, authenticated;
grant execute on function public.assign_order_employee(uuid,uuid),public.settle_free_order(uuid) to authenticated;
commit;
