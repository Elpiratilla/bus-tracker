// go503 empresas: panel (flota en vivo, unidades, mantenimiento y reportes)
const { supa, api, $, el, showMsg } = window.go503;

const REFRESH_MS = 5000;
const CARTO_KEY = "cb1_483z_1_4a6102fca3ea19c0048a0ded"; // la misma del mapa público
const VIEWS = ["flota", "unidades", "mantenimiento", "reportes", "clientes", "codigos", "recorridos"];
const ADMIN_VIEWS = ["clientes", "codigos", "recorridos"];
let isAdmin = false;
const TIPOS = { autobus: "Autobús", microbus: "Microbús" };
const SERVICIOS = { aceite: "Cambio de aceite", frenos: "Frenos", llantas: "Llantas", general: "Revisión general", otro: "Otro" };

let rutas = [];
let flota = [];
let timer = null;
let selected = null;
let pendientes = []; // unidades con el aceite vencido o por vencer (de updateBadge)

// ---------- Utilidades ----------
const km = (n) => `${fmt(n, n != null && n < 100 ? 1 : 0)} km`; // decimales solo cuando son pocos km
const fmt = (n, d = 0) => (n == null ? "–" : Number(n).toLocaleString((window.go503Idioma?.locale || "es-SV"), { maximumFractionDigits: d, minimumFractionDigits: d }));
const fecha = (iso) => new Date(iso).toLocaleDateString((window.go503Idioma?.locale || "es-SV"), { day: "numeric", month: "short", year: "numeric" });
const hora = (t) => new Date(t).toLocaleTimeString((window.go503Idioma?.locale || "es-SV"), { hour: "2-digit", minute: "2-digit", hour12: false });

function hace(iso) {
  if (!iso) return "Nunca";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return fecha(iso);
}

function icon(id) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("class", "ico");
  s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
  u.setAttribute("href", `#${id}`);
  s.append(u);
  return s;
}

function button(text, cls, onClick) {
  const b = el("button", `btn ${cls}`, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

// En el teléfono cada fila se muestra como tarjeta: cada celda lleva el nombre de su columna
function cards(table) {
  table.classList.add("table--cards");
  const names = [...table.tHead.rows[0].cells].map((th) => th.textContent);
  [...table.tBodies[0].rows].forEach((tr) => [...tr.cells].forEach((td, i) => { if (names[i]) td.dataset.label = names[i]; }));
  return table;
}

// Menú "Más": las acciones que se usan poco quedan guardadas, para que no compitan con la principal
let menuAbierto = null;
function cerrarMenu() {
  if (!menuAbierto) return;
  menuAbierto.list.hidden = true;
  menuAbierto.btn.setAttribute("aria-expanded", "false");
  menuAbierto = null;
}
function moreMenu(etiqueta, items) {
  const wrap = el("div", "more");
  const list = el("div", "more__list");
  list.hidden = true;
  const btn = button("Más", "btn--ghost btn--sm more__btn", (e) => {
    e.stopPropagation();
    const abrir = list.hidden;
    cerrarMenu();
    if (!abrir) return;
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    menuAbierto = { btn, list };
    list.querySelector("button")?.focus();
  });
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", etiqueta);
  items.forEach(([texto, fn, cls]) => {
    const b = el("button", `more__item${cls ? ` ${cls}` : ""}`, texto);
    b.type = "button";
    b.addEventListener("click", () => { cerrarMenu(); btn.focus(); fn(); });
    list.append(b);
  });
  wrap.append(btn, list);
  return wrap;
}
document.addEventListener("click", (e) => { if (menuAbierto && !menuAbierto.list.contains(e.target)) cerrarMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuAbierto) { const b = menuAbierto.btn; cerrarMenu(); b.focus(); } });

const msg = $("#msg");
const fail = (err) => { console.error(err); showMsg(msg, err.message || "Algo falló. Intenta de nuevo."); };

// Tooltip compartido de gráficas y mapa de calor
const tip = $("#tip");
function showTip(e, nodes) {
  tip.replaceChildren(...nodes);
  tip.hidden = false;
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  tip.style.left = `${x}px`;
  tip.style.top = `${e.clientY - tip.offsetHeight - 12}px`;
}
const hideTip = () => { tip.hidden = true; };

// Diálogos: cerrar con los botones [data-cerrar]
document.querySelectorAll("dialog").forEach((d) =>
  d.querySelectorAll("[data-cerrar]").forEach((b) => b.addEventListener("click", () => d.close())));

// ---------- Navegación ----------
// Cambio de sección con una transición suave (si el navegador la soporta)
let firstRoute = true;
function route() {
  if (!firstRoute && document.startViewTransition && !reduceMotion.matches) {
    document.startViewTransition(showRoute);
  } else showRoute();
  firstRoute = false;
}
function showRoute() {
  const asked = location.hash.slice(1);
  const view = VIEWS.includes(asked) && (!ADMIN_VIEWS.includes(asked) || isAdmin) ? asked : "flota";
  VIEWS.forEach((v) => { $(`#v-${v}`).hidden = v !== view; });
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.getAttribute("href") === `#${view}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  showMsg(msg, "");
  clearInterval(timer);
  if (view === "flota") { loadFlota(); timer = setInterval(loadFlota, REFRESH_MS); }
  if (view === "unidades") loadUnidades();
  if (view === "mantenimiento") loadMantenimiento();
  if (view === "reportes") loadReportes();
  if (view === "codigos") loadCodigos();
  if (view === "clientes") loadClientes();
  if (view === "recorridos") loadRecorridos();
}
addEventListener("hashchange", route);

// ---------- Flota en vivo ----------
let map = null;
const markers = new Map();
let fitted = false;

let tiles = null;
function setTiles() {
  if (!map) return;
  if (tiles) tiles.remove();
  tiles = L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/${isDark() ? "dark_all" : "light_all"}/{z}/{x}/{y}.png?key=${CARTO_KEY}`, {
    maxZoom: 20, detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
}
function initMap() {
  map = L.map("fleet-map", { zoomControl: false }).setView([13.699, -89.205], 12);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  setTiles();
}

// Modo claro / oscuro: el del teléfono, salvo que la persona escoja otro (se guarda igual que en la portada)
const root = document.documentElement;
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function isDark() { return root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches; }
function applyTheme() {
  const b = $("#tema");
  b.textContent = isDark() ? "Claro" : "Oscuro";
  b.setAttribute("aria-label", isDark() ? "Pasar a modo claro" : "Pasar a modo oscuro");
  setTiles();
}
$("#tema").addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  try { localStorage.setItem("go503-tema", root.dataset.theme); } catch {}
  applyTheme();
});
darkQuery.addEventListener("change", () => { if (!root.dataset.theme) applyTheme(); });
applyTheme();

function markerIcon(u) {
  const cls = `fleet-mk${u.enLinea ? "" : " fleet-mk--off"}${selected === u.id ? " fleet-mk--sel" : ""}`;
  return L.divIcon({ className: "", html: `<span class="${cls}">${u.ruta ?? ""}</span>`, iconSize: [38, 26], iconAnchor: [19, 13] });
}

function estado(u) {
  if (!u.ultimaSenal) return "El sensor aún no transmite";
  if (!u.enLinea) return `Sin señal, última ${hace(u.ultimaSenal)}`;
  if (u.enServicio === false) return "Fuera de servicio";
  if (u.motorApagado) return u.parada ? `Motor apagado en ${u.parada}` : "Motor apagado";
  const va = u.hacia ? ` hacia ${u.hacia}` : "";
  return u.parada ? `En ${u.parada}${va}` : `En ruta${va}`;
}

const lastEstado = new Map();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Mueve un marcador suavemente durante el intervalo de actualización (sin saltos)
function slideMarker(m, to) {
  const from = m.getLatLng();
  if (reduceMotion.matches || (from.lat === to[0] && from.lng === to[1])) return m.setLatLng(to);
  cancelAnimationFrame(m._slide);
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / REFRESH_MS);
    m.setLatLng([from.lat + (to[0] - from.lat) * k, from.lng + (to[1] - from.lng) * k]);
    if (k < 1) m._slide = requestAnimationFrame(step);
  };
  m._slide = requestAnimationFrame(step);
}

