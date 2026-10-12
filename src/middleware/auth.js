// Si defines BUS_API_KEY, los sensores deben enviarla en el header x-api-key.
module.exports = (req, res, next) => {
  const key = process.env.BUS_API_KEY;
  if (key && req.get("x-api-key") !== key) return res.status(401).json({ error: "API key inválida" });
  next();
};
