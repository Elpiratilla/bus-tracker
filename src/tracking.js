const { segments, geofence, trips } = require("./store");
const { nearestStop } = require("./geo");
const { persist } = require("./db");
const { track } = require("./trazos");

// Qué tan cerca (en metros) debe estar el bus para contar que pasó por la parada
const STOP_RADIUS_M = Number(process.env.STOP_RADIUS_M) || 50;

// En memoria solo se guardan los últimos tiempos de cada tramo (el historial completo queda en Supabase)
const KEEP_PER_LEG = 10;

// Una vuelta sin movimiento en 2 h ya no sirve para saber en qué sentido va el bus
const TRIP_STALE_MS = 2 * 60 * 60 * 1000;

const DIRS = ["ida", "regreso"];
const other = (dir) => (dir === "ida" ? "regreso" : "ida");
const stopIndex = (route, dir, stopId) => route.directions[dir].findIndex((s) => s.id === stopId);

// Hora del evento: la del sensor si es válida, si no la del servidor.
// Nunca en el futuro: un reloj adelantado dejaría al bus "en línea" para siempre.
function toTime(ts) {
  const t = ts ? new Date(ts).getTime() : NaN;
  return Number.isFinite(t) ? Math.min(t, Date.now()) : Date.now();
}

function saveSegment(busId, route, dir, from, to, seconds, now) {
  const seg = { busId, routeId: route.id, dir, from, to, seconds, ts: now };
  segments.push(seg);
  const sameLeg = (s) => s.routeId === seg.routeId && s.dir === dir && s.from === from && s.to === to;
  if (segments.filter(sameLeg).length > KEEP_PER_LEG) segments.splice(segments.findIndex(sameLeg), 1);
  persist("tramo", (db) => db.from("segments").insert({ bus_id: busId, route_id: route.id, direction: dir,
    from_stop: from, to_stop: to, seconds, ts: new Date(now).toISOString() }));
}

// Registra que un bus llegó a una parada. Decide el sentido así:
// "¿en qué sentido esta parada va DESPUÉS de la anterior?". Primero se prueba el sentido actual.
// Ej.: de Metrocentro a Zona Rosa = ida; de Zona Rosa a Metrocentro = regreso.
function registerPass(busId, route, stopId, now) {
  const key = `${busId}:${route.id}`;
  let trip = trips[key];
  if (trip && now - trip.updatedAt > TRIP_STALE_MS) trip = null;
  const last = trip?.lastStopId;
  if (last === stopId) return saveTrip(busId, route.id); // volvió a entrar a la misma parada (salto del GPS)

  const tryOrder = trip ? [trip.dir, other(trip.dir)] : DIRS;
  const dir = last && tryOrder.find((d) => {
    const i = stopIndex(route, d, stopId);
    const j = stopIndex(route, d, last);
    return i >= 0 && j >= 0 && i > j;
  });

  if (dir) {
    // Cambió de sentido (dio la vuelta en la terminal): vuelta nueva que arranca en la parada anterior,
    // contada desde que SALIÓ de ella (no desde que llegó: así no suma el tiempo de espera en la terminal)
    if (dir !== trip.dir) {
      const start = trip.leftStop === last && trip.leftAt ? trip.leftAt : trip.passes[last];
      trip = trips[key] = { busId, dir, passes: { [last]: start }, lastStopId: last };
    }
    const i = stopIndex(route, dir, stopId);
    const j = stopIndex(route, dir, last);
    if (i === j + 1) saveSegment(busId, route, dir, last, stopId, Math.round((now - trip.passes[last]) / 1000), now);
  } else {
    // No sigue ninguna vuelta: empieza una nueva. Si la parada está en los dos sentidos, se asume el
    // actual (o ida); con la siguiente parada se corrige solo.
    const guess = tryOrder.find((d) => stopIndex(route, d, stopId) >= 0) || "ida";
    trip = trips[key] = { busId, dir: guess, passes: {} };
  }

  trip.passes[stopId] = now;
  trip.lastStopId = stopId;
  trip.leftStop = null;
  trip.leftAt = null;
  trip.updatedAt = now;
  saveTrip(busId, route.id);
}

// El bus salió de una parada. Si es la primera de su sentido (terminal), la vuelta cuenta desde ahora.
function registerExit(busId, route, stopId, now) {
  const key = `${busId}:${route.id}`;
  const trip = trips[key];
  if (!trip || trip.lastStopId !== stopId) return;
  trip.leftStop = stopId;
  trip.leftAt = now;
  if (stopIndex(route, trip.dir, stopId) === 0 && Object.keys(trip.passes).length === 1) trip.passes[stopId] = now;
}

// Guarda en Supabase la vuelta actual y la parada en la que está el bus
function saveTrip(busId, routeId) {
  const key = `${busId}:${routeId}`;
  const trip = trips[key];
  const row = { bus_id: busId, route_id: routeId, geofence_stop: geofence[key] ?? null,
    direction: trip?.dir ?? "ida", last_stop_id: trip?.lastStopId ?? null, passes: trip?.passes ?? {},
    left_stop: trip?.leftStop ?? null, left_at: trip?.leftAt ? new Date(trip.leftAt).toISOString() : null,
    updated_at: new Date(trip?.updatedAt ?? Date.now()).toISOString() };
  persist("vuelta", (db) => db.from("bus_trips").upsert(row), key);
}

// Recibe una posición GPS y detecta si el bus entró a una parada o salió de ella.
// Solo cuenta la entrada: mientras siga dentro del radio no se vuelve a registrar.
function handlePosition(busId, route, point, now) {
  const near = nearestStop(route, point);
  const inside = near.distance <= STOP_RADIUS_M ? near.stop.id : null;
  const key = `${busId}:${route.id}`;
  const was = geofence[key] ?? null;
  // Ya estaba dentro de la parada pero sin vuelta activa (se reinició el simulador o el sensor tras
  // horas guardado en la terminal): cuenta como llegada, si no el bus no sale hasta la parada siguiente
  const trip = trips[key];
  const sinVuelta = !trip?.lastStopId || now - trip.updatedAt > TRIP_STALE_MS;
  const entered = inside && (inside !== was || sinVuelta);

  geofence[key] = inside;
  if (was && was !== inside) registerExit(busId, route, was, now);
  if (entered) registerPass(busId, route, inside, now); // ya guarda la vuelta
  else if (was !== inside) saveTrip(busId, route.id);  // salió de la parada

  track(busId, route, point, now); // graba la vuelta completa para los recorridos (src/trazos.js)

  return { atStop: inside, nearestStop: near.stop.id, direction: trips[key]?.dir ?? null,
    distanceM: Math.round(near.distance), entered: Boolean(entered) };
}

// El motorista tocó "Iniciar trayecto": la vuelta empieza ya, en la primera parada del sentido que
// escogió. Así no hay que adivinar el sentido con las primeras paradas.
function startTrip(busId, route, dir, now) {
  const first = route.directions[dir][0].id;
  trips[`${busId}:${route.id}`] = { busId, dir, passes: { [first]: now }, lastStopId: first,
    leftStop: first, leftAt: now, updatedAt: now };
  saveTrip(busId, route.id);
}

// El motorista tocó "Terminar trayecto": se cierra la vuelta (los tiempos de los tramos ya quedaron guardados)
function endTrip(busId, route) {
  delete trips[`${busId}:${route.id}`];
  saveTrip(busId, route.id);
}

module.exports = { handlePosition, startTrip, endTrip, toTime };