// Rutas en el mapa: por dónde debe ir cada unidad, en el sentido que lleva, con sus paradas.
// Con una unidad escogida su ruta queda al frente y las demás se aclaran.
// Sin recorrido guardado se unen las paradas en línea recta punteada: solo de referencia.
const rutasMapa = new Map(); // "101:ida" -> respuesta de /api/rutas/101?sentido=ida
let rutasCapa = null;
let rutasFirma = "";
const claveRuta = (u) => `${u.ruta}:${u.sentido || "ida"}`;
async function pintarRutas() {
  if (!map) return;
  const claves = [...new Set(flota.filter((u) => u.ruta).map(claveRuta))];
  const sel = flota.find((u) => u.id === selected && u.ruta);
  const principal = sel ? claveRuta(sel) : null;
  const firma = `${claves.join(",")}|${principal}`;
  if (firma === rutasFirma) return;
  try {
    await Promise.all(claves.filter((k) => !rutasMapa.has(k)).map(async (k) => {
      const [ruta, sentido] = k.split(":");
      const r = await fetch(`/api/rutas/${encodeURIComponent(ruta)}?sentido=${sentido}`);
      if (r.ok) rutasMapa.set(k, await r.json());
    }));
  } catch (err) { return console.error(err); }
  rutasFirma = firma;
  if (!rutasCapa) rutasCapa = L.layerGroup().addTo(map);
  rutasCapa.clearLayers();
  // la principal al final para que quede encima
  [...claves.filter((k) => k !== principal), ...(principal ? [principal] : [])].forEach((k) => {
    const r = rutasMapa.get(k);
    if (!r?.paradas.length) return;
    const tenue = principal && k !== principal ? " fleet-ruta--tenue" : "";
    const puntos = r.trazo?.length > 1 ? r.trazo : r.paradas.map((p) => [p.lat, p.lng]);
    const recta = r.trazo?.length > 1 ? null : "4 10";
    rutasCapa.addLayer(L.polyline(puntos, { className: `fleet-borde${tenue}`, weight: 8, interactive: false }));
    rutasCapa.addLayer(L.polyline(puntos, { className: `fleet-ruta${tenue}`, weight: 4, dashArray: recta, interactive: false }));
    const fin = r.paradas.length - 1;
    r.paradas.forEach((p, i) => rutasCapa.addLayer(L.circleMarker([p.lat, p.lng], {
      radius: i === fin ? 7 : 4.5, className: `fleet-parada${i === fin ? " fleet-parada--fin" : ""}${tenue}`,
    }).bindTooltip(i === fin ? `Ruta ${r.ruta}, termina en ${p.nombre}` : `${i + 1}. ${p.nombre}`, { direction: "top", offset: [0, -6] })));
  });
  // la primera vez se encuadran las rutas completas y los buses
  const b = L.latLngBounds([]);
  rutasCapa.eachLayer((l) => b.extend(l.getBounds?.() ?? l.getLatLng()));
  markers.forEach((m) => b.extend(m.getLatLng()));
  if (!fitted && b.isValid()) {
    fitted = true;
    map.invalidateSize();
    map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
  }
}

// Resumen en palabras: saludo, cuántas andan y, si alguna necesita servicio, cuál y dónde atenderla
function pintarResumen() {
  const en = flota.filter((u) => u.enLinea).length;
  const h = new Date().getHours();
  const resumen = [el("span", null, h < 12 ? "Buenos días." : h < 19 ? "Buenas tardes." : "Buenas noches."), " ",
    el("span", null, flota.length
      ? `${en} de ${flota.length} ${flota.length === 1 ? "unidad" : "unidades"} en línea.`
      : "Todavía no tienes unidades registradas.")];
  if (flota.length && pendientes.length) {
    const atiende = el("span", "atiende");
    const ir = el("a", null, "Ver mantenimiento");
    ir.href = "#mantenimiento";
    atiende.append(el("span", null, pendientes.length === 1 ? `${pendientes[0]} necesita servicio.` : `${pendientes.length} unidades necesitan servicio.`), ir);
    resumen.push(" ", atiende);
  }
  $("#flota-resumen").replaceChildren(...resumen);
}

async function loadFlota() {
  try {
    flota = await api("/flota");
  } catch (err) { return fail(err); }

  pintarResumen();

  $("#fleet").hidden = !flota.length;
  $("#fleet-vacio").hidden = Boolean(flota.length);
  if (!flota.length) return;
  if (!map) initMap();

  // Lista
  $("#units").replaceChildren(...flota.map((u) => {
    const li = el("li");
    const b = el("button", "unit");
    b.type = "button";
    b.setAttribute("aria-pressed", String(selected === u.id));
    const speed = u.enLinea && u.velocidad != null ? `${fmt(u.velocidad)} km/h` : "";
    const st = el("span", `status${u.enLinea ? " status--on" : ""}`, u.enLinea ? "En línea" : "Sin señal");
    b.append(el("span", "unit__route", u.ruta ?? "–"),
      Object.assign(el("span"), { className: "", style: "display:grid" }),
      el("span", "unit__speed", speed));
    b.children[1].append(el("span", "unit__name", u.nombre), st);
    // sin señal ya lo dice la etiqueta de arriba: aquí solo cuándo fue la última
    const meta = el("span", "unit__meta", !u.enLinea && u.ultimaSenal ? `Última señal ${hace(u.ultimaSenal)}` : estado(u));
    if (u.placa) meta.append(". ", el("span", "nowrap", `Placa ${u.placa}`)); // la placa no se parte en dos renglones
    b.append(meta);
    b.addEventListener("click", () => openDetalle(u.id));
    // si cambió de estado (se conectó o perdió la señal) la fila se marca un momento
    const before = lastEstado.get(u.id);
    if (before !== undefined && before !== u.enLinea) b.classList.add(u.enLinea ? "unit--up" : "unit--down");
    lastEstado.set(u.id, u.enLinea);
    li.append(b);
    return li;
  }));

  // Mapa: cada marcador se crea una vez y luego se desliza a su nueva posición
  const seen = new Set();
  flota.filter((u) => u.lat != null).forEach((u) => {
    seen.add(u.id);
    let m = markers.get(u.id);
    if (!m) {
      m = L.marker([u.lat, u.lng], { keyboard: false, title: u.nombre, icon: markerIcon(u) }).addTo(map);
      m.on("click", () => openDetalle(u.id));
      markers.set(u.id, m);
    } else {
      slideMarker(m, [u.lat, u.lng]);
      const mk = m.getElement()?.querySelector(".fleet-mk");
      if (mk) {
        mk.className = `fleet-mk${u.enLinea ? "" : " fleet-mk--off"}${selected === u.id ? " fleet-mk--sel" : ""}`;
        mk.textContent = u.ruta ?? "";
      }
    }
  });
  markers.forEach((m, id) => { if (!seen.has(id)) { m.remove(); markers.delete(id); } });
  pintarRutas();
  setTimeout(() => map.invalidateSize(), 0);
}

// ---------- Detalle de unidad ----------
const drawer = $("#drawer");

async function openDetalle(id) {
  selected = id;
  const u = flota.find((x) => x.id === id) || (await api("/flota")).find((x) => x.id === id);
  if (!u) return;
  if (u.lat != null && map) map.panTo([u.lat, u.lng]);
  markers.forEach((m, mid) => { const f = flota.find((x) => x.id === mid); if (f) m.setIcon(markerIcon(f)); });
  pintarRutas();

  $("#d-nombre").textContent = u.nombre;
  $("#d-sub").textContent = `Ruta ${u.ruta}, ${TIPOS[u.tipo] || "unidad"}${u.placa ? `, placa ${u.placa}` : ""}`;
  // Sin señal, temperatura y combustible son la última lectura, no lo de ahora
  const ult = u.enLinea ? "" : " (última lectura)";
  const facts = [
    ["Estado", estado(u)],
    ["Velocidad", u.enLinea && u.velocidad != null ? `${fmt(u.velocidad)} km/h` : "–"],
    ["Kilometraje", km(u.odometroKm)],
    ["Horas de motor", `${fmt(u.horasMotor, 1)} h`],
    [`Temperatura${ult}`, u.temperatura != null ? `${fmt(u.temperatura, 1)} °C` : "–"],
    [`Combustible${ult}`, u.combustible != null ? `${fmt(u.combustible)} %` : "–"],
  ];
  $("#d-facts").replaceChildren(...facts.map(([k, v]) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v)); return d; }));
  $("#d-servicio").onclick = () => openServicio(u);
  $("#d-editar").onclick = () => openUnidad(u);

  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("open"));
  $("#d-cerrar").focus();

  $("#d-charts").replaceChildren(el("p", "muted", "Cargando historial…"));
  $("#d-servicios").replaceChildren();
  try {
    const [hist, servicios] = await Promise.all([api(`/unidades/${id}/historial?horas=24`), api(`/unidades/${id}/servicios`)]);
    $("#d-charts").replaceChildren(
      lineChart(hist, "velocidad", "Velocidad", "km/h"),
      lineChart(hist, "temperatura", "Temperatura del motor", "°C", 1),
      lineChart(hist, "combustible", "Combustible", "%"));
    $("#d-servicios").replaceChildren(...(servicios.length ? servicios.map((s) => {
      const li = el("li");
      li.append(el("b", null, SERVICIOS[s.tipo] || s.tipo), ` a los ${fmt(s.km)} km, ${fecha(s.fecha)}`);
      if (s.notas) li.append(el("small", "muted", ` ${s.notas}`));
      return li;
    }) : [el("li", "muted", "Aún no hay servicios registrados.")]));
  } catch (err) { $("#d-charts").replaceChildren(el("p", "muted", err.message)); }
}

function closeDetalle() {
  drawer.classList.remove("open");
  selected = null;
  setTimeout(() => { drawer.hidden = true; }, 250);
  markers.forEach((m, id) => { const f = flota.find((x) => x.id === id); if (f) m.setIcon(markerIcon(f)); });
  pintarRutas();
}
$("#d-cerrar").addEventListener("click", closeDetalle);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden && !document.querySelector("dialog[open]")) closeDetalle(); });

