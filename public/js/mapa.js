// go503: interfaz + mapa real (Leaflet + CARTO)

const CONFIG = {
  API_BASE: "",        // ej. "https://api.go503.com". Vacío = el mismo servidor
  USE_MOCK: false,     // true = datos de ejemplo, sin backend
  REFRESH_MS: 5000,   // cada cuánto se actualiza
  OSRM: "https://router.project-osrm.org", // pega la ruta a las calles (servicio de prueba)
  CENTER: [13.699, -89.205],               // San Salvador
  CARTO_KEY: "cb1_483z_1_4a6102fca3ea19c0048a0ded",       // pega aquí tu llave gratis de https://carto.com/basemaps/apikey/
};

/* Contrato esperado
GET {API_BASE}/api/rutas            -> [ { "ruta": "101", "tipo": "autobus" }, ... ]
                                      tipo: "autobus" o "microbus"
GET {API_BASE}/api/rutas/101
{
  "ruta": "101",
  "tipo": "autobus",
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
const MOCK_RUTAS = [
  { ruta: "101", tipo: "autobus" },
  { ruta: "42",  tipo: "autobus" },
  { ruta: "29",  tipo: "microbus" },
  { ruta: "52",  tipo: "microbus" },
];
MOCK["52"] = [
  ["Zacamil",                    13.7290, -89.2090],
  ["Universidad de El Salvador", 13.7188, -89.2044],
  ["Parque Infantil",            13.7030, -89.2030],
  ["Centro Histórico",           13.6989, -89.1914],
  ["Terminal de Oriente",        13.7126, -89.1643],
];
const T0 = Date.now();

function mockRoute(ruta) {
  const at = (m) => (m === null ? null : new Date(T0 + m * 60000).toISOString());
  const tramos = [null, 5, 6, 7, 5];
  const pasos  = [-14, -9, -3, null, null];  // minutos respecto a la carga
  const etas   = [null, null, null, 4, 9];
  return {
    ruta,
    tipo: MOCK_RUTAS.find((r) => r.ruta === ruta).tipo,
    actualizado: new Date().toISOString(),
    paradas: MOCK[ruta].map(([nombre, lat, lng], i) => ({
      id: i + 1, nombre, lat, lng, tramoMin: tramos[i], pasoA: at(pasos[i]), etaA: at(etas[i]),
    })),
  };
}

async function getRutas() {
  if (CONFIG.USE_MOCK) return MOCK_RUTAS;
  const res = await fetch(`${CONFIG.API_BASE}/api/rutas`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getRoute(ruta) {
  if (CONFIG.USE_MOCK) return mockRoute(ruta);
  const q = sentido ? `?sentido=${sentido}` : ""; // sin sentido: el servidor escoge donde hay bus
  const res = await fetch(`${CONFIG.API_BASE}/api/rutas/${encodeURIComponent(ruta)}${q}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);

const TIPOS = { autobus: "Autobús", microbus: "Microbús" };

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

// Tema: el del teléfono, salvo que la persona elija otro con el botón (se recuerda)
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const root = document.documentElement;
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches);

let tiles;
function setTiles() {
  if (tiles) tiles.remove();
  if (CONFIG.CARTO_KEY) {
    const style = isDark() ? "dark_all" : "light_all";
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
function applyTheme() {
  setTiles();
  const dark = isDark();
  const btn = $("#tema");
  btn.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  btn.title = dark ? "Modo claro" : "Modo oscuro";
  btn.querySelector("use").setAttribute("href", dark ? "#i-sun" : "#i-moon");
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0C1130" : "#1B2559";
}
$("#tema").addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  try { localStorage.setItem("go503-tema", root.dataset.theme); } catch {}
  applyTheme();
});
applyTheme();
darkQuery.addEventListener("change", () => { if (!root.dataset.theme) applyTheme(); });

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

// ---------- Unidad en el mapa: vista desde arriba, gira con la calle (como Uber) ----------
// Dibujadas mirando hacia arriba (norte); se giran según la dirección de la calle
const VEHICULOS = {
  autobus: `<svg viewBox="-4 -1 34 62" width="27" height="50" aria-hidden="true">
    <defs><linearGradient id="v-roof-bus" x1="0" x2="1">
      <stop offset="0" stop-color="var(--v-side)"/><stop offset=".5" stop-color="var(--v-top)"/><stop offset="1" stop-color="var(--v-side)"/>
    </linearGradient></defs>
    <path class="v-dark" d="M2 9L-2.5 6.5V10.5L2 12ZM24 9L28.5 6.5V10.5L24 12Z"/>
    <rect x="1" y="0" width="24" height="60" rx="5" fill="url(#v-roof-bus)" class="v-edge"/>
    <path class="v-glass" d="M3.5 7Q3.5 2.5 8 2.5H18Q22.5 2.5 22.5 7V9.5H3.5Z"/>
    <rect class="v-glass" x="2.2" y="13" width="1.6" height="40" rx=".8"/>
    <rect class="v-glass" x="22.2" y="13" width="1.6" height="40" rx=".8"/>
    <rect class="v-unit" x="7" y="15" width="12" height="9" rx="2"/>
    <path class="v-grill" d="M9 17.5H17M9 19.5H17M9 21.5H17"/>
    <rect class="v-unit" x="7" y="36" width="12" height="9" rx="2"/>
    <path class="v-grill" d="M9 38.5H17M9 40.5H17M9 42.5H17"/>
    <rect class="v-hatch" x="9.5" y="28" width="7" height="5" rx="1"/>
    <rect class="v-glass" x="6" y="55.5" width="14" height="2" rx="1"/>
    <rect class="v-head" x="3" y=".6" width="4" height="1.4" rx=".7"/><rect class="v-head" x="19" y=".6" width="4" height="1.4" rx=".7"/>
    <rect class="v-tail" x="2.5" y="58.2" width="3.5" height="1.3" rx=".6"/><rect class="v-tail" x="20" y="58.2" width="3.5" height="1.3" rx=".6"/>
  </svg>`,
  microbus: `<svg viewBox="-4 -1 34 44" width="27" height="35" aria-hidden="true">
    <defs><linearGradient id="v-roof-micro" x1="0" x2="1">
      <stop offset="0" stop-color="var(--v-side)"/><stop offset=".5" stop-color="var(--v-top)"/><stop offset="1" stop-color="var(--v-side)"/>
    </linearGradient></defs>
    <path class="v-dark" d="M2 10L-2.5 7.5V11.5L2 13ZM24 10L28.5 7.5V11.5L24 13Z"/>
    <path d="M1 11Q1 0 13 0Q25 0 25 11V38Q25 42 21 42H5Q1 42 1 38Z" fill="url(#v-roof-micro)" class="v-edge"/>
    <path class="v-glass" d="M4 12Q4 4 13 4Q22 4 22 12V13.5H4Z"/>
    <rect class="v-glass" x="2.2" y="16" width="1.6" height="20" rx=".8"/>
    <rect class="v-glass" x="22.2" y="16" width="1.6" height="20" rx=".8"/>
    <rect class="v-unit" x="7" y="18" width="12" height="13" rx="3"/>
    <path class="v-grill" d="M9.5 21.5H16.5M9.5 24.5H16.5M9.5 27.5H16.5"/>
    <rect class="v-glass" x="6" y="37" width="14" height="2" rx="1"/>
    <rect class="v-head" x="4.5" y="1.6" width="4" height="1.4" rx=".7" transform="rotate(-18 6.5 2.3)"/>
    <rect class="v-head" x="17.5" y="1.6" width="4" height="1.4" rx=".7" transform="rotate(18 19.5 2.3)"/>
    <rect class="v-tail" x="2.5" y="40.2" width="3.5" height="1.3" rx=".6"/><rect class="v-tail" x="20" y="40.2" width="3.5" height="1.3" rx=".6"/>
  </svg>`,
};

// Dirección de a hacia b en grados (0 = norte, sentido horario)
function bearing(a, b) {
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2(dx, b[0] - a[0]) * 180) / Math.PI;
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Estado de la unidad animada. El servidor da la posición cada REFRESH_MS;
// entre actualizaciones se predice dónde va (como Uber) y se avanza suave sobre la calle.
let vehicle = null;

// target: { leg, legIdx, legMs, progress, tipo, ruta, doneLine } o null si no hay bus
function trackVehicle(target) {
  const key = target && `${target.ruta}|${target.tipo}|${target.sentido}`; // otro sentido = otro bus
  if (!target || (vehicle && vehicle.key !== key)) {
    if (vehicle) {
      cancelAnimationFrame(vehicle.raf);
      vehicle.marker.remove();
      vehicle.raf = 0;
    }
    vehicle = null;
  }
  if (!target) return;

  const progress = Math.min(0.98, Math.max(0, target.progress));
  if (!vehicle) {
    const html = `<span class="veh">${VEHICULOS[target.tipo] || VEHICULOS.autobus}</span>`
      + `<span class="veh__tag">${target.ruta}</span>`;
    const marker = L.marker(splitAt(target.leg, progress).pt, {
      icon: L.divIcon({ className: "veh-wrap", html, iconSize: [0, 0] }),
      zIndexOffset: 1000, keyboard: false, interactive: false,
    }).addTo(map);
    vehicle = { marker, key, p: progress, angle: null, lastT: 0, rate: null, history: [] };
  } else if (target.legIdx !== vehicle.legIdx) {
    vehicle.p = 0; // pasó a la siguiente parada: empieza el tramo nuevo desde su inicio
    vehicle.history = [];
  }

  // Velocidad real (parte del tramo por ms) con las últimas 4 posiciones del servidor en este tramo.
  // Si el bus se detiene, la animación también.
  const now = Date.now();
  vehicle.history = [...vehicle.history, [now, progress]].slice(-4);
  const [t0, p0] = vehicle.history[0];
  vehicle.rate = now - t0 > 2000 ? Math.max(0, (progress - p0) / (now - t0))
    : progress < 0.01 ? 0 // está en la parada y aún no se sabe si arrancó: no lo muevas
    : null;               // sin medición: usar la velocidad promedio del tramo

  Object.assign(vehicle, {
    leg: target.leg, legIdx: target.legIdx, legMs: target.legMs, doneLine: target.doneLine,
    base: progress, baseAt: now,
  });
  if (!vehicle.raf) vehicle.raf = requestAnimationFrame(animateVehicle);
}

function animateVehicle(t) {
  const v = vehicle;
  if (!v) return;
  // Volvió después de una pausa (otra pestaña, app en segundo plano): salta directo a donde va
  const resumed = !v.lastT || t - v.lastT > 1000;
  const dt = resumed ? 0 : t - v.lastT;
  v.lastT = t;

  // Predicción: lo último que dijo el servidor + lo que avanzó desde entonces, a la velocidad
  // medida (o la promedio del tramo si aún no hay medición). Tope de +30 % del tramo.
  const rate = v.rate ?? 1 / v.legMs;
  const pred = Math.min(0.98, v.base + (Date.now() - v.baseAt) * rate, v.base + 0.3);
  const k = reduceMotion.matches || resumed ? 1 : 1 - Math.exp(-dt / 2000); // las correcciones se reparten en ~2 s
  let p = v.p + (pred - v.p) * k;
  if (p < v.p && v.p - p < 0.03) p = v.p; // no retroceder por correcciones pequeñas
  // Al ponerse al día nunca va a más del doble de su velocidad normal (sin acelerones)
  const maxStep = 2 * Math.max(rate, 1 / v.legMs) * dt;
  if (!reduceMotion.matches && !resumed && p > v.p + maxStep) p = v.p + maxStep;
  v.p = p;

  const s = splitAt(v.leg, p);
  v.marker.setLatLng(s.pt);
  v.doneLine.setLatLngs(s.head);

  // Gira hacia donde va la calle unos metros adelante, sin girar de golpe
  const ahead = splitAt(v.leg, Math.min(1, p + 0.015)).pt;
  if (dist(s.pt, ahead) > 1e-6) {
    const target = bearing(s.pt, ahead);
    if (v.angle === null) v.angle = target;
    const delta = ((target - v.angle + 540) % 360) - 180; // por el lado más corto
    v.angle += delta * (reduceMotion.matches || resumed ? 1 : 1 - Math.exp(-dt / 250));
  }
  const body = v.marker.getElement()?.querySelector(".veh");
  if (body && v.angle !== null) body.style.transform = `rotate(${v.angle}deg)`;

  v.raf = requestAnimationFrame(animateVehicle);
}

let mapToken = 0;
let fittedRoute = null;

async function drawMap(data, lastIdx, nextIdx) {
  const { ruta, paradas } = data;
  const token = ++mapToken;
  const legs = await Promise.all(paradas.slice(1).map((p, i) => legPath(paradas[i], p)));
  if (token !== mapToken) return; // llegó otra actualización más nueva

  overlay.clearLayers();

  // Tramo donde va el bus y qué parte lleva (la del GPS o, si no viene, estimada por tiempo)
  let target = null;
  let doneLegs = legs.slice(0, Math.max(lastIdx, 0));
  if (lastIdx >= 0 && nextIdx < paradas.length) {
    const legMs = (paradas[nextIdx].tramoMin || 5) * 60000;
    const progress = data.bus && data.bus.progreso != null
      ? data.bus.progreso
      : (Date.now() - new Date(paradas[lastIdx].pasoA)) / legMs;
    target = { leg: legs[lastIdx], legIdx: lastIdx, legMs, progress, tipo: data.tipo, ruta, sentido: data.sentido };
  } else if (lastIdx >= paradas.length - 1) {
    doneLegs = legs;
  }

  // Ruta: borde blanco, tramo pendiente y tramo recorrido
  legs.forEach((pts) => overlay.addLayer(line(pts, "route-case", 11)));
  legs.forEach((pts) => overlay.addLayer(line(pts, "route route--todo", 7)));
  doneLegs.forEach((pts) => overlay.addLayer(line(pts, "route route--done", 7)));
  // Tramo actual recorrido: lo alarga la animación conforme avanza el bus
  if (target) {
    target.doneLine = line([], "route route--done", 7);
    overlay.addLayer(target.doneLine);
  }

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

  // Unidad
  trackVehicle(target);

  // Encuadre: solo al abrir o cambiar de ruta
  if (fittedRoute !== ruta) {
    fittedRoute = ruta;
    map.fitBounds(L.latLngBounds(legs.flat()), { paddingTopLeft: [30, 120], paddingBottomRight: [30, 50] });
  }
}

// ---------- Avisos "tu bus está cerca" (Web Push) ----------
const api = (path) => `${CONFIG.API_BASE}${path}`;
const alertasOn = !CONFIG.USE_MOCK;
const pushOk = alertasOn && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const swReady = pushOk
  ? navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).catch((err) => {
      console.error(err);
      return null;
    })
  : Promise.resolve(null);

let misAlertas = new Set(); // "ruta|sentido|parada" con aviso activo en este dispositivo
let alertaMin = 5;

const postJSON = (path, body, method = "POST") =>
  fetch(api(path), { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Clave pública VAPID (base64url) a bytes
function b64ToBytes(b64) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

// Suscripción push de este dispositivo. Con pedir=true pide permiso si hace falta.
async function miSuscripcion(pedir) {
  const reg = await swReady;
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (sub || !pedir) return sub;
  if ((await Notification.requestPermission()) !== "granted") return null;
  const res = await fetch(api("/api/alertas/clave"));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { clave, minutos } = await res.json();
  alertaMin = minutos;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(clave) });
}

async function cargarAlertas() {
  if (!pushOk) return;
  try {
    const sub = await miSuscripcion(false);
    if (!sub) return;
    const res = await postJSON("/api/alertas/mias", { endpoint: sub.endpoint });
    if (res.ok) misAlertas = new Set((await res.json()).map((a) => `${a.ruta}|${a.sentido}|${a.parada}`));
  } catch (err) {
    console.error(err);
  }
}

async function toggleAlerta(ruta, dir, hacia, parada, nombre) {
  if (!pushOk) {
    setStatus(isIOS
      ? "En iPhone: toca Compartir y luego “Agregar a inicio”. Abre go503 desde ahí para recibir avisos."
      : "Este navegador no permite notificaciones.");
    return;
  }
  const key = `${ruta}|${dir}|${parada}`;
  try {
    const sub = await miSuscripcion(true);
    if (!sub) {
      setStatus("Activa las notificaciones de go503 para que te avisemos.");
      return;
    }
    if (misAlertas.has(key)) {
      await postJSON("/api/alertas", { endpoint: sub.endpoint, ruta, sentido: dir, parada }, "DELETE");
      misAlertas.delete(key);
      setStatus("");
    } else {
      const res = await postJSON("/api/alertas", { suscripcion: sub.toJSON(), ruta, sentido: dir, parada });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      misAlertas.add(key);
      setStatus(`Listo: te avisamos cuando la ${ruta}${hacia ? ` hacia ${hacia}` : ""} esté a ${alertaMin} min de ${nombre}.`);
    }
    if (lastData) render(lastData);
  } catch (err) {
    console.error(err);
    setStatus("No se pudo guardar el aviso. Intenta de nuevo.");
  }
}

function bellButton(ruta, dir, hacia, p) {
  const on = misAlertas.has(`${ruta}|${dir}|${p.id}`);
  const label = on ? `Cancelar aviso de ${p.nombre}` : `Avisarme cuando la ${ruta} esté cerca de ${p.nombre}`;
  const b = el("button", "stop__bell");
  b.type = "button";
  b.title = label;
  b.setAttribute("aria-label", label);
  b.setAttribute("aria-pressed", String(on));
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "ico");
  s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", "#i-bell");
  s.append(u);
  b.append(s);
  b.addEventListener("click", () => toggleAlerta(ruta, dir, hacia, p.id, p.nombre));
  return b;
}

// ---------- Panel ----------
function render(data) {
  const { ruta, actualizado, paradas } = data;
  const lastIdx = paradas.map((p) => Boolean(p.pasoA)).lastIndexOf(true);
  const nextIdx = lastIdx + 1;
  const next = paradas[nextIdx];
  const eta = next && next.etaA ? minsTo(next.etaA) : null;
  const etaLabel = data.sinSenal ? "Sin señal"
    : eta === null ? "Sin estimado" : eta <= 0 ? "Llegando" : `Llega en ${eta} min`;

  // Sentido: "Hacia Zona Rosa" / "Hacia Terminal de Oriente"
  const actual = (data.sentidos || []).find((x) => x.id === data.sentido);
  const hacia = actual?.destino || null;
  const dirBox = $("#sentidos");
  dirBox.hidden = !data.sentidos;
  if (data.sentidos) {
    dirBox.replaceChildren(...data.sentidos.map((x) => {
      const b = el("button", null, `Hacia ${x.destino}`);
      b.type = "button";
      b.setAttribute("aria-pressed", String(x.id === data.sentido));
      b.addEventListener("click", () => { if (x.id !== data.sentido) { sentido = x.id; load(); } });
      return b;
    }));
  }

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
  $("#upd").textContent = data.sinSenal
    ? `La unidad no envía señal desde las ${hhmm(data.ultimaSenal)}. Su hora de llegada no es confiable.`
    : `${TIPOS[data.tipo] || "Unidad"}. Actualizado a las ${hhmm(actualizado)}`;

  $("#stops-title").textContent = `Paradas de la ruta ${ruta}${hacia ? ` hacia ${hacia}` : ""}`;
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
      if (alertasOn && state !== "done") li.append(bellButton(ruta, data.sentido || "ida", hacia, p));
      return li;
    })
  );

  drawMap(data, lastIdx, nextIdx);
}

// ---------- Carga y actualización ----------
const params = new URLSearchParams(location.search);
let current = params.get("ruta") || "101"; // ?ruta=&sentido= al abrir desde un aviso
let sentido = ["ida", "regreso"].includes(params.get("sentido")) ? params.get("sentido") : null; // null = automático
let lastData = null;

function setStatus(msg) {
  const s = $("#status");
  s.textContent = msg;
  s.hidden = !msg;
}

async function load() {
  try {
    const data = await getRoute(current);
    await cargarAlertas();
    lastData = data;
    render(data);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("No se pudo actualizar. Reintentando...");
  }
}

// ---------- Selector de tipo y rutas ----------
let rutas = [];
let tipo = "todos";

function icono(t) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "ico");
  s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", t === "microbus" ? "#i-micro" : "#i-bus");
  s.append(u);
  return s;
}

// Búsqueda por número de ruta o nombre de parada, sin importar acentos ni mayúsculas
let query = "";
const norm = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const compact = (t) => norm(t).replace(/[^a-z0-9]/g, "");

function matches(r) {
  if (!query) return true;
  const q = norm(query);
  return compact(r.ruta).startsWith(compact(q))
    || norm(r.nombre || "").includes(q)
    || (r.paradas || []).some((p) => norm(p).includes(q));
}

function renderChips() {
  const visibles = rutas.filter((r) => (tipo === "todos" || r.tipo === tipo) && matches(r));
  if (!visibles.length && query) {
    $("#chips").replaceChildren(el("p", "chips__empty", `No hay rutas con “${query}”`));
    return visibles;
  }
  $("#chips").replaceChildren(
    ...visibles.map((r) => {
      const b = el("button", `chip${r.tipo === "microbus" ? " chip--micro" : ""}`);
      b.type = "button";
      b.setAttribute("aria-current", String(r.ruta === current));
      b.setAttribute("aria-label", `Ruta ${r.ruta}, ${TIPOS[r.tipo]}`);
      b.append(icono(r.tipo), r.ruta);
      b.addEventListener("click", () => {
        current = r.ruta;
        sentido = null;
        renderChips();
        load();
      });
      return b;
    })
  );
  return visibles;
}

function selectRuta(ruta) {
  current = ruta;
  sentido = null;
  renderChips();
  load();
}

const buscar = $("#buscar");
buscar.addEventListener("input", () => { query = buscar.value; renderChips(); });
buscar.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const first = rutas.find((r) => (tipo === "todos" || r.tipo === tipo) && matches(r));
    if (first) { selectRuta(first.ruta); buscar.blur(); }
  }
  if (e.key === "Escape") { buscar.value = ""; query = ""; renderChips(); }
});

document.querySelectorAll(".seg button").forEach((b) => {
  b.addEventListener("click", () => {
    tipo = b.dataset.tipo;
    document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const visibles = renderChips();
    if (visibles.length && !visibles.some((r) => r.ruta === current)) {
      current = visibles[0].ruta;
      sentido = null;
      renderChips();
      load();
    }
  });
});

async function init() {
  try {
    rutas = await getRutas();
  } catch (err) {
    console.error(err);
    rutas = [{ ruta: current, tipo: "autobus" }];
    setStatus("No se pudo cargar la lista de rutas.");
  }
  if (rutas.length && !rutas.some((r) => r.ruta === current)) current = rutas[0].ruta;
  renderChips();
  load();
  setInterval(load, CONFIG.REFRESH_MS);
}

init();