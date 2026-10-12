// Formato que usa el frontend (public/js/mapa.js): GET /api/rutas y GET /api/rutas/:id?sentido=ida|regreso
const router = require("express").Router();
const { routes, buses } = require("../store");
const { routeStatus, pickDirection } = require("../eta");

const iso = (t) => (t == null ? null : new Date(t).toISOString());

// Los dos sentidos de una ruta, nombrados por su destino ("Hacia Zona Rosa")
const sentidos = (route) => ["ida", "regreso"].map((d) => ({
  id: d, destino: route.directions[d].at(-1)?.name ?? null, origen: route.directions[d][0]?.name ?? null,
}));

// Lista de rutas para los botones del frontend
// (incluye los nombres de las paradas para que el buscador encuentre rutas por parada)
router.get("/", (_req, res) => res.json(routes.map((r) => ({
  ruta: r.id, tipo: r.type, nombre: r.name, paradas: r.stops.map((s) => s.name), sentidos: sentidos(r),
}))));

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
