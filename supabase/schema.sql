-- VinFuse — Supabase schema
-- Run in the SQL editor: https://supabase.com/dashboard/project/_/sql
-- Then set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.

create extension if not exists "pgcrypto";

create table if not exists public.dealerships (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('sales_lot', 'service_center')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('manager', 'porter')),
  created_at timestamptz not null default now()
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  code text not null unique,
  email text not null default '',
  role text not null check (role in ('manager', 'porter')),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists public.audit_sessions (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  started_by uuid not null references public.profiles (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  session_id uuid not null references public.audit_sessions (id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  vin text not null,
  scanned_by uuid not null references public.profiles (id),
  scanned_at timestamptz not null default now(),
  source text not null check (source in ('barcode', 'manual', 'ocr'))
);

alter table public.scans drop constraint if exists scans_source_check;
alter table public.scans add constraint scans_source_check check (source in ('barcode', 'manual', 'ocr'));

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  vin text not null,
  stock_number text not null default '',
  year text not null default '',
  make text not null default '',
  model text not null default '',
  color text not null default '',
  expected_location_name text not null default '',
  expected_location_id uuid references public.locations (id) on delete set null,
  imported_at timestamptz not null default now()
);

create index if not exists locations_dealer_idx on public.locations (dealership_id);
create index if not exists profiles_dealer_idx on public.profiles (dealership_id);
create index if not exists scans_session_idx on public.scans (session_id, scanned_at desc);
create index if not exists scans_dealer_idx on public.scans (dealership_id, scanned_at desc);
create index if not exists inventory_dealer_vin_idx on public.inventory_items (dealership_id, vin);
create index if not exists audit_open_idx on public.audit_sessions (dealership_id, location_id, status);

create or replace function public.vinfuse_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.invites%rowtype;
  dealer_id uuid;
  invite_code text;
begin
  invite_code := upper(coalesce(new.raw_user_meta_data->>'invite_code', ''));
  if invite_code <> '' then
    select * into invite_row from public.invites where code = invite_code and used_at is null limit 1;
    if invite_row.id is null then
      raise exception 'Invalid invite code';
    end if;
    insert into public.profiles (id, dealership_id, email, full_name, role)
    values (
      new.id,
      invite_row.dealership_id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      invite_row.role
    );
    update public.invites set used_at = now() where id = invite_row.id;
    return new;
  end if;

  insert into public.dealerships (name, plan)
  values (coalesce(nullif(new.raw_user_meta_data->>'dealership_name', ''), 'My Dealership'), 'free')
  returning id into dealer_id;

  insert into public.locations (dealership_id, name, kind)
  values (dealer_id, 'Main Lot', 'sales_lot');

  insert into public.profiles (id, dealership_id, email, full_name, role)
  values (
    new.id,
    dealer_id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'manager'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.vinfuse_handle_new_user();

alter table public.dealerships enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.audit_sessions enable row level security;
alter table public.scans enable row level security;
alter table public.inventory_items enable row level security;

create or replace function public.vinfuse_dealer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select dealership_id from public.profiles where id = auth.uid()
$$;

drop policy if exists dealerships_select on public.dealerships;
create policy dealerships_select on public.dealerships
  for select using (id = public.vinfuse_dealer_id());
drop policy if exists dealerships_update on public.dealerships;
create policy dealerships_update on public.dealerships
  for update using (id = public.vinfuse_dealer_id());

drop policy if exists locations_all on public.locations;
create policy locations_all on public.locations
  for all using (dealership_id = public.vinfuse_dealer_id())
  with check (dealership_id = public.vinfuse_dealer_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (dealership_id = public.vinfuse_dealer_id());

drop policy if exists invites_all on public.invites;
create policy invites_all on public.invites
  for all using (dealership_id = public.vinfuse_dealer_id())
  with check (dealership_id = public.vinfuse_dealer_id());

drop policy if exists audit_all on public.audit_sessions;
create policy audit_all on public.audit_sessions
  for all using (dealership_id = public.vinfuse_dealer_id())
  with check (dealership_id = public.vinfuse_dealer_id());

drop policy if exists scans_all on public.scans;
create policy scans_all on public.scans
  for all using (dealership_id = public.vinfuse_dealer_id())
  with check (dealership_id = public.vinfuse_dealer_id());

drop policy if exists inventory_all on public.inventory_items;
create policy inventory_all on public.inventory_items
  for all using (dealership_id = public.vinfuse_dealer_id())
  with check (dealership_id = public.vinfuse_dealer_id());
