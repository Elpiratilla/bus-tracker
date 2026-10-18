// go503 motorista: el celular del motorista hace de sensor del bus.
// Escoge hacia dónde sale, Dar la vuelta en la terminal y Terminar trayecto.
// Manda el GPS solo mientras está en trayecto.
// La misma página va dentro de la app de Android (carpeta app/): ahí el GPS sigue con la pantalla apagada.
(() => {
const SEND_MS = 5000;           // cada cuánto se manda la posición durante el trayecto
const KEY = "go503-motorista";  // código de la unidad y clave, en este celular
const $ = (id) => document.getElementById(id);

// Dentro de la app: los archivos van en el celular y el servidor es el de Render
const NATIVA = window.Capacitor?.isNativePlatform?.() === true;
const SERVIDOR = NATIVA ? "https://go503.onrender.com" : "";
const GpsFondo = NATIVA ? window.Capacitor.registerPlugin("BackgroundGeolocation") : null;
let watcherId = null;

let cred = null;      // { busId, clave }
let estado = null;    // lo último que dijo el servidor
let pos = null;       // última posición del GPS
let lastSent = 0;
let lastOk = 0;
let wakeLock = null;
let gpsFalla = false;   // sin permiso o sin señal: el aviso de arriba se pone rojo
let confirmar = null;   // "Terminar trayecto" pide un segundo toque

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
  const res = await fetch(SERVIDOR + path, {
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

// Rótulo de un sentido, como el letrero del bus: número de ruta, destino y de dónde sale
function rotulo(ruta, d) {
  const b = nuevo("button");
  b.type = "button";
  b.className = "rotulo";
  const n = nuevo("span", ruta);
  n.className = "fascia";
  n.setAttribute("aria-hidden", "true");
  b.append(n, nuevo("b", d.destino), nuevo("small", `Sale de ${d.origen}`));
  b.setAttribute("aria-label", `Salir hacia ${d.destino}, desde ${d.origen}`);
  b.addEventListener("click", () => viaje("salir", d.id));
  return b;
}

function render() {
  const s = estado;
  const actual = s.sentidos.find((d) => d.id === s.sentido);
  const otro = s.sentidos.find((d) => d.id !== s.sentido);
  $("numero").hidden = !s.enServicio; // fuera de servicio el número ya va en cada rótulo
  $("numero").textContent = s.ruta;
  // En trayecto, arriba va el destino como en el rótulo del bus; si no, el nombre de la unidad
  $("titulo").textContent = s.enServicio ? actual.destino : s.unidad || `Ruta ${s.ruta}`;
  $("subtitulo").textContent = s.enServicio ? `${s.unidad || "Ruta " + s.ruta}, en trayecto` : `Fuera de servicio, unidad ${cred.busId}`;
  $("v-salir").hidden = s.enServicio;
  $("v-viaje").hidden = !s.enServicio;
  $("sentidos").replaceChildren(...s.sentidos.map((d) => rotulo(s.ruta, d)));
  if (s.enServicio) {
    const enTerminal = !s.siguiente;
    $("proxima-titulo").textContent = enTerminal ? "Llegaste a la terminal" : "Próxima parada";
    $("siguiente").textContent = s.siguiente || actual.destino;
    $("paradas").replaceChildren(...s.paradas.map((p) => {
      const li = nuevo("li", p.nombre);
      li.className = p.paso ? "paso" : p.nombre === s.siguiente ? "sigue" : "";
      return li;
    }));
    // Dar la vuelta solo resalta al llegar a la terminal
    $("vuelta").className = `btn grande ${enTerminal ? "btn--maiz" : "btn--vuelta"}`;
    $("vuelta").replaceChildren(`Dar la vuelta hacia ${otro.destino}`, nuevo("small", enTerminal ? "Empieza el regreso" : "Al llegar a la terminal"));
  }
  if (!s.enServicio) desarmarTerminar(); // se redibuja cada 5 s: no borrar el primer toque de Terminar
  renderDetalle();
}

// Aviso del GPS arriba a la derecha (solo en trayecto)
function renderDetalle() {
  const g = $("gps");
  g.hidden = !estado?.enServicio;
  if (g.hidden) return;
  const s = lastOk ? Math.round((Date.now() - lastOk) / 1000) : null;
  const viejo = s != null && s > 30;
  g.dataset.estado = gpsFalla || viejo ? "mal" : s == null ? "busca" : "ok";
  g.textContent = gpsFalla ? "Sin GPS" : s == null ? "Buscando GPS" : viejo ? `Sin enviar ${s} s` : `GPS ${s} s`;
}

async function refresh() {
  try {
    estado = await api("estado");
    $("v-entrar").hidden = true;
    $("v-app").hidden = false;
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
  $("numero").hidden = true;
  $("gps").hidden = true;
  $("titulo").textContent = "go503 motorista";
  $("subtitulo").textContent = "Tu celular es el GPS del bus";
}

// ---------- GPS ----------
// En la app: el GPS se prende solo durante el trayecto, con una notificación fija (así Android no lo corta)
async function gpsApp() {
  if (estado?.enServicio && watcherId == null) {
    watcherId = "pidiendo";
    watcherId = await GpsFondo.addWatcher({
      backgroundTitle: "Trayecto en curso",
      backgroundMessage: "Tu bus sale en el mapa de go503. Toca Terminar trayecto al acabar.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 0,
    }, (loc, err) => {
      if (err) {
        gpsFalla = true;
        if (err.code === "NOT_AUTHORIZED") showMsg("Dale permiso de ubicación a go503 Motorista (Permitir siempre) en los ajustes del celular.");
        return;
      }
      gpsFalla = false;
      pos = { timestamp: loc.time ?? Date.now(), coords: { latitude: loc.latitude, longitude: loc.longitude,
        accuracy: loc.accuracy, speed: loc.speed, heading: loc.bearing } };
      sendPosition();
    }).catch((err) => { watcherId = null; throw err; }); // si falla, se puede volver a intentar
  } else if (!estado?.enServicio && watcherId != null && watcherId !== "pidiendo") {
    const id = watcherId;
    watcherId = null;
    pos = null;
    await GpsFondo.removeWatcher({ id });
  }
}

function startGps() {
  if (NATIVA) return; // en la app lo maneja gpsApp()
  if (!("geolocation" in navigator)) return showMsg("Este celular no tiene GPS en el navegador.");
  navigator.geolocation.watchPosition((p) => {
    pos = p;
    gpsFalla = false;
    sendPosition();
  }, (err) => {
    gpsFalla = true;
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

// La pantalla no se apaga durante el trayecto (si se apaga, el navegador deja de mandar el GPS).
// En la app no hace falta: prende o apaga el GPS en segundo plano.
async function keepAwake() {
  if (NATIVA) return gpsApp().catch((err) => showMsg(`No se pudo prender el GPS: ${err.message}`));
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

// Terminar pide un segundo toque en 4 s: un roce sin querer no saca al bus del mapa
function desarmarTerminar() {
  clearTimeout(confirmar);
  confirmar = null;
  delete $("terminar").dataset.confirmar;
  $("terminar").textContent = "Terminar trayecto";
}
$("terminar").addEventListener("click", () => {
  if (confirmar) return viaje("terminar");
  $("terminar").dataset.confirmar = "";
  $("terminar").textContent = "Toca otra vez para terminar";
  confirmar = setTimeout(desarmarTerminar, 4000);
});
$("vuelta").addEventListener("click", () => viaje("salir", estado.sentidos.find((d) => d.id !== estado.sentido).id));

$("f-entrar").addEventListener("submit", (e) => {
  e.preventDefault();
  // También sirve pegar el enlace completo del panel (…/motorista.html#u=ID&k=CLAVE)
  const enlace = new URLSearchParams($("e-unidad").value.split("#")[1] || "");
  const busId = (enlace.get("u") || $("e-unidad").value).trim().toUpperCase();
  const clave = (enlace.get("k") || $("e-clave").value).trim();
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
if (NATIVA) {
  $("aviso-pantalla").textContent = "Puedes bloquear el celular: el GPS sigue mandándose. Déjalo conectado al cargador.";
  $("e-ayuda").textContent = "Pega aquí el enlace que te mandó el dueño del bus, o escribe el código y la clave.";
}
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