// Gráfica de línea de una sola serie (sin leyenda: el título la nombra)
function lineChart(rows, key, title, unit, digits = 0) {
  const box = el("div", "chart");
  const h = el("h3", null, `${title} `);
  h.append(el("span", null, unit));
  box.append(h);
  const pts = rows.filter((r) => r[key] != null).map((r) => [new Date(r.ts).getTime(), r[key]]);
  if (pts.length < 2) { box.append(el("p", "muted", "El sensor no mandó lecturas en las últimas 24 horas.")); return box; }

  const W = 460, H = 150, L = 38, R = 8, T = 8, B = 22;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.15 || 1;
  y0 = Math.max(0, y0 - pad); y1 += pad;
  const sx = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);

  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    return n;
  };
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": `${title}: entre ${fmt(Math.min(...ys), digits)} y ${fmt(Math.max(...ys), digits)} ${unit} en las últimas 24 horas` });
  const grid = s("g", { class: "grid" });
  const axis = s("g", { class: "axis" });
  [0, 0.5, 1].forEach((f) => {
    const v = y0 + (y1 - y0) * f;
    grid.append(s("line", { x1: L, x2: W - R, y1: sy(v), y2: sy(v) }));
    axis.append(s("text", { x: L - 6, y: sy(v) + 4, "text-anchor": "end" }, fmt(v, digits)));
  });
  [0, 1 / 3, 2 / 3, 1].forEach((f) => {
    const t = x0 + (x1 - x0) * f;
    axis.append(s("text", { x: sx(t), y: H - 4, "text-anchor": f === 0 ? "start" : f === 1 ? "end" : "middle" }, hora(t)));
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join("");
  const cross = s("line", { class: "cross", y1: T, y2: H - B, visibility: "hidden" });
  const dot = s("circle", { class: "pt", r: 4.5, visibility: "hidden" });
  const hit = s("rect", { x: L, y: 0, width: W - L - R, height: H - B, fill: "transparent" });
  svg.append(grid, axis, s("path", { class: "series", d }), cross, dot, hit);

  // Cruz + tooltip al pasar el mouse (o el dedo)
  hit.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const t = x0 + ((mx - L) / (W - L - R)) * (x1 - x0);
    const p = pts.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a));
    cross.setAttribute("x1", sx(p[0])); cross.setAttribute("x2", sx(p[0]));
    dot.setAttribute("cx", sx(p[0])); dot.setAttribute("cy", sy(p[1]));
    cross.setAttribute("visibility", "visible"); dot.setAttribute("visibility", "visible");
    showTip(e, [`${hora(p[0])}  `, el("b", null, `${fmt(p[1], digits)} ${unit}`)]);
  });
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); hideTip(); });
  box.append(svg);
  return box;
}

// ---------- Unidades ----------
async function loadUnidades() {
  try {
    flota = await api("/flota");
  } catch (err) { return fail(err); }
  const root = $("#unidades");
  if (!flota.length) {
    const empty = el("div", "empty-state");
    empty.append(el("h2", null, "Aún no tienes unidades"),
      el("p", null, "Registra cada bus con su ruta y su placa. Te daremos la clave que va en su sensor."),
      button("Registrar unidad", "btn--anil", () => openUnidad()));
    return root.replaceChildren(empty);
  }
  const table = el("table", "table");
  const head = el("tr");
  ["Unidad", "Ruta", "Tipo", "Sensor", ""].forEach((t) => head.append(el("th", null, t)));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);
  flota.forEach((u) => {
    const tr = el("tr");
    const name = el("td");
    name.append(el("b", null, u.nombre), el("small", null, u.placa ? `Placa ${u.placa}` : "Sin placa"));
    const sensor = el("td", "sensor");
    sensor.append(el("span", `status${u.enLinea ? " status--on" : ""}`, u.enLinea ? "En línea" : "Sin señal"),
      el("small", null, u.ultimaSenal ? `Última señal ${hace(u.ultimaSenal)}` : "Aún no transmite"));
    const actions = el("td");
    const wrap = el("div", "actions");
    wrap.append(
      button("Editar", "btn--ghost btn--sm", () => openUnidad(u)),
      moreMenu(`Más acciones de ${u.nombre}`, [
        ["Enlace del motorista", () => confirmar(
          `Enlace del motorista de ${u.nombre}`,
          "Se crea un enlace nuevo para la app del motorista. Si ya le habías mandado uno, ese deja de funcionar. El sensor no se afecta.",
          "Crear enlace",
          async () => showClave(await api(`/unidades/${u.id}/motorista`, { method: "POST" }), u.ruta))],
        ["Nueva clave del sensor", () => confirmar(
          `Nueva clave del sensor de ${u.nombre}`,
          "La clave actual del sensor dejará de funcionar y tendrás que poner la nueva en su configuración. El enlace del motorista sigue igual.",
          "Generar nueva clave",
          async () => showClave(await api(`/unidades/${u.id}/clave`, { method: "POST" }), u.ruta))],
        ["Eliminar unidad", () => confirmar(
          `Eliminar ${u.nombre}`,
          "Se borran la unidad y sus servicios. Su sensor dejará de aparecer en tu panel. Esto no se puede deshacer.",
          "Eliminar unidad",
          async () => { await api(`/unidades/${u.id}`, { method: "DELETE" }); loadUnidades(); }), "more__item--quitar"],
      ]));
    actions.append(wrap);
    tr.append(name, el("td", null, u.ruta), el("td", null, TIPOS[u.tipo] || "–"), sensor, actions);
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(cards(table));
}

document.querySelectorAll("[data-nueva]").forEach((b) => b.addEventListener("click", () => openUnidad()));

const dlgUnidad = $("#dlg-unidad");
let editing = null;

function openUnidad(u = null) {
  editing = u;
  $("#u-titulo").textContent = u ? `Editar ${u.nombre}` : "Registrar unidad";
  $("#u-ayuda").textContent = u ? "Los cambios se aplican de inmediato." : "Al guardar te daremos la clave de su sensor.";
  $("#u-guardar").textContent = u ? "Guardar cambios" : "Registrar unidad";
  $("#u-ruta").replaceChildren(...rutas.map((r) => { const o = el("option", null, `Ruta ${r.ruta}`); o.value = r.ruta; return o; }));
  $("#u-nombre").value = u?.nombre ?? "";
  $("#u-placa").value = u?.placa ?? "";
  $("#u-ruta").value = u?.ruta ?? rutas[0]?.ruta ?? "";
  $("#u-tipo").value = u?.tipo ?? "autobus";
  $("#u-km").value = u ? Math.round(u.odometroKm) : "";
  $("#u-aceite").value = u?.intervaloAceiteKm ?? 5000;
  showMsg($("#u-msg"), "");
  dlgUnidad.showModal();
  $("#u-nombre").focus();
}

$("#f-unidad").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    nombre: $("#u-nombre").value, placa: $("#u-placa").value || null,
    ruta: $("#u-ruta").value, tipo: $("#u-tipo").value,
    intervaloAceiteKm: Number($("#u-aceite").value),
  };
  if ($("#u-km").value !== "") body.odometroKm = Number($("#u-km").value);
  const btn = $("#u-guardar");
  btn.disabled = true;
  try {
    if (editing) {
      await api(`/unidades/${editing.id}`, { method: "PATCH", body });
      dlgUnidad.close();
      if (selected === editing.id) closeDetalle();
    } else {
      const res = await api("/unidades", { method: "POST", body });
      if (body.odometroKm != null || body.intervaloAceiteKm !== 5000)
        await api(`/unidades/${res.id}`, { method: "PATCH", body: { odometroKm: body.odometroKm ?? 0, intervaloAceiteKm: body.intervaloAceiteKm } });
      dlgUnidad.close();
      showClave(res, body.ruta);
    }
    route();
  } catch (err) {
    showMsg($("#u-msg"), err.message);
  } finally {
    btn.disabled = false;
  }
});

// Muestra la clave del sensor, el enlace del motorista o los dos (al registrar una unidad)
function showClave({ id, clave, claveMotorista }, ruta) {
  $("#k-sensor").hidden = !clave;
  $("#k-motorista").hidden = !claveMotorista;
  $("#k-titulo").textContent = clave ? "Clave del sensor" : "Enlace del motorista";
  $("#k-motorista-titulo").hidden = !clave; // si es lo único del cuadro, el título de arriba ya lo dice
  if (claveMotorista) {
    // Sin sensor, el celular del motorista hace de GPS con este enlace
    const enlace = `${location.origin}/motorista.html#u=${encodeURIComponent(id)}&k=${encodeURIComponent(claveMotorista)}`;
    $("#k-enlace").textContent = enlace;
    $("#k-whatsapp").href = `https://wa.me/?text=${encodeURIComponent(`App del motorista (go503). Ábrela en tu celular y no la compartas:\n${enlace}`)}`;
    $("#k-copiar-enlace").textContent = "Copiar";
  }
  if (!clave) return $("#dlg-clave").showModal();
  $("#k-clave").textContent = clave;
  $("#k-config").textContent = `// config.h del sensor\n#define BUS_ID   "${id}"\n#define API_KEY  "${clave}"\n#define ROUTE_ID "${ruta}"`;
  $("#k-sim").textContent = `SIM_BUS=${id} SIM_KEY=${clave} SIM_ROUTE=${ruta} npm run simulate`;
  $("#k-copiar").textContent = "Copiar";
  $("#dlg-clave").showModal();
}
$("#k-copiar").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#k-clave").textContent);
    $("#k-copiar").textContent = "Copiada";
  } catch {
    getSelection().selectAllChildren($("#k-clave"));
    $("#k-copiar").textContent = "Selecciónala y cópiala";
  }
});
$("#k-copiar-enlace").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#k-enlace").textContent);
    $("#k-copiar-enlace").textContent = "Copiado";
  } catch {
    getSelection().selectAllChildren($("#k-enlace"));
    $("#k-copiar-enlace").textContent = "Selecciónalo y cópialo";
  }
});

