// go503 empresas: panel (flota en vivo, unidades, mantenimiento y reportes)
const { supa, api, $, el, showMsg } = window.go503;

const REFRESH_MS = 5000;
const CARTO_KEY = "cb1_483z_1_4a6102fca3ea19c0048a0ded"; // la misma del mapa público
const VIEWS = ["flota", "unidades", "mantenimiento", "reportes", "codigos"];
let isAdmin = false;
const TIPOS = { autobus: "Autobús", microbus: "Microbús" };
const SERVICIOS = { aceite: "Cambio de aceite", frenos: "Frenos", llantas: "Llantas", general: "Revisión general", otro: "Otro" };

let rutas = [];
let flota = [];
let timer = null;
let selected = null;

// ---------- Utilidades ----------
const km = (n) => `${fmt(n, n != null && n < 100 ? 1 : 0)} km`; // decimales solo cuando son pocos km
const fmt = (n, d = 0) => (n == null ? "–" : Number(n).toLocaleString("es-SV", { maximumFractionDigits: d, minimumFractionDigits: d }));
const fecha = (iso) => new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "short", year: "numeric" });
const hora = (t) => new Date(t).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit", hour12: false });

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
function route() {
  const asked = location.hash.slice(1);
  const view = VIEWS.includes(asked) && (asked !== "codigos" || isAdmin) ? asked : "flota";
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
}
addEventListener("hashchange", route);

// ---------- Flota en vivo ----------
let map = null;
const markers = new Map();
let fitted = false;

