-- Recorridos: por dónde pasa de verdad cada ruta en el mapa.
-- route_shapes: el trazo aprobado de cada ruta y sentido (dibujado en el panel o sacado de una vuelta GPS).
-- route_recordings: vueltas completas grabadas por el GPS (de la primera a la última parada),
-- para que un admin escoja una y la use como trazo.

create table public.route_shapes (
  route_id text not null references public.routes (id) on delete cascade,
  direction text not null check (direction in ('ida', 'regreso')),
  points jsonb not null,                 -- [[lat, lng], ...]
  source text not null check (source in ('dibujado', 'gps')),
  updated_at timestamptz not null default now(),
  primary key (route_id, direction)
);

create table public.route_recordings (
  id bigint generated always as identity primary key,
  route_id text not null references public.routes (id) on delete cascade,
  direction text not null check (direction in ('ida', 'regreso')),
  bus_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  points jsonb not null                  -- [[lat, lng], ...], ya simplificado
);
create index route_recordings_route_idx on public.route_recordings (route_id, direction, ended_at desc);

-- Igual que las demás tablas: RLS sin políticas, todo pasa por la API del servidor
alter table public.route_shapes enable row level security;
alter table public.route_recordings enable row level security;
