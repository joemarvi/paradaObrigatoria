begin;
create function public.require_role(roles public.app_role[]) returns void language plpgsql security definer set search_path='' as $$
begin if not public.has_role(roles) then raise exception 'Acesso não permitido' using errcode='42501'; end if; end; $$;
revoke all on function public.require_role(public.app_role[]) from public, anon, authenticated;

create function public.create_work_order(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; vid uuid; cid uuid; sid uuid; svc public.services; subtotal numeric(12,2):=0;
 disc numeric(12,2):=coalesce((payload->>'discount')::numeric,0); extra numeric(12,2):=coalesce((payload->>'surcharge')::numeric,0);
 product jsonb; qty integer; price numeric(12,2);
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 vid:=(payload->>'vehicle_id')::uuid; cid:=(payload->>'customer_id')::uuid;
 if not exists(select 1 from public.vehicles v join public.customers c on c.id=v.customer_id where v.id=vid and c.id=cid and v.active and c.active) then raise exception 'Veículo e cliente inválidos'; end if;
 if payload->>'employee_id' is not null and not exists(select 1 from public.employees where id=(payload->>'employee_id')::uuid and active) then raise exception 'Funcionário inativo'; end if;
 if disc<0 or extra<0 then raise exception 'Valores inválidos'; end if;
 if jsonb_array_length(coalesce(payload->'service_ids','[]'))=0 then raise exception 'Selecione um serviço'; end if;
 if (select count(*)<>count(distinct value) from jsonb_array_elements_text(payload->'service_ids')) then raise exception 'Serviço duplicado'; end if;
 insert into public.work_orders(customer_id,vehicle_id,employee_id,total,discount,surcharge,notes,fuel_level,vehicle_condition,belongings,expected_at)
 values(cid,vid,(payload->>'employee_id')::uuid,0,disc,extra,payload->>'notes',payload->>'fuel_level',payload->>'vehicle_condition',payload->>'belongings',(payload->>'expected_at')::timestamptz) returning id into oid;
 for sid in select value::uuid from jsonb_array_elements_text(payload->'service_ids') loop
 select * into svc from public.services where id=sid and active;
 if not found then raise exception 'Serviço indisponível'; end if;
 insert into public.work_order_items(work_order_id,service_id,name,unit_price) values(oid,sid,svc.name,svc.price);
 subtotal:=subtotal+svc.price;
 end loop;
 for product in select value from jsonb_array_elements(coalesce(payload->'products','[]')) loop
 qty:=(product->>'quantity')::integer; price:=(product->>'unit_price')::numeric;
 if qty<=0 or price<0 or length(trim(product->>'name'))<1 then raise exception 'Produto inválido'; end if;
 insert into public.work_order_items(work_order_id,name,kind,quantity,unit_price) values(oid,product->>'name','PRODUTO',qty,price);
 subtotal:=subtotal+qty*price;
 end loop;
 if disc>subtotal+extra then raise exception 'Desconto superior ao total'; end if;
 update public.work_orders set total=subtotal-disc+extra where id=oid;
 return oid;
end; $$;

create function public.transition_order(order_id uuid, next_status public.order_status) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders; paid numeric;
begin
 perform public.require_role(array['administrador','gerente','atendente','operador']::public.app_role[]);
 select * into o from public.work_orders where id=order_id for update;
 if not found then raise exception 'Ordem não encontrada'; end if;
 if next_status='CANCELADO' then
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 if o.status not in ('AGUARDANDO','EM_SERVICO') or exists(select 1 from public.payments where work_order_id=order_id) then raise exception 'Esta ordem não pode ser cancelada'; end if;
 elsif not ((o.status='AGUARDANDO' and next_status='EM_SERVICO') or (o.status='EM_SERVICO' and next_status='AGUARDANDO_PAGAMENTO')) then
 raise exception 'Transição de status inválida';
 end if;
 update public.work_orders set status=next_status, completed_at=case when next_status='AGUARDANDO_PAGAMENTO' then now() else completed_at end where id=order_id;
end; $$;

create function public.open_register(amount numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 if amount is null or amount<0 or amount<>round(amount,2) then raise exception 'Valor inválido'; end if;
 insert into public.cash_registers(opening_amount) values(amount) returning id into rid;
 insert into public.cash_movements(cash_register_id,type,amount,description) values(rid,'ABERTURA',amount,'Abertura do caixa');
 return rid;
end; $$;

create function public.record_payment(order_id uuid, parts jsonb) returns void language plpgsql security definer set search_path='' as $$
declare o public.work_orders; rid uuid; paid numeric(12,2); incoming numeric(12,2):=0; part jsonb; amount numeric; pid uuid; method public.payment_method;
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 -- Consistent lock order: register first, then order. Closing locks this same register.
 select id into rid from public.cash_registers where closed_at is null for update;
 if rid is null then raise exception 'Abra o caixa antes de receber'; end if;
 select * into o from public.work_orders where id=order_id for update;
 if not found or o.status<>'AGUARDANDO_PAGAMENTO' then raise exception 'Ordem não disponível para pagamento'; end if;
 if jsonb_array_length(parts)=0 then raise exception 'Informe o pagamento'; end if;
 for part in select value from jsonb_array_elements(parts) loop
 amount:=(part->>'amount')::numeric; method:=(part->>'method')::public.payment_method;
 if amount is null or method is null or amount<=0 or amount<>round(amount,2) then raise exception 'Pagamento inválido'; end if;
 incoming:=incoming+amount;
 end loop;
 select coalesce(sum(p.amount),0) into paid from public.payments p where p.work_order_id=order_id;
 if paid+incoming>o.total then raise exception 'Pagamento superior ao saldo'; end if;
 for part in select value from jsonb_array_elements(parts) loop
 insert into public.payments(work_order_id,cash_register_id,amount,method) values(order_id,rid,(part->>'amount')::numeric,(part->>'method')::public.payment_method) returning id into pid;
 insert into public.cash_movements(cash_register_id,payment_id,type,amount,description) values(rid,pid,'VENDA',(part->>'amount')::numeric,'Pagamento OS '||o.number);
 end loop;
 if paid+incoming=o.total then update public.work_orders set status='FINALIZADO' where id=order_id; end if;
end; $$;

create function public.register_balance(register_id uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when m.type in ('ABERTURA','REFORCO') then m.amount when m.type in ('SANGRIA','DESPESA') then -m.amount when m.type='VENDA' and p.method='DINHEIRO' then m.amount else 0 end),0)
 from public.cash_movements m left join public.payments p on p.id=m.payment_id where m.cash_register_id=register_id;
$$;
revoke all on function public.register_balance(uuid) from public, anon, authenticated;

create function public.move_cash(movement_type text, amount numeric, description text) returns void language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 select id into rid from public.cash_registers where closed_at is null for update;
 if rid is null then raise exception 'Caixa fechado'; end if;
 if movement_type not in ('SANGRIA','DESPESA','REFORCO') or amount is null or amount<=0 or amount<>round(amount,2) or length(trim(description))<3 then raise exception 'Movimento inválido'; end if;
 if movement_type in ('SANGRIA','DESPESA') and amount>public.register_balance(rid) then raise exception 'Saldo insuficiente em dinheiro'; end if;
 insert into public.cash_movements(cash_register_id,type,amount,description) values(rid,movement_type,amount,description);
end; $$;

create function public.close_register(counted_amount numeric, note text default '') returns void language plpgsql security definer set search_path='' as $$
declare rid uuid; expected numeric;
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 select id into rid from public.cash_registers where closed_at is null for update;
 if rid is null then raise exception 'Caixa já fechado'; end if;
 if counted_amount is null or counted_amount<0 or counted_amount<>round(counted_amount,2) then raise exception 'Valor inválido'; end if;
 expected:=public.register_balance(rid);
 update public.cash_registers set closed_at=now(),closed_by=auth.uid(),closing_amount=counted_amount,expected_amount=expected,notes=note where id=rid;
 insert into public.cash_movements(cash_register_id,type,amount,description) values(rid,'FECHAMENTO',counted_amount,'Conferência de fechamento');
end; $$;

create function public.release_vehicle(order_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_role(array['administrador','gerente','atendente']::public.app_role[]);
 update public.work_orders set exited_at=now() where id=order_id and status='FINALIZADO' and exited_at is null;
 if not found then raise exception 'Finalize o pagamento antes da saída'; end if;
end; $$;

-- Appointment capacity and ownership are enforced independently of the browser.
create function public.validate_appointment() returns trigger language plpgsql security definer set search_path='' as $$
declare capacity integer; occupied integer;
begin
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
create trigger appointment_validation before insert or update on public.appointments for each row execute function public.validate_appointment();
-- Lock privileges down explicitly; PostgreSQL grants EXECUTE to PUBLIC by default.
revoke all on function public.create_work_order(jsonb),public.transition_order(uuid,public.order_status),public.open_register(numeric),public.record_payment(uuid,jsonb),public.move_cash(text,numeric,text),public.close_register(numeric,text),public.release_vehicle(uuid) from public, anon, authenticated;
grant execute on function public.create_work_order(jsonb),public.transition_order(uuid,public.order_status),public.open_register(numeric),public.record_payment(uuid,jsonb),public.move_cash(text,numeric,text),public.close_register(numeric,text),public.release_vehicle(uuid) to authenticated;
commit;
