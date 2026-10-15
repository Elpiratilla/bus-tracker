// App del motorista de un micro de colegio (public/motorista.html).
// Su celular hace de sensor: entra con el id de la unidad y su clave (header x-api-key, igual que el sensor).
// Todo va por POST porque la autenticación lee busId del cuerpo.
const router = require("express").Router();
const auth = require("../middleware/auth");
const { buses, units, trips } = require("../store");
const { saveBus } = require("../db");
const { startTrip, endTrip } = require("../tracking");
const { schoolRoute, addStop, clearStops } = require("../colegio");

const TURNOS = { ida: "mañana", regreso: "tarde" };

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// Solo unidades registradas por una empresa (no el simulador)
router.use(auth, (req, res, next) => {
  const unit = units[req.body?.busId];
  if (!unit?.companyId) return res.status(404).json({ error: "Esta unidad no está registrada en un panel" });
  req.unit = unit;
  next();
});

function estado(unit) {
  const route = schoolRoute(unit);
  const bus = buses[unit.busId] || {};
  const trip = route && trips[`${unit.busId}:${route.id}`];
  return {
    unidad: unit.name,
    enServicio: Boolean(bus.enServicio),
    sentido: bus.enServicio ? bus.sentido : null,
    turno: bus.enServicio ? TURNOS[bus.sentido] : null,
    ultimaParada: trip ? route.stops.find((s) => s.id === trip.lastStopId)?.name ?? null : null,
    paradas: (route?.directions.ida || []).map((s) => ({ id: s.id, nombre: s.name, lat: s.lat, lng: s.lng })),
    // la unidad usa una ruta pública (101, 42...): no puede tener recorrido de colegio
    rutaPublica: Boolean(unit.routeId && !route),
  };
}

router.post("/estado", (req, res) => res.json(estado(req.unit)));

// Marcar una parada donde está el micro: { busId, nombre, lat, lng }
router.post("/parada", (req, res) => {
  const { unit } = req;
  const { lat, lng } = req.body;
  const nombre = typeof req.body.nombre === "string" ? req.body.nombre.trim().replace(/\s+/g, " ") : "";
  if (nombre.length < 1 || nombre.length > 40) return res.status(400).json({ error: "Ponle un nombre de 1 a 40 letras" });
  if (!validCoord(lat, lng)) return res.status(400).json({ error: "No tenemos tu ubicación. Activa el GPS." });
  if (unit.routeId && !schoolRoute(unit)) return res.status(409).json({ error: "Esta unidad usa una ruta pública. Cámbiala a recorrido de colegio en el panel." });
  if (buses[unit.busId]?.enServicio) return res.status(409).json({ error: "Termina el viaje antes de cambiar las paradas" });

  const { error } = addStop(unit, nombre, lat, lng);
  if (error) return res.status(400).json({ error });
  res.status(201).json(estado(unit));
});

// Borrar todas las paradas para marcarlas otra vez
router.post("/paradas/borrar", (req, res) => {
  if (buses[req.unit.busId]?.enServicio) return res.status(409).json({ error: "Termina el viaje antes de borrar las paradas" });
  clearStops(req.unit);
  res.json(estado(req.unit));
});

// Empezar o terminar un viaje: { busId, accion: "salir" | "llegue", sentido: "ida" | "regreso" }
router.post("/viaje", (req, res) => {
  const { unit } = req;
  const { accion, sentido } = req.body;
  const route = schoolRoute(unit);
  const now = Date.now();
  const bus = buses[unit.busId] = { ...buses[unit.busId], busId: unit.busId, ...(route && { routeId: route.id }), updatedAt: buses[unit.busId]?.updatedAt ?? now };

  if (accion === "salir") {
    if (!["ida", "regreso"].includes(sentido)) return res.status(400).json({ error: "Escoge mañana o tarde" });
    if (!route || route.directions.ida.length < 2) return res.status(400).json({ error: "Primero marca al menos 2 paradas: las casas y el colegio" });
    startTrip(unit.busId, route, sentido, now);
    Object.assign(bus, { enServicio: true, sentido, servicioDesde: now });
  } else if (accion === "llegue") {
    if (route) endTrip(unit.busId, route);
    Object.assign(bus, { enServicio: false, sentido: null, servicioDesde: null });
  } else {
    return res.status(400).json({ error: "accion es salir o llegue" });
  }
  saveBus(unit.busId);
  res.json(estado(unit));
});

module.exports = router;
