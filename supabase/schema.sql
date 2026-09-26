-- Run once in a NEW Supabase project's SQL Editor. No Supabase Auth required.
-- All timestamps use UTC; contribution month and business date use Asia/Kolkata.
begin;
create extension if not exists pgcrypto;
create table public.members (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),
 join_year int not null check(join_year between 2000 and 2100), join_month int not null check(join_month between 1 and 12),
 leave_year int check(leave_year between 2000 and 2100), leave_month int check(leave_month between 1 and 12),
 is_active boolean not null default true, display_order int not null default 0 check(display_order between 0 and 9999),
 created_at timestamptz not null default now(),
 check ((leave_year is null)=(leave_month is null)), check(is_active=(leave_year is null)),
 check(leave_year is null or leave_year*12+leave_month>=join_year*12+join_month)
);
create table public.yearly_settings (id uuid primary key default gen_random_uuid(), year int not null unique check(year between 2000 and 2100), monthly_amount numeric(12,2) not null check(monthly_amount>0 and monthly_amount<=1000000));
insert into public.yearly_settings(year,monthly_amount) values(2027,300);
create table public.payments (
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.members(id) on delete restrict,
 year int not null check(year between 2000 and 2100),month int not null check(month between 1 and 12),
 expected_amount numeric(12,2) not null check(expected_amount>0),amount_paid numeric(12,2) not null default 0 check(amount_paid between 0 and 1000000),
 payment_date date,screenshot_path text,note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(member_id,year,month), check(amount_paid=0 or payment_date is not null)
);
create table public.notices(id uuid primary key default gen_random_uuid(),message text not null check(length(trim(message)) between 1 and 1500),start_date date,end_date date,is_active boolean not null default true,created_at timestamptz not null default now(),check(start_date is null or end_date is null or end_date>=start_date));
create table public.admin_logs(id uuid primary key default gen_random_uuid(),action text not null,member_id uuid,payment_id uuid,old_value jsonb,new_value jsonb,created_at timestamptz not null default now());
create table public.admin_login_limits(ip_hash text primary key,window_start timestamptz not null,attempts int not null);
create index payment_period on public.payments(year,month);
create index payment_member on public.payments(member_id);
create index logs_created on public.admin_logs(created_at desc);
-- Current year and past rates are immutable; future-year changes are permitted.
create function public.guard_rate() returns trigger language plpgsql set search_path='' as $$
begin
 if new.year<=extract(year from now() at time zone 'Asia/Kolkata') then raise exception 'HISTORY: only future year rates can change'; end if;
 if tg_op='UPDATE' and new.year<>old.year then raise exception 'HISTORY: year cannot change'; end if;
 return new;
end $$;
create trigger rate_guard before insert or update on public.yearly_settings for each row execute function public.guard_rate();
create function public.guard_member_history() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.payments p where p.member_id=new.id and (p.amount_paid>0 or p.screenshot_path is not null) and (p.year*12+p.month<new.join_year*12+new.join_month or (new.leave_year is not null and p.year*12+p.month>new.leave_year*12+new.leave_month))) then raise exception 'HISTORY: recorded contributions fall outside membership'; end if;
 return new;
end $$;
create trigger member_history_guard before update on public.members for each row execute function public.guard_member_history();
create function public.payment_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.members m where m.id=new.member_id and new.year*12+new.month>=m.join_year*12+m.join_month and (m.leave_year is null or new.year*12+new.month<=m.leave_year*12+m.leave_month)) then raise exception 'INELIGIBLE'; end if;
 if new.payment_date>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Future payment date'; end if;
 if tg_op='UPDATE' then
   if new.member_id<>old.member_id or new.year<>old.year or new.month<>old.month then raise exception 'HISTORY: identity cannot change'; end if;
   new.expected_amount:=old.expected_amount;
 end if;
 new.updated_at:=now();return new;
end $$;
create trigger payment_guard before insert or update on public.payments for each row execute function public.payment_guard();
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare old_json jsonb;new_json jsonb;mid uuid;pid uuid;
begin
 if tg_op<>'INSERT' then old_json:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then new_json:=to_jsonb(new);end if;
 if tg_table_name='payments' then mid:=coalesce(new_json->>'member_id',old_json->>'member_id')::uuid;pid:=coalesce(new_json->>'id',old_json->>'id')::uuid;
 elsif tg_table_name='members' then mid:=coalesce(new_json->>'id',old_json->>'id')::uuid;end if;
 insert into public.admin_logs(action,member_id,payment_id,old_value,new_value) values(tg_table_name||':'||tg_op,mid,pid,old_json,new_json);
 return null;
