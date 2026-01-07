-- Shop products + admin-only editing
-- Run this in Supabase SQL Editor.
--
-- What you get:
-- 1) public.profiles (id, is_admin)
-- 2) public.products (store items)
-- 3) RLS policies: everyone can read products; only admins can insert/update/delete
--
-- IMPORTANT:
-- If you already had users before running this, the BACKFILL step below creates missing
-- profiles rows so the admin flag can be set.

-- =========================
-- 1) Profiles (admin flag)
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

alter table public.profiles enable row level security;

-- BACKFILL: create a profiles row for any existing auth user (critical if users existed already)
insert into public.profiles (id)
select id
from auth.users
on conflict (id) do nothing;

-- authenticated users can read their own profile row
drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- allow the client to insert their own row (useful if trigger fails for some reason)
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- prevent self-escalation in the client (only run admin flips from SQL editor / service role)
drop policy if exists "No profile updates from client" on public.profiles;
create policy "No profile updates from client"
  on public.profiles
  for update
  to authenticated
  using (false);

-- Auto-create a profiles row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: are we an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

-- =========================
-- 2) Products
-- =========================

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  collection text not null,
  price integer not null check (price >= 0),
  rating numeric(3,1) not null default 0,
  stock integer not null default 0 check (stock >= 0),
  tag text,
  image text,
  description text,
  details text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table already existed, ensure expected columns are present
alter table public.products add column if not exists name text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists collection text;
alter table public.products add column if not exists price integer;
alter table public.products add column if not exists rating numeric(3,1);
alter table public.products add column if not exists stock integer;
alter table public.products add column if not exists tag text;
alter table public.products add column if not exists image text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists details text[];
alter table public.products add column if not exists created_at timestamptz;
alter table public.products add column if not exists updated_at timestamptz;

create index if not exists products_category_idx on public.products (category);
create index if not exists products_collection_idx on public.products (collection);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- Everyone can read products (public shop)
drop policy if exists "Products are readable by everyone" on public.products;
create policy "Products are readable by everyone"
  on public.products
  for select
  to anon, authenticated
  using (true);

-- Admin-only writes
drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products
  for delete
  to authenticated
  using (public.is_admin());

-- =========================
-- 3) Seed products (optional)
-- =========================

insert into public.products (id, name, category, collection, price, rating, stock, tag, image, description, details)
values
  (
    'starlight-kit',
    'Starlight Study Kit',
    'Study tools',
    'Astral Study',
    96,
    4.9,
    9,
    'Bundle',
    './assets/images/hero-approach.png',
    'Moonlit essentials for long-form spell theory sessions.',
    array['Moonbeam ink vial','Skyglass lamp','Focus rune patch']
  ),
  (
    'warding-satchel',
    'Warding Satchel',
    'Protection',
    'Wardcraft',
    74,
    4.7,
    4,
    'Best seller',
    './assets/images/These_are_the_202512031938.jpeg',
    'Layered wards woven into a weatherproof field satchel.',
    array['Triple-stitched wards','Weather seal','Notebook divider']
  ),
  (
    'aurora-tea',
    'Aurora Calm Tea',
    'Wellness',
    'Restorative',
    32,
    4.6,
    18,
    'Soothing',
    './assets/images/Image_202512081359.jpeg',
    'Herbal blend to steady focus before summoning practice.',
    array['Juniper petals','Lavender steam','Honeyed cedar']
  )
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  collection = excluded.collection,
  price = excluded.price,
  rating = excluded.rating,
  stock = excluded.stock,
  tag = excluded.tag,
  image = excluded.image,
  description = excluded.description,
  details = excluded.details,
  updated_at = now();

-- =========================
-- 4) Make yourself an admin
-- =========================
-- Find your user id (UUID) in: Authentication → Users.
-- Then run:
-- update public.profiles set is_admin = true where id = 'YOUR-USER-UUID-HERE';
