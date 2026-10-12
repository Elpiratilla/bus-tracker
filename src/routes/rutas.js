// Formato que usa el frontend (public/app.js): GET /api/rutas/:id
const router = require("express").Router();
const { routes, segments, trips, buses } = require("../store");
const { distanceM } = require("../geo");

const RECENT_TRIPS = 10;                 // promedio con los últimos N pasos por tramo
const FALLBACK_SPEED_MS = 20 / 3.6;      // 20 km/h si un tramo aún no tiene mediciones
const STALE_MS = 2 * 60 * 60 * 1000;     // vuelta sin actividad en 2 h = no hay bus

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

router.get("/:id", (req, res) => {
  const route = routes.find((r) => r.id === req.params.id);
  if (!route) return res.status(404).json({ error: "Ruta no existe" });

  const legs = legSeconds(route);
  const trip = activeTrip(route.id);
  const lastIdx = trip ? route.stops.findIndex((s) => s.id === trip.lastStopId) : -1;
  const iso = (t) => (t == null ? null : new Date(t).toISOString());

  // Hora de paso (real o, si el GPS se la saltó, estimada) y ETA de las que faltan
  const times = [];
  route.stops.forEach((stop, i) => {
    const real = trip && trip.passes[stop.id];
    if (i <= lastIdx) times[i] = real || (times[i - 1] != null ? times[i - 1] + legs[i] * 1000 : null);
    else if (lastIdx >= 0) times[i] = times[i - 1] + legs[i] * 1000;
    else times[i] = null;
  });
  // Si la vuelta empezó a medias (ej. se reinició el servidor), estima hacia atrás
  for (let i = lastIdx - 1; i >= 0; i--) {
    if (times[i] == null) times[i] = times[i + 1] - legs[i + 1] * 1000;
  }

  res.json({
    ruta: route.id,
    actualizado: iso((trip && buses[trip.busId]?.updatedAt) || Date.now()),
    paradas: route.stops.map((stop, i) => ({
      id: stop.id,
      nombre: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      tramoMin: i === 0 ? null : Math.max(1, Math.round(legs[i] / 60)),
      pasoA: i <= lastIdx ? iso(times[i]) : null,
      etaA: i > lastIdx ? iso(times[i]) : null,
    })),
  });
});

module.exports = router;
