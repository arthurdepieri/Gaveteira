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
alter table public.profiles add column if not exists role text not null default 'user';

alter table public.profiles
alter column family_code set default 'social';

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check check (role in ('user', 'admin'));

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

alter table public.cultural_items
alter column family_code set default 'social';

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create table if not exists public.curated_recommendations (
  id text primary key,
  item_id text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  curator_id uuid not null references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, owner_id)
);

create table if not exists public.sync_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_change_id text not null,
  item_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  payload jsonb,
  local_updated_at timestamptz,
  cloud_applied_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'synced', 'failed', 'conflict')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_change_id)
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  item_owner_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  event_type text not null check (event_type in ('added', 'updated', 'finished', 'abandoned', 'favorite', 'wishlist', 'diary')),
  diary_id text,
  item_snapshot jsonb not null,
  visibility text not null default 'friends' check (visibility in ('friends', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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

create index if not exists curated_recommendations_owner_idx
on public.curated_recommendations (owner_id, item_id);

create index if not exists curated_recommendations_created_idx
on public.curated_recommendations (created_at desc);

create index if not exists sync_changes_user_status_idx
on public.sync_changes (user_id, status, updated_at desc);

create index if not exists activity_events_actor_created_idx
on public.activity_events (actor_id, created_at desc);

create index if not exists activity_events_item_created_idx
on public.activity_events (item_owner_id, item_id, created_at desc);

create index if not exists admin_audit_logs_created_idx
on public.admin_audit_logs (created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gaveteira-images',
  'gaveteira-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.cultural_items enable row level security;
alter table public.friend_requests enable row level security;
alter table public.curated_recommendations enable row level security;
alter table public.sync_changes enable row level security;
alter table public.activity_events enable row level security;
alter table public.admin_audit_logs enable row level security;

drop function if exists public.current_family_code();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
$$;

create or replace function public.are_friends(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select left_user_id is not null
    and right_user_id is not null
    and left_user_id <> right_user_id
    and exists (
      select 1
      from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.requester_id = left_user_id and fr.addressee_id = right_user_id)
          or (fr.addressee_id = left_user_id and fr.requester_id = right_user_id)
        )
    )
$$;

create or replace function public.sanitize_social_item(raw_item jsonb)
returns jsonb
language sql
stable
as $$
  select jsonb_set(
    coalesce(raw_item, '{}'::jsonb),
    '{diary}',
    coalesce((
      select jsonb_agg(entry)
      from jsonb_array_elements(
        case
          when jsonb_typeof(coalesce(raw_item, '{}'::jsonb)->'diary') = 'array'
          then coalesce(raw_item, '{}'::jsonb)->'diary'
          else '[]'::jsonb
        end
      ) entry
      where coalesce(entry->>'visibility', 'private') = 'friends'
    ), '[]'::jsonb),
    true
  )
$$;

create or replace function public.get_social_items()
returns table (
  id text,
  owner_id uuid,
  owner_name text,
  family_code text,
  item jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    ci.id,
    ci.owner_id,
    coalesce(p.display_name, p.email, 'Pessoa da Gaveteira') as owner_name,
    ci.family_code,
    case
      when ci.owner_id = auth.uid() then ci.item
      else public.sanitize_social_item(ci.item)
    end as item,
    ci.updated_at
  from public.cultural_items ci
  join public.profiles p on p.id = ci.owner_id
  where auth.uid() is not null
    and (
      ci.owner_id = auth.uid()
      or (
        coalesce(ci.item->>'visibility', 'friends') <> 'private'
        and public.are_friends(auth.uid(), ci.owner_id)
      )
      or (
        coalesce(ci.item->>'visibility', 'friends') <> 'private'
        and exists (
          select 1
          from public.curated_recommendations cr
          where cr.item_id = ci.id
            and cr.owner_id = ci.owner_id
        )
      )
    )
  order by ci.updated_at desc
$$;

create or replace function public.get_admin_curatable_items()
returns table (
  id text,
  owner_id uuid,
  owner_name text,
  family_code text,
  item jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    ci.id,
    ci.owner_id,
    coalesce(p.display_name, p.email, 'Pessoa da Gaveteira') as owner_name,
    ci.family_code,
    public.sanitize_social_item(ci.item) as item,
    ci.updated_at
  from public.cultural_items ci
  join public.profiles p on p.id = ci.owner_id
  where public.is_admin()
    and ci.owner_id <> auth.uid()
    and coalesce(ci.item->>'visibility', 'friends') <> 'private'
  order by ci.updated_at desc
  limit 120
$$;

create or replace function public.get_curated_recommendations()
returns table (
  recommendation_id text,
  item_id text,
  owner_id uuid,
  owner_name text,
  curator_id uuid,
  curator_name text,
  note text,
  created_at timestamptz,
  id text,
  family_code text,
  item jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    cr.id as recommendation_id,
    cr.item_id,
    cr.owner_id,
    coalesce(owner_profile.display_name, owner_profile.email, 'Pessoa da Gaveteira') as owner_name,
    cr.curator_id,
    coalesce(curator_profile.display_name, curator_profile.email, 'Curadoria Gaveteira') as curator_name,
    cr.note,
    cr.created_at,
    ci.id,
    ci.family_code,
    public.sanitize_social_item(ci.item) as item,
    ci.updated_at
  from public.curated_recommendations cr
  join public.cultural_items ci
    on ci.id = cr.item_id
   and ci.owner_id = cr.owner_id
  join public.profiles owner_profile on owner_profile.id = cr.owner_id
  left join public.profiles curator_profile on curator_profile.id = cr.curator_id
  where auth.uid() is not null
    and coalesce(ci.item->>'visibility', 'friends') <> 'private'
  order by cr.created_at desc
$$;

create or replace function public.get_admin_overview()
returns table (
  profile_id uuid,
  display_name text,
  email text,
  username text,
  bio text,
  avatar_url text,
  favorite_categories text[],
  invite_code text,
  family_code text,
  role text,
  item_count bigint,
  last_activity timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    p.id as profile_id,
    p.display_name,
    p.email,
    p.username,
    p.bio,
    p.avatar_url,
    p.favorite_categories,
    p.invite_code,
    p.family_code,
    p.role,
    count(ci.id) as item_count,
    max(ci.updated_at) as last_activity
  from public.profiles p
  left join public.cultural_items ci on ci.owner_id = p.id
  where public.is_admin()
  group by p.id
  order by p.display_name asc
$$;

create or replace function public.activity_type_for_item(raw_item jsonb, was_created boolean)
returns text
language sql
stable
as $$
  select case
    when exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(coalesce(raw_item, '{}'::jsonb)->'diary') = 'array'
          then coalesce(raw_item, '{}'::jsonb)->'diary'
          else '[]'::jsonb
        end
      ) entry
      where coalesce(entry->>'visibility', 'private') = 'friends'
    ) then 'diary'
    when lower(coalesce(raw_item->>'status', '')) like '%abandon%' then 'abandoned'
    when lower(coalesce(raw_item->>'status', '')) ~ '(zerado|lido|ouvido|assistido|finalizad|terminad)' then 'finished'
    when case
      when coalesce(raw_item->>'rating', '') ~ '^[0-9]+(\.[0-9]+)?$'
      then (raw_item->>'rating')::numeric
      else 0
    end >= 4.5 then 'favorite'
    when lower(coalesce(raw_item->>'status', '')) like 'quero%' then 'wishlist'
    when was_created then 'added'
    else 'updated'
  end
$$;

create or replace function public.latest_public_diary_id(raw_item jsonb)
returns text
language sql
stable
as $$
  select entry->>'id'
  from jsonb_array_elements(
    case
      when jsonb_typeof(coalesce(raw_item, '{}'::jsonb)->'diary') = 'array'
      then coalesce(raw_item, '{}'::jsonb)->'diary'
      else '[]'::jsonb
    end
  ) entry
  where coalesce(entry->>'visibility', 'private') = 'friends'
  order by coalesce(entry->>'date', '') desc
  limit 1
$$;

create or replace function public.apply_item_change(
  requested_operation text,
  requested_item_id text,
  requested_payload jsonb default null,
  requested_local_updated_at timestamptz default null,
  requested_client_change_id text default null
)
returns table (
  change_id uuid,
  status text,
  operation text,
  item_id text,
  cloud_applied_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_operation text := lower(coalesce(requested_operation, ''));
  normalized_client_change_id text := coalesce(nullif(requested_client_change_id, ''), normalized_operation || ':' || requested_item_id);
  normalized_item_id text := coalesce(nullif(requested_item_id, ''), requested_payload->>'id');
  applied_at timestamptz := now();
  was_created boolean := false;
  event_type text;
begin
  if current_user_id is null then
    raise exception 'Sessão obrigatória para sincronizar.';
  end if;

  if normalized_operation not in ('upsert', 'delete') then
    raise exception 'Operação de sync inválida.';
  end if;

  if normalized_item_id is null or normalized_item_id = '' then
    raise exception 'A ficha não tem id para sincronizar.';
  end if;

  insert into public.sync_changes (
    user_id,
    client_change_id,
    item_id,
    operation,
    payload,
    local_updated_at,
    status,
    updated_at
  )
  values (
    current_user_id,
    normalized_client_change_id,
    normalized_item_id,
    normalized_operation,
    requested_payload,
    requested_local_updated_at,
    'pending',
    applied_at
  )
  on conflict (user_id, client_change_id) do update
  set
    item_id = excluded.item_id,
    operation = excluded.operation,
    payload = excluded.payload,
    local_updated_at = excluded.local_updated_at,
    status = 'pending',
    error_message = null,
    updated_at = applied_at;

  if normalized_operation = 'delete' then
    delete from public.cultural_items
    where id = normalized_item_id
      and owner_id = current_user_id;

    update public.sync_changes
    set status = 'synced',
        cloud_applied_at = applied_at,
        updated_at = applied_at
    where user_id = current_user_id
      and client_change_id = normalized_client_change_id
    returning id into change_id;

    status := 'synced';
    operation := normalized_operation;
    item_id := normalized_item_id;
    cloud_applied_at := applied_at;
    return next;
    return;
  end if;

  if requested_payload is null or jsonb_typeof(requested_payload) <> 'object' then
    raise exception 'Payload da ficha inválido.';
  end if;

  select not exists (
    select 1
    from public.cultural_items
    where id = normalized_item_id
      and owner_id = current_user_id
  ) into was_created;

  insert into public.cultural_items (id, owner_id, family_code, item, updated_at)
  values (
    normalized_item_id,
    current_user_id,
    'social',
    requested_payload,
    coalesce(requested_local_updated_at, applied_at)
  )
  on conflict (id, owner_id) do update
  set
    family_code = excluded.family_code,
    item = excluded.item,
    updated_at = greatest(public.cultural_items.updated_at, excluded.updated_at);

  event_type := public.activity_type_for_item(requested_payload, was_created);

  if coalesce(requested_payload->>'visibility', 'friends') <> 'private' then
    insert into public.activity_events (
      actor_id,
      item_owner_id,
      item_id,
      event_type,
      diary_id,
      item_snapshot,
      visibility,
      created_at
    )
    values (
      current_user_id,
      current_user_id,
      normalized_item_id,
      event_type,
      case when event_type = 'diary' then public.latest_public_diary_id(requested_payload) else null end,
      requested_payload,
      'friends',
      applied_at
    );
  end if;

  update public.sync_changes
  set status = 'synced',
      cloud_applied_at = applied_at,
      updated_at = applied_at
  where user_id = current_user_id
    and client_change_id = normalized_client_change_id
  returning id into change_id;

  status := 'synced';
  operation := normalized_operation;
  item_id := normalized_item_id;
  cloud_applied_at := applied_at;
  return next;
exception
  when others then
    if current_user_id is not null and normalized_client_change_id is not null then
      insert into public.sync_changes (
        user_id,
        client_change_id,
        item_id,
        operation,
        payload,
        local_updated_at,
        status,
        error_message,
        updated_at
      )
      values (
        current_user_id,
        normalized_client_change_id,
        coalesce(normalized_item_id, 'unknown'),
        coalesce(nullif(normalized_operation, ''), 'upsert'),
        requested_payload,
        requested_local_updated_at,
        'failed',
        sqlerrm,
        now()
      )
      on conflict (user_id, client_change_id) do update
      set status = 'failed',
          error_message = sqlerrm,
          updated_at = now();
    end if;
    raise;
end
$$;

create or replace function public.get_social_feed(feed_limit integer default 80)
returns table (
  event_id uuid,
  event_type text,
  actor_id uuid,
  actor_name text,
  item_owner_id uuid,
  item_id text,
  item jsonb,
  diary_id text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    ae.id as event_id,
    ae.event_type,
    ae.actor_id,
    coalesce(p.display_name, p.email, 'Pessoa da Gaveteira') as actor_name,
    ae.item_owner_id,
    ae.item_id,
    case
      when ae.item_owner_id = auth.uid() then ae.item_snapshot
      else public.sanitize_social_item(ae.item_snapshot)
    end as item,
    ae.diary_id,
    ae.created_at
  from public.activity_events ae
  join public.profiles p on p.id = ae.actor_id
  where auth.uid() is not null
    and (
      ae.item_owner_id = auth.uid()
      or (
        ae.visibility in ('friends', 'public')
        and coalesce(ae.item_snapshot->>'visibility', 'friends') <> 'private'
        and public.are_friends(auth.uid(), ae.item_owner_id)
      )
    )
  order by ae.created_at desc
  limit least(greatest(coalesce(feed_limit, 80), 1), 200)
$$;

create or replace function public.set_profile_role(target_profile_id uuid, next_role text)
returns table (
  profile_id uuid,
  role text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  previous_role text;
  normalized_role text := lower(coalesce(next_role, ''));
begin
  if not public.is_admin() then
    raise exception 'Apenas admins podem alterar papéis.';
  end if;

  if normalized_role not in ('user', 'admin') then
    raise exception 'Papel inválido.';
  end if;

  if target_profile_id = auth.uid() and normalized_role <> 'admin' then
    raise exception 'Você não pode remover seu próprio papel de admin.';
  end if;

  select p.role
  into previous_role
  from public.profiles p
  where p.id = target_profile_id;

  if previous_role is null then
    raise exception 'Perfil não encontrado.';
  end if;

  update public.profiles
  set role = normalized_role,
      updated_at = now()
  where id = target_profile_id;

  insert into public.admin_audit_logs (actor_id, target_user_id, action, details)
  values (
    auth.uid(),
    target_profile_id,
    case when normalized_role = 'admin' then 'promote_admin' else 'demote_admin' end,
    jsonb_build_object('previous_role', previous_role, 'next_role', normalized_role)
  );

  profile_id := target_profile_id;
  role := normalized_role;
  return next;
end
$$;

create or replace function public.get_admin_logs(log_limit integer default 40)
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  target_user_id uuid,
  target_name text,
  action text,
  details jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    log.id,
    log.actor_id,
    coalesce(actor.display_name, actor.email, 'Admin') as actor_name,
    log.target_user_id,
    coalesce(target.display_name, target.email, 'Pessoa da Gaveteira') as target_name,
    log.action,
    log.details,
    log.created_at
  from public.admin_audit_logs log
  left join public.profiles actor on actor.id = log.actor_id
  left join public.profiles target on target.id = log.target_user_id
  where public.is_admin()
  order by log.created_at desc
  limit least(greatest(coalesce(log_limit, 40), 1), 100)
$$;

create or replace function public.log_curated_recommendation_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  action_name text;
  actor uuid;
  target uuid;
  target_item text;
begin
  if tg_op = 'DELETE' then
    action_name := 'remove_curation';
    actor := auth.uid();
    target := old.owner_id;
    target_item := old.item_id;
  else
    action_name := 'curate_item';
    actor := coalesce(new.curator_id, auth.uid());
    target := new.owner_id;
    target_item := new.item_id;
  end if;

  insert into public.admin_audit_logs (actor_id, target_user_id, action, details)
  values (
    actor,
    target,
    action_name,
    jsonb_build_object('item_id', target_item, 'source', 'curated_recommendations')
  );

  return coalesce(new, old);
end
$$;

drop trigger if exists curated_recommendations_admin_log on public.curated_recommendations;
create trigger curated_recommendations_admin_log
after insert or update or delete on public.curated_recommendations
for each row execute function public.log_curated_recommendation_change();

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

drop policy if exists "admin_audit_logs_select_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_select_admin"
on public.admin_audit_logs for select
to authenticated
using (public.is_admin());

drop policy if exists "admin_audit_logs_insert_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_insert_admin"
on public.admin_audit_logs for insert
to authenticated
with check (public.is_admin() and actor_id = auth.uid());

drop policy if exists "items_select_family" on public.cultural_items;
drop policy if exists "items_select_social" on public.cultural_items;
drop policy if exists "items_select_self" on public.cultural_items;
create policy "items_select_self"
on public.cultural_items for select
to authenticated
using (owner_id = auth.uid());

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
using (requester_id = auth.uid() or addressee_id = auth.uid() or public.is_admin());

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

drop policy if exists "curated_recommendations_select_authenticated" on public.curated_recommendations;
create policy "curated_recommendations_select_authenticated"
on public.curated_recommendations for select
to authenticated
using (true);

drop policy if exists "curated_recommendations_insert_admin" on public.curated_recommendations;
create policy "curated_recommendations_insert_admin"
on public.curated_recommendations for insert
to authenticated
with check (public.is_admin() and curator_id = auth.uid());

drop policy if exists "curated_recommendations_update_admin" on public.curated_recommendations;
create policy "curated_recommendations_update_admin"
on public.curated_recommendations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "curated_recommendations_delete_admin" on public.curated_recommendations;
create policy "curated_recommendations_delete_admin"
on public.curated_recommendations for delete
to authenticated
using (public.is_admin());

drop policy if exists "sync_changes_select_self" on public.sync_changes;
create policy "sync_changes_select_self"
on public.sync_changes for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "sync_changes_write_self" on public.sync_changes;
create policy "sync_changes_write_self"
on public.sync_changes for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "activity_events_select_social" on public.activity_events;
create policy "activity_events_select_social"
on public.activity_events for select
to authenticated
using (
  item_owner_id = auth.uid()
  or (
    visibility in ('friends', 'public')
    and coalesce(item_snapshot->>'visibility', 'friends') <> 'private'
    and public.are_friends(auth.uid(), item_owner_id)
  )
);

drop policy if exists "activity_events_insert_self" on public.activity_events;
create policy "activity_events_insert_self"
on public.activity_events for insert
to authenticated
with check (actor_id = auth.uid() and item_owner_id = auth.uid());

drop policy if exists "gaveteira_images_public_read" on storage.objects;
create policy "gaveteira_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'gaveteira-images');

drop policy if exists "gaveteira_images_insert_own_folder" on storage.objects;
create policy "gaveteira_images_insert_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gaveteira-images'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "gaveteira_images_update_own_folder" on storage.objects;
create policy "gaveteira_images_update_own_folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'gaveteira-images'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'gaveteira-images'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "gaveteira_images_delete_own_folder" on storage.objects;
create policy "gaveteira_images_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gaveteira-images'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create index if not exists cultural_items_family_updated_idx
on public.cultural_items (family_code, updated_at desc);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cultural_items to authenticated;
revoke update on public.friend_requests from authenticated;
grant select, insert, delete on public.friend_requests to authenticated;
grant update (status, updated_at) on public.friend_requests to authenticated;
grant select, insert, update, delete on public.curated_recommendations to authenticated;
grant select, insert, update on public.sync_changes to authenticated;
grant select, insert on public.activity_events to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.sanitize_social_item(jsonb) to authenticated;
grant execute on function public.get_social_items() to authenticated;
grant execute on function public.get_admin_curatable_items() to authenticated;
grant execute on function public.get_curated_recommendations() to authenticated;
grant execute on function public.get_admin_overview() to authenticated;
grant execute on function public.activity_type_for_item(jsonb, boolean) to authenticated;
grant execute on function public.latest_public_diary_id(jsonb) to authenticated;
grant execute on function public.apply_item_change(text, text, jsonb, timestamptz, text) to authenticated;
grant execute on function public.get_social_feed(integer) to authenticated;
grant execute on function public.set_profile_role(uuid, text) to authenticated;
grant execute on function public.get_admin_logs(integer) to authenticated;

revoke insert (role), update (role) on public.profiles from authenticated;

notify pgrst, 'reload schema';
