// go503: interfaz + mapa real (Leaflet + CARTO)

const CONFIG = {
  API_BASE: "",        // ej. "https://api.go503.com". Vacío = el mismo servidor
  USE_MOCK: false,     // true = datos de ejemplo, sin backend
  REFRESH_MS: 15000,   // cada cuánto se actualiza
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
  const res = await fetch(`${CONFIG.API_BASE}/api/rutas/${encodeURIComponent(ruta)}`);
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

// ---------- Unidad en el mapa: vista desde arriba, gira con la calle (como Uber) ----------
// Dibujadas mirando hacia arriba (norte); se giran con CSS según la dirección
const VEHICULOS = {
  autobus: `<svg viewBox="-3 0 28 50" width="25" height="45" aria-hidden="true">
    <rect class="v-dark" x="-2" y="6" width="3" height="4" rx="1"/>
    <rect class="v-dark" x="21" y="6" width="3" height="4" rx="1"/>
    <rect class="v-body" x="1" y="1" width="20" height="48" rx="4"/>
    <rect class="v-dark" x="3.5" y="3.5" width="15" height="6" rx="2"/>
    <rect class="v-roof" x="5" y="14" width="12" height="8" rx="2"/>
    <rect class="v-roof" x="5" y="27" width="12" height="8" rx="2"/>
    <rect class="v-dark v-rear" x="5" y="44" width="12" height="2.5" rx="1"/>
  </svg>`,
  microbus: `<svg viewBox="-3 0 28 38" width="25" height="34" aria-hidden="true">
    <rect class="v-dark" x="-2" y="8" width="3" height="4" rx="1"/>
    <rect class="v-dark" x="21" y="8" width="3" height="4" rx="1"/>
    <path class="v-body" d="M1 10Q1 1 11 1Q21 1 21 10V34Q21 37 18 37H4Q1 37 1 34Z"/>
    <path class="v-dark" d="M4 11Q4 5 11 5Q18 5 18 11V13H4Z"/>
    <rect class="v-roof" x="5" y="17" width="12" height="11" rx="2.5"/>
    <rect class="v-dark v-rear" x="5" y="32.5" width="12" height="2" rx="1"/>
  </svg>`,
};

// Dirección de a hacia b en grados (0 = norte, sentido horario)
function bearing(a, b) {
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return (Math.atan2(dx, b[0] - a[0]) * 180) / Math.PI;
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let vehicle = null; // marcador fuera de overlay para poder moverlo sin redibujarlo

function showVehicle(pos, angle, tipo, ruta) {
  const key = `${ruta}|${tipo}`;
  if (!pos || (vehicle && vehicle.key !== key)) {
    if (vehicle) vehicle.marker.remove();
    vehicle = null;
  }
  if (!pos) return;

  if (!vehicle) {
    const html = `<span class="veh" style="transform: rotate(${angle}deg)">${VEHICULOS[tipo] || VEHICULOS.autobus}</span>`
      + `<span class="veh__tag">${ruta}</span>`;
    const marker = L.marker(pos, {
      icon: L.divIcon({ className: "veh-wrap", html, iconSize: [0, 0] }),
      zIndexOffset: 1000, keyboard: false, interactive: false,
    }).addTo(map);
    vehicle = { marker, key, angle };
  } else {
    slide(vehicle.marker, pos);
  }

  // Gira por el camino más corto (de 350° a 10° son 20°, no 340°)
  vehicle.angle += ((angle - vehicle.angle + 540) % 360) - 180;
  const body = vehicle.marker.getElement()?.querySelector(".veh");
  if (body) body.style.transform = `rotate(${vehicle.angle}deg)`;
}

// Desliza el marcador hasta su nueva posición en vez de saltar
function slide(marker, to, ms = 1000) {
  cancelAnimationFrame(marker._slide);
  const from = marker.getLatLng();
  if (reduceMotion.matches) return marker.setLatLng(to);
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = k * (2 - k); // frena al final
    marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
    if (k < 1) marker._slide = requestAnimationFrame(step);
  };
  marker._slide = requestAnimationFrame(step);
}

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
  let busAngle = 0;
  let doneLegs = legs.slice(0, Math.max(lastIdx, 0));
  if (lastIdx >= 0 && nextIdx < paradas.length) {
    // Parte del tramo recorrida: la del GPS (backend) o, si no viene, estimada por tiempo
    const mins = (Date.now() - new Date(paradas[lastIdx].pasoA)) / 60000;
    const raw = data.bus && data.bus.progreso != null ? data.bus.progreso : mins / (paradas[nextIdx].tramoMin || 5);
    const p = Math.min(0.98, Math.max(0.02, raw));
    const s = splitAt(legs[lastIdx], p);
    doneLegs = [...doneLegs, s.head];
    bus = s.pt;
    busAngle = bearing(s.pt, splitAt(legs[lastIdx], Math.min(1, p + 0.02)).pt);
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

  // Unidad
  showVehicle(bus, busAngle, data.tipo, ruta);

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
  ? navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch((err) => {
      console.error(err);
      return null;
    })
  : Promise.resolve(null);

let misAlertas = new Set(); // "ruta|parada" con aviso activo en este dispositivo
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
    if (res.ok) misAlertas = new Set((await res.json()).map((a) => `${a.ruta}|${a.parada}`));
  } catch (err) {
    console.error(err);
  }
}

