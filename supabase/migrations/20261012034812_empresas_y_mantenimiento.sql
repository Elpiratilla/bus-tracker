-- Empresas (dueños de flotas), códigos de invitación y mantenimiento

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Códigos que se entregan al vender el sensor. Un código = una empresa.
create table public.invite_codes (
  code text primary key,
  note text,                                   -- a quién se le dio
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Unidades: dueño, placa, clave del sensor y contadores
alter table public.buses
  add column company_id uuid references public.companies (id) on delete set null,
  add column name text,
  add column plate text,
  add column type text check (type in ('autobus', 'microbus')),
  add column api_key_hash text,                -- sha256 de la clave del sensor (la clave no se guarda)
  add column odometer_km double precision not null default 0,
  add column engine_hours double precision not null default 0,
  add column oil_interval_km int not null default 5000,
  add column created_at timestamptz not null default now();
create index buses_company_idx on public.buses (company_id);

-- Servicios hechos a cada unidad (cambio de aceite, frenos...)
create table public.service_records (
  id bigint generated always as identity primary key,
  bus_id text not null references public.buses (id) on delete cascade,
  kind text not null check (kind in ('aceite', 'frenos', 'llantas', 'general', 'otro')),
  odometer_km double precision not null,
  engine_hours double precision,
  notes text check (char_length(notes) <= 500),
  done_at timestamptz not null default now()
);
create index service_records_bus_idx on public.service_records (bus_id, done_at desc);

alter table public.companies enable row level security;
alter table public.invite_codes enable row level security;
alter table public.service_records enable row level security;

-- Reporte: minutos promedio por tramo y hora del día (hora de El Salvador)
create function public.report_leg_times(p_company uuid, p_since timestamptz)
returns table (route_id text, from_stop text, to_stop text, hour int, avg_seconds int, trips int)
language sql stable set search_path = '' as $$
  select s.route_id, s.from_stop, s.to_stop,
         extract(hour from s.ts at time zone 'America/El_Salvador')::int as hour,
         avg(s.seconds)::int, count(*)::int
  from public.segments s
  join public.buses b on b.id = s.bus_id
  where b.company_id = p_company and s.ts >= p_since
  group by 1, 2, 3, 4
$$;

-- Reporte: vueltas completas por unidad y día (llegadas a la última parada de su ruta)
create function public.report_trips_per_day(p_company uuid, p_since timestamptz)
returns table (bus_id text, day date, trips int)
language sql stable set search_path = '' as $$
  select s.bus_id, (s.ts at time zone 'America/El_Salvador')::date, count(*)::int
  from public.segments s
  join public.buses b on b.id = s.bus_id
  join public.route_stops rs on rs.route_id = s.route_id and rs.stop_id = s.to_stop
  where b.company_id = p_company and s.ts >= p_since
    and rs.position = (select max(position) from public.route_stops x where x.route_id = s.route_id)
  group by 1, 2
$$;

-- Los reportes solo los llama el servidor (clave secreta), nunca el navegador
revoke execute on function public.report_leg_times(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.report_trips_per_day(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.report_leg_times(uuid, timestamptz) to service_role;
grant execute on function public.report_trips_per_day(uuid, timestamptz) to service_role;
