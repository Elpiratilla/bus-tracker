// Sesión de empresarios: el navegador inicia sesión con Supabase Auth y manda
// "Authorization: Bearer <token>". Aquí se verifica y se busca su empresa.
const { db } = require("../db");

const CACHE_MS = 60 * 1000;
const cache = new Map(); // token -> { user, company, exp }

async function lookup(token) {
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit;

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: company } = await db.from("companies").select("id, name, is_admin")
    .eq("owner_id", data.user.id).maybeSingle();

  const entry = { user: data.user, company: company || null, exp: Date.now() + CACHE_MS };
  cache.set(token, entry);
  if (cache.size > 5000) cache.delete(cache.keys().next().value); // no crecer sin límite
  return entry;
}

// Requiere sesión válida (la empresa puede no existir todavía: recién registrado)
async function requireUser(req, res, next) {
  if (!db) return res.status(503).json({ error: "El panel necesita Supabase configurado en el servidor" });
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Inicia sesión para continuar" });
  try {
    const entry = await lookup(token);
    if (!entry) return res.status(401).json({ error: "Tu sesión venció. Vuelve a iniciar sesión." });
    req.user = entry.user;
    req.company = entry.company;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

// Requiere sesión y empresa activada
function requireCompany(req, res, next) {
  requireUser(req, res, () => {
    if (!req.company) return res.status(403).json({ error: "Activa tu empresa con tu código de invitación" });
    next();
  });
}

// Requiere ser administrador de go503 (crea códigos de invitación)
function requireAdmin(req, res, next) {
  requireCompany(req, res, () => {
    if (!req.company.is_admin) return res.status(403).json({ error: "Solo los administradores de go503 pueden hacer esto" });
    next();
  });
}

const forgetToken = (token) => cache.delete(token);

// Límite simple por IP para no permitir adivinar códigos a la fuerza
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    // Las IPs que ya vencieron se olvidan, si no el Map crece con cada visitante hasta reiniciar
    if (hits.size > 10000) for (const [ip, e] of hits) if (e.reset <= now) hits.delete(ip);
    const h = hits.get(req.ip);
    const entry = h && h.reset > now ? h : { n: 0, reset: now + windowMs };
    entry.n += 1;
    hits.set(req.ip, entry);
    if (entry.n > max) return res.status(429).json({ error: "Demasiados intentos. Espera un minuto." });
    next();
  };
}

module.exports = { requireUser, requireCompany, requireAdmin, forgetToken, rateLimit };
