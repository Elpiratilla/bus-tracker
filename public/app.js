// go503: conecta la interfaz con la API (o con datos de ejemplo)

const CONFIG = {
  API_BASE: "",        // ej. "https://api.go503.com". Vacío = datos de ejemplo
  REFRESH_MS: 15000,   // cada cuánto se actualiza
};

/* Contrato esperado: GET {API_BASE}/api/rutas/101
{
  "ruta": "101",
  "actualizado": "2026-10-12T08:16:00-06:00",
  "paradas": [               // en orden de recorrido
    { "id": 1, "nombre": "Terminal Oriente", "tramoMin": null,
      "pasoA": "2026-10-12T08:02:00-06:00",  // null si el bus aún no pasa
      "etaA": null }                         // hora estimada si aún no pasa
  ]
} */

// ---------- Posición de cada parada en el mapa esquemático ----------
// name y leg = [desplazamiento x, desplazamiento y, alineación]
const LAYOUT = {
  "101": [
    { x: 40,  y: 280, name: [14, 4, "start"] },
    { x: 40,  y: 200, name: [14, 4, "start"],   leg: [14, 4, "start"] },
    { x: 120, y: 120, name: [-8, -20, "end"],   leg: [16, 10, "start"] },
    { x: 240, y: 120, name: [0, 28, "middle"],  leg: [25, -16, "middle"] },
    { x: 320, y: 40,  name: [0, -18, "end"],    leg: [12, 20, "start"] },
  ],
};

// Si una ruta no tiene diseño propio, se acomoda en diagonal
function autoLayout(n) {
  return Array.from({ length: n }, (_, i) => ({
    x: 40 + (280 * i) / (n - 1),
    y: 280 - (240 * i) / (n - 1),
    name: i === n - 1 ? [0, -18, "end"] : [14, 18, "start"],
    leg: [-10, -4, "end"],
  }));
}

// ---------- Datos de ejemplo (se usan si API_BASE está vacío) ----------
const MOCK_NAMES = {
  "101": ["Terminal Oriente", "Parque Infantil", "Centro Histórico", "Metrocentro", "Zona Rosa"],
  "42":  ["Mejicanos", "Zacamil", "Plaza Mundo", "UCA", "Antiguo Cuscatlán"],
  "29":  ["Soyapango", "Ilopango", "San Bartolo", "Terminal", "Tonacatepeque"],
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
    paradas: MOCK_NAMES[ruta].map((nombre, i) => ({
      id: i + 1, nombre, tramoMin: tramos[i], pasoA: at(pasos[i]), etaA: at(etas[i]),
    })),
  };
}

async function getRoute(ruta) {
  if (!CONFIG.API_BASE) return mockRoute(ruta);
  const res = await fetch(`${CONFIG.API_BASE}/api/rutas/${encodeURIComponent(ruta)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const NS = "http://www.w3.org/2000/svg";

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit", hour12: false });
const minsTo = (iso) => Math.ceil((new Date(iso) - Date.now()) / 60000);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}
function svg(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text) n.textContent = text;
  return n;
}

// ---------- Dibujo ----------
function render({ ruta, actualizado, paradas }) {
  const L = LAYOUT[ruta] || autoLayout(paradas.length);
  const lastIdx = paradas.map((p) => Boolean(p.pasoA)).lastIndexOf(true);
  const nextIdx = lastIdx + 1;
  const next = paradas[nextIdx];
  const eta = next && next.etaA ? minsTo(next.etaA) : null;
  const etaLabel = eta === null ? "Sin estimado" : eta <= 0 ? "Llegando" : `Llega en ${eta} min`;

  // Posición del bus entre la última parada y la siguiente
  let bus = null;
  if (next && lastIdx >= 0) {
    const mins = (Date.now() - new Date(paradas[lastIdx].pasoA)) / 60000;
    const p = Math.min(0.95, Math.max(0.05, mins / (next.tramoMin || 5)));
    const a = L[lastIdx], b = L[nextIdx];
    bus = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
  }

  // Tablero de próxima parada
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

  // Mapa
  const pts = L.map((p) => `${p.x} ${p.y}`);
  const path = (arr) => "M" + arr.join(" L");
  const layer = $("#layer");
  layer.replaceChildren(svg("path", { class: "route route--todo", d: path(pts) }));

  const done = lastIdx >= 0 ? pts.slice(0, lastIdx + 1) : [];
  if (bus) done.push(`${bus.x} ${bus.y}`);
  if (done.length > 1) layer.append(svg("path", { class: "route route--done", d: path(done) }));

  paradas.forEach((p, i) => {
    const state = i <= lastIdx ? "done" : i === nextIdx ? "next" : "todo";
    const { x, y } = L[i];
    if (state === "next") layer.append(svg("circle", { class: "pulse", cx: x, cy: y, r: 13 }));
    layer.append(svg("circle", { class: `cp cp--${state}`, cx: x, cy: y, r: state === "next" ? 13 : 9 }));
  });

  if (bus) {
    layer.append(
      svg("g", { class: "bus", transform: `translate(${bus.x} ${bus.y})` }),
    );
    const g = layer.lastChild;
    g.append(
      svg("rect", { x: -19, y: -12, width: 38, height: 24, rx: 8 }),
      svg("text", { y: 4, "text-anchor": "middle" }, ruta)
    );
  }

  paradas.forEach((p, i) => {
    const { x, y, name } = L[i];
    layer.append(svg("text", { class: "m-t m-name", x: x + name[0], y: y + name[1], "text-anchor": name[2] }, p.nombre));
    if (i > 0 && p.tramoMin && L[i].leg) {
      const a = L[i - 1], [dx, dy, anchor] = L[i].leg;
      layer.append(svg("text", {
        class: "m-t m-leg", x: (a.x + x) / 2 + dx, y: (a.y + y) / 2 + dy, "text-anchor": anchor,
      }, `${p.tramoMin} min`));
    }
  });

  $("#map-svg").setAttribute(
    "aria-label",
    next && lastIdx >= 0
      ? `Ruta ${ruta}: el bus está entre ${paradas[lastIdx].nombre} y ${next.nombre}.`
      : `Mapa de la ruta ${ruta}.`
  );

  // Lista de paradas
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