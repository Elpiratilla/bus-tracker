// Formato que usa el frontend (public/js/mapa.js): GET /api/rutas y GET /api/rutas/:id?sentido=ida|regreso
const router = require("express").Router();
const { routes, buses, units } = require("../store");
const { routeStatus, pickDirection } = require("../eta");
const { distanceM } = require("../geo");

const iso = (t) => (t == null ? null : new Date(t).toISOString());
// Bus del simulador o de pruebas (no es una unidad registrada por una empresa): el mapa lo marca como demo
const isDemo = (trip) => Boolean(trip && !units[trip.busId]);

// Los dos sentidos de una ruta, nombrados por su destino ("Hacia Zona Rosa")
const sentidos = (route) => ["ida", "regreso"].map((d) => ({
  id: d, destino: route.directions[d].at(-1)?.name ?? null, origen: route.directions[d][0]?.name ?? null,
}));

// Lista de rutas para los botones del frontend
// (incluye los nombres de las paradas para que el buscador encuentre rutas por parada)
router.get("/", (_req, res) => res.json(routes.map((r) => ({
  ruta: r.id, tipo: r.type, nombre: r.name, paradas: r.stops.map((s) => s.name), sentidos: sentidos(r),
}))));

// Paradas cerca de una ubicación: /api/rutas/cerca?lat=13.70&lng=-89.21[&radio=800]
// Por cada ruta y sentido, la parada más cercana dentro del radio y cuándo llega el próximo bus.
const WALK_M_PER_MIN = 80; // caminando, unos 4.8 km/h
router.get("/cerca", (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const radio = Math.min(Math.max(Number(req.query.radio) || 800, 100), 3000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "Manda lat y lng válidos" });
  }
  const here = { lat, lng };
  const now = Date.now();
  const out = [];
  for (const route of routes) {
    for (const dir of ["ida", "regreso"]) {
      const stops = route.directions[dir];
      // la más cercana de este sentido (sin contar la última: ahí el bus ya no sigue)
      let best = null;
      stops.slice(0, -1).forEach((stop, i) => {
        const d = distanceM(here, stop);
        if (d <= radio && (!best || d < best.d)) best = { stop, i, d };
      });
      if (!best) continue;
      const { trip, lastIdx, times } = routeStatus(route, dir, now);
      // una hora estimada que ya pasó es de un bus que dejó de reportar: no cuenta como "en camino"
      const t = best.i > lastIdx ? times[best.i] : null;
      const eta = t && t > now - 60 * 1000 ? t : null;
      out.push({
        ruta: route.id, tipo: route.type, sentido: dir,
        destino: stops.at(-1)?.name ?? null,
        parada: { id: best.stop.id, nombre: best.stop.name, lat: best.stop.lat, lng: best.stop.lng },
        distanciaM: Math.round(best.d),
        caminarMin: Math.max(1, Math.round(best.d / WALK_M_PER_MIN)),
        llegaA: iso(eta),
        llegaMin: eta ? Math.max(0, Math.round((eta - now) / 60000)) : null,
        demo: Boolean(eta) && isDemo(trip),
      });
    }
  }
  // Primero lo que llega antes; las que no tienen bus en camino, al final por distancia
  out.sort((a, b) => (a.llegaMin ?? 1e9) - (b.llegaMin ?? 1e9) || a.distanciaM - b.distanciaM);
  res.json({ radio, paradas: out });
});

router.get("/:id", (req, res) => {
  const route = routes.find((r) => r.id === req.params.id);
  if (!route) return res.status(404).json({ error: "Ruta no existe" });
  const pedido = req.query.sentido;
  if (pedido && !["ida", "regreso"].includes(pedido)) return res.status(400).json({ error: "El sentido es ida o regreso" });

  // Sin sentido pedido: el del bus que se movió más reciente (así siempre se ve un bus si hay)
  const dir = pedido || pickDirection(route);
  const { stops, legs, trip, lastIdx, times, current } = routeStatus(route, dir);

  res.json({
    ruta: route.id,
    tipo: route.type,
    sentido: dir,
    sentidos: sentidos(route),
    actualizado: iso((trip && buses[trip.busId]?.updatedAt) || Date.now()),
    demo: isDemo(trip),
    // Dónde va el bus: posición GPS real (enVivo) o null si no hay señal reciente
    bus: current && {
      lat: current.bus?.lat ?? null,
      lng: current.bus?.lng ?? null,
      progreso: Math.round(current.progress * 1000) / 1000, // parte del tramo actual ya recorrida
      enVivo: current.live,
    },
    paradas: stops.map((stop, i) => ({
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