// Confirmación para acciones que no se deshacen
const dlgConfirm = $("#dlg-confirmar");
let onConfirm = null;
function confirmar(titulo, texto, accion, fn) {
  $("#c-titulo").textContent = titulo;
  $("#c-texto").textContent = texto;
  $("#c-ok").textContent = accion;
  onConfirm = fn;
  dlgConfirm.showModal();
}
$("#c-ok").addEventListener("click", async () => {
  $("#c-ok").disabled = true;
  try { await onConfirm(); dlgConfirm.close(); } catch (err) { dlgConfirm.close(); fail(err); } finally { $("#c-ok").disabled = false; }
});

// ---------- Mantenimiento ----------
const ESTADO_ACEITE = {
  "vencido": { icon: "i-stop", orden: 0 },
  "pronto": { icon: "i-warn", orden: 1 },
  "sin-registro": { icon: "i-warn", orden: 2 },
  "al-dia": { icon: "i-ok", orden: 3 },
};

async function loadMantenimiento() {
  let list;
  try { list = await api("/mantenimiento"); } catch (err) { return fail(err); }
  updateBadge(list);
  const root = $("#mantenimiento");
  if (!list.length) {
    const empty = el("div", "empty-state");
    empty.append(el("h2", null, "Sin unidades todavía"), el("p", null, "Registra una unidad y aquí verás cuándo le toca cada servicio."),
      button("Registrar unidad", "btn--anil", () => openUnidad()));
    return root.replaceChildren(empty);
  }
  list.sort((a, b) => ESTADO_ACEITE[a.estadoAceite].orden - ESTADO_ACEITE[b.estadoAceite].orden || (b.kmDesdeAceite ?? 0) - (a.kmDesdeAceite ?? 0));

  const table = el("table", "table");
  const head = el("tr");
  [["Unidad"], ["Kilometraje", "num"], ["Cambio de aceite"], ["Motor"], ["Fallas"], ["Último servicio"], [""]]
    .forEach(([t, c]) => head.append(el("th", c, t)));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);

  list.forEach((m) => {
    const tr = el("tr");
    const name = el("td");
    name.append(el("b", null, m.nombre), el("small", null, m.placa ? `Placa ${m.placa}` : ""));
    const km = el("td", "num");
    km.append(`${fmt(m.odometroKm, m.odometroKm < 100 ? 1 : 0)} km`, el("small", null, `${fmt(m.horasMotor, 1)} h de motor`));

    // Aceite: barra + ícono + texto (el estado nunca va solo en color)
    const pct = Math.min(100, ((m.kmDesdeAceite ?? 0) / m.intervaloAceiteKm) * 100);
    const falta = m.intervaloAceiteKm - m.kmDesdeAceite;
    const texto = m.estadoAceite === "sin-registro" ? "Registra el último cambio de aceite"
      : m.estadoAceite === "vencido" ? `Vencido por ${fmt(-falta)} km` : m.estadoAceite === "pronto" ? `Pronto: faltan ${fmt(falta)} km` : `Al día: faltan ${fmt(falta)} km`;
    const oil = el("div", `oil oil--${m.estadoAceite}`);
    const bar = el("div", "oil__bar");
    const fill = el("span");
    fill.style.width = `${Math.max(3, pct)}%`;
    bar.append(fill);
    const label = el("span", "oil__label");
    label.append(icon(ESTADO_ACEITE[m.estadoAceite].icon), texto);
    oil.append(label, bar, el("small", "muted", `Cada ${fmt(m.intervaloAceiteKm)} km`));
    const oilTd = el("td");
    oilTd.append(oil);

    const motor = el("td", "motor");
    motor.append(m.temperatura != null ? `${fmt(m.temperatura, 1)} °C` : "–",
      el("small", null, m.combustible != null ? `Combustible ${fmt(m.combustible)} %` : ""));
    if (!m.enLinea && m.temperatura != null) motor.append(el("small", null, "Última lectura"));
    const fallas = el("td", "fallas");
    if (m.fallas.length) m.fallas.forEach((f) => fallas.append(el("span", "chip", f)));
    else fallas.append(el("span", "muted", m.enLinea ? "Ninguna" : "Sin datos"));
    const ultimo = el("td");
    if (m.ultimoServicio) ultimo.append(SERVICIOS[m.ultimoServicio.tipo] || m.ultimoServicio.tipo, el("small", null, `${fecha(m.ultimoServicio.fecha)}, a los ${fmt(m.ultimoServicio.km)} km`));
    else ultimo.append(el("span", "muted", "Ninguno"));
    const actions = el("td");
    const wrap = el("div", "actions");
    // texto corto para que la tabla quepa sin deslizar; el lector de pantalla oye la acción completa
    const srv = button("Servicio", "btn--ghost btn--sm", () => openServicio(m));
    srv.setAttribute("aria-label", `Registrar servicio de ${m.nombre}`);
    wrap.append(srv);
    actions.append(wrap);
    tr.append(name, km, oilTd, motor, fallas, ultimo, actions);
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(cards(table));
}

function updateBadge(list) {
  pendientes = list.filter((m) => m.estadoAceite === "vencido" || m.estadoAceite === "pronto").map((m) => m.nombre);
  const n = pendientes.length;
  if (flota.length) pintarResumen(); // el aviso sale sin esperar la siguiente vuelta del mapa
  const badge = $("#badge-mant");
  badge.hidden = !n;
  badge.textContent = n;
  badge.setAttribute("aria-label", `${n} ${n === 1 ? "unidad necesita" : "unidades necesitan"} servicio`);
}

const dlgServicio = $("#dlg-servicio");
let servicioDe = null;
function openServicio(u) {
  servicioDe = u;
  $("#s-titulo").textContent = `Registrar servicio de ${u.nombre}`;
  $("#s-ayuda").textContent = `Se guarda con el kilometraje actual: ${fmt(u.odometroKm)} km.`;
  $("#s-tipo").value = "aceite";
  $("#s-notas").value = "";
  showMsg($("#s-msg"), "");
  dlgServicio.showModal();
}
$("#f-servicio").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/unidades/${servicioDe.id}/servicios`, { method: "POST", body: { tipo: $("#s-tipo").value, notas: $("#s-notas").value || null } });
    dlgServicio.close();
    if (!drawer.hidden && selected === servicioDe.id) openDetalle(servicioDe.id);
    if (location.hash === "#mantenimiento") loadMantenimiento();
    showMsg(msg, `Servicio registrado para ${servicioDe.nombre}.`, "ok");
  } catch (err) { showMsg($("#s-msg"), err.message); }
});

// ---------- Reportes ----------
const RAMP = ["#EDE8DB", "#C9CFE6", "#8E9DD3", "#3B4A93", "#141B3D"]; // un solo tono: claro = rápido, oscuro = lento

$("#r-dias").addEventListener("change", loadReportes);

async function loadReportes() {
  let rep;
  try { rep = await api(`/reportes?dias=${$("#r-dias").value}`); } catch (err) { return fail(err); }
  renderTramos(rep.tramos);
  renderVueltas(rep.vueltas, rep.dias);
}

function renderTramos(tramos) {
  const root = $("#r-tramos");
  if (!tramos.length) return root.replaceChildren(el("p", "muted", "Todavía no hay viajes de tus unidades en este periodo. Aparecerán cuando completen tramos entre paradas."));
  // solo las horas en que hubo viajes: una columna vacía no dice nada
  const cols = [...new Set(tramos.flatMap((t) => Object.keys(t.porHora).map(Number)))].sort((a, b) => a - b);

  const table = el("table");
  const head = el("tr");
  head.append(el("th", null, ""), ...cols.map((h) => el("th", null, `${h}:00`)), el("th", "avg", "Promedio"));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);

  tramos.forEach((t) => {
    const vals = Object.values(t.porHora);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const tr = el("tr");
    const th = el("th", null, `${t.desde} a ${t.hasta}`);
    th.scope = "row";
    th.append(el("small", null, `Ruta ${t.ruta}${t.hacia ? ` hacia ${t.hacia}` : ""}, ${fmt(t.viajes)} viajes`));
    tr.append(th);
    cols.forEach((h) => {
      const v = t.porHora[h];
      const td = el("td", v == null ? "empty" : null, v == null ? "" : fmt(v, 1));
      if (v != null) {
        const step = hi === lo ? 2 : Math.round(((v - lo) / (hi - lo)) * (RAMP.length - 1));
        td.style.background = RAMP[step];
        td.style.color = step >= 3 ? "#fff" : "#141B3D";
        td.addEventListener("pointermove", (e) => showTip(e, [`${t.desde} a ${t.hasta}, ${h}:00 a ${h + 1}:00  `, el("b", null, `${fmt(v, 1)} min`)]));
        td.addEventListener("pointerleave", hideTip);
      }
      tr.append(td);
    });
    tr.append(el("td", "avg", `${fmt(t.promedioMin, 1)} min`));
    table.tBodies[0].append(tr);
  });

  const legend = el("div", "legend");
  const ramp = el("span", "legend__ramp");
  RAMP.forEach((c) => { const s = el("span"); s.style.background = c; ramp.append(s); });
  legend.append("Minutos. Más rápido", ramp, "Más lento (comparado dentro de cada tramo)");
  root.replaceChildren(table, legend);
}

function renderVueltas(vueltas, dias) {
  const root = $("#r-vueltas");
  if (!vueltas.length) return root.replaceChildren(el("p", "muted", "Registra unidades para ver sus vueltas."));
  const n = Math.min(dias, 7);
  const days = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86400000);
    return d.toLocaleDateString("en-CA", { timeZone: "America/El_Salvador" }); // AAAA-MM-DD
  });
  const label = (d) => new Date(`${d}T12:00:00`).toLocaleDateString((window.go503Idioma?.locale || "es-SV"), { weekday: "short", day: "numeric" });

  const table = el("table", "table");
  const head = el("tr");
  head.append(el("th", null, "Unidad"), ...days.map((d) => el("th", "num", label(d))), el("th", "num", "Total"));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);
  vueltas.forEach((v) => {
    const tr = el("tr");
    tr.append(el("td", null, v.nombre), ...days.map((d) => el("td", "num", v.porDia[d] ? fmt(v.porDia[d]) : "–")),
      el("td", "num", fmt(Object.values(v.porDia).reduce((a, b) => a + b, 0))));
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(table);
}

// ---------- Alertas de la flota ----------
const ALERTAS_MS = 20000;
const ICONO_ALERTA = { grave: "i-stop", aviso: "i-warn" };
let alertas = [];
let sinVer = 0;
const vistas = {
  get: () => { try { return new Set(JSON.parse(localStorage.getItem("go503-alertas-vistas") || "[]")); } catch { return new Set(); } },
  set: (ids) => { try { localStorage.setItem("go503-alertas-vistas", JSON.stringify([...ids])); } catch {} },
};

async function loadAlertas() {
  try { alertas = await api("/alertas"); } catch { return; }
  // una alerta que se resolvió y vuelve a pasar cuenta como nueva
  const seen = vistas.get();
  const ids = new Set(alertas.map((a) => a.id));
  const kept = new Set([...seen].filter((id) => ids.has(id)));
  if (kept.size !== seen.size) vistas.set(kept);

  const n = alertas.filter((a) => !kept.has(a.id)).length;
  const count = $("#alertas-n");
  count.hidden = !n;
  count.textContent = n > 9 ? "9+" : n;
  $("#btn-alertas").setAttribute("aria-label", n ? `Alertas: ${n} sin ver` : "Alertas");
  // la campana suena cuando llega una alerta nueva
  if (n > sinVer) {
    const b = $("#btn-alertas");
    b.classList.remove("is-ringing");
    void b.offsetWidth;
    b.classList.add("is-ringing");
  }
  sinVer = n;
  if (!$("#alertas-pop").hidden) renderAlertas();
}

function renderAlertas() {
  const list = $("#alertas-list");
  if (!alertas.length) {
    const li = el("li", "alerts__empty");
    li.append(el("b", null, "Todo en orden"), el("span", null, "Ninguna unidad necesita atención ahora."));
    return list.replaceChildren(li);
  }
  const seen = vistas.get();
  list.replaceChildren(...alertas.map((a) => {
    const li = el("li");
    const b = el("button", `alert alert--${a.nivel}${seen.has(a.id) ? "" : " alert--new"}`);
    b.type = "button";
    const ico = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ico.setAttribute("class", "ico");
    ico.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${ICONO_ALERTA[a.nivel]}`);
    ico.append(use);
    const txt = el("span", "alert__txt");
    txt.append(el("b", null, a.nombre), el("span", null, a.texto));
    b.append(ico, txt);
    b.addEventListener("click", () => {
      closeAlertas();
      if (a.tipo === "aceite") location.hash = "#mantenimiento";
      else openDetalle(a.unidad);
    });
    li.append(b);
    return li;
  }));
}

