-- Paradas de una ruta en un solo paso (src/routes/empresa.js, saveStops).
-- Antes eran tres llamadas: si fallaba el insert después del delete, la ruta quedaba sin paradas
-- y al reiniciar el servidor sus buses daban error. Una función corre todo en una transacción.
-- p_stops: [{ id, name, lat, lng }]   p_route_stops: [{ direction, position, stop_id }]
create function public.reemplazar_paradas(p_route text, p_stops jsonb, p_route_stops jsonb)
returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.stops (id, name, lat, lng)
  select id, name, lat, lng from jsonb_to_recordset(p_stops) as x(id text, name text, lat double precision, lng double precision)
  on conflict (id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng;

  delete from public.route_stops where route_id = p_route;

  insert into public.route_stops (route_id, direction, position, stop_id)
  select p_route, direction, position, stop_id
  from jsonb_to_recordset(p_route_stops) as x(direction text, position int, stop_id text);
end;
$$;

-- Solo la llama el servidor (clave secreta), nunca el navegador
revoke execute on function public.reemplazar_paradas(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.reemplazar_paradas(text, jsonb, jsonb) to service_role;

-- Enlaces de familias (rama de colegios): ningún código la usa y está vacía
drop table public.family_links;
