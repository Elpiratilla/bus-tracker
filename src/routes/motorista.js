// App del motorista (public/motorista.html): el celular del motorista hace de sensor del bus.
// Entra con el id de la unidad y su clave (header x-api-key, igual que el sensor).
// Todo va por POST porque la autenticación lee busId del cuerpo.
const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes, buses, units, trips } = require("../store");
const { saveBus } = require("../db");
const { startTrip, endTrip } = require("../tracking");

// Solo unidades registradas por una empresa y con ruta asignada (no el simulador)
router.use(auth, (req, res, next) => {
  const unit = units[req.body?.busId];
  if (!unit?.companyId) return res.status(404).json({ error: "Esta unidad no está registrada en un panel" });
  const route = routes.find((r) => r.id === unit.routeId);
  if (!route) return res.status(409).json({ error: "Esta unidad no tiene ruta. Asígnale una en el panel." });
  req.unit = unit;
  req.ruta = route;
  next();
});

// Hacia dónde va, por qué parada va y cuál sigue
function estado(unit, route) {
  const bus = buses[unit.busId] || {};
  const trip = trips[`${unit.busId}:${route.id}`];
  const sentido = bus.enServicio ? bus.sentido : null;
  const paradas = sentido ? route.directions[sentido] : [];
  const i = trip ? paradas.findIndex((s) => s.id === trip.lastStopId) : -1;
  return {
    unidad: unit.name,
    ruta: route.id,
    enServicio: Boolean(bus.enServicio),
    sentido,
    sentidos: ["ida", "regreso"].map((d) => ({ id: d,
      origen: route.directions[d][0]?.name, destino: route.directions[d].at(-1)?.name })),
    paradas: paradas.map((s, j) => ({ nombre: s.name, paso: j <= i })),
    ultimaParada: i >= 0 ? paradas[i].name : null,
    siguiente: paradas[i + 1]?.name ?? null,
  };
}

router.post("/estado", (req, res) => res.json(estado(req.unit, req.ruta)));

// Iniciar o terminar el trayecto: { busId, accion: "salir" | "terminar", sentido: "ida" | "regreso" }
// "salir" en pleno trayecto = dar la vuelta en la terminal: empieza el otro sentido
router.post("/viaje", (req, res) => {
  const { unit, ruta: route } = req;
  const { accion, sentido } = req.body;
  const now = Date.now();
  const bus = buses[unit.busId] = { ...buses[unit.busId], busId: unit.busId, routeId: route.id,
    updatedAt: buses[unit.busId]?.updatedAt ?? now };

  if (accion === "salir") {
    if (!["ida", "regreso"].includes(sentido)) return res.status(400).json({ error: "Escoge hacia dónde vas" });
    startTrip(unit.busId, route, sentido, now);
    Object.assign(bus, { enServicio: true, sentido, servicioDesde: now });
  } else if (accion === "terminar") {
    endTrip(unit.busId, route);
    Object.assign(bus, { enServicio: false, sentido: null, servicioDesde: null });
  } else {
    return res.status(400).json({ error: "accion es salir o terminar" });
  }
  saveBus(unit.busId);
  res.json(estado(unit, route));
});

module.exports = router;
