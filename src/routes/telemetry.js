const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes, buses } = require("../store");
const { handlePosition, toTime } = require("../tracking");

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// El sensor manda posición GPS y datos de la unidad (velocidad, combustible, temperatura...)
router.post("/", auth, (req, res) => {
  const { busId, routeId, lat, lng, ts, ...data } = req.body;
  if (!busId) return res.status(400).json({ error: "busId requerido" });

  const now = toTime(ts);
  let position = null;

  if (lat !== undefined || lng !== undefined) {
    if (!validCoord(lat, lng)) return res.status(400).json({ error: "lat/lng inválidos" });
    const route = routes.find((r) => r.id === routeId);
    if (!route) return res.status(400).json({ error: "routeId inválido" });
    position = handlePosition(busId, route, { lat, lng }, now);
  }

  buses[busId] = { ...buses[busId], busId, ...(routeId && { routeId }), ...data,
    ...(position && { lat, lng, atStop: position.atStop }), updatedAt: now };
  res.status(201).json({ ok: true, ...(position && { position }) });
});

router.get("/", (_req, res) => res.json(Object.values(buses)));

module.exports = router;
