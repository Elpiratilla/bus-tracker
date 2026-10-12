// go503: interfaz + mapa real (Leaflet + CARTO)

const CONFIG = {
  API_BASE: "",        // ej. "https://api.go503.com". Vacío = el mismo servidor
  USE_MOCK: false,     // true = datos de ejemplo, sin backend
  REFRESH_MS: 15000,   // cada cuánto se actualiza
  OSRM: "https://router.project-osrm.org", // pega la ruta a las calles (servicio de prueba)
  CENTER: [13.699, -89.205],               // San Salvador
  CARTO_KEY: "cb1_483z_1_4a6102fca3ea19c0048a0ded",       // pega aquí tu llave gratis de https://carto.com/basemaps/apikey/
};

/* Contrato esperado: GET {API_BASE}/api/rutas/101
{
  "ruta": "101",
  "actualizado": "2026-10-12T08:16:00-06:00",
  "paradas": [               // en orden de recorrido
    { "id": 1, "nombre": "Terminal de Oriente", "lat": 13.71, "lng": -89.16,
      "tramoMin": null,                       // minutos desde la parada anterior
      "pasoA": "2026-10-12T08:02:00-06:00",   // null si el bus aún no pasa
      "etaA": null }                          // hora estimada si aún no pasa
  ]
} */

// ---------- Datos de ejemplo (coordenadas aproximadas, solo para probar) ----------
const MOCK = {
  "101": [
    ["Terminal de Oriente", 13.7126, -89.1643],
    ["Centro Histórico",    13.6989, -89.1914],
    ["Parque Infantil",     13.7030, -89.2030],
    ["Metrocentro",         13.7059, -89.2123],
    ["Zona Rosa",           13.6935, -89.2362],
  ],
  "42": [
    ["Mejicanos",                   13.7415, -89.2145],
    ["Zacamil",                     13.7290, -89.2090],
    ["Universidad de El Salvador",  13.7188, -89.2044],
    ["Colonia Escalón",             13.7010, -89.2380],
    ["Antiguo Cuscatlán",           13.6740, -89.2420],
  ],
  "29": [
    ["Soyapango",           13.7100, -89.1530],
    ["Terminal de Oriente", 13.7126, -89.1643],
    ["Centro Histórico",    13.6989, -89.1914],
    ["Hospital Rosales",    13.7045, -89.2028],
    ["Merliot",             13.6765, -89.2630],
  ],
};
const T0 = Date.now();

function mockRoute(ruta) {
  const at = (m) => (m === null ? null : new Date(T0 + m * 60000).toISOString());
  const tramos = [null, 5, 6, 7, 5];
  const pasos  = [-14, -9, -3, null, null];  // minutos respecto a la carga
  const etas   = [null, null, null, 4, 9];
  return {
    ruta,
    actualizado: new Date().toISOString(),
    paradas: MOCK[ruta].map(([nombre, lat, lng], i) => ({
      id: i + 1, nombre, lat, lng, tramoMin: tramos[i], pasoA: at(pasos[i]), etaA: at(etas[i]),
    })),
  };
}

