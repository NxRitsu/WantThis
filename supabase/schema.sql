-- ============================================================================
-- WantThis — Schéma de base de données + sécurité (Row Level Security)
-- ----------------------------------------------------------------------------
-- À exécuter UNE FOIS dans Supabase : SQL Editor -> coller tout -> Run.
-- Idempotent autant que possible (drop policy if exists / create or replace).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- Profil applicatif, lié 1-1 à l'utilisateur Auth de Supabase.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- Un groupe = une "famille". invite_code sert à rejoindre le groupe.
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Appartenance N-N entre utilisateurs et groupes.
create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Un cadeau appartient à un membre (owner_id) au sein d'un groupe.
create table if not exists public.gifts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  url        text,
  price      numeric(10, 2),
  created_at timestamptz not null default now()
);

-- Réservation d'un cadeau. gift_id UNIQUE => un seul réservataire par cadeau.
create table if not exists public.reservations (
  id          uuid primary key default gen_random_uuid(),
  gift_id     uuid not null unique references public.gifts (id) on delete cascade,
  reserved_by uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. FONCTIONS HELPER (SECURITY DEFINER)
--    Elles s'exécutent avec les droits du créateur => contournent le RLS en
--    interne, ce qui évite la récursion infinie dans les policies.
-- ----------------------------------------------------------------------------

-- L'utilisateur _user_id est-il membre du groupe _group_id ?
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id
  );
$$;

-- L'utilisateur courant partage-t-il au moins un groupe avec _other ?
create or replace function public.shares_group_with(_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = _other
  );
$$;

-- Génère un code d'invitation court, lisible (6 caractères, sans 0/O/1/I ambigus).
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Crée un groupe ET ajoute le créateur comme membre, dans la même transaction.
-- Réessaie si collision de code (très improbable).
create or replace function public.create_group(_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g    public.groups;
  code text;
begin
  if coalesce(trim(_name), '') = '' then
    raise exception 'Le nom du groupe est requis';
  end if;

  loop
    code := public.gen_invite_code();
    begin
      insert into public.groups (name, invite_code, created_by)
      values (trim(_name), code, auth.uid())
      returning * into g;
      exit;
    exception when unique_violation then
      -- collision sur invite_code : on régénère
    end;
  end loop;

  insert into public.group_members (group_id, user_id)
  values (g.id, auth.uid());

  return g;
end;
$$;

-- Rejoint un groupe via son code d'invitation (insensible à la casse).
create or replace function public.join_group_by_code(_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid
  from public.groups
  where invite_code = upper(trim(_code));

  if gid is null then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return gid;
end;
$$;

-- Crée automatiquement le profil à l'inscription d'un nouvel utilisateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. ACTIVATION DU RLS
-- ----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.gifts         enable row level security;
alter table public.reservations  enable row level security;

-- ----------------------------------------------------------------------------
-- 4. POLICIES
-- ----------------------------------------------------------------------------

-- ---- profiles ----
-- On voit son propre profil + ceux des membres des groupes que l'on partage.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid() or public.shares_group_with(id)
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---- groups ----
-- On voit les groupes dont on est membre.
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id, auth.uid()));
-- (la création passe par la fonction create_group, pas par un INSERT direct)

-- ---- group_members ----
-- On voit les membres des groupes auxquels on appartient.
drop policy if exists "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members
  for select using (public.is_group_member(group_id, auth.uid()));
-- (rejoindre passe par la fonction join_group_by_code)

-- On peut quitter un groupe (supprimer sa propre appartenance).
drop policy if exists "group_members_delete_self" on public.group_members;
create policy "group_members_delete_self" on public.group_members
  for delete using (user_id = auth.uid());

-- ---- gifts ----
-- On voit tous les cadeaux des groupes dont on est membre (y compris les siens).
drop policy if exists "gifts_select_member" on public.gifts;
create policy "gifts_select_member" on public.gifts
  for select using (public.is_group_member(group_id, auth.uid()));

-- On n'ajoute que ses propres cadeaux, dans un groupe dont on est membre.
drop policy if exists "gifts_insert_own" on public.gifts;
create policy "gifts_insert_own" on public.gifts
  for insert with check (
    owner_id = auth.uid() and public.is_group_member(group_id, auth.uid())
  );

-- On ne modifie / supprime que ses propres cadeaux.
drop policy if exists "gifts_update_own" on public.gifts;
create policy "gifts_update_own" on public.gifts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "gifts_delete_own" on public.gifts;
create policy "gifts_delete_own" on public.gifts
  for delete using (owner_id = auth.uid());

-- ---- reservations (LE CŒUR : réservation secrète) ----
-- SELECT : on voit une réservation si l'on est membre du groupe du cadeau
--          ET que l'on n'en est PAS le propriétaire.
--          => Le propriétaire d'une liste ne reçoit JAMAIS les lignes de
--             réservation de ses propres cadeaux : la surprise est préservée
--             côté serveur, impossible à contourner depuis le frontend.
drop policy if exists "reservations_select_not_owner" on public.reservations;
create policy "reservations_select_not_owner" on public.reservations
  for select using (
    exists (
      select 1
      from public.gifts g
      join public.group_members gm on gm.group_id = g.group_id
      where g.id = reservations.gift_id
        and gm.user_id = auth.uid()
        and g.owner_id <> auth.uid()
    )
  );

-- INSERT : on réserve un cadeau d'un autre membre de notre groupe (jamais le sien).
drop policy if exists "reservations_insert" on public.reservations;
create policy "reservations_insert" on public.reservations
  for insert with check (
    reserved_by = auth.uid()
    and exists (
      select 1
      from public.gifts g
      join public.group_members gm on gm.group_id = g.group_id
      where g.id = gift_id
        and gm.user_id = auth.uid()
        and g.owner_id <> auth.uid()
    )
  );

-- DELETE : seul le réservataire peut annuler sa réservation.
drop policy if exists "reservations_delete_own" on public.reservations;
create policy "reservations_delete_own" on public.reservations
  for delete using (reserved_by = auth.uid());

-- ============================================================================
-- FIN
-- ============================================================================
