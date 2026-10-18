-- Clave propia de la app del motorista, separada de la del sensor ESP32:
-- así generar una nueva para uno no deja sin funcionar al otro. Se guarda su sha256.
alter table public.buses add column driver_key_hash text;
