create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  family_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cultural_items (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  family_code text not null,
  item jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, owner_id)
);

alter table public.profiles enable row level security;
alter table public.cultural_items enable row level security;

create or replace function public.current_family_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select family_code
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

drop policy if exists "profiles_select_family" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_upsert_self" on public.profiles;
create policy "profiles_upsert_self"
on public.profiles for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "items_select_family" on public.cultural_items;
create policy "items_select_family"
on public.cultural_items for select
to authenticated
using (family_code = public.current_family_code());

drop policy if exists "items_write_self" on public.cultural_items;
create policy "items_write_self"
on public.cultural_items for all
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and family_code = public.current_family_code()
);

create index if not exists cultural_items_family_updated_idx
on public.cultural_items (family_code, updated_at desc);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cultural_items to authenticated;
grant execute on function public.current_family_code() to authenticated;
