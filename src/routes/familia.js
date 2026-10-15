// Vista de los papás (public/familia.html): ven el micro de sus hijos con el enlace privado
// que les mandó el motorista. El token va en el header x-familia (no en la URL: no queda en los logs).
const router = require("express").Router();
const { buses, units, trips, familyLinks } = require("../store");
const { routeStatus } = require("../eta");
const { schoolRoute } = require("../colegio");
const { hashKey } = require("../middleware/auth");
const { rateLimit } = require("../middleware/empresa");

const SERVICE_MAX_MS = 4 * 60 * 60 * 1000; // si el motorista olvida tocar "Llegué", a las 4 h deja de mostrarse
const LIVE_MS = 2 * 60 * 1000;             // posición de hace más de 2 min: no se dibuja el micro
const TURNOS = { ida: "mañana", regreso: "tarde" };
const iso = (t) => (t == null ? null : new Date(t).toISOString());

router.get("/", rateLimit(60, 60 * 1000), (req, res) => {
  const token = req.get("x-familia") || "";
  const link = token && familyLinks.get(hashKey(token));
  const unit = link && units[link.busId];
  if (!unit) return res.status(401).json({ error: "Este enlace ya no funciona. Pídele uno nuevo al motorista." });

  const route = schoolRoute(unit);
  const bus = buses[unit.busId] || {};
  const now = Date.now();
  const enServicio = Boolean(route && bus.enServicio && now - bus.servicioDesde < SERVICE_MAX_MS);
  const base = { micro: unit.name, para: link.label, enServicio };

  // Fuera de servicio no se muestra dónde está el micro (de noche puede estar en la casa del motorista)
  if (!enServicio) {
    return res.json({ ...base, paradas: (route?.directions.ida || []).map((s) => ({ id: s.id, nombre: s.name, lat: s.lat, lng: s.lng })) });
  }

  const dir = bus.sentido;
  const { stops, lastIdx, times, current } = routeStatus(route, dir, now);
  // routeStatus ignora una vuelta ya terminada: si llegó a la última parada, se dice aquí
  const trip = trips[`${unit.busId}:${route.id}`];
  const llego = Boolean(trip && trip.dir === dir && trip.lastStopId === stops.at(-1)?.id);
  const live = bus.lat != null && now - bus.updatedAt < LIVE_MS;

  res.json({
    ...base,
    sentido: dir,
    turno: TURNOS[dir],
    llego,
    actualizado: iso(bus.updatedAt),
    bus: live ? { lat: bus.lat, lng: bus.lng } : null,
    enVivo: Boolean(current?.live),
    paradas: stops.map((s, i) => ({
      id: s.id, nombre: s.name, lat: s.lat, lng: s.lng,
      pasoA: llego ? iso(trip.passes[s.id]) : i <= lastIdx ? iso(times[i]) : null,
      etaA: !llego && i > lastIdx ? iso(times[i]) : null,
    })),
  });
});

module.exports = router;
