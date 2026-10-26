// Cabeceras de seguridad para todas las respuestas (sin helmet: son pocas y así se ven todas).
// La CSP solo deja correr scripts de go503, de unpkg (Leaflet) y de jsDelivr (Supabase).
// Los <script> en línea de las páginas se permiten por su hash, que se calcula al arrancar:
// si cambias uno, reinicia el servidor (en Render pasa solo con cada deploy).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "public", "html");

function hashesEnLinea() {
  const hashes = new Set();
  for (const f of fs.readdirSync(HTML).filter((n) => n.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(HTML, f), "utf8");
    for (const [, js] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      hashes.add(`'sha256-${crypto.createHash("sha256").update(js).digest("base64")}'`);
    }
  }
  return [...hashes].join(" ");
}

function cabeceras() {
  const supa = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).host : "*.supabase.co";
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashesEnLinea()} https://unpkg.com https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com", // hay style="" en las páginas
    "img-src 'self' data: blob: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://unpkg.com",
    "font-src 'self'",
    `connect-src 'self' https://${supa} wss://${supa} https://router.project-osrm.org`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  return (_req, res, next) => {
    res.set({
      "Content-Security-Policy": csp,
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    });
    next();
  };
}

module.exports = { cabeceras };
