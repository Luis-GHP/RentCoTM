create table if not exists public.house_rule (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general'
    check (category in (
      'general',
      'payment',
      'maintenance',
      'utilities',
      'visitors',
      'parking',
      'quiet_hours',
      'safety',
      'move_out',
      'other'
    )),
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.house_rule enable row level security;

create index if not exists idx_house_rule_property on public.house_rule(property_id);
create index if not exists idx_house_rule_property_sort on public.house_rule(property_id, sort_order, updated_at desc);

create or replace function public.set_house_rule_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_house_rule_updated_at on public.house_rule;
create trigger trg_house_rule_updated_at
before update on public.house_rule
for each row
execute function public.set_house_rule_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'house_rule'
      and policyname = 'landlord: manage own house rules'
  ) then
    create policy "landlord: manage own house rules"
      on public.house_rule for all
      using (
        property_id in (
          select p.id
          from public.property p
          where p.landlord_id = public.auth_landlord_id()
        )
      )
      with check (
        property_id in (
          select p.id
          from public.property p
          where p.landlord_id = public.auth_landlord_id()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'house_rule'
      and policyname = 'tenant: view published house rules for leased property'
  ) then
    create policy "tenant: view published house rules for leased property"
      on public.house_rule for select
      using (
        is_published
        and property_id in (select public.auth_tenant_property_ids())
      );
  end if;
end $$;

grant select, insert, update, delete on public.house_rule to authenticated;
grant execute on function public.set_house_rule_updated_at() to authenticated;
