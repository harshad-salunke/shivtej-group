-- Existing installations: run this migration ONCE, before deploying the new code.
-- New installations: schema.sql already includes these objects; do not run twice.
begin;
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
commit;
