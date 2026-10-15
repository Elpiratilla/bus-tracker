-- go503: rutas, paradas, buses y tiempos de cada tramo

create table public.routes (
  id text primary key,
  name text not null,
  type text not null check (type in ('autobus', 'microbus')),
  active boolean not null default true
);

create table public.stops (
  id text primary key,
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180)
);

-- Orden de las paradas en cada ruta (una parada puede estar en varias rutas)
create table public.route_stops (
  route_id text not null references public.routes (id) on delete cascade,
  position int not null check (position >= 0),
  stop_id text not null references public.stops (id),
  primary key (route_id, position),
  unique (route_id, stop_id)
);

-- Última posición y datos de cada bus
create table public.buses (
  id text primary key,
  route_id text references public.routes (id) on delete set null,
  lat double precision,
  lng double precision,
  at_stop text,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Vuelta actual de cada bus en una ruta
create table public.bus_trips (
  bus_id text not null,
  route_id text not null references public.routes (id) on delete cascade,
  geofence_stop text,                  -- parada en la que está ahora (null = entre paradas)
  last_stop_id text,                   -- última parada por la que pasó
  passes jsonb not null default '{}',  -- { stopId: epoch ms } de la vuelta actual
  updated_at timestamptz not null default now(),
  primary key (bus_id, route_id)
);

-- Historial: cuánto tardó cada bus en cada tramo
create table public.segments (
  id bigint generated always as identity primary key,
  bus_id text not null,
  route_id text not null references public.routes (id) on delete cascade,
  from_stop text not null,
  to_stop text not null,
  seconds int not null check (seconds >= 0),
  ts timestamptz not null
);
create index segments_leg_ts_idx on public.segments (route_id, from_stop, to_stop, ts desc);

-- Los últimos 10 tiempos de cada tramo (lo que usa el cálculo de llegada)
create view public.recent_segments with (security_invoker = true) as
select bus_id, route_id, from_stop, to_stop, seconds, ts
from (
  select s.*, row_number() over (partition by route_id, from_stop, to_stop order by ts desc) as rn
  from public.segments s
) t
where rn <= 10;

-- Historial de datos de la unidad para mantenimiento (uno por minuto por bus)
create table public.telemetry (
  id bigint generated always as identity primary key,
  bus_id text not null,
  ts timestamptz not null,
  lat double precision,
  lng double precision,
  data jsonb not null default '{}'
);
create index telemetry_bus_ts_idx on public.telemetry (bus_id, ts desc);

-- Avisos "tu bus está cerca" pendientes
create table public.alerts (
  id bigint generated always as identity primary key,
  endpoint text not null,
  subscription jsonb not null,
  route_id text not null references public.routes (id) on delete cascade,
  stop_id text not null,
  created_at timestamptz not null default now(),
  unique (endpoint, route_id, stop_id)
);

-- Solo el servidor (clave secreta) accede: RLS activo y sin políticas públicas
alter table public.routes enable row level security;
alter table public.stops enable row level security;
alter table public.route_stops enable row level security;
alter table public.buses enable row level security;
alter table public.bus_trips enable row level security;
alter table public.segments enable row level security;
alter table public.telemetry enable row level security;
alter table public.alerts enable row level security;