function openAlertas() {
  renderAlertas();
  $("#alertas-pop").hidden = false;
  $("#btn-alertas").setAttribute("aria-expanded", "true");
}
function closeAlertas() {
  $("#alertas-pop").hidden = true;
  $("#btn-alertas").setAttribute("aria-expanded", "false");
}
$("#btn-alertas").addEventListener("click", () => ($("#alertas-pop").hidden ? openAlertas() : closeAlertas()));
$("#alertas-vistas").addEventListener("click", () => {
  vistas.set(new Set(alertas.map((a) => a.id)));
  sinVer = 0;
  $("#alertas-n").hidden = true;
  $("#btn-alertas").setAttribute("aria-label", "Alertas");
  renderAlertas();
});
document.addEventListener("click", (e) => { if (!$("#alertas").contains(e.target)) closeAlertas(); });
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#alertas-pop").hidden) { closeAlertas(); $("#btn-alertas").focus(); }
});

// ---------- Clientes interesados (administradores) ----------
const ESTADOS_CLIENTE = { nuevo: "Nuevo", contactado: "Contactado", vendido: "Vendido", descartado: "Descartado" };
let clientes = [];

async function loadClientes({ soloContar = false } = {}) {
  try { clientes = await api("/admin/clientes"); } catch (err) { return soloContar ? null : fail(err); }
  const nuevos = clientes.filter((c) => c.estado === "nuevo").length;
  const badge = $("#badge-clientes");
  badge.hidden = !nuevos;
  badge.textContent = nuevos;
  badge.setAttribute("aria-label", `${nuevos} nuevos`);
  if (soloContar) return;
  renderClientes();
}

// Filtros por etapa: "Pendientes" (nuevos y contactados) es lo que falta atender
const ETAPAS = [["activos", "Pendientes"], ["nuevo", "Nuevos"], ["contactado", "Contactados"], ["vendido", "Vendidos"], ["descartado", "Descartados"], ["todos", "Todos"]];
const enEtapa = (c, f) => f === "todos" || (f === "activos" ? ["nuevo", "contactado"].includes(c.estado) : c.estado === f);
let etapaCli = "activos";
function pintarEtapas() {
  $("#cli-estado").replaceChildren(...ETAPAS.map(([f, t]) => {
    const b = el("button", "etapa");
    b.type = "button";
    b.setAttribute("aria-pressed", String(f === etapaCli));
    b.append(el("span", null, t), el("span", "etapa__n", fmt(clientes.filter((c) => enEtapa(c, f)).length)));
    b.addEventListener("click", () => { etapaCli = f; renderClientes(); });
    return b;
  }));
}

// Cuándo llegó: en horas o días si es reciente (lo nuevo urge), si no la fecha
function recibido(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d < 1 ? hace(iso) : d < 7 ? (d === 1 ? "ayer" : `hace ${d} días`) : fecha(iso);
}

// WhatsApp: si el número no trae código de país, se asume El Salvador (503)
const waLink = (tel) => {
  const d = tel.replace(/\D/g, "");
  return `https://wa.me/${d.length === 8 ? `503${d}` : d}`;
};

