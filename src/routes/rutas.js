// Formato que usa el frontend (public/app.js): GET /api/rutas y GET /api/rutas/:id
const router = require("express").Router();
const { routes, buses } = require("../store");
const { routeStatus } = require("../eta");

const iso = (t) => (t == null ? null : new Date(t).toISOString());

// Lista de rutas para los botones del frontend
// (incluye los nombres de las paradas para que el buscador encuentre rutas por parada)
router.get("/", (_req, res) => res.json(routes.map((r) => ({
  ruta: r.id, tipo: r.type, nombre: r.name, paradas: r.stops.map((s) => s.name),
}))));

router.get("/:id", (req, res) => {
  const route = routes.find((r) => r.id === req.params.id);
  if (!route) return res.status(404).json({ error: "Ruta no existe" });

  const { legs, trip, lastIdx, times, current } = routeStatus(route);

  res.json({
    ruta: route.id,
    tipo: route.type,
    actualizado: iso((trip && buses[trip.busId]?.updatedAt) || Date.now()),
    // Dónde va el bus: posición GPS real (enVivo) o null si no hay señal reciente
    bus: current && {
      lat: current.bus?.lat ?? null,
      lng: current.bus?.lng ?? null,
      progreso: Math.round(current.progress * 1000) / 1000, // parte del tramo actual ya recorrida
      enVivo: current.live,
    },
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
