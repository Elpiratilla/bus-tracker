-- Cada ruta tiene dos sentidos: ida y regreso, cada uno con sus propias paradas

-- Paradas por sentido
alter table public.route_stops add column direction text not null default 'ida' check (direction in ('ida', 'regreso'));
alter table public.route_stops drop constraint route_stops_pkey;
alter table public.route_stops drop constraint route_stops_route_id_stop_id_key;
alter table public.route_stops add primary key (route_id, direction, position);
alter table public.route_stops add constraint route_stops_route_dir_stop_key unique (route_id, direction, stop_id);

-- Regreso de las rutas actuales: las mismas paradas en orden inverso
insert into public.route_stops (route_id, direction, position, stop_id)
select route_id, 'regreso', (max(position) over (partition by route_id)) - position, stop_id
from public.route_stops where direction = 'ida';

-- Tiempos de tramo por sentido (los que ya existen son de ida)
alter table public.segments add column direction text not null default 'ida' check (direction in ('ida', 'regreso'));
drop index public.segments_leg_ts_idx;
create index segments_leg_ts_idx on public.segments (route_id, direction, from_stop, to_stop, ts desc);

drop view public.recent_segments;
create view public.recent_segments with (security_invoker = true) as
select bus_id, route_id, direction, from_stop, to_stop, seconds, ts
from (
  select s.*, row_number() over (partition by route_id, direction, from_stop, to_stop order by ts desc) as rn
  from public.segments s
) t
where rn <= 10;

-- Vuelta actual: en qué sentido va y cuándo salió de la última parada
alter table public.bus_trips
  add column direction text not null default 'ida' check (direction in ('ida', 'regreso')),
  add column left_stop text,
  add column left_at timestamptz;

-- Avisos: para una parada en un sentido
alter table public.alerts add column direction text not null default 'ida' check (direction in ('ida', 'regreso'));
alter table public.alerts drop constraint alerts_endpoint_route_id_stop_id_key;
alter table public.alerts add constraint alerts_endpoint_route_dir_stop_key unique (endpoint, route_id, direction, stop_id);

-- Reportes por sentido
drop function public.report_leg_times(uuid, timestamptz);
create function public.report_leg_times(p_company uuid, p_since timestamptz)
returns table (route_id text, direction text, from_stop text, to_stop text, hour int, avg_seconds int, trips int)
language sql stable set search_path = '' as $$
  select s.route_id, s.direction, s.from_stop, s.to_stop,
         extract(hour from s.ts at time zone 'America/El_Salvador')::int as hour,
         avg(s.seconds)::int, count(*)::int
  from public.segments s
  join public.buses b on b.id = s.bus_id
  where b.company_id = p_company and s.ts >= p_since
  group by 1, 2, 3, 4, 5
$$;

-- Recorridos completos por día: llegadas a la última parada de cada sentido
drop function public.report_trips_per_day(uuid, timestamptz);
create function public.report_trips_per_day(p_company uuid, p_since timestamptz)
returns table (bus_id text, day date, trips int)
language sql stable set search_path = '' as $$
  select s.bus_id, (s.ts at time zone 'America/El_Salvador')::date, count(*)::int
  from public.segments s
  join public.buses b on b.id = s.bus_id
  join public.route_stops rs on rs.route_id = s.route_id and rs.direction = s.direction and rs.stop_id = s.to_stop
  where b.company_id = p_company and s.ts >= p_since
    and rs.position = (select max(position) from public.route_stops x where x.route_id = s.route_id and x.direction = s.direction)
  group by 1, 2
$$;

revoke execute on function public.report_leg_times(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.report_trips_per_day(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.report_leg_times(uuid, timestamptz) to service_role;
grant execute on function public.report_trips_per_day(uuid, timestamptz) to service_role;
