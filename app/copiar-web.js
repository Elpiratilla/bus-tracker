// Copia la página del motorista (public/) a www/, que es lo que va dentro de la app.
// Así la app y la página web usan el mismo código. Correr: npm run web (o npm run sync)
const fs = require("fs");
const path = require("path");

const PUBLIC = path.join(__dirname, "..", "public");
const WWW = path.join(__dirname, "www");
const ARCHIVOS = {
  "motorista.html": "index.html", // la app abre index.html
  "js/motorista.js": "js/motorista.js",
  "css/base.css": "css/base.css",
  "css/motorista.css": "css/motorista.css",
  "img/go503-favicon.svg": "img/go503-favicon.svg",
};

fs.rmSync(WWW, { recursive: true, force: true });
for (const [desde, hacia] of Object.entries(ARCHIVOS)) {
  const destino = path.join(WWW, hacia);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(path.join(PUBLIC, desde), destino);
}
console.log(`Copiados ${Object.keys(ARCHIVOS).length} archivos a www/`);
