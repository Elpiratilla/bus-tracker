const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes, buses } = require("../store");
const { handlePosition, toTime } = require("../tracking");
const { persist } = require("../db");

const LOG_EVERY_MS = 60 * 1000; // historial de mantenimiento: un registro por minuto por bus
const lastLog = {};

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// El sensor manda posición GPS y datos de la unidad (velocidad, combustible, temperatura...)
router.post("/", auth, (req, res) => {
  const { busId, routeId, lat, lng, ts, ...data } = req.body;
  if (typeof busId !== "string" || !busId || busId.length > 64)
    return res.status(400).json({ error: "busId requerido (texto de hasta 64 caracteres)" });

  const now = toTime(ts);
  let position = null;

  if (lat !== undefined || lng !== undefined) {
    if (!validCoord(lat, lng)) return res.status(400).json({ error: "lat/lng inválidos" });
    const route = routes.find((r) => r.id === routeId);
    if (!route) return res.status(400).json({ error: "routeId inválido" });
    position = handlePosition(busId, route, { lat, lng }, now);
  }

  const knownRoute = routes.some((r) => r.id === routeId);
  const bus = buses[busId] = { ...buses[busId], busId, ...(knownRoute && { routeId }), ...data,
    ...(position && { lat, lng, atStop: position.atStop }), updatedAt: now };
  res.status(201).json({ ok: true, ...(position && { position }) });

  // Guardar en Supabase: última posición siempre, historial una vez por minuto
  const { busId: _id, routeId: _r, lat: bLat, lng: bLng, atStop, updatedAt, ...extra } = bus;
  const iso = new Date(now).toISOString();
  persist("bus", (db) => db.from("buses").upsert({ id: busId, route_id: bus.routeId ?? null,
    lat: bLat ?? null, lng: bLng ?? null, at_stop: atStop ?? null, data: extra, updated_at: iso }), `bus:${busId}`);
  if (!(now - lastLog[busId] < LOG_EVERY_MS)) {
    lastLog[busId] = now;
    persist("historial", (db) => db.from("telemetry").insert({ bus_id: busId, ts: iso,
      lat: position ? lat : null, lng: position ? lng : null, data }));
  }
});

router.get("/", (_req, res) => res.json(Object.values(buses)));

module.exports = router;
