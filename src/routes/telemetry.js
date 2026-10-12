const router = require("express").Router();
const auth = require("../middleware/auth");
const { buses } = require("../store");

// Datos de la unidad: velocidad, combustible, temperatura...
router.post("/", auth, (req, res) => {
  const { busId, ...data } = req.body;
  if (!busId) return res.status(400).json({ error: "busId requerido" });
  buses[busId] = { busId, ...data, updatedAt: Date.now() };
  res.status(201).json({ ok: true });
});

router.get("/", (_req, res) => res.json(Object.values(buses)));

module.exports = router;
