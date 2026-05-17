create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  family_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists favorite_categories text[] not null default '{}'::text[];
alter table public.profiles add column if not exists invite_code text;

update public.profiles
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where invite_code is null;

alter table public.profiles
alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

alter table public.profiles
alter column invite_code set not null;

create table if not exists public.cultural_items (
  id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  family_code text not null,
  item jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, owner_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null and username <> '';

create unique index if not exists profiles_invite_code_unique
on public.profiles (invite_code);

create unique index if not exists friend_requests_pair_unique
on public.friend_requests (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
)
where status <> 'rejected';

alter table public.profiles enable row level security;
alter table public.cultural_items enable row level security;
alter table public.friend_requests enable row level security;

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
drop policy if exists "items_select_social" on public.cultural_items;
create policy "items_select_social"
on public.cultural_items for select
to authenticated
using (
  owner_id = auth.uid()
  or (
    coalesce(item->>'visibility', 'friends') <> 'private'
    and exists (
      select 1
      from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.requester_id = auth.uid() and fr.addressee_id = owner_id)
          or (fr.addressee_id = auth.uid() and fr.requester_id = owner_id)
        )
    )
  )
);

drop policy if exists "items_write_self" on public.cultural_items;
create policy "items_write_self"
on public.cultural_items for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "friend_requests_select_own" on public.friend_requests;
create policy "friend_requests_select_own"
on public.friend_requests for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friend_requests_insert_self" on public.friend_requests;
create policy "friend_requests_insert_self"
on public.friend_requests for insert
to authenticated
with check (requester_id = auth.uid() and addressee_id <> auth.uid());

drop policy if exists "friend_requests_update_received" on public.friend_requests;
create policy "friend_requests_update_received"
on public.friend_requests for update
to authenticated
using (addressee_id = auth.uid())
with check (addressee_id = auth.uid());

drop policy if exists "friend_requests_delete_own" on public.friend_requests;
create policy "friend_requests_delete_own"
on public.friend_requests for delete
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

create index if not exists cultural_items_family_updated_idx
on public.cultural_items (family_code, updated_at desc);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cultural_items to authenticated;
grant select, insert, update, delete on public.friend_requests to authenticated;
grant execute on function public.current_family_code() to authenticated;

notify pgrst, 'reload schema';
