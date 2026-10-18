const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes, buses, units, retired } = require("../store");
const { handlePosition, toTime } = require("../tracking");
const { distanceM } = require("../geo");
const { persist, saveBus } = require("../db");
const { enMapa } = require("../enMapa");

const LOG_EVERY_MS = 60 * 1000;      // historial de mantenimiento: un registro por minuto por bus
const MAX_GAP_MS = 5 * 60 * 1000;    // más de 5 min sin señal: no se suman km ni horas de ese hueco
const MAX_SPEED_KMH = 150;           // saltos más rápidos que esto son errores del GPS
const lastLog = {};
// Lo que manda el firmware (go503_sensor.ino) y la app del motorista; lo demás se ignora
const CAMPOS = ["speed", "heading", "fuel", "engineTemp", "rpm", "dtc", "ignition", "odometerKm", "obdSpeed", "hardBrakes"];

const validCoord = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

// Suma kilómetros y horas de motor de una unidad registrada
function updateCounters(unit, prev, lat, lng, now, data) {
  const dt = prev?.updatedAt ? now - prev.updatedAt : 0;
  const okGap = dt > 0 && dt < MAX_GAP_MS;

  if (typeof data.odometerKm === "number") unit.odometerKm = data.odometerKm; // del motor (OBD)
  // Sin okGap: después de una zona sin señal se suma la recta entre los dos puntos (mejor que perderlo)
  else if (dt > 0 && prev.lat != null && lat != null) {
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
  const data = Object.fromEntries(CAMPOS.filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]]));
  const routeId = rest.routeId || unit?.routeId; // si el sensor no la manda, la que asignó la empresa
  const now = toTime(ts);
  const prev = buses[busId];
  let position = null;

  // Mensaje atrasado (guardado sin señal y mandado después): solo va al historial.
  // Si moviera el bus, el mapa lo mostraría donde estaba hace media hora.
  if (prev?.updatedAt && now < prev.updatedAt) {
    if (lat !== undefined && !validCoord(lat, lng)) return res.status(400).json({ error: "lat/lng inválidos" });
    res.status(201).json({ ok: true, atrasado: true });
    return logHistory(busId, now, lat !== undefined ? lat : null, lat !== undefined ? lng : null, data);
  }

  if (lat !== undefined || lng !== undefined) {
    if (!validCoord(lat, lng)) return res.status(400).json({ error: "lat/lng inválidos" });
    const route = routes.find((r) => r.id === routeId);
    if (!route) return res.status(400).json({ error: "routeId inválido" });
    position = handlePosition(busId, route, { lat, lng }, now);
  }

  if (unit) updateCounters(unit, prev, position ? lat : null, lng, now, data);

  // Desde cuándo está apagado el motor (si el sensor lo sabe): con más de 5 min sale del mapa
  const apagadoDesde = data.ignition === false ? prev?.apagadoDesde ?? now
    : data.ignition === true ? null : prev?.apagadoDesde ?? null;

  // Encendió el motor después de estar apagado: un "Terminar trayecto" de antes ya no cuenta,
  // vuelve a mandar el encendido (si el motorista usa la app, la próxima vez toca Salir)
  const encendio = data.ignition === true && prev?.apagadoDesde;

  const knownRoute = routes.some((r) => r.id === routeId);
  buses[busId] = { ...prev, busId, ...(knownRoute && { routeId }), ...data,
    ...(position && { lat, lng, atStop: position.atStop }), apagadoDesde,
    ...(encendio && prev.enServicio === false && { enServicio: null }), updatedAt: now };
  res.status(201).json({ ok: true, ...(position && { position }) });

  // Guardar en Supabase: estado en vivo siempre, historial una vez por minuto
  saveBus(busId);
  logHistory(busId, now, position ? lat : null, position ? lng : null, data);
});

// Historial: un registro por minuto por bus. abs(): los mensajes atrasados (más viejos que el
// último guardado) también entran, así no queda un hueco donde no hubo señal.
function logHistory(busId, now, lat, lng, data) {
  if (Math.abs(now - lastLog[busId]) < LOG_EVERY_MS) return;
  lastLog[busId] = now;
  persist("historial", (db) => db.from("telemetry").insert({ bus_id: busId, ts: new Date(now).toISOString(), lat, lng, data }));
}

// Posiciones públicas (sin datos del motor ni de la empresa). demo: bus del simulador, no una unidad registrada
// No salen los buses guardados: el motorista tocó "Terminar trayecto" o el motor lleva rato apagado (src/enMapa.js)
router.get("/", (_req, res) => res.json(Object.values(buses).filter((b) => enMapa(b)).map((b) => ({
  busId: b.busId, routeId: b.routeId, lat: b.lat, lng: b.lng, atStop: b.atStop, updatedAt: b.updatedAt,
  demo: !units[b.busId],
}))));

module.exports = router;
