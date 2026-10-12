const router = require("express").Router();
const { routes, segments } = require("../store");

router.get("/", (_req, res) => res.json(routes));

// Promedio y último tiempo por tramo
router.get("/:id/summary", (req, res) => {
  const route = routes.find((r) => r.id === req.params.id);
  if (!route) return res.status(404).json({ error: "Ruta no existe" });
  const result = route.stops.slice(1).map((stop, i) => {
    const from = route.stops[i];
    const list = segments.filter((s) => s.routeId === route.id && s.from === from.id && s.to === stop.id);
    const avg = list.length ? list.reduce((a, s) => a + s.seconds, 0) / list.length : null;
    return { from: from.name, to: stop.name, trips: list.length,
      avgSeconds: avg && Math.round(avg), lastSeconds: list.length ? list[list.length - 1].seconds : null };
  });
  res.json(result);
});

module.exports = router;