function renderClientes() {
  const root = $("#clientes");
  if (!clientes.length) {
    const empty = el("div", "empty-state");
    empty.append(el("h2", null, "Todavía no hay solicitudes"), el("p", null, "Cuando alguien llene «Pide el sensor» en la portada, aparece aquí con su teléfono para escribirle por WhatsApp."));
    $("#cli-estado").replaceChildren();
    return root.replaceChildren(empty);
  }
  pintarEtapas();
  const q = $("#cli-buscar").value.trim().toLowerCase();
  const list = clientes.filter((c) => enEtapa(c, etapaCli)
    && (!q || [c.nombre, c.empresa, c.telefono, c.ciudad, c.correo].some((t) => t && t.toLowerCase().includes(q))));
  if (!list.length) return root.replaceChildren(el("div", "empty-state", "Ningún cliente coincide con el filtro. Borra la búsqueda o escoge «Todos»."));

  const table = el("table", "table");
  const head = el("tr");
  ["Persona", "Contacto", "Flota", "Estado", "Recibido", ""].forEach((t) => head.append(el("th", null, t)));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);
  list.forEach((c) => {
    const tr = el("tr", c.estado === "nuevo" ? "row--new" : null);
    const who = el("td");
    who.append(el("b", null, c.nombre), el("small", null, c.empresa || "Sin empresa"));
    if (c.mensaje) who.append(el("p", "cli__msg", `«${c.mensaje}»`));
    if (c.nota) who.append(el("p", "cli__nota", `Nota: ${c.nota}`));

    const contact = el("td");
    const wa = el("a", "cli__link", c.telefono);
    wa.href = waLink(c.telefono);
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.title = "Escribir por WhatsApp";
    contact.append(wa);
    if (c.correo) {
      const m = el("a", "cli__link cli__link--mail", c.correo);
      m.href = `mailto:${c.correo}?subject=${encodeURIComponent("Sensor go503")}`;
      contact.append(m);
    }

    const flota = el("td", "nowrap");
    flota.append(el("span", null, c.unidades ? `${c.unidades} ${c.unidades === 1 ? "unidad" : "unidades"}` : "–"), el("small", null, c.ciudad || ""));

    const estado = el("td");
    const sel = el("select", `select select--sm estado estado--${c.estado}`);
    sel.setAttribute("aria-label", `Estado de ${c.nombre}`);
    Object.entries(ESTADOS_CLIENTE).forEach(([v, t]) => {
      const o = el("option", null, t);
      o.value = v;
      o.selected = v === c.estado;
      sel.append(o);
    });
    sel.addEventListener("change", async () => {
      try {
        const upd = await api(`/admin/clientes/${c.id}`, { method: "PATCH", body: { estado: sel.value } });
        Object.assign(c, upd);
        sel.className = `select select--sm estado estado--${c.estado}`;
        tr.classList.toggle("row--new", c.estado === "nuevo");
        tr.classList.add("row--flash");
        setTimeout(() => tr.classList.remove("row--flash"), 900);
        loadClientes({ soloContar: true });
      } catch (err) { sel.value = c.estado; fail(err); }
    });
    estado.append(sel);

    const actions = el("td");
    const wrap = el("div", "actions");
    // la siguiente acción según la etapa: escribirle si es nuevo, el código si ya compró, la nota si se está hablando
    if (c.estado === "nuevo") {
      const escribir = el("a", "btn btn--anil btn--sm", "Escribir por WhatsApp");
      escribir.href = waLink(c.telefono);
      escribir.target = "_blank";
      escribir.rel = "noopener";
      escribir.setAttribute("aria-label", `Escribir a ${c.nombre} por WhatsApp`);
      wrap.append(escribir);
    }
    if (c.estado === "contactado") {
      const nota = button(c.nota ? "Editar nota" : "Nota", "btn--ghost btn--sm", () => openCliente(c));
      nota.setAttribute("aria-label", `Nota sobre ${c.nombre}`);
      wrap.append(nota);
    }
    if (c.estado === "vendido") {
      const cod = button("Crear código", "btn--anil btn--sm", async () => {
        try {
          const { codigo } = await api("/admin/codigos", { method: "POST", body: { nota: c.empresa || c.nombre } });
          await navigator.clipboard?.writeText(codigo).catch(() => {});
          showMsg(msg, `Código para ${c.empresa || c.nombre}: ${codigo} (ya está copiado). Envíaselo para que se registre.`, "ok");
        } catch (err) { fail(err); }
      });
      cod.setAttribute("aria-label", `Crear código de invitación para ${c.empresa || c.nombre}`);
      wrap.append(cod);
    }
    wrap.append(moreMenu(`Más acciones de ${c.nombre}`, [
      ...(c.estado === "contactado" ? [] : [[c.nota ? "Editar nota" : "Escribir una nota", () => openCliente(c)]]),
      ["Eliminar solicitud", () => confirmar(
        `Eliminar a ${c.nombre}`,
        "Se borra la solicitud y su nota. Esto no se puede deshacer.",
        "Eliminar",
        async () => { await api(`/admin/clientes/${c.id}`, { method: "DELETE" }); loadClientes(); }), "more__item--quitar"],
    ]));
    actions.append(wrap);

    const cuando = el("td", "nowrap", recibido(c.creado));
    cuando.title = fecha(c.creado);
    tr.append(who, contact, flota, estado, cuando, actions);
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(cards(table));
}
$("#cli-buscar").addEventListener("input", renderClientes);

const dlgCliente = $("#dlg-cliente");
let editingCliente = null;
function openCliente(c) {
  editingCliente = c;
  $("#cl-titulo").textContent = `Nota sobre ${c.nombre}`;
  $("#cl-nota").value = c.nota ?? "";
  $("#cl-msg").hidden = true;
  dlgCliente.showModal();
  $("#cl-nota").focus();
}
$("#f-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/admin/clientes/${editingCliente.id}`, { method: "PATCH", body: { nota: $("#cl-nota").value.trim() || null } });
    dlgCliente.close();
    showMsg(msg, "Nota guardada.", "ok");
    loadClientes();
  } catch (err) { showMsg($("#cl-msg"), err.message); }
});

// ---------- Códigos de invitación (administradores) ----------
let codigos = [];

async function loadCodigos() {
  try { codigos = await api("/admin/codigos"); } catch (err) { return fail(err); }
  const libres = codigos.filter((c) => !c.usado).length;
  $("#cod-resumen").textContent = codigos.length
    ? `${libres} ${libres === 1 ? "disponible" : "disponibles"} y ${codigos.length - libres} ${codigos.length - libres === 1 ? "usado" : "usados"}.`
    : "";
  $("#cod-filtros").hidden = codigos.length < 6; // con pocos códigos buscar estorba
  renderCodigos();
}

function renderCodigos() {
  const root = $("#codigos");
  if (!codigos.length) return root.replaceChildren(el("div", "empty-state", "Todavía no has creado códigos. Escribe para quién es y toca «Crear código»."));
  const q = $("#cod-buscar").value.trim().toLowerCase();
  const estado = $("#cod-estado").value;
  const list = codigos.filter((c) =>
    (estado === "todos" || (estado === "usados") === Boolean(c.usado))
    && (!q || [c.codigo, c.nota, c.empresa].some((t) => t && t.toLowerCase().includes(q))));
  if (!list.length) return root.replaceChildren(el("div", "empty-state", "Ningún código coincide con la búsqueda. Borra la búsqueda o escoge «Todos»."));

  const table = el("table", "table");
  const head = el("tr");
  ["Código", "Para", "Estado", "Creado", ""].forEach((t) => head.append(el("th", null, t)));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);
  list.forEach((c) => {
    const tr = el("tr");
    const code = el("td");
    code.append(el("b", "code", c.codigo));
    const estadoTd = el("td");
    if (c.usado) estadoTd.append(el("span", "status", "Usado"), el("small", null, `${c.empresa ?? "Empresa eliminada"}, ${fecha(c.usado)}`));
    else estadoTd.append(el("span", "status status--on", "Disponible"));

    const actions = el("td");
    const wrap = el("div", "actions");
    const copiar = button("Copiar", "btn--ghost btn--sm", async () => {
      try { await navigator.clipboard.writeText(c.codigo); copiar.textContent = "Copiado"; }
      catch { getSelection().selectAllChildren(code.firstChild); copiar.textContent = "Selecciónalo y cópialo"; }
      setTimeout(() => { copiar.textContent = "Copiar"; }, 1800);
    });
    copiar.setAttribute("aria-label", `Copiar ${c.codigo}`);
    const eliminar = () => confirmar(
      `Eliminar ${c.codigo}`,
      c.usado
        ? `${c.empresa ?? "La empresa"} lo usó para registrarse y seguirá funcionando igual. Solo se borra de esta lista.`
        : "Nadie lo ha usado todavía. Si ya se lo diste a alguien, ya no le va a servir para registrarse.",
      "Eliminar código",
      async () => {
        await api(`/admin/codigos/${encodeURIComponent(c.codigo)}`, { method: "DELETE" });
        showMsg(msg, `Código ${c.codigo} eliminado.`, "ok");
        loadCodigos();
      });
    if (!c.usado) wrap.append(copiar);
    wrap.append(moreMenu(`Más acciones de ${c.codigo}`, [
      [c.nota ? "Editar para quién es" : "Escribir para quién es", () => openCodigo(c)],
      ["Eliminar código", eliminar, "more__item--quitar"],
    ]));
    actions.append(wrap);

    tr.append(code, el("td", c.nota ? "nota" : "nota muted", c.nota ?? "Sin nota"), estadoTd, el("td", null, fecha(c.creado)), actions);
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(cards(table));
}
$("#cod-buscar").addEventListener("input", renderCodigos);
$("#cod-estado").addEventListener("change", renderCodigos);

// Editar la nota de un código
const dlgCodigo = $("#dlg-codigo");
let editingCode = null;
function openCodigo(c) {
  editingCode = c;
  $("#cd-titulo").textContent = `Editar ${c.codigo}`;
  $("#cd-ayuda").textContent = c.usado ? `Lo usó ${c.empresa ?? "una empresa que ya no existe"}.` : "Todavía nadie lo ha usado.";
  $("#cd-nota").value = c.nota ?? "";
  $("#cd-msg").hidden = true;
  dlgCodigo.showModal();
  $("#cd-nota").focus();
}
$("#f-cod-editar").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/admin/codigos/${encodeURIComponent(editingCode.codigo)}`, { method: "PATCH", body: { nota: $("#cd-nota").value.trim() || null } });
    dlgCodigo.close();
    showMsg(msg, `Cambios guardados en ${editingCode.codigo}.`, "ok");
    loadCodigos();
  } catch (err) { showMsg($("#cd-msg"), err.message); }
});

$("#f-codigo").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const { codigo } = await api("/admin/codigos", { method: "POST", body: { nota: $("#cod-nota").value || null } });
    $("#cod-nota").value = "";
    const copiado = await navigator.clipboard?.writeText(codigo).then(() => true, () => false);
    showMsg(msg, `Código creado: ${codigo}${copiado ? " (ya está copiado)" : ""}. Dáselo a la empresa para que se registre.`, "ok");
    loadCodigos();
  } catch (err) { fail(err); }
});

// ---------- Recorridos (administradores) ----------
// El trazo se arma con "tramos": cada toque en el mapa agrega un tramo desde el punto anterior
// (pegado a las calles con OSRM, o en línea recta). Deshacer quita el último tramo.
const OSRM = "https://router.project-osrm.org";
const rec = { rutas: [], ruta: null, sentido: "ida", tramos: [], fuente: "dibujado", cambios: false, map: null, capa: null, vista: null,
  nuevas: null }; // nuevas: paradas escritas y ya buscadas, sin guardar

const recPuntos = () => rec.tramos.flat();
const recSentido = () => rec.rutas.find((r) => r.ruta === rec.ruta)?.sentidos.find((s) => s.id === rec.sentido);

async function loadRecorridos() {
  try { rec.rutas = await api("/admin/recorridos"); } catch (err) { return fail(err); }
  const sel = $("#rec-ruta");
  if (!sel.options.length) {
    sel.replaceChildren(...rec.rutas.map((r) => { const o = el("option", null, `Ruta ${r.ruta}`); o.value = r.ruta; return o; }));
    sel.addEventListener("change", () => cambiarRecorrido(sel.value, "ida"));
  }
  if (!rec.map) {
    rec.map = L.map("rec-map", { zoomControl: false }).setView([13.699, -89.205], 13);
    L.control.zoom({ position: "bottomright" }).addTo(rec.map);
    L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/${isDark() ? "dark_all" : "light_all"}/{z}/{x}/{y}.png?key=${CARTO_KEY}`, {
      maxZoom: 20, detectRetina: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(rec.map);
    rec.capa = L.layerGroup().addTo(rec.map);
    rec.map.on("click", (e) => agregarPunto([e.latlng.lat, e.latlng.lng]));
  }
  setTimeout(() => rec.map.invalidateSize(), 50); // la sección estaba escondida al crear el mapa
  cambiarRecorrido(rec.ruta || rec.rutas[0]?.ruta, rec.sentido, { encuadrar: !rec.ruta });
}

