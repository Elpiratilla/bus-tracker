const router = require("express").Router();
const { routes } = require("../store");

// Rutas completas con coordenadas: las usa el simulador (tools/simulator.js)
router.get("/", (_req, res) => res.json(routes));

module.exports = router;
