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
  let res;
  try {
    res = await fetch(SERVIDOR + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cred.clave },
      body: JSON.stringify({ busId: cred.busId, ...body }),
    });
  } catch {
    throw new Error("No hay conexión con go503. Revisa que tengas datos o wifi y vuelve a tocar.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `go503 no respondió bien (error ${res.status}). Intenta de nuevo en un momento.`);
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
  $("pie").hidden = s.enServicio; // en trayecto no se puede cambiar de unidad: ni se ofrece
  $("sentidos").replaceChildren(...s.sentidos.map((d) => rotulo(s.ruta, d)));
  if (s.enServicio) {
    const enTerminal = !s.siguiente;
    const i = s.paradas.findIndex((p) => !p.paso); // la próxima
    const faltan = s.paradas.length - i;            // de la próxima a la terminal, las dos cuentan
    $("proxima-titulo").textContent = enTerminal ? "Llegaste a la terminal" : "Próxima parada";
    $("siguiente").textContent = s.siguiente || actual.destino;
    $("luego").textContent = enTerminal ? `Toca Dar la vuelta para salir hacia ${otro.destino}.`
      : faltan === 1 ? "Es la terminal. Ahí das la vuelta."
      : `Después: ${s.paradas[i + 1].nombre}. Faltan ${faltan} paradas para ${actual.destino}.`;
    // Las que ya pasó no hacen falta de un vistazo: queda la última y las demás en una línea
    const pasadas = s.paradas.filter((p) => p.paso).length;
    const resumen = pasadas > 2 ? [Object.assign(nuevo("li", `${pasadas - 1} paradas ya pasadas`), { className: "paso resumen" })] : [];
    $("paradas").replaceChildren(...resumen, ...s.paradas.slice(resumen.length ? pasadas - 1 : 0).map((p) => {
      const li = nuevo("li", p.nombre);
      li.className = p.paso ? "paso" : p.nombre === s.siguiente ? "sigue" : "";
      if (li.className === "sigue") li.setAttribute("aria-current", "step");
      return li;
    }));
    // Dar la vuelta solo resalta al llegar a la terminal; antes es un botón callado
    $("vuelta").className = `btn grande ${enTerminal ? "btn--maiz" : "btn--vuelta"}`;
    $("vuelta").replaceChildren("Dar la vuelta", nuevo("small", `Regreso hacia ${otro.destino}`));
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
  const sinRed = !navigator.onLine;
  const problema = gpsFalla || viejo || sinRed;
  // Con problema manda el aviso rojo de abajo; la banda se esconde para no repetirlo
  g.hidden = problema;
  g.dataset.estado = s == null ? "busca" : "ok";
  if (s == null) g.textContent = "Buscando GPS. Todavía no sales en el mapa.";
  else g.replaceChildren("Sales en el mapa", nuevo("small", s < 3 ? "recién enviada" : `hace ${s} s`));
  const p = $("perdido");
  const cola = leerCola().length ? " El recorrido se sigue guardando en el celular y se manda solo cuando vuelva." : "";
  p.hidden = !problema;
  p.textContent = sinRed ? `El celular no tiene internet. La gente no ve el bus en el mapa hasta que vuelva la señal.${cola}`
    : gpsFalla ? "El GPS no responde. Revisa que la ubicación del celular esté prendida."
    : viejo ? `Hace ${s} s que no se manda la ubicación. Revisa el internet del celular.${cola}` : "";
}
addEventListener("online", () => renderDetalle());
addEventListener("offline", () => renderDetalle());

// Primer estado, con aviso mientras llega (Render tarda si estaba dormido)
function conectar() {
  $("cargando").hidden = false;
  return refresh().finally(() => { $("cargando").hidden = true; });
}

async function refresh() {
  try {
    estado = await api("estado");
    $("v-entrar").hidden = true;
    $("v-app").hidden = false;
    render();
    keepAwake();
    startGps(); // la ubicación se pide hasta que el motorista ya entró, no al abrir la página
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

let gpsPedido = false;
function startGps() {
  if (NATIVA || gpsPedido) return; // en la app lo maneja gpsApp(); en el navegador se pide una sola vez
  if (!("geolocation" in navigator)) return showMsg("Este celular no tiene GPS en el navegador.");
  gpsPedido = true;
  navigator.geolocation.watchPosition((p) => {
    pos = p;
    gpsFalla = false;
    sendPosition();
  }, (err) => {
    gpsFalla = true;
    showMsg(err.code === 1
      ? "El navegador no dejó usar la ubicación. Permítela para esta página (en el candado o en Ajustes del navegador) y recarga."
      : "No se pudo leer el GPS. Sal a un lugar abierto.");
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}

async function sendPosition() {
  if (!estado?.enServicio || !pos || Date.now() - lastSent < SEND_MS) return;
  lastSent = Date.now();
  const c = pos.coords;
  const punto = {
    lat: c.latitude, lng: c.longitude, ts: new Date(pos.timestamp).toISOString(),
    ...(c.speed != null && { speed: Math.round(c.speed * 3.6) }),
    ...(c.heading != null && !Number.isNaN(c.heading) && { heading: Math.round(c.heading) }),
  };
  if (!navigator.onLine) return guardar(punto); // sin internet ni se intenta: va directo a la cola
  try {
    await call("/api/telemetry", punto);
  } catch (err) {
    if (!err.status) guardar(punto); // no llegó al servidor (sin señal): se manda después
    return showMsg(err.message);
  }
  lastOk = Date.now();
  ultimoEnviado = Date.parse(punto.ts);
  showMsg("");
  // Un destello por cada ubicación enviada (marca un hecho real, no late sin parar)
  $("gps").classList.remove("envio");
  void $("gps").offsetWidth;
  $("gps").classList.add("envio");
  try {
    // Trae la parada nueva si el bus llegó a una (próxima parada, paradas que ya pasó)
    estado = await api("estado");
    render();
  } catch (err) { showMsg(err.message); }
}

// ---------- Cola sin señal ----------
// Igual que el sensor (firmware/go503_sensor/cola.h): sin señal, las ubicaciones se guardan en el
// celular con su hora y se mandan al volver el internet. El servidor las pone en el historial del
// dueño (km, vueltas) sin mover el bus en el mapa. Una por minuto alcanza: el historial guarda
// una por minuto. 240 = 4 horas sin señal; si se llena, se van las más viejas.
const COLA_KEY = "go503-motorista-cola";
const COLA_MAX = 240;
const COLA_CADA_MS = 60 * 1000;
let vaciando = false;
let ultimoEnviado = 0; // hora del GPS de la última ubicación en vivo que llegó

function leerCola() {
  try {
    const c = JSON.parse(localStorage.getItem(COLA_KEY));
    return c?.busId === cred?.busId && Array.isArray(c.puntos) ? c.puntos : [];
  } catch { return []; }
}
function escribirCola(puntos) {
  try {
    puntos.length ? localStorage.setItem(COLA_KEY, JSON.stringify({ busId: cred.busId, puntos }))
      : localStorage.removeItem(COLA_KEY);
  } catch {}
}
function guardar(punto) {
  const puntos = leerCola();
  const ultimo = puntos.at(-1);
  if (ultimo && Date.parse(punto.ts) - Date.parse(ultimo.ts) < COLA_CADA_MS) return;
  escribirCola([...puntos, punto].slice(-COLA_MAX));
}

// De 3 en 3 y en orden, como el sensor. Si el servidor rechaza uno (400), se bota y se sigue.
// Primero tiene que llegar una ubicación en vivo: si llegara antes una vieja, el mapa pondría el
// bus donde estaba hace media hora (el servidor solo trata como atrasadas las más viejas que la última).
async function vaciarCola() {
  if (vaciando || !cred || !navigator.onLine) return;
  vaciando = true;
  try {
    for (let i = 0; i < 3; i++) {
      const [punto] = leerCola();
      if (!punto || Date.parse(punto.ts) >= ultimoEnviado) break;
      try { await call("/api/telemetry", punto); } catch (err) { if (!err.status || err.status >= 500) break; }
      escribirCola(leerCola().slice(1));
    }
  } finally { vaciando = false; }
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
// Mientras el servidor responde, los botones no se pueden volver a tocar y se ve que está pasando algo
function ocupado(si) {
  $("v-app").querySelectorAll("button").forEach((b) => { b.disabled = si; });
  if (si) showMsg("Avisando a go503…", "info");
}

async function viaje(accion, sentido) {
  ocupado(true);
  try {
    estado = await api("viaje", { accion, sentido });
    showMsg(accion === "salir" ? "Buen viaje. Ya sales en el mapa." : "Trayecto terminado. Ya no sales en el mapa.", "ok");
    lastSent = 0;
    render();
    keepAwake();
    sendPosition();
  } catch (err) { showMsg(err.message); } finally { ocupado(false); }
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
  conectar();
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
if (cred) conectar(); else showEntrar();
setInterval(() => { renderDetalle(); sendPosition(); vaciarCola(); }, 1000);
})();
