// Chat "¿A dónde vas?": POST /api/chat { mensaje, historial?, lang?: "es"|"en", lat?, lng? }
// → { texto, rutas: [{ ruta, sentido, texto }], sugerencias: [], ia?: true }
// Con ANTHROPIC_API_KEY responde Claude (src/chat/ia.js); sin clave, o si falla, las reglas (src/chat/reglas.js).
const router = require("express").Router();
const { rateLimit } = require("../middleware/empresa");
const reglas = require("../chat/reglas");
const ia = require("../chat/ia");

router.post("/", rateLimit(20, 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const mensaje = typeof b.mensaje === "string" ? b.mensaje.trim().slice(0, 400) : "";
  const lang = b.lang === "en" ? "en" : "es";
  const lat = Number(b.lat), lng = Number(b.lng);
  const coords = b.lat != null && b.lng != null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  // El saludo no gasta IA
  if (mensaje && ia.disponible()) {
    try {
      return res.json(await ia.responderIA({ mensaje, historial: b.historial, lang, coords }));
    } catch (err) {
      console.error("[chat] La IA falló, respondo con reglas:", err.message);
    }
  }
  res.json(reglas.responder({ mensaje, lang, lat: coords?.lat, lng: coords?.lng }));
});

module.exports = router;
