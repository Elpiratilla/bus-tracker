// go503 motorista: el celular del motorista hace de sensor del micro de colegio.
// Botones grandes: Salir (mañana o tarde), Llegué y marcar paradas. Manda el GPS solo durante el viaje.
(() => {
const SEND_MS = 5000;           // cada cuánto se manda la posición durante el viaje
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

// ---------- Pantallas ----------
function render() {
  const s = estado;
  $("titulo").textContent = s.unidad || "Mi micro";
  $("subtitulo").textContent = `Unidad ${cred.busId}`;
  $("estado").className = `estado${s.enServicio ? " estado--on" : ""}`;
  $("e-texto").textContent = s.enServicio ? `En viaje: ${s.turno}` : "Sin viaje";
  $("v-salir").hidden = s.enServicio;
  $("v-viaje").hidden = !s.enServicio;
  $("v-paradas").hidden = s.enServicio;
  document.querySelectorAll("[data-salir]").forEach((b) => { b.disabled = s.paradas.length < 2; });
  $("p-borrar").hidden = !s.paradas.length;
  $("paradas").replaceChildren(...s.paradas.map((p, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = p.nombre;
    if (i === s.paradas.length - 1 && s.paradas.length > 1) {
      const small = document.createElement("small");
      small.textContent = "Colegio (última de la mañana)";
      span.append(small);
    }
    li.append(span);
    return li;
  }));
  renderDetalle();
}

function renderDetalle() {
  if (!estado) return;
  let t;
  if (estado.rutaPublica) t = "Esta unidad tiene una ruta pública. En el panel cámbiala a \"Recorrido de colegio\".";
  else if (estado.enServicio) {
    const s = lastOk ? Math.round((Date.now() - lastOk) / 1000) : null;
    t = !pos ? "Buscando GPS…" : s == null ? "Mandando ubicación…" : `Ubicación enviada hace ${s} s`;
    if (estado.ultimaParada) t += ` · Última parada: ${estado.ultimaParada}`;
  } else if (estado.paradas.length < 2) t = "Marca al menos 2 paradas para poder salir.";
  else t = `${estado.paradas.length} paradas. Toca Salir cuando arranques.`;
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
      showMsg("El código o la clave no sirven. Pídele el enlace nuevo al dueño del micro.");
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
  } catch (err) {
    showMsg(`No se pudo mandar la ubicación: ${err.message}`);
  }
}

// La pantalla no se apaga durante el viaje (si se apaga, el navegador deja de mandar el GPS)
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
    showMsg(accion === "salir" ? "Buen viaje. Los papás ya ven el micro." : "Viaje terminado.", "ok");
    lastSent = 0;
    render();
    keepAwake();
    sendPosition();
  } catch (err) { showMsg(err.message); }
}

document.querySelectorAll("[data-salir]").forEach((b) => b.addEventListener("click", () => viaje("salir", b.dataset.salir)));
$("llegue").addEventListener("click", () => viaje("llegue"));

$("f-parada").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pos) return showMsg("Aún no tenemos tu ubicación. Espera unos segundos.");
  if (pos.coords.accuracy > 60) return showMsg(`El GPS está impreciso (±${Math.round(pos.coords.accuracy)} m). Espera un momento al aire libre.`);
  const btn = $("p-marcar");
  btn.disabled = true;
  try {
    estado = await api("parada", { nombre: $("p-nombre").value, lat: pos.coords.latitude, lng: pos.coords.longitude });
    $("p-nombre").value = "";
    showMsg("Parada guardada.", "ok");
    render();
  } catch (err) { showMsg(err.message); } finally { btn.disabled = false; }
});

$("p-borrar").addEventListener("click", async () => {
  if (!confirm("¿Borrar todas las paradas? Tendrás que marcarlas otra vez.")) return;
  try {
    estado = await api("paradas/borrar");
    render();
  } catch (err) { showMsg(err.message); }
});

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
  if (estado?.enServicio) return showMsg("Termina el viaje antes de cambiar de unidad.");
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
