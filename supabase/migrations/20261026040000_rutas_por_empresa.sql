-- Cada empresa arma sus propias rutas (número, paradas por sentido y recorrido).
-- company_id null: rutas de go503 (101, 42, 29), que solo editan los administradores.
alter table public.routes
  add column company_id uuid references public.companies (id) on delete cascade;
create index routes_company_idx on public.routes (company_id);