async function toggleAlerta(ruta, parada, nombre) {
  if (!pushOk) {
    setStatus(isIOS
      ? "En iPhone: toca Compartir y luego “Agregar a inicio”. Abre go503 desde ahí para recibir avisos."
      : "Este navegador no permite notificaciones.");
    return;
  }
  const key = `${ruta}|${parada}`;
  try {
    const sub = await miSuscripcion(true);
    if (!sub) {
      setStatus("Activa las notificaciones de go503 para que te avisemos.");
      return;
    }
    if (misAlertas.has(key)) {
      await postJSON("/api/alertas", { endpoint: sub.endpoint, ruta, parada }, "DELETE");
      misAlertas.delete(key);
      setStatus("");
    } else {
      const res = await postJSON("/api/alertas", { suscripcion: sub.toJSON(), ruta, parada });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      misAlertas.add(key);
      setStatus(`Listo: te avisamos cuando la ${ruta} esté a ${alertaMin} min de ${nombre}.`);
    }
    if (lastData) render(lastData);
  } catch (err) {
    console.error(err);
    setStatus("No se pudo guardar el aviso. Intenta de nuevo.");
  }
}

function bellButton(ruta, p) {
  const on = misAlertas.has(`${ruta}|${p.id}`);
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
  b.addEventListener("click", () => toggleAlerta(ruta, p.id, p.nombre));
  return b;
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
  $("#upd").textContent = `${TIPOS[data.tipo] || "Unidad"}. Actualizado a las ${hhmm(actualizado)}`;

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
      if (alertasOn && state !== "done") li.append(bellButton(ruta, p));
      return li;
    })
  );

  drawMap(data, lastIdx, nextIdx);
}

// ---------- Carga y actualización ----------
let current = new URLSearchParams(location.search).get("ruta") || "101"; // ?ruta= al abrir desde un aviso
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

function renderChips() {
  const visibles = rutas.filter((r) => tipo === "todos" || r.tipo === tipo);
  $("#chips").replaceChildren(
    ...visibles.map((r) => {
      const b = el("button", `chip${r.tipo === "microbus" ? " chip--micro" : ""}`);
      b.type = "button";
      b.setAttribute("aria-current", String(r.ruta === current));
      b.setAttribute("aria-label", `Ruta ${r.ruta}, ${TIPOS[r.tipo]}`);
      b.append(icono(r.tipo), r.ruta);
      b.addEventListener("click", () => {
        current = r.ruta;
        renderChips();
        load();
      });
      return b;
    })
  );
  return visibles;
}

document.querySelectorAll(".seg button").forEach((b) => {
  b.addEventListener("click", () => {
    tipo = b.dataset.tipo;
    document.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const visibles = renderChips();
    if (visibles.length && !visibles.some((r) => r.ruta === current)) {
      current = visibles[0].ruta;
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