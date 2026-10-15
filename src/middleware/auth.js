// Autenticación de sensores (header x-api-key).
// - Unidad registrada por una empresa: debe mandar SU clave (se compara contra el hash guardado).
// - Unidad no registrada (simulador, pruebas): debe mandar BUS_API_KEY. Solo en desarrollo local,
//   sin BUS_API_KEY definida, se acepta sin clave (en producción el servidor ni arranca sin ella).
const crypto = require("crypto");
const { units } = require("../store");
const { isProduction } = require("../env");

const hashKey = (key) => crypto.createHash("sha256").update(String(key)).digest("hex");

function sameHash(a, b) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function sensorAuth(req, res, next) {
  const key = req.get("x-api-key") || "";
  const unit = units[req.body?.busId];
  if (unit?.apiKeyHash) {
    if (key && sameHash(hashKey(key), unit.apiKeyHash)) return next();
    return res.status(401).json({ error: "Clave del sensor inválida para esta unidad" });
  }
  const general = process.env.BUS_API_KEY;
  if (!general && isProduction) return res.status(401).json({ error: "API key inválida" });
  if (general && !(key && sameHash(hashKey(key), hashKey(general)))) return res.status(401).json({ error: "API key inválida" });
  next();
}

module.exports = sensorAuth;
module.exports.hashKey = hashKey;
