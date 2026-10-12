// Alertas "avísame cuando mi bus esté cerca" para el frontend
const router = require("express").Router();
const { routes, alerts } = require("../store");
const { enabled, ALERT_MIN, validSubscription, addAlert, removeAlert, listAlerts } = require("../alerts");

const MAX_PER_DEVICE = 10;
const MAX_TOTAL = 10000;

router.use((_req, res, next) => {
  if (!enabled) return res.status(503).json({ error: "Notificaciones desactivadas en el servidor" });
  next();
});

// Clave pública que el navegador necesita para suscribirse
router.get("/clave", (_req, res) => res.json({ clave: process.env.VAPID_PUBLIC_KEY, minutos: ALERT_MIN }));

// Crear alerta: { suscripcion, ruta, parada }
router.post("/", (req, res) => {
  const { suscripcion, ruta, parada } = req.body;
  const route = routes.find((r) => r.id === ruta);
  if (!validSubscription(suscripcion)) return res.status(400).json({ error: "Suscripción inválida" });
  if (!route || !route.stops.some((s) => s.id === parada))
    return res.status(400).json({ error: "ruta o parada inválida" });
  if (listAlerts(suscripcion.endpoint).length >= MAX_PER_DEVICE || alerts.size >= MAX_TOTAL)
    return res.status(429).json({ error: "Demasiadas alertas" });

  addAlert(suscripcion, ruta, parada);
  res.status(201).json({ ok: true, minutos: ALERT_MIN });
});

// Alertas activas de este dispositivo: { endpoint }
router.post("/mias", (req, res) => res.json(listAlerts(String(req.body.endpoint || ""))));

// Cancelar alerta: { endpoint, ruta, parada }
router.delete("/", (req, res) => {
  const { endpoint, ruta, parada } = req.body;
  res.json({ ok: removeAlert(String(endpoint || ""), ruta, parada) });
});

module.exports = router;