async function getRoute(ruta) {
  if (CONFIG.USE_MOCK) return mockRoute(ruta);
  const res = await fetch(`${CONFIG.API_BASE}/api/rutas/${encodeURIComponent(ruta)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit", hour12: false });
const minsTo = (iso) => Math.ceil((new Date(iso) - Date.now()) / 60000);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

// ---------- Mapa ----------
const map = L.map("map", { zoomControl: false }).setView(CONFIG.CENTER, 13);
L.control.zoom({ position: "bottomright" }).addTo(map);

const darkQuery = matchMedia("(prefers-color-scheme: dark)");
let tiles;
function setTiles() {
  if (tiles) tiles.remove();
  if (CONFIG.CARTO_KEY) {
    const style = darkQuery.matches ? "dark_all" : "light_all";
    tiles = L.tileLayer(
      `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png?key=${CONFIG.CARTO_KEY}`,
      {
        maxZoom: 20,
        detectRetina: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    );
  } else {
    tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
  }
  tiles.addTo(map);
}
setTiles();
darkQuery.addEventListener("change", setTiles);

const overlay = L.layerGroup().addTo(map);

// Geometría de cada tramo siguiendo las calles (si falla, línea recta)
const legCache = new Map();
function legPath(a, b) {
  const key = `${a.lng},${a.lat};${b.lng},${b.lat}`;
  if (!legCache.has(key)) {
    legCache.set(key, (async () => {
      const straight = [[a.lat, a.lng], [b.lat, b.lng]];
      try {
        const r = await fetch(`${CONFIG.OSRM}/route/v1/driving/${key}?overview=full&geometries=geojson`);
        if (!r.ok) return straight;
        const j = await r.json();
        const c = j.routes && j.routes[0] && j.routes[0].geometry.coordinates;
        return c ? c.map(([x, y]) => [y, x]) : straight;
      } catch {
        return straight;
      }
    })());
  }
  return legCache.get(key);
}

const dist = (a, b) => Math.hypot(b[0] - a[0], (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180));

// Divide una línea en la fracción p (0 a 1) de su longitud
function splitAt(pts, p) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = dist(pts[i], pts[i + 1]);
    segs.push(d);
    total += d;
  }
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= total * p) {
      const t = segs[i] ? (total * p - acc) / segs[i] : 0;
      const pt = [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
      ];
      return { head: [...pts.slice(0, i + 1), pt], pt };
    }
    acc += segs[i];
  }
  const last = pts[pts.length - 1];
  return { head: pts, pt: last };
}

const icon = (html, size, cls = "cp-wrap") => L.divIcon({ className: cls, html, iconSize: size });
const line = (pts, cls, weight) =>
  L.polyline(pts, { className: cls, weight, lineCap: "round", lineJoin: "round", interactive: false });

let mapToken = 0;
let fittedRoute = null;

async function drawMap(data, lastIdx, nextIdx) {
  const { ruta, paradas } = data;
  const token = ++mapToken;
  const legs = await Promise.all(paradas.slice(1).map((p, i) => legPath(paradas[i], p)));
  if (token !== mapToken) return; // llegó otra actualización más nueva

  overlay.clearLayers();

  // Posición del bus dentro del tramo actual
  let bus = null;
  let doneLegs = legs.slice(0, Math.max(lastIdx, 0));
  if (lastIdx >= 0 && nextIdx < paradas.length) {
    const mins = (Date.now() - new Date(paradas[lastIdx].pasoA)) / 60000;
    const p = Math.min(0.95, Math.max(0.05, mins / (paradas[nextIdx].tramoMin || 5)));
    const s = splitAt(legs[lastIdx], p);
    doneLegs = [...doneLegs, s.head];
    bus = s.pt;
  } else if (lastIdx >= paradas.length - 1) {
    doneLegs = legs;
  }

  // Ruta: borde blanco, tramo pendiente y tramo recorrido
  legs.forEach((pts) => overlay.addLayer(line(pts, "route-case", 11)));
  legs.forEach((pts) => overlay.addLayer(line(pts, "route route--todo", 7)));
  doneLegs.forEach((pts) => overlay.addLayer(line(pts, "route route--done", 7)));

  // Minutos entre paradas
  legs.forEach((pts, i) => {
    const m = paradas[i + 1].tramoMin;
    if (!m) return;
    const mid = splitAt(pts, 0.5).pt;
    overlay.addLayer(L.marker(mid, { icon: icon(`<span class="leg">${m} min</span>`, [0, 0]), interactive: false, keyboard: false }));
  });

  // Checkpoints con nombre
  paradas.forEach((p, i) => {
    const state = i <= lastIdx ? "done" : i === nextIdx ? "next" : "todo";
    const html = (state === "next" ? '<span class="pulse"></span>' : "") + `<span class="cp cp--${state}"></span>`;
    const m = L.marker([p.lat, p.lng], { icon: icon(html, [22, 22]), keyboard: false, title: p.nombre });
    m.bindTooltip(p.nombre, {
      permanent: true,
      direction: i % 2 ? "bottom" : "top",
      offset: [0, i % 2 ? 12 : -12],
      className: state === "next" ? "stop-tip stop-tip--next" : "stop-tip",
    });
    overlay.addLayer(m);
  });

  // Bus
  if (bus) {
    overlay.addLayer(L.marker(bus, {
      icon: icon(`<span class="busmk">${ruta}</span>`, [46, 28]),
      zIndexOffset: 1000, keyboard: false, title: `Bus ${ruta}`,
    }));
  }

  // Encuadre: solo al abrir o cambiar de ruta
  if (fittedRoute !== ruta) {
    fittedRoute = ruta;
    map.fitBounds(L.latLngBounds(legs.flat()), { paddingTopLeft: [30, 70], paddingBottomRight: [30, 50] });
  }
}

// ---------- Panel ----------
function render(data) {
  const { ruta, actualizado, paradas } = data;
  const lastIdx = paradas.map((p) => Boolean(p.pasoA)).lastIndexOf(true);
  const nextIdx = lastIdx + 1;
  const next = paradas[nextIdx];
  const eta = next && next.etaA ? minsTo(next.etaA) : null;
  const etaLabel = eta === null ? "Sin estimado" : eta <= 0 ? "Llegando" : `Llega en ${eta} min`;

  $("#fascia").textContent = ruta;
  $("#fascia").setAttribute("aria-label", `Ruta ${ruta}`);
  $("#next-stop").textContent = next ? next.nombre : "Recorrido terminado";
  $("#next-eta").replaceChildren(
    ...(next
      ? eta !== null && eta > 0
        ? ["Llega en ", Object.assign(el("strong"), { textContent: `${eta} min` })]
        : [Object.assign(el("strong"), { textContent: etaLabel })]
      : [])
  );
  $("#upd").textContent = `Actualizado a las ${hhmm(actualizado)}`;

  $("#stops-title").textContent = `Paradas de la ruta ${ruta}`;
  $("#stops-list").replaceChildren(
    ...paradas.map((p, i) => {
      const state = i <= lastIdx ? "done" : i === nextIdx ? "next" : "todo";
      const li = el("li", `stop stop--${state}`);
      if (state === "next") li.setAttribute("aria-current", "step");

      const name = el("span", "stop__name", p.nombre);
      name.append(el("span", "stop__leg", p.tramoMin ? `${p.tramoMin} min desde la anterior` : "Inicio de la ruta"));

      const time =
        state === "done" ? `Pasó ${hhmm(p.pasoA)}`
        : state === "next" ? etaLabel
        : p.etaA ? `${hhmm(p.etaA)} aprox.` : "Sin estimado";

      li.append(el("span", "stop__dot"), name, el("span", "stop__time", time));
      return li;
    })
  );

  drawMap(data, lastIdx, nextIdx);
}

// ---------- Carga y actualización ----------
let current = "101";

function setStatus(msg) {
  const s = $("#status");
  s.textContent = msg;
  s.hidden = !msg;
}

async function load() {
  try {
    render(await getRoute(current));
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("No se pudo actualizar. Reintentando...");
  }
}

document.querySelectorAll(".routes a").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    current = a.dataset.ruta;
    document.querySelectorAll(".routes a").forEach((x) => x.removeAttribute("aria-current"));
    a.setAttribute("aria-current", "page");
    load();
  });
});

load();
setInterval(load, CONFIG.REFRESH_MS);