function initMap() {
  map = L.map("fleet-map", { zoomControl: false }).setView([13.699, -89.205], 12);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`, {
    maxZoom: 20, detectRetina: true,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
}

function markerIcon(u) {
  const cls = `fleet-mk${u.enLinea ? "" : " fleet-mk--off"}${selected === u.id ? " fleet-mk--sel" : ""}`;
  return L.divIcon({ className: "", html: `<span class="${cls}">${u.ruta ?? ""}</span>`, iconSize: [38, 26], iconAnchor: [19, 13] });
}

function estado(u) {
  if (!u.ultimaSenal) return "El sensor aún no transmite";
  if (!u.enLinea) return `Sin señal, última ${hace(u.ultimaSenal)}`;
  return u.parada ? `En ${u.parada}` : "En ruta";
}

async function loadFlota() {
  try {
    flota = await api("/flota");
  } catch (err) { return fail(err); }

  const en = flota.filter((u) => u.enLinea).length;
  $("#flota-resumen").textContent = flota.length
    ? `${en} de ${flota.length} ${flota.length === 1 ? "unidad" : "unidades"} en línea`
    : "Todavía no tienes unidades registradas.";

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
    b.append(el("span", "unit__meta", `${estado(u)}${u.placa ? `. Placa ${u.placa}` : ""}`));
    b.addEventListener("click", () => openDetalle(u.id));
    li.append(b);
    return li;
  }));

  // Mapa
  const seen = new Set();
  flota.filter((u) => u.lat != null).forEach((u) => {
    seen.add(u.id);
    let m = markers.get(u.id);
    if (!m) {
      m = L.marker([u.lat, u.lng], { keyboard: false, title: u.nombre }).addTo(map);
      m.on("click", () => openDetalle(u.id));
      markers.set(u.id, m);
    } else m.setLatLng([u.lat, u.lng]);
    m.setIcon(markerIcon(u));
  });
  markers.forEach((m, id) => { if (!seen.has(id)) { m.remove(); markers.delete(id); } });
  const pts = flota.filter((u) => u.lat != null).map((u) => [u.lat, u.lng]);
  if (!fitted && pts.length) {
    fitted = true;
    map.fitBounds(pts, { padding: [60, 60], maxZoom: 15 });
  }
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

  $("#d-nombre").textContent = u.nombre;
  $("#d-sub").textContent = `Ruta ${u.ruta}, ${TIPOS[u.tipo] || "unidad"}${u.placa ? `, placa ${u.placa}` : ""}`;
  const facts = [
    ["Estado", estado(u)],
    ["Velocidad", u.enLinea && u.velocidad != null ? `${fmt(u.velocidad)} km/h` : "–"],
    ["Kilometraje", km(u.odometroKm)],
    ["Horas de motor", `${fmt(u.horasMotor, 1)} h`],
    ["Temperatura", u.temperatura != null ? `${fmt(u.temperatura, 1)} °C` : "–"],
    ["Combustible", u.combustible != null ? `${fmt(u.combustible)} %` : "–"],
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
  if (pts.length < 2) { box.append(el("p", "muted", "Sin datos todavía.")); return box; }

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
    const sensor = el("td");
    sensor.append(el("span", `status${u.enLinea ? " status--on" : ""}`, u.enLinea ? "En línea" : "Sin señal"),
      el("small", null, u.ultimaSenal ? `Última señal ${hace(u.ultimaSenal)}` : "Aún no transmite"));
    const actions = el("td");
    const wrap = el("div", "actions");
    wrap.append(
      button("Editar", "btn--ghost btn--sm", () => openUnidad(u)),
      button("Nueva clave", "btn--ghost btn--sm", () => confirmar(
        `Nueva clave para ${u.nombre}`,
        "La clave actual dejará de funcionar y tendrás que poner la nueva en el sensor.",
        "Generar nueva clave",
        async () => showClave(await api(`/unidades/${u.id}/clave`, { method: "POST" }), u.ruta))),
      button("Eliminar", "btn--ghost btn--sm", () => confirmar(
        `Eliminar ${u.nombre}`,
        "Se borran la unidad y sus servicios. Su sensor dejará de aparecer en tu panel. Esto no se puede deshacer.",
        "Eliminar unidad",
        async () => { await api(`/unidades/${u.id}`, { method: "DELETE" }); loadUnidades(); })));
    actions.append(wrap);
    tr.append(name, el("td", null, u.ruta), el("td", null, TIPOS[u.tipo] || "–"), sensor, actions);
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(table);
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

function showClave({ id, clave }, ruta) {
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
  "al-dia": { icon: "i-ok", orden: 2 },
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
  list.sort((a, b) => ESTADO_ACEITE[a.estadoAceite].orden - ESTADO_ACEITE[b.estadoAceite].orden || b.kmDesdeAceite - a.kmDesdeAceite);

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
    const pct = Math.min(100, (m.kmDesdeAceite / m.intervaloAceiteKm) * 100);
    const falta = m.intervaloAceiteKm - m.kmDesdeAceite;
    const texto = m.estadoAceite === "vencido" ? `Vencido por ${fmt(-falta)} km` : m.estadoAceite === "pronto" ? `Pronto: faltan ${fmt(falta)} km` : `Al día: faltan ${fmt(falta)} km`;
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

    const motor = el("td");
    motor.append(m.temperatura != null ? `${fmt(m.temperatura, 1)} °C` : "–",
      el("small", null, m.combustible != null ? `Combustible ${fmt(m.combustible)} %` : ""));
    const fallas = el("td");
    if (m.fallas.length) m.fallas.forEach((f) => fallas.append(el("span", "chip", f)));
    else fallas.append(el("span", "muted", "Ninguna"));
    const ultimo = el("td");
    if (m.ultimoServicio) ultimo.append(SERVICIOS[m.ultimoServicio.tipo] || m.ultimoServicio.tipo, el("small", null, `${fecha(m.ultimoServicio.fecha)}, a los ${fmt(m.ultimoServicio.km)} km`));
    else ultimo.append(el("span", "muted", "Ninguno"));
    const actions = el("td");
    const wrap = el("div", "actions");
    wrap.append(button("Registrar servicio", "btn--ghost btn--sm", () => openServicio(m)));
    actions.append(wrap);
    tr.append(name, km, oilTd, motor, fallas, ultimo, actions);
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(table);
}

function updateBadge(list) {
  const n = list.filter((m) => m.estadoAceite !== "al-dia").length;
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
const RAMP = ["#E8ECF8", "#C3CBEA", "#8E9DD3", "#5568B0", "#2A3A82"]; // un solo tono: claro = rápido, oscuro = lento

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
  const hours = tramos.flatMap((t) => Object.keys(t.porHora).map(Number));
  const h0 = Math.min(...hours), h1 = Math.max(...hours);
  const cols = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);

  const table = el("table");
  const head = el("tr");
  head.append(el("th", null, ""), ...cols.map((h) => el("th", null, `${h}:00`)), el("th", null, "Promedio"));
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
        td.style.color = step >= 3 ? "#fff" : "var(--tinta)";
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
  legend.append("Más rápido", ramp, "Más lento (comparado dentro de cada tramo)");
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
  const label = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("es-SV", { weekday: "short", day: "numeric" });

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

// ---------- Códigos de invitación (administradores) ----------
async function loadCodigos() {
  let list;
  try { list = await api("/admin/codigos"); } catch (err) { return fail(err); }
  const root = $("#codigos");
  if (!list.length) return root.replaceChildren(el("div", "empty-state", "Todavía no has creado códigos."));
  const table = el("table", "table");
  const head = el("tr");
  ["Código", "Para", "Estado", "Creado"].forEach((t) => head.append(el("th", null, t)));
  table.append(el("thead"), el("tbody"));
  table.tHead.append(head);
  list.forEach((c) => {
    const tr = el("tr");
    const code = el("td");
    code.append(el("b", null, c.codigo));
    const estado = el("td");
    if (c.usado) estado.append(el("span", "status", "Usado"), el("small", null, `${c.empresa ?? "Empresa eliminada"}, ${fecha(c.usado)}`));
    else estado.append(el("span", "status status--on", "Disponible"));
    tr.append(code, el("td", c.nota ? null : "muted", c.nota ?? "Sin nota"), estado, el("td", null, fecha(c.creado)));
    table.tBodies[0].append(tr);
  });
  root.replaceChildren(table);
}

$("#f-codigo").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const { codigo } = await api("/admin/codigos", { method: "POST", body: { nota: $("#cod-nota").value || null } });
    $("#cod-nota").value = "";
    showMsg(msg, `Código creado: ${codigo}. Dáselo a la empresa para que se registre.`, "ok");
    loadCodigos();
  } catch (err) { fail(err); }
});

// ---------- Inicio ----------
$("#logout").addEventListener("click", async () => {
  const sb = await supa();
  await sb.auth.signOut();
  location.replace("/empresa/");
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
    if (!session) return location.replace("/empresa/");

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
    $("#company").textContent = yo.empresa.name;
    isAdmin = Boolean(yo.empresa.is_admin);
    $("#nav-codigos").hidden = !isAdmin;
    rutas = await fetch("/api/rutas").then((r) => r.json());
    route();
    api("/mantenimiento").then(updateBadge).catch(() => {});
  } catch (err) { fail(err); }
})();
