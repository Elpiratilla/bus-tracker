// Cálculo de horas de paso y llegada estimada (ETA) de una ruta.
// Lo usan GET /api/rutas/:id y las notificaciones.
const { segments, trips, buses } = require("./store");
const { distanceM } = require("./geo");
const { enMapa } = require("./enMapa");

const RECENT_TRIPS = 10;                 // promedio con los últimos N pasos por tramo
const FALLBACK_SPEED_MS = 20 / 3.6;      // 20 km/h si un tramo aún no tiene mediciones
const STALE_MS = 2 * 60 * 60 * 1000;     // vuelta sin actividad en 2 h = no hay bus
const LIVE_MS = 60 * 1000;               // GPS sin reportar en 1 min = estimar por tiempo

// Segundos estimados de cada tramo de un sentido (índice i = de la parada i-1 a la i)
function legSeconds(route, dir, stops) {
  return stops.map((stop, i) => {
    if (i === 0) return null;
    const from = stops[i - 1];
    const list = segments
      .filter((s) => s.routeId === route.id && (s.dir || "ida") === dir && s.from === from.id && s.to === stop.id)
      .slice(-RECENT_TRIPS);
    if (list.length) return list.reduce((a, s) => a + s.seconds, 0) / list.length;
    return distanceM(from, stop) / FALLBACK_SPEED_MS;
  });
}

const other = (dir) => (dir === "ida" ? "regreso" : "ida");
const finished = (route, t) => t.lastStopId === route.directions[t.dir || "ida"].at(-1)?.id;

// Vueltas recientes de los buses de esta ruta (sin los buses guardados: motor apagado o fuera de servicio)
const recentTrips = (route) => Object.entries(trips)
  .filter(([key, t]) => key.endsWith(`:${route.id}`) && Date.now() - t.updatedAt < STALE_MS && enMapa(buses[t.busId]))
  .map(([, t]) => t);

// Vuelta más reciente en un sentido. Un bus que TERMINÓ el sentido contrario en la parada donde
// empieza este (la terminal) cuenta aquí como bus esperando en la primera parada, listo para salir.
function activeTrip(route, dir) {
  const first = route.directions[dir][0]?.id;
  const list = recentTrips(route).flatMap((t) => {
    const tDir = t.dir || "ida";
    if (tDir === dir && !finished(route, t)) return [t];
    if (tDir === other(dir) && finished(route, t) && t.lastStopId === first) {
      return [{ busId: t.busId, dir, passes: { [first]: t.passes[first] }, lastStopId: first, updatedAt: t.updatedAt }];
    }
    return [];
  });
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

// Sentido que conviene mostrar si la persona no escogió: el del bus que se movió más reciente
// (si ya terminó su recorrido, el sentido al que va a salir)
function pickDirection(route) {
  const t = recentTrips(route).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!t) return "ida";
  return finished(route, t) ? other(t.dir || "ida") : t.dir || "ida";
}

// Qué parte del tramo actual ya recorrió el bus (0 a 1).
// Se mide por distancia con la última posición GPS. Si esa posición tiene más de
// LIVE_MS, se le suma el tiempo que pasó desde entonces (el bus siguió avanzando).
function legProgress(route, stops, trip, lastIdx, legMs, passedAt, now) {
  const from = stops[lastIdx];
  const to = stops[lastIdx + 1];
  const bus = buses[trip.busId];
  const hasGps = bus && bus.routeId === route.id && bus.lat != null && bus.updatedAt >= passedAt;
  if (!hasGps) return { progress: Math.min(1, (now - passedAt) / legMs), live: false, bus: null };

  const done = distanceM(from, bus);
  const left = distanceM(bus, to);
  const gpsProgress = done + left ? done / (done + left) : 0;
  const live = now - bus.updatedAt < LIVE_MS;
  const progress = live ? gpsProgress : gpsProgress + (now - bus.updatedAt) / legMs;
  return { progress: Math.min(1, progress), live, bus };
}

// Estado de un sentido de la ruta: horas de paso, ETAs y dónde va el bus
function routeStatus(route, dir = "ida", now = Date.now()) {
  const stops = route.directions[dir];
  const legs = legSeconds(route, dir, stops);
  const trip = activeTrip(route, dir);
  const lastIdx = trip ? stops.findIndex((s) => s.id === trip.lastStopId) : -1;

  // Hora de paso real (o estimada si el GPS se saltó la parada)
  const times = [];
  for (let i = 0; i <= lastIdx; i++) {
    times[i] = trip.passes[stops[i].id] ?? (times[i - 1] != null ? times[i - 1] + legs[i] * 1000 : null);
  }
  // Si la vuelta empezó a medias (ej. se reinició el servidor), estima hacia atrás
  for (let i = lastIdx - 1; i >= 0; i--) {
    if (times[i] == null) times[i] = times[i + 1] - legs[i + 1] * 1000;
  }

  // ETA progresiva: lo que falta del tramo actual + los tramos siguientes
  let current = null;
  if (lastIdx >= 0 && lastIdx < stops.length - 1) {
    const legMs = legs[lastIdx + 1] * 1000;
    current = legProgress(route, stops, trip, lastIdx, legMs, times[lastIdx], now);
    times[lastIdx + 1] = now + (1 - current.progress) * legMs;
    for (let i = lastIdx + 2; i < stops.length; i++) times[i] = times[i - 1] + legs[i] * 1000;
  }

  return { route, dir, stops, legs, trip, lastIdx, times, current };
}

module.exports = { routeStatus, pickDirection };
