do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum ('consumer', 'producer', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_unit' and typnamespace = 'public'::regnamespace) then
    create type public.product_unit as enum ('piece','kg','g','litre','botte','douzaine');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  avatar_url text,
  phone text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'consumer');
  exception when others then
    v_role := 'consumer';
  end;

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
grant select on public.labels to anon, authenticated;
grant all on public.labels to service_role;
alter table public.labels enable row level security;
drop policy if exists "labels_public_read" on public.labels;
create policy "labels_public_read" on public.labels for select to anon, authenticated using (true);

create table if not exists public.producers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  farm_name text not null,
  description text,
  city text,
  lat double precision,
  lng double precision,
  avatar_url text,
  cover_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.producers to anon, authenticated;
grant insert, update on public.producers to authenticated;
grant all on public.producers to service_role;
alter table public.producers enable row level security;
drop policy if exists "producers_public_read" on public.producers;
drop policy if exists "producers_insert_own" on public.producers;
drop policy if exists "producers_update_own" on public.producers;
create policy "producers_public_read" on public.producers for select to anon, authenticated using (is_active = true or user_id = auth.uid());
create policy "producers_insert_own" on public.producers for insert to authenticated with check (user_id = auth.uid() and public.has_role(auth.uid(), 'producer'));
create policy "producers_update_own" on public.producers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists producers_touch_updated_at on public.producers;
create trigger producers_touch_updated_at before update on public.producers for each row execute function public.touch_updated_at();

create table if not exists public.hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  lat double precision,
  lng double precision,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.hubs to anon, authenticated;
grant all on public.hubs to service_role;
alter table public.hubs enable row level security;
drop policy if exists "hubs_public_read" on public.hubs;
create policy "hubs_public_read" on public.hubs for select to anon, authenticated using (is_active = true);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.producers(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text,
  description text,
  price_cents int not null check (price_cents >= 0),
  unit public.product_unit not null default 'piece',
  stock int not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_producer_idx on public.products(producer_id);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx on public.products(is_active);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
drop policy if exists "products_public_read" on public.products;
drop policy if exists "products_insert_own" on public.products;
drop policy if exists "products_update_own" on public.products;
drop policy if exists "products_delete_own" on public.products;
create policy "products_public_read" on public.products for select to anon, authenticated using (is_active = true or exists (select 1 from public.producers p where p.id = producer_id and p.user_id = auth.uid()));
create policy "products_insert_own" on public.products for insert to authenticated with check (exists (select 1 from public.producers p where p.id = producer_id and p.user_id = auth.uid()));
create policy "products_update_own" on public.products for update to authenticated using (exists (select 1 from public.producers p where p.id = producer_id and p.user_id = auth.uid())) with check (exists (select 1 from public.producers p where p.id = producer_id and p.user_id = auth.uid()));
create policy "products_delete_own" on public.products for delete to authenticated using (exists (select 1 from public.producers p where p.id = producer_id and p.user_id = auth.uid()));
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_updated_at();

create table if not exists public.product_labels (
  product_id uuid not null references public.products(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (product_id, label_id)
);
grant select on public.product_labels to anon, authenticated;
grant insert, delete on public.product_labels to authenticated;
grant all on public.product_labels to service_role;
alter table public.product_labels enable row level security;
drop policy if exists "product_labels_public_read" on public.product_labels;
drop policy if exists "product_labels_write_own" on public.product_labels;
drop policy if exists "product_labels_delete_own" on public.product_labels;
create policy "product_labels_public_read" on public.product_labels for select to anon, authenticated using (true);
create policy "product_labels_write_own" on public.product_labels for insert to authenticated with check (exists (select 1 from public.products pr join public.producers p on p.id = pr.producer_id where pr.id = product_id and p.user_id = auth.uid()));
create policy "product_labels_delete_own" on public.product_labels for delete to authenticated using (exists (select 1 from public.products pr join public.producers p on p.id = pr.producer_id where pr.id = product_id and p.user_id = auth.uid()));

insert into public.categories (slug, name, icon, sort_order) values
  ('fruits','Fruits','🍎',1),
  ('legumes','Légumes','🥬',2),
  ('viandes','Viandes','🥩',3),
  ('fromages','Fromages','🧀',4),
  ('boulangerie','Pain & Boulangerie','🥖',5),
  ('boissons','Boissons','🍷',6),
  ('epicerie','Épicerie','🫙',7),
  ('miel','Miel & Confitures','🍯',8)
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order;

insert into public.labels (slug, name, color) values
  ('bio','Bio','#7CB342'),
  ('aop','AOP','#FFA62B'),
  ('local','100% Local','#1E5E5E'),
  ('artisanal','Artisanal','#D17B27'),
  ('sans-pesticides','Sans pesticides','#558B2F')
on conflict (slug) do update set name = excluded.name, color = excluded.color;

insert into public.hubs (name, address, city, lat, lng, description) values
  ('Hub Marseille Vieux-Port','12 Quai du Port','Marseille',43.2965,5.3698,'Retrait du mardi au samedi 10h-19h'),
  ('Hub Aix Centre','5 Cours Mirabeau','Aix-en-Provence',43.5263,5.4454,'Retrait mercredi & samedi 9h-13h'),
  ('Hub Toulon Port','Quai Cronstadt','Toulon',43.1196,5.9299,'Retrait vendredi 16h-20h'),
  ('Hub Nice Libération','Marché Libération','Nice',43.7167,7.2667,'Retrait jeudi & samedi 8h-14h')
on conflict do nothing;