function cambiarRecorrido(ruta, sentido, { encuadrar = true } = {}) {
  const t = window.go503Idioma?.t || ((x) => x);
  if ((rec.cambios || rec.nuevas) && !confirm(t("Tienes cambios sin guardar en este recorrido. ¿Los dejas?"))) {
    $("#rec-ruta").value = rec.ruta;
    return;
  }
  rec.ruta = ruta;
  rec.sentido = sentido;
  $("#rec-ruta").value = ruta;
  const r = rec.rutas.find((x) => x.ruta === ruta);
  $("#rec-dir").replaceChildren(...r.sentidos.map((s) => {
    const b = el("button", null, `Hacia ${s.destino}`);
    b.type = "button";
    b.setAttribute("aria-pressed", String(s.id === sentido));
    b.addEventListener("click", () => { if (s.id !== rec.sentido) cambiarRecorrido(rec.ruta, s.id); });
    return b;
  }));
  const s = recSentido();
  rec.tramos = s.trazo ? [s.trazo.puntos] : [];
  rec.fuente = s.trazo?.fuente || "dibujado";
  rec.cambios = false;
  rec.vista = null;
  rec.nuevas = null;
  $("#rec-paradas-txt").value = $("#rec-via-txt").value = s.paradas.map((p) => p.nombre).join("\n");
  $("#rec-paradas-lista").replaceChildren();
  $("#rec-via-lista").replaceChildren();
  dibujarRecorrido();
  if (encuadrar) rec.map.fitBounds(L.latLngBounds(s.paradas.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
  loadVueltas();
}

function estadoRecorrido() {
  const s = recSentido();
  const n = recPuntos().length;
  $("#rec-estado").textContent = rec.cambios
    ? (n ? "Cambios sin guardar." : "Toca el mapa en la parada 1 para empezar.")
    : s.trazo
      ? `Guardado: ${s.trazo.fuente === "gps" ? "sacado de una vuelta GPS" : "dibujado a mano"}, ${fecha(s.trazo.actualizado)}.`
      : "Sin recorrido guardado: el mapa público lo adivina por las calles (puede no ser exacto).";
  $("#rec-estado").dataset.estado = rec.cambios ? "cambios" : s.trazo ? "ok" : "auto";
  $("#rec-guardar").disabled = n < 2 || !rec.cambios;
  $("#rec-deshacer").disabled = !rec.tramos.length;
  $("#rec-borrar").disabled = !rec.tramos.length;
  $("#rec-auto").hidden = !s.trazo;
  $("#rec-paradas-guardar").disabled = !rec.nuevas || rec.nuevas.some((p) => p.error);
}

// Cuántos sentidos ya tienen recorrido guardado; los demás el mapa público los adivina por las calles
function resumenRecorridos() {
  const todos = rec.rutas.flatMap((r) => r.sentidos);
  const listos = todos.filter((x) => x.trazo).length;
  $("#rec-resumen").textContent = listos === todos.length
    ? `Los ${todos.length} recorridos están guardados.`
    : !listos ? "Ningún recorrido guardado todavía: el mapa público los adivina por las calles."
    : `${listos} de ${todos.length} recorridos guardados. Los demás el mapa los adivina por las calles.`;
}

function dibujarRecorrido() {
  resumenRecorridos();
  const s = recSentido();
  rec.capa.clearLayers();
  // la vuelta GPS que se está viendo, punteada debajo
  if (rec.vista) rec.capa.addLayer(L.polyline(rec.vista, { className: "rec-vista", weight: 5, dashArray: "2 9", interactive: false }));
  const pts = recPuntos();
  if (pts.length > 1) {
    rec.capa.addLayer(L.polyline(pts, { className: "rec-borde", weight: 10, interactive: false }));
    rec.capa.addLayer(L.polyline(pts, { className: "rec-linea", weight: 5, interactive: false }));
  }
  if (pts.length) rec.capa.addLayer(L.circleMarker(pts.at(-1), { radius: 6, className: "rec-fin", interactive: false }));
  // paradas numeradas en el orden del sentido; las escritas sin guardar van en amarillo y se pueden arrastrar
  (rec.nuevas || s.paradas).forEach((p, i) => {
    if (p.error) return;
    const m = L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: "", html: `<span class="rec-parada${rec.nuevas ? " rec-parada--nueva" : ""}">${i + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
      title: p.nombre, keyboard: false, draggable: Boolean(rec.nuevas),
    }).bindTooltip(`${i + 1}. ${p.nombre}`, { direction: "top", offset: [0, -14] });
    m.on("dragend", () => {
      const { lat, lng } = m.getLatLng();
      Object.assign(p, { lat, lng, lugar: "Movida a mano en el mapa" });
      pintarHallados($("#rec-paradas-lista"), rec.nuevas);
    });
    rec.capa.addLayer(m);
  });
  estadoRecorrido();
}

async function agregarPunto(p) {
  const pts = recPuntos();
  let tramo = [p];
  if (pts.length && $("#rec-pegar").checked) {
    const a = pts.at(-1);
    try {
      const r = await fetch(`${OSRM}/route/v1/driving/${a[1]},${a[0]};${p[1]},${p[0]}?overview=full&geometries=geojson`);
      const j = await r.json();
      const c = j.routes?.[0]?.geometry.coordinates;
      if (c?.length) tramo = c.slice(1).map(([x, y]) => [y, x]);
    } catch {
      showMsg(msg, "No se pudo pegar a las calles: ese tramo quedó en línea recta.");
    }
  }
  rec.tramos.push(tramo);
  rec.fuente = "dibujado";
  rec.cambios = true;
  dibujarRecorrido();
}

$("#rec-deshacer").addEventListener("click", () => { rec.tramos.pop(); rec.cambios = true; dibujarRecorrido(); });
$("#rec-borrar").addEventListener("click", () => { rec.tramos = []; rec.cambios = true; dibujarRecorrido(); });

// Antes de guardar se quitan los puntos que no cambian la forma (pesa menos y dibuja más rápido)
function simplificar(points, tol = 4) {
  if (points.length < 3) return points;
  const k = Math.cos((points[0][0] * Math.PI) / 180) * 111320;
  const xy = points.map(([la, ln]) => [ln * k, la * 110540]);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const len = Math.hypot(xy[b][0] - xy[a][0], xy[b][1] - xy[a][1]) || 1;
    let far = -1, dmax = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((xy[b][0] - xy[a][0]) * (xy[a][1] - xy[i][1]) - (xy[a][0] - xy[i][0]) * (xy[b][1] - xy[a][1])) / len;
      if (d > dmax) { dmax = d; far = i; }
    }
    if (dmax > tol) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

$("#rec-guardar").addEventListener("click", async () => {
  const puntos = simplificar(recPuntos()).map(([a, b]) => [Math.round(a * 1e6) / 1e6, Math.round(b * 1e6) / 1e6]);
  try {
    await api(`/admin/recorridos/${rec.ruta}/${rec.sentido}`, { method: "PUT", body: { puntos, fuente: rec.fuente } });
    recSentido().trazo = { puntos, fuente: rec.fuente, actualizado: new Date().toISOString() };
    rec.tramos = [puntos];
    rec.cambios = false;
    dibujarRecorrido();
    showMsg(msg, `Recorrido de la ${rec.ruta} guardado. Ya se ve así en el mapa público.`, "ok");
  } catch (err) { fail(err); }
});

$("#rec-auto").addEventListener("click", () => confirmar(
  `Quitar el recorrido de la ${rec.ruta}`,
  "El mapa público volverá a adivinar el camino por las calles, parada por parada. Puedes dibujarlo otra vez cuando quieras.",
  "Quitar recorrido",
  async () => {
    await api(`/admin/recorridos/${rec.ruta}/${rec.sentido}`, { method: "DELETE" });
    recSentido().trazo = null;
    rec.tramos = [];
    rec.cambios = false;
    dibujarRecorrido();
  }));

// ---- Escribir paradas y recorrido como texto ----
// Cada renglón es "Nombre", "Nombre | lugar a buscar" o "Nombre | 13.70, -89.20".
// Las paradas que ya existen se reconocen por su nombre y conservan su ubicación sin buscarlas.
const COORD = /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/;
const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const renglones = (id) => $(id).value.split("\n").map((x) => x.trim()).filter(Boolean);

async function resolverRenglon(linea) {
  const [nombre, extra] = linea.split("|").map((x) => x.trim());
  const busca = extra || nombre;
  const c = busca.match(COORD);
  if (c) return { nombre, lat: Number(c[1]), lng: Number(c[2]), lugar: "Coordenadas escritas" };
  // primero las de esta ruta; luego las de otras (así una terminal compartida sigue siendo una sola parada)
  const todas = [rec.rutas.find((x) => x.ruta === rec.ruta), ...rec.rutas.filter((x) => x.ruta !== rec.ruta)]
    .flatMap((r) => r.sentidos.flatMap((x) => x.paradas));
  const ya = !extra && todas.find((p) => norm(p.nombre) === norm(nombre));
  if (ya) return { ...ya, lugar: "Ya es parada de go503" };
  const [hit] = await api(`/admin/lugares?q=${encodeURIComponent(busca)}`);
  return hit ? { nombre, lat: hit.lat, lng: hit.lng, lugar: hit.lugar } : { nombre, error: true };
}

// Busca los renglones uno por uno (el buscador de lugares acepta uno por segundo) y va mostrando el avance
async function resolverTodos(lineas, lista, boton) {
  boton.disabled = true;
  const out = [];
  try {
    for (const [i, l] of lineas.entries()) {
      lista.replaceChildren(el("li", "muted", `Buscando ${i + 1} de ${lineas.length}: ${l}`));
      out.push(await resolverRenglon(l));
    }
  } finally { boton.disabled = false; }
  pintarHallados(lista, out);
  return out;
}

function pintarHallados(lista, items) {
  lista.replaceChildren(...items.map((x) => {
    const li = el("li", x.error ? "rec__hallado rec__hallado--no" : "rec__hallado");
    li.append(el("b", null, x.nombre), el("small", null, x.error
      ? "No lo encontré. Pon el lugar más completo después de una raya, o sus coordenadas."
      : x.lugar));
    return li;
  }));
}

$("#rec-paradas-buscar").addEventListener("click", async () => {
  const lineas = renglones("#rec-paradas-txt");
  if (lineas.length < 2) return showMsg(msg, "Escribe al menos 2 paradas, una por renglón.");
  try {
    rec.nuevas = await resolverTodos(lineas, $("#rec-paradas-lista"), $("#rec-paradas-buscar"));
  } catch (err) { return fail(err); }
  dibujarRecorrido();
  const ok = rec.nuevas.filter((p) => !p.error);
  if (ok.length) rec.map.fitBounds(L.latLngBounds(ok.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
  showMsg(msg, ok.length < rec.nuevas.length
    ? "Algunas paradas no aparecieron: corrígelas y vuelve a buscar."
    : "Revisa las paradas amarillas en el mapa. Si alguna quedó mal, arrástrala a su lugar y guarda.", ok.length < rec.nuevas.length ? "error" : "ok");
});
// si cambia el texto, lo buscado ya no corresponde
$("#rec-paradas-txt").addEventListener("input", () => {
  if (!rec.nuevas) return;
  rec.nuevas = null;
  $("#rec-paradas-lista").replaceChildren();
  dibujarRecorrido();
});

$("#rec-paradas-guardar").addEventListener("click", async () => {
  const s = recSentido();
  try {
    const paradas = await api(`/admin/recorridos/${rec.ruta}/${rec.sentido}/paradas`, { method: "PUT",
      body: { paradas: rec.nuevas.map(({ id, nombre, lat, lng }) => ({ id, nombre, lat, lng })) } });
    // una parada que se movió puede estar en otras rutas: se recargan todas
    rec.rutas = await api("/admin/recorridos");
    rec.nuevas = null;
    $("#rec-paradas-lista").replaceChildren();
    cambiarRecorrido(rec.ruta, rec.sentido, { encuadrar: false });
    showMsg(msg, s.trazo
      ? `Paradas de la ${rec.ruta} guardadas (${paradas.length}). Revisa que el recorrido dibujado siga pasando por ellas.`
      : `Paradas de la ${rec.ruta} guardadas (${paradas.length}). Ya se ven así en el mapa público.`, "ok");
  } catch (err) { fail(err); }
});

$("#rec-via-trazar").addEventListener("click", async () => {
  const lineas = renglones("#rec-via-txt");
  if (lineas.length < 2) return showMsg(msg, "Escribe al menos 2 lugares, uno por renglón.");
  let pts;
  try {
    pts = await resolverTodos(lineas, $("#rec-via-lista"), $("#rec-via-trazar"));
  } catch (err) { return fail(err); }
  if (pts.some((p) => p.error)) return showMsg(msg, "Algunos lugares no aparecieron: corrígelos y vuelve a trazar.");
  let linea = pts.map((p) => [p.lat, p.lng]);
  if ($("#rec-pegar").checked) {
    try {
      const r = await fetch(`${OSRM}/route/v1/driving/${pts.map((p) => `${p.lng},${p.lat}`).join(";")}?overview=full&geometries=geojson`);
      const c = (await r.json()).routes?.[0]?.geometry.coordinates;
      if (c?.length) linea = c.map(([x, y]) => [y, x]);
    } catch {
      showMsg(msg, "No se pudo pegar a las calles: el recorrido quedó en líneas rectas.");
    }
  }
  rec.tramos = [linea];
  rec.fuente = "dibujado";
  rec.cambios = true;
  rec.vista = null;
  dibujarRecorrido();
  rec.map.fitBounds(L.latLngBounds(linea), { padding: [40, 40] });
});

async function loadVueltas() {
  const root = $("#rec-vueltas");
  root.replaceChildren(el("li", "muted", "Buscando vueltas…"));
  let vueltas;
  try { vueltas = await api(`/admin/recorridos/${rec.ruta}/${rec.sentido}/grabaciones`); } catch (err) {
    return root.replaceChildren(el("li", "muted", err.message));
  }
  if (!vueltas.length) return root.replaceChildren(el("li", "muted", "Todavía no hay vueltas completas en este sentido."));
  root.replaceChildren(...vueltas.map((v) => {
    const li = el("li", "rec__vuelta");
    const txt = el("div");
    txt.append(el("b", null, v.unidad), el("small", null, `${fecha(v.inicio)}, ${hora(v.inicio)} a ${hora(v.fin)} (${v.minutos} min)`));
    const ver = button("Ver", "btn--ghost btn--sm", () => {
      rec.vista = rec.vista === v.puntos ? null : v.puntos;
      ver.setAttribute("aria-pressed", String(Boolean(rec.vista)));
      dibujarRecorrido();
      if (rec.vista) rec.map.fitBounds(L.latLngBounds(v.puntos), { padding: [40, 40] });
    });
    ver.setAttribute("aria-pressed", "false");
    const usar = button("Usar esta", "btn--ghost btn--sm", () => {
      rec.tramos = [v.puntos];
      rec.fuente = "gps";
      rec.cambios = true;
      rec.vista = null;
      dibujarRecorrido();
    });
    usar.setAttribute("aria-label", `Usar la vuelta de ${v.unidad} como recorrido`);
    li.append(txt, ver, usar);
    return li;
  }));
}

// ---------- Inicio ----------
$("#logout").addEventListener("click", async () => {
  const sb = await supa();
  await sb.auth.signOut();
  location.replace("/login.html");
});

$("#f-activar").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/activar", { method: "POST", body: { codigo: $("#a-codigo").value, empresa: $("#a-empresa").value } });
    location.reload();
  } catch (err) { showMsg(msg, err.message); }
});

(async () => {
  try {
    const sb = await supa();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return location.replace("/login.html");

    let yo = await api("/yo");
    // Primera vez después de registrarse: activar con el código que puso al crear la cuenta
    if (!yo.empresa) {
      const meta = session.user.user_metadata || {};
      if (meta.codigo && meta.empresa) {
        try {
          await api("/activar", { method: "POST", body: { codigo: meta.codigo, empresa: meta.empresa } });
          yo = await api("/yo");
        } catch (err) { showMsg(msg, err.message); }
      }
    }
    $("#email").textContent = yo.usuario.email;
    if (!yo.empresa) {
      VIEWS.forEach((v) => { $(`#v-${v}`).hidden = true; });
      document.querySelector(".nav").hidden = true;
      $("#v-activar").hidden = false;
      $("#a-empresa").value = session.user.user_metadata?.empresa || "";
      return;
    }
    const empresa = yo.empresa.name;
    $("#company").textContent = empresa;
    $("#iniciales").textContent = empresa.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    isAdmin = Boolean(yo.empresa.is_admin);
    $("#nav-codigos").hidden = !isAdmin;
    $("#nav-recorridos").hidden = !isAdmin;
    $("#nav-clientes").hidden = !isAdmin;
    $("#nav-admin").hidden = !isAdmin;
    if (isAdmin) loadClientes({ soloContar: true });
    $("#alertas").hidden = false;
    loadAlertas();
    setInterval(loadAlertas, ALERTAS_MS);
    rutas = await fetch("/api/rutas").then((r) => r.json());
    route();
    api("/mantenimiento").then(updateBadge).catch(() => {});
  } catch (err) { fail(err); }
})();
