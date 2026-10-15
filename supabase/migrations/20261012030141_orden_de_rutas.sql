-- Orden en que aparecen las rutas en la app
alter table public.routes add column sort int not null default 0;
update public.routes set sort = case id when '101' then 1 when '42' then 2 when '29' then 3 else 99 end;
