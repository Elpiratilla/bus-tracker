// Conexión a Supabase. El servidor trabaja en memoria (rápido) y guarda cada cambio aquí;
// al arrancar carga todo de vuelta. Sin SUPABASE_URL y SUPABASE_SECRET_KEY funciona solo en memoria.
const { createClient } = require("@supabase/supabase-js");
const store = require("./store");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const db = url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

if (!db) console.warn("Sin Supabase: los datos solo viven en memoria (faltan SUPABASE_URL y SUPABASE_SECRET_KEY en .env)");

// Guarda en segundo plano: un error de la base no debe tumbar la respuesta al sensor.
// Con `queue`, las escrituras de la misma cola van en orden (una vieja no pisa a una nueva).
const queues = new Map();
function persist(label, query, queue) {
  if (!db) return;
  const run = () => query(db)
    .then(({ error }) => { if (error) console.error(`Supabase (${label}): ${error.message}`); })
    .catch((err) => console.error(`Supabase (${label}): ${err.message}`));
  if (!queue) return void run();
  const next = (queues.get(queue) || Promise.resolve()).then(run);
  queues.set(queue, next);
  next.then(() => { if (queues.get(queue) === next) queues.delete(queue); });
}

// Espera a que terminen las escrituras pendientes de una cola (ej. antes de borrar)
const flush = (queue) => queues.get(queue) || Promise.resolve();

const ms = (t) => (t ? new Date(t).getTime() : null);

// Fila de la tabla buses -> unidad registrada en memoria
const unitFromRow = (b) => ({
  busId: b.id, companyId: b.company_id, name: b.name, plate: b.plate, type: b.type, routeId: b.route_id,
  apiKeyHash: b.api_key_hash, driverKeyHash: b.driver_key_hash, odometerKm: b.odometer_km, engineHours: b.engine_hours,
  oilIntervalKm: b.oil_interval_km, createdAt: ms(b.created_at),
});

async function select(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// Carga el estado guardado en los objetos de store.js (los mismos que usa el resto del código)
async function loadState() {
  if (!db) return;

  const routes = await select(db.from("routes")
    .select("id, name, type, route_stops(direction, position, stops(id, name, lat, lng))")
    .eq("active", true).order("sort"));
  store.routes.splice(0, store.routes.length, ...routes.map((r) => {
    const dir = (d) => r.route_stops.filter((rs) => rs.direction === d)
      .sort((a, b) => a.position - b.position).map((rs) => rs.stops);
    const ida = dir("ida");
    const regreso = dir("regreso");
    // stops: todas las paradas de la ruta (las de ida y las que solo están en el regreso)
    const stops = [...ida, ...regreso.filter((s) => !ida.some((x) => x.id === s.id))];
    return { id: r.id, name: r.name, type: r.type, stops,
      directions: { ida, regreso: regreso.length ? regreso : [...ida].reverse() } };
  }));

  const segments = await select(db.from("recent_segments").select("*").order("ts"));
  store.segments.splice(0, store.segments.length, ...segments.map((s) => ({
    busId: s.bus_id, routeId: s.route_id, dir: s.direction, from: s.from_stop, to: s.to_stop, seconds: s.seconds, ts: ms(s.ts),
  })));

  for (const t of await select(db.from("bus_trips").select("*"))) {
    const k = `${t.bus_id}:${t.route_id}`;
    store.geofence[k] = t.geofence_stop;
    if (t.last_stop_id) {
      store.trips[k] = { busId: t.bus_id, dir: t.direction, passes: t.passes, lastStopId: t.last_stop_id,
        leftStop: t.left_stop, leftAt: ms(t.left_at), updatedAt: ms(t.updated_at) };
    }
  }

  for (const b of await select(db.from("buses").select("*"))) {
    store.buses[b.id] = { ...b.data, busId: b.id, routeId: b.route_id, lat: b.lat, lng: b.lng,
      atStop: b.at_stop, updatedAt: ms(b.updated_at) };
    if (b.company_id) store.units[b.id] = unitFromRow(b);
  }

  for (const a of await select(db.from("alerts").select("*"))) {
    store.alerts.set(`${a.endpoint}|${a.route_id}|${a.direction}|${a.stop_id}`,
      { subscription: a.subscription, routeId: a.route_id, dir: a.direction, stopId: a.stop_id, createdAt: ms(a.created_at) });
  }

  console.log(`Supabase: ${Object.keys(store.units).length} unidades registradas, ${store.routes.length} rutas, ${store.segments.length} tiempos de tramo, `
    + `${Object.keys(store.trips).length} vueltas, ${Object.keys(store.buses).length} buses, ${store.alerts.size} alertas`);
}

// Guarda el estado en vivo de un bus (posición, en servicio, datos del motor) y sus contadores
function saveBus(busId) {
  const bus = store.buses[busId];
  const unit = store.units[busId];
  if (!bus) return;
  const { busId: _id, routeId, lat, lng, atStop, updatedAt, ...live } = bus;
  persist("bus", (db) => db.from("buses").upsert({ id: busId, route_id: routeId ?? null,
    lat: lat ?? null, lng: lng ?? null, at_stop: atStop ?? null, data: live,
    updated_at: new Date(updatedAt ?? Date.now()).toISOString(),
    ...(unit && { odometer_km: unit.odometerKm, engine_hours: unit.engineHours }) }), `bus:${busId}`);
}

module.exports = { db, persist, flush, saveBus, loadState, select, unitFromRow };
