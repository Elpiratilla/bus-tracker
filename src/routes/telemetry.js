const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes, buses, units, retired } = require("../store");
const { handlePosition, toTime } = require("../tracking");
const { distanceM } = require("../geo");
const { persist, saveBus } = require("../db");

const LOG_EVERY_MS = 60 * 1000;      // historial de mantenimiento: un registro por minuto por bus
const MAX_GAP_MS = 5 * 60 * 1000;    // más de 5 min sin señal: no se suman km ni horas de ese hueco
const MAX_SPEED_KMH = 150;           // saltos más rápidos que esto son errores del GPS
const lastLog = {};

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// Suma kilómetros y horas de motor de una unidad registrada
function updateCounters(unit, prev, lat, lng, now, data) {
  const dt = prev?.updatedAt ? now - prev.updatedAt : 0;
  const okGap = dt > 0 && dt < MAX_GAP_MS;

  if (typeof data.odometerKm === "number") unit.odometerKm = data.odometerKm; // del motor (OBD)
  else if (okGap && prev.lat != null && lat != null) {
    const km = distanceM(prev, { lat, lng }) / 1000;
    if (km / (dt / 3600000) < MAX_SPEED_KMH) unit.odometerKm += km;
  }
  // Motor encendido: lo dice el sensor (ignition) o, si no lo manda, se asume mientras reporte
  if (okGap && data.ignition !== false) unit.engineHours += dt / 3600000;
}

// El sensor manda posición GPS y datos de la unidad (velocidad, combustible, temperatura...)
router.post("/", auth, (req, res) => {
  const { busId, lat, lng, ts, ...rest } = req.body;
  if (typeof busId !== "string" || !busId || busId.length > 64)
    return res.status(400).json({ error: "busId requerido (texto de hasta 64 caracteres)" });

  if (retired.has(busId)) return res.status(410).json({ error: "Esta unidad fue eliminada del panel" });

  const unit = units[busId];
  const { routeId: sentRoute, ...data } = rest;
  const routeId = sentRoute || unit?.routeId; // si el sensor no la manda, la que asignó la empresa
  const now = toTime(ts);
  const prev = buses[busId];
  let position = null;

  if (lat !== undefined || lng !== undefined) {
    if (!validCoord(lat, lng)) return res.status(400).json({ error: "lat/lng inválidos" });
    const route = routes.find((r) => r.id === routeId);
    if (!route) return res.status(400).json({ error: "routeId inválido" });
    position = handlePosition(busId, route, { lat, lng }, now);
  }

  if (unit) updateCounters(unit, prev, position ? lat : null, lng, now, data);

  const knownRoute = routes.some((r) => r.id === routeId);
  buses[busId] = { ...prev, busId, ...(knownRoute && { routeId }), ...data,
    ...(position && { lat, lng, atStop: position.atStop }), updatedAt: now };
  res.status(201).json({ ok: true, ...(position && { position }) });

  // Guardar en Supabase: estado en vivo siempre, historial una vez por minuto
  saveBus(busId);
  if (!(now - lastLog[busId] < LOG_EVERY_MS)) {
    lastLog[busId] = now;
    persist("historial", (db) => db.from("telemetry").insert({ bus_id: busId, ts: new Date(now).toISOString(),
      lat: position ? lat : null, lng: position ? lng : null, data }));
  }
});

// Posiciones públicas (sin datos del motor ni de la empresa). demo: bus del simulador, no una unidad registrada
// El bus cuyo motorista tocó "Terminar trayecto" (enServicio false) no sale hasta que vuelva a salir
router.get("/", (_req, res) => res.json(Object.values(buses).filter((b) => b.enServicio !== false).map((b) => ({
  busId: b.busId, routeId: b.routeId, lat: b.lat, lng: b.lng, atStop: b.atStop, updatedAt: b.updatedAt,
  demo: !units[b.busId],
}))));

module.exports = router;
