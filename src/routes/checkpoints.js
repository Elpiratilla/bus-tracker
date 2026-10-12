const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes } = require("../store");
const { registerPass, toTime } = require("../tracking");

// Marca a mano que un bus pasó por una parada (los sensores GPS usan /api/telemetry)
router.post("/", auth, (req, res) => {
  const { busId, routeId, stopId, ts } = req.body;
  const route = routes.find((r) => r.id === routeId);
  if (!busId || !route || !route.stops.some((s) => s.id === stopId))
    return res.status(400).json({ error: "busId, routeId o stopId inválido" });

  registerPass(busId, route, stopId, toTime(ts));
  res.status(201).json({ ok: true });
});

module.exports = router;
