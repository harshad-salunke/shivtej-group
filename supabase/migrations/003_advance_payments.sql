-- Existing installations: run after 002. New schema.sql already includes this.
begin;
create table public.admin_payment_batches(id uuid primary key,member_id uuid not null references public.members(id),request jsonb not null,created_at timestamptz not null default now());
alter table public.admin_payment_batches enable row level security;
revoke all on public.admin_payment_batches from anon,authenticated;
grant all on public.admin_payment_batches to service_role;
create function public.save_advance(p_request uuid,p_member uuid,p_entries jsonb,p_date date,p_path text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;expected numeric;received numeric;yy int;mm int;inserted int;request_value jsonb;
begin
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 12 then raise exception 'INVALID_BATCH';end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'INVALID_DATE';end if;
 if (select count(*) from jsonb_array_elements(p_entries))<>(select count(distinct ((e->>'year')||'-'||(e->>'month'))) from jsonb_array_elements(p_entries) e) then raise exception 'DUPLICATE_PERIOD';end if;
 perform 1 from public.members where id=p_member for update;
 if not found then raise exception 'INELIGIBLE';end if;
 request_value:=jsonb_build_object('entries',p_entries,'date',p_date,'note',p_note);
 insert into public.admin_payment_batches(id,member_id,request) values(p_request,p_member,request_value) on conflict(id) do nothing;
 get diagnostics inserted = row_count;
 if inserted=0 then
   if not exists(select 1 from public.admin_payment_batches where id=p_request and member_id=p_member and request=request_value) then raise exception 'BATCH_CHANGED';end if;
   return;
 end if;
 for item in select value from jsonb_array_elements(p_entries) loop
   yy:=(item->>'year')::int;mm:=(item->>'month')::int;received:=(item->>'amount')::numeric;
   if received is null or received<=0 or received>1000000 or received<>round(received,2) then raise exception 'INVALID_AMOUNT';end if;
   select monthly_amount into expected from public.yearly_settings where year<=yy order by year desc limit 1;
   insert into public.payments(member_id,year,month,expected_amount,amount_paid,payment_date,screenshot_path,note)
   values(p_member,yy,mm,coalesce(expected,300),received,p_date,p_path,coalesce(p_note,''))
   on conflict(member_id,year,month) do update set amount_paid=public.payments.amount_paid+excluded.amount_paid,payment_date=excluded.payment_date,screenshot_path=coalesce(excluded.screenshot_path,public.payments.screenshot_path),note=excluded.note;
 end loop;
end $$;
revoke all on function public.save_advance(uuid,uuid,jsonb,date,text,text) from public,anon,authenticated;
grant execute on function public.save_advance(uuid,uuid,jsonb,date,text,text) to service_role;
create or replace function public.save_payment(p_member uuid,p_year int,p_month int,p_paid numeric,p_date date,p_path text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare expected numeric;
begin
 perform 1 from public.members where id=p_member for update;
 select monthly_amount into expected from public.yearly_settings where year<=p_year order by year desc limit 1;
 insert into public.payments(member_id,year,month,expected_amount,amount_paid,payment_date,screenshot_path,note)
 values(p_member,p_year,p_month,coalesce(expected,300),p_paid,p_date,p_path,p_note)
 on conflict(member_id,year,month) do update set amount_paid=excluded.amount_paid,payment_date=excluded.payment_date,screenshot_path=excluded.screenshot_path,note=excluded.note;
end $$;

commit;
