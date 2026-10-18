// go503 motorista: el celular del motorista hace de sensor del bus.
// Escoge hacia dónde sale, Dar la vuelta en la terminal y Terminar trayecto.
// Manda el GPS solo mientras está en trayecto.
(() => {
const SEND_MS = 5000;           // cada cuánto se manda la posición durante el trayecto
const KEY = "go503-motorista";  // código de la unidad y clave, en este celular
const $ = (id) => document.getElementById(id);

let cred = null;      // { busId, clave }
let estado = null;    // lo último que dijo el servidor
let pos = null;       // última posición del GPS
let lastSent = 0;
let lastOk = 0;
let wakeLock = null;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save(c) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch {}
}

function showMsg(text, kind = "error") {
  const m = $("msg");
  m.textContent = text;
  m.className = `msg msg--${kind}`;
  m.hidden = !text;
}

async function call(path, body = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": cred.clave },
    body: JSON.stringify({ busId: cred.busId, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
const api = (path, body) => call(`/api/motorista/${path}`, body);

// ---------- Pantalla ----------
const nuevo = (tag, text) => { const n = document.createElement(tag); if (text != null) n.textContent = text; return n; };

// Botón grande con una línea chica abajo ("Sale de Terminal de Oriente")
function botonGrande(clase, texto, detalle, onClick) {
  const b = nuevo("button", texto);
  b.type = "button";
  b.className = `btn ${clase} btn--big`;
  b.append(nuevo("small", detalle));
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  const s = estado;
  const actual = s.sentidos.find((d) => d.id === s.sentido);
  const otro = s.sentidos.find((d) => d.id !== s.sentido);
  $("titulo").textContent = s.unidad || `Ruta ${s.ruta}`;
  $("subtitulo").textContent = `Ruta ${s.ruta} · unidad ${cred.busId}`;
  $("estado").className = `estado${s.enServicio ? " estado--on" : ""}`;
  $("e-texto").textContent = s.enServicio ? `En trayecto hacia ${actual.destino}` : "Fuera de servicio";
  $("v-salir").hidden = s.enServicio;
  $("v-viaje").hidden = !s.enServicio;
  $("sentidos").replaceChildren(...s.sentidos.map((d, i) =>
    botonGrande(i ? "btn--maiz" : "btn--torogoz", `Hacia ${d.destino}`, `Sale de ${d.origen}`, () => viaje("salir", d.id))));
  if (s.enServicio) {
    $("siguiente").textContent = s.siguiente || actual.destino;
    $("hacia").textContent = s.siguiente ? `Vas hacia ${actual.destino}` : "Llegaste a la terminal";
    $("vuelta").replaceChildren(`Dar la vuelta: hacia ${otro.destino}`, nuevo("small", "Al llegar a la terminal"));
    $("paradas").replaceChildren(...s.paradas.map((p) => {
      const li = nuevo("li", p.nombre);
      if (p.paso) li.className = "ya-paso";
      return li;
    }));
  }
  renderDetalle();
}

function renderDetalle() {
  if (!estado) return;
  let t;
  if (estado.enServicio) {
    const s = lastOk ? Math.round((Date.now() - lastOk) / 1000) : null;
    t = !pos ? "Buscando GPS…" : s == null ? "Mandando ubicación…" : `Ubicación enviada hace ${s} s`;
  } else t = "Escoge hacia dónde sales para que la gente vea el bus en el mapa.";
  $("e-detalle").textContent = t;
}

async function refresh() {
  try {
    estado = await api("estado");
    $("v-entrar").hidden = true;
    $("v-app").hidden = false;
    $("cerrar").hidden = false;
    render();
    keepAwake();
  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      save(null);
      cred = null;
      showEntrar();
      showMsg("El código o la clave no sirven. Pídele el enlace nuevo al dueño del bus.");
    } else showMsg(err.message);
  }
}

function showEntrar() {
  $("v-entrar").hidden = false;
  $("v-app").hidden = true;
  $("cerrar").hidden = true;
}

// ---------- GPS ----------
function startGps() {
  if (!("geolocation" in navigator)) return showMsg("Este celular no tiene GPS en el navegador.");
  navigator.geolocation.watchPosition((p) => {
    pos = p;
    sendPosition();
  }, (err) => {
    showMsg(err.code === 1 ? "Dale permiso de ubicación a esta página para que funcione." : "No se pudo leer el GPS. Sal a un lugar abierto.");
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}

async function sendPosition() {
  if (!estado?.enServicio || !pos || Date.now() - lastSent < SEND_MS) return;
  lastSent = Date.now();
  const c = pos.coords;
  try {
    await call("/api/telemetry", {
      lat: c.latitude, lng: c.longitude, ts: new Date(pos.timestamp).toISOString(),
      ...(c.speed != null && { speed: Math.round(c.speed * 3.6) }),
      ...(c.heading != null && !Number.isNaN(c.heading) && { heading: Math.round(c.heading) }),
    });
    lastOk = Date.now();
    showMsg("");
    // Trae la parada nueva si el bus llegó a una (próxima parada, paradas que ya pasó)
    estado = await api("estado");
    render();
  } catch (err) {
    showMsg(`No se pudo mandar la ubicación: ${err.message}`);
  }
}

// La pantalla no se apaga durante el trayecto (si se apaga, el navegador deja de mandar el GPS)
async function keepAwake() {
  if (!estado?.enServicio) { wakeLock?.release().catch(() => {}); wakeLock = null; return; }
  if (wakeLock || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

// ---------- Botones ----------
async function viaje(accion, sentido) {
  try {
    estado = await api("viaje", { accion, sentido });
    showMsg(accion === "salir" ? "Buen viaje. Ya sales en el mapa." : "Trayecto terminado. Ya no sales en el mapa.", "ok");
    lastSent = 0;
    render();
    keepAwake();
    sendPosition();
  } catch (err) { showMsg(err.message); }
}

$("terminar").addEventListener("click", () => viaje("terminar"));
$("vuelta").addEventListener("click", () => viaje("salir", estado.sentidos.find((d) => d.id !== estado.sentido).id));

$("f-entrar").addEventListener("submit", (e) => {
  e.preventDefault();
  const busId = $("e-unidad").value.trim().toUpperCase();
  const clave = $("e-clave").value.trim();
  if (!busId || !clave) return showMsg("Escribe el código y la clave.");
  cred = { busId, clave };
  save(cred);
  showMsg("");
  refresh();
});

$("cerrar").addEventListener("click", () => {
  if (estado?.enServicio) return showMsg("Termina el trayecto antes de cambiar de unidad.");
  save(null);
  cred = null;
  estado = null;
  showEntrar();
});

// ---------- Inicio ----------
// El panel da un enlace /motorista.html#u=ID&k=CLAVE: se guarda y se quita de la barra
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get("u") && hash.get("k")) {
  save({ busId: hash.get("u").toUpperCase(), clave: hash.get("k") });
  history.replaceState(null, "", location.pathname);
}
cred = load();
if (cred) refresh(); else showEntrar();
startGps();
setInterval(() => { renderDetalle(); sendPosition(); }, 1000);
})();
