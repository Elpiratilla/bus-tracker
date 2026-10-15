-- Personas o empresas que piden el sensor desde la portada
create table public.leads (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 80),
  company text check (char_length(company) <= 80),
  phone text not null check (char_length(phone) between 7 and 30),
  email text check (char_length(email) <= 120),
  units int check (units between 1 and 5000),
  city text check (char_length(city) <= 80),
  message text check (char_length(message) <= 600),
  status text not null default 'nuevo' check (status in ('nuevo', 'contactado', 'vendido', 'descartado')),
  admin_note text check (char_length(admin_note) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_created_idx on public.leads (created_at desc);
-- Solo el servidor (service_role) lee y escribe: RLS activo sin políticas
alter table public.leads enable row level security;
