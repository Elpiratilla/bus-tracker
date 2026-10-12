const router = require("express").Router();
const auth = require("../middleware/auth");
const { routes, lastPass, segments } = require("../store");

// El sensor avisa que un bus pasó por una parada
router.post("/", auth, (req, res) => {
  const { busId, routeId, stopId, ts } = req.body;
  const route = routes.find((r) => r.id === routeId);
  if (!busId || !route || !route.stops.some((s) => s.id === stopId))
    return res.status(400).json({ error: "busId, routeId o stopId inválido" });

  const now = ts ? new Date(ts).getTime() : Date.now();
  const key = `${busId}:${routeId}`;
  const prev = lastPass[key];
  const order = (id) => route.stops.findIndex((s) => s.id === id);

  // Solo cuenta tramos consecutivos (parada N -> N+1)
  if (prev && order(stopId) === order(prev.stopId) + 1) {
    segments.push({ busId, routeId, from: prev.stopId, to: stopId,
      seconds: Math.round((now - prev.ts) / 1000), ts: now });
  }
  lastPass[key] = { stopId, ts: now };
  res.status(201).json({ ok: true });
});

module.exports = router;
