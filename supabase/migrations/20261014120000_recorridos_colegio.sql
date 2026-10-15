-- Recorridos de colegio: cada microbús escolar tiene su propia ruta privada.
-- ida = recorrido de la mañana (casas -> colegio), regreso = el de la tarde (colegio -> casas).
-- company_id null = ruta pública (101, 42, 29...). Con empresa = privada: no sale en el mapa público.
alter table public.routes add column company_id uuid references public.companies (id) on delete cascade;
create index routes_company_idx on public.routes (company_id);

-- Enlaces privados para que los papás vean el micro de sus hijos (sin cuenta ni contraseña).
-- El token va solo en el enlace: aquí se guarda su sha256.
create table public.family_links (
  id bigint generated always as identity primary key,
  bus_id text not null references public.buses (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index family_links_bus_idx on public.family_links (bus_id);

-- Solo el servidor (service_role) lee y escribe: RLS activo sin políticas
alter table public.family_links enable row level security;
