const { lastPass, segments, geofence, trips } = require("./store");
const { nearestStop } = require("./geo");
const { persist } = require("./db");

// Qué tan cerca (en metros) debe estar el bus para contar que pasó por la parada
const STOP_RADIUS_M = Number(process.env.STOP_RADIUS_M) || 50;

// En memoria solo se guardan los últimos tiempos de cada tramo (el historial completo queda en Supabase)
const KEEP_PER_LEG = 10;

// Hora del evento: la del sensor si es válida, si no la del servidor
function toTime(ts) {
  const t = ts ? new Date(ts).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

// Registra que un bus pasó por una parada y guarda el tiempo del tramo
function registerPass(busId, route, stopId, now) {
  const key = `${busId}:${route.id}`;
  const prev = lastPass[key];
  const order = (id) => route.stops.findIndex((s) => s.id === id);

  // Solo cuenta tramos consecutivos (parada N -> N+1)
  if (prev && order(stopId) === order(prev.stopId) + 1) {
    const seg = { busId, routeId: route.id, from: prev.stopId, to: stopId,
      seconds: Math.round((now - prev.ts) / 1000), ts: now };
    segments.push(seg);
    const sameLeg = (s) => s.routeId === seg.routeId && s.from === seg.from && s.to === seg.to;
    if (segments.filter(sameLeg).length > KEEP_PER_LEG) segments.splice(segments.findIndex(sameLeg), 1);
    persist("tramo", (db) => db.from("segments").insert({ bus_id: busId, route_id: route.id,
      from_stop: seg.from, to_stop: seg.to, seconds: seg.seconds, ts: new Date(now).toISOString() }));
  }
  lastPass[key] = { stopId, ts: now };

  // Si vuelve a una parada anterior (o a la misma), empezó una vuelta nueva
  const trip = trips[key];
  if (!trip || order(stopId) <= order(trip.lastStopId)) trips[key] = { busId, passes: {} };
  trips[key].passes[stopId] = now;
  trips[key].lastStopId = stopId;
  trips[key].updatedAt = now;
  saveTrip(busId, route.id);
}

// Guarda en Supabase la vuelta actual y la parada en la que está el bus
function saveTrip(busId, routeId) {
  const key = `${busId}:${routeId}`;
  const trip = trips[key];
  const row = { bus_id: busId, route_id: routeId, geofence_stop: geofence[key] ?? null,
    last_stop_id: trip?.lastStopId ?? null, passes: trip?.passes ?? {},
    updated_at: new Date(trip?.updatedAt ?? Date.now()).toISOString() };
  persist("vuelta", (db) => db.from("bus_trips").upsert(row), key);
}

// Recibe una posición GPS y detecta si el bus acaba de entrar a una parada.
// Solo cuenta la entrada: mientras siga dentro del radio no se vuelve a registrar.
function handlePosition(busId, route, point, now) {
  const near = nearestStop(route, point);
  const inside = near.distance <= STOP_RADIUS_M ? near.stop.id : null;
  const key = `${busId}:${route.id}`;
  const entered = inside && inside !== geofence[key];

  const changed = inside !== (geofence[key] ?? null);
  geofence[key] = inside;
  if (entered) registerPass(busId, route, inside, now); // ya guarda la vuelta
  else if (changed) saveTrip(busId, route.id);         // salió de la parada

  return { atStop: inside, nearestStop: near.stop.id,
    distanceM: Math.round(near.distance), entered: Boolean(entered) };
}

module.exports = { registerPass, handlePosition, toTime, STOP_RADIUS_M };
