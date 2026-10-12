// Cálculo de horas de paso y llegada estimada (ETA) de una ruta.
// Lo usan GET /api/rutas/:id y las notificaciones.
const { segments, trips, buses } = require("./store");
const { distanceM } = require("./geo");

const RECENT_TRIPS = 10;                 // promedio con los últimos N pasos por tramo
const FALLBACK_SPEED_MS = 20 / 3.6;      // 20 km/h si un tramo aún no tiene mediciones
const STALE_MS = 2 * 60 * 60 * 1000;     // vuelta sin actividad en 2 h = no hay bus
const LIVE_MS = 60 * 1000;               // GPS sin reportar en 1 min = estimar por tiempo

// Segundos estimados de cada tramo (índice i = de la parada i-1 a la i)
function legSeconds(route) {
  return route.stops.map((stop, i) => {
    if (i === 0) return null;
    const from = route.stops[i - 1];
    const list = segments
      .filter((s) => s.routeId === route.id && s.from === from.id && s.to === stop.id)
      .slice(-RECENT_TRIPS);
    if (list.length) return list.reduce((a, s) => a + s.seconds, 0) / list.length;
    return distanceM(from, stop) / FALLBACK_SPEED_MS;
  });
}

// Vuelta más reciente de cualquier bus en esta ruta
function activeTrip(routeId) {
  const list = Object.entries(trips)
    .filter(([key, t]) => key.endsWith(`:${routeId}`) && Date.now() - t.updatedAt < STALE_MS)
    .map(([, t]) => t);
  return list.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

// Qué parte del tramo actual ya recorrió el bus (0 a 1).
// Se mide por distancia con la última posición GPS. Si esa posición tiene más de
// LIVE_MS, se le suma el tiempo que pasó desde entonces (el bus siguió avanzando).
function legProgress(route, trip, lastIdx, legMs, passedAt, now) {
  const from = route.stops[lastIdx];
  const to = route.stops[lastIdx + 1];
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

// Estado completo de la ruta: horas de paso, ETAs y dónde va el bus
function routeStatus(route, now = Date.now()) {
  const legs = legSeconds(route);
  const trip = activeTrip(route.id);
  const lastIdx = trip ? route.stops.findIndex((s) => s.id === trip.lastStopId) : -1;

  // Hora de paso real (o estimada si el GPS se saltó la parada)
  const times = [];
  for (let i = 0; i <= lastIdx; i++) {
    times[i] = trip.passes[route.stops[i].id] ?? (times[i - 1] != null ? times[i - 1] + legs[i] * 1000 : null);
  }
  // Si la vuelta empezó a medias (ej. se reinició el servidor), estima hacia atrás
  for (let i = lastIdx - 1; i >= 0; i--) {
    if (times[i] == null) times[i] = times[i + 1] - legs[i + 1] * 1000;
  }

  // ETA progresiva: lo que falta del tramo actual + los tramos siguientes
  let current = null;
  if (lastIdx >= 0 && lastIdx < route.stops.length - 1) {
    const legMs = legs[lastIdx + 1] * 1000;
    current = legProgress(route, trip, lastIdx, legMs, times[lastIdx], now);
    times[lastIdx + 1] = now + (1 - current.progress) * legMs;
    for (let i = lastIdx + 2; i < route.stops.length; i++) times[i] = times[i - 1] + legs[i] * 1000;
  }

  return { route, legs, trip, lastIdx, times, current };
}

module.exports = { routeStatus };
