-- Rutas 101, 42 y 29 (coordenadas aproximadas: ajustarlas a la ubicación real)
insert into public.routes (id, name, type) values
  ('101', 'Ruta 101', 'autobus'),
  ('42', 'Ruta 42', 'autobus'),
  ('29', 'Ruta 29', 'microbus');

insert into public.stops (id, name, lat, lng) values
  ('t-ori', 'Terminal de Oriente', 13.7126, -89.1643),
  ('centro', 'Centro Histórico', 13.6989, -89.1914),
  ('p-inf', 'Parque Infantil', 13.7030, -89.2030),
  ('metro', 'Metrocentro', 13.7059, -89.2123),
  ('z-rosa', 'Zona Rosa', 13.6935, -89.2362),
  ('mejicanos', 'Mejicanos', 13.7415, -89.2145),
  ('zacamil', 'Zacamil', 13.7290, -89.2090),
  ('ues', 'Universidad de El Salvador', 13.7188, -89.2044),
  ('escalon', 'Colonia Escalón', 13.7010, -89.2380),
  ('a-cusc', 'Antiguo Cuscatlán', 13.6740, -89.2420),
  ('soya', 'Soyapango', 13.7100, -89.1530),
  ('rosales', 'Hospital Rosales', 13.7045, -89.2028),
  ('merliot', 'Merliot', 13.6765, -89.2630);

insert into public.route_stops (route_id, position, stop_id) values
  ('101', 0, 't-ori'), ('101', 1, 'centro'), ('101', 2, 'p-inf'), ('101', 3, 'metro'), ('101', 4, 'z-rosa'),
  ('42', 0, 'mejicanos'), ('42', 1, 'zacamil'), ('42', 2, 'ues'), ('42', 3, 'escalon'), ('42', 4, 'a-cusc'),
  ('29', 0, 'soya'), ('29', 1, 't-ori'), ('29', 2, 'centro'), ('29', 3, 'rosales'), ('29', 4, 'merliot');