end $$;
create trigger members_audit after insert or update or delete on public.members for each row execute function public.audit_change();
create trigger payments_audit after insert or update or delete on public.payments for each row execute function public.audit_change();
create trigger notices_audit after insert or update or delete on public.notices for each row execute function public.audit_change();
create trigger settings_audit after insert or update or delete on public.yearly_settings for each row execute function public.audit_change();
-- Atomic payment + audit transaction. Snapshot expected amount once, even on later edits.
create function public.save_payment(p_member uuid,p_year int,p_month int,p_paid numeric,p_date date,p_path text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare expected numeric;
begin
 perform 1 from public.members where id=p_member for update;
 select monthly_amount into expected from public.yearly_settings where year<=p_year order by year desc limit 1;
 insert into public.payments(member_id,year,month,expected_amount,amount_paid,payment_date,screenshot_path,note)
 values(p_member,p_year,p_month,coalesce(expected,300),p_paid,p_date,p_path,p_note)
 on conflict(member_id,year,month) do update set amount_paid=excluded.amount_paid,payment_date=excluded.payment_date,screenshot_path=excluded.screenshot_path,note=excluded.note;
end $$;
-- Shared, atomic throttle: survives serverless cold starts and multiple instances.
create function public.admin_login_attempt(ip_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare n int;
begin
 delete from public.admin_login_limits where window_start<now()-interval '1 day';
 insert into public.admin_login_limits(ip_hash,window_start,attempts) values(ip_key,now(),1)
 on conflict(ip_hash) do update set
 attempts=case when admin_login_limits.window_start<now()-interval '15 minutes' then 1 else admin_login_limits.attempts+1 end,
 window_start=case when admin_login_limits.window_start<now()-interval '15 minutes' then now() else admin_login_limits.window_start end
 returning attempts into n;
 return n<=10;
end $$;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.yearly_settings enable row level security;
alter table public.notices enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admin_login_limits enable row level security;
revoke all on public.members,public.payments,public.yearly_settings,public.notices,public.admin_logs,public.admin_login_limits from anon,authenticated;
grant select on public.members,public.payments,public.yearly_settings,public.notices to anon,authenticated;
grant all on public.members,public.payments,public.yearly_settings,public.notices,public.admin_logs,public.admin_login_limits to service_role;
create policy public_read_members on public.members for select to anon,authenticated using(true);
create policy public_read_payments on public.payments for select to anon,authenticated using(true);
create policy public_read_rates on public.yearly_settings for select to anon,authenticated using(true);
create policy public_read_notices on public.notices for select to anon,authenticated using(is_active and (start_date is null or start_date<=(now() at time zone 'Asia/Kolkata')::date) and (end_date is null or end_date>=(now() at time zone 'Asia/Kolkata')::date));
revoke all on function public.save_payment(uuid,int,int,numeric,date,text,text),public.admin_login_attempt(text),public.audit_change(),public.payment_guard(),public.guard_member_history(),public.guard_rate() from public,anon,authenticated;
grant execute on function public.save_payment(uuid,int,int,numeric,date,text,text),public.admin_login_attempt(text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('payment-proofs','payment-proofs',true,2097152,array['image/webp','image/png','image/jpeg']);
-- No anon/authenticated storage write policy. Server secret writes only.

-- Other receipts and one-time opening balances.
create table public.additional_income (
 id uuid primary key default gen_random_uuid(),
 year int not null check(year between 2000 and 2100),
 month int not null check(month between 1 and 12),
 kind text not null check(kind in ('donation','opening_balance')),
 source text not null check(length(trim(source)) between 1 and 120),
 amount numeric(12,2) not null check(amount>0 and amount<=1000000),
 entry_date date not null,
 note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index additional_income_period on public.additional_income(year,month);
create function public.income_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now();return new;end $$;
create trigger additional_income_timestamp before update on public.additional_income for each row execute function public.income_updated_at();
create trigger additional_income_audit after insert or update or delete on public.additional_income for each row execute function public.audit_change();
alter table public.additional_income enable row level security;
revoke all on public.additional_income from anon,authenticated;
grant select on public.additional_income to anon,authenticated;
grant all on public.additional_income to service_role;
create policy public_read_additional_income on public.additional_income for select to anon,authenticated using(true);
revoke all on function public.income_updated_at() from public,anon,authenticated;

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
commit;
