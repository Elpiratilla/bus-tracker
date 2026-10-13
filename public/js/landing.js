// go503: tablero en vivo de la portada (usa la misma API que el mapa)

const REFRESH_MS = 5000;
const $ = (id) => document.getElementById(id);
const minsTo = (iso) => Math.ceil((new Date(iso) - Date.now()) / 60000);

let current = null;
let lastProgress = null;

// Cambia un texto y, si es distinto, lo hace voltear como letrero de destino
function flip(node, text) {
  if (node.textContent === text) return;
  node.textContent = text;
  node.classList.remove("flap");
  void node.offsetWidth;
  node.classList.add("flap");
}
let timer = null;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

const hhmm = (iso) => new Date(iso).toLocaleTimeString((window.go503Idioma?.locale || "es-SV"), { hour: "numeric", minute: "2-digit" });

// Lo que la persona escogió: sentido (null = el del bus más reciente) y su parada en cada ruta
let rutas = [];
let sentido = null;
let stopsKey = "";
const myStop = {
  get: (ruta) => { try { return localStorage.getItem(`go503-parada-${ruta}`); } catch { return null; } },
  set: (ruta, id) => { try { id ? localStorage.setItem(`go503-parada-${ruta}`, id) : localStorage.removeItem(`go503-parada-${ruta}`); } catch {} },
};

let lastData = null;
function render(data) {
  lastData = data;
  const { ruta, paradas, bus, actualizado } = data;
  const lastIdx = paradas.map((p) => Boolean(p.pasoA)).lastIndexOf(true);
  const next = paradas[lastIdx + 1];
  const hasBus = Boolean(bus) && lastIdx >= 0 && next;

  // La parada que se muestra: la que escogiste o, si no, la siguiente del bus
  const mineId = myStop.get(ruta);
  const mineIdx = paradas.findIndex((p) => String(p.id) === mineId);
  const targetIdx = mineIdx >= 0 ? mineIdx : hasBus ? lastIdx + 1 : 0;
  const target = paradas[targetIdx];

  $("b-ruta").textContent = ruta;
  const title = $("h-ruta");
  if (title.textContent !== ruta) {
    title.textContent = ruta;
    title.setAttribute("aria-label", `Ruta ${ruta}. Toca para cambiar de ruta`);
    title.classList.remove("is-new");
    void title.offsetWidth; // reinicia la animación
    title.classList.add("is-new");
  }
  const hacia = (data.sentidos || []).find((x) => x.id === data.sentido)?.destino;
  document.querySelector(".board__label").textContent = mineIdx >= 0
    ? (hacia ? `Tu parada, yendo hacia ${hacia}:` : "Tu parada:")
    : (hacia ? `Va hacia ${hacia}. Su próxima parada:` : "Su próxima parada:");
  flip($("board-stop"), target.nombre);

  // Sentido: "Hacia Zona Rosa" / "Hacia Terminal de Oriente"
  const dir = $("b-dir");
  dir.hidden = !(data.sentidos?.length > 1);
  if (!dir.hidden && dir.dataset.ruta !== ruta) {
    dir.dataset.ruta = ruta;
    dir.replaceChildren(...data.sentidos.map((x) => {
      const b = el("button", null, `Hacia ${x.destino}`);
      b.type = "button";
      b.dataset.sentido = x.id;
      b.addEventListener("click", () => { sentido = x.id; select(current, { keepDir: true }); });
      return b;
    }));
  }
  dir.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sentido === data.sentido)));

  // Minutos que faltan para la parada que se muestra
  const eta = $("b-eta");
  const before = eta.textContent;
  eta.replaceChildren();
  if (hasBus && targetIdx <= lastIdx && target.pasoA) {
    eta.append(el("span", "board__note", `El bus ya pasó por aquí a las ${hhmm(target.pasoA)}. Toca otra parada o cambia de sentido.`));
  } else if (hasBus && target.etaA) {
    const m = minsTo(target.etaA);
    if (m <= 0) eta.append(el("span", "board__num board__num--now", "¡Ya viene!"));
    else eta.append(el("span", "board__num", String(m)), el("span", "board__unit", "min"));
  } else if (data.sinSenal) {
    const mins = Math.round((Date.now() - new Date(data.ultimaSenal)) / 60000);
    eta.append(el("span", "board__note", `El bus dejó de mandar señal hace ${mins} min. Mira otra ruta mientras tanto.`));
  } else {
    eta.append(el("span", "board__note", `Ahorita no viene ningún bus de la ${ruta} por aquí. Prueba con otra ruta o el otro sentido.`));
  }
  // los minutos voltean solo cuando cambian
  if (eta.textContent !== before) eta.firstChild.classList.add("flap");

  // Línea de paradas: cada nombre es un botón para escoger tu parada.
  // Solo se vuelven a crear si cambia la ruta o el sentido (así no se pierde el foco del teclado).
  const n = paradas.length - 1;
  const at = (i) => `${(i / n) * 100}%`;
  const stops = $("b-stops");
  const key = `${ruta}|${data.sentido}|${paradas.map((p) => p.id).join(",")}`;
  if (key !== stopsKey) {
    stopsKey = key;
    stops.style.setProperty("--seg", `${100 / n}cqi`);
    stops.replaceChildren(...paradas.flatMap((p, i) => {
      const dot = el("i", "strip__stop");
      dot.setAttribute("aria-hidden", "true");
      dot.style.left = at(i);
      const name = el("button", "strip__name", p.nombre);
      name.type = "button";
      name.style.left = at(i);
      const pick = () => {
        const id = String(p.id);
        myStop.set(ruta, myStop.get(ruta) === id ? null : id); // tocarla otra vez la quita
        $("b-hint").hidden = true;
        render(lastData);
      };
      name.addEventListener("click", pick);
      dot.addEventListener("click", pick); // en el teléfono los nombres del medio se esconden: el punto también sirve
      return [dot, name];
    }));
  }
  const dots = stops.querySelectorAll(".strip__stop");
  const names = stops.querySelectorAll(".strip__name");
  paradas.forEach((p, i) => {
    const state = i <= lastIdx ? "done" : hasBus && i === lastIdx + 1 ? "next" : "todo";
    dots[i].className = `strip__stop strip__stop--${state}${i === mineIdx ? " strip__stop--mine" : ""}`;
    names[i].className = `strip__name${state === "next" ? " strip__name--next" : ""}${i === mineIdx ? " strip__name--mine" : ""}`;
    names[i].setAttribute("aria-pressed", String(i === mineIdx));
  });
  $("b-hint").hidden = mineIdx >= 0 || $("b-hint").hidden;

  const pos = hasBus ? Math.min(n, lastIdx + (bus.progreso || 0)) : 0;
  $("b-done").style.width = hasBus ? at(pos) : "0";
  const busEl = $("b-bus");
  busEl.hidden = !hasBus;
  // rebota mientras avanza; quieto si sigue en el mismo punto (detenido en la parada)
  const progress = hasBus ? pos : null;
  busEl.classList.toggle("is-moving", hasBus && lastProgress != null && progress !== lastProgress);
  lastProgress = progress;
  busEl.style.left = at(pos);

  // Los botones de la portada abren el mapa en esta misma ruta y sentido
  const q = `?ruta=${encodeURIComponent(ruta)}&sentido=${data.sentido}`;
  $("cta-mapa").href = `/mapa.html${q}`;
  $("cta-aviso").href = `/mapa.html${q}`;

  // Estado de la conexión
  const secs = Math.max(0, Math.round((Date.now() - new Date(actualizado)) / 1000));
  $("b-upd").textContent = hasBus ? (secs < 10 ? "En vivo ahorita" : secs < 60 ? `Lo vimos hace ${secs} s` : `Lo vimos hace ${Math.round(secs / 60)} min`)
    : data.sinSenal ? "Sin señal" : "Esperando que salga un bus";
  document.querySelector(".live").classList.toggle("live--off", !hasBus);
}

async function load() {
  try {
    const q = sentido ? `?sentido=${sentido}` : "";
    render(await getJSON(`/api/rutas/${encodeURIComponent(current)}${q}`));
  } catch {
    $("b-upd").textContent = "Se cayó la conexión. Volviendo a intentar…";
    document.querySelector(".live").classList.add("live--off");
  }
}

function select(ruta, { keepDir = false } = {}) {
  if (!keepDir) sentido = null; // otra ruta: el sentido vuelve a ser automático
  current = ruta;
  lastProgress = null;
  document.querySelectorAll("#b-routes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ruta === ruta)));
  // al cambiar de ruta o sentido el bus no debe "viajar" desde la posición anterior
  const busEl = $("b-bus");
  busEl.style.transition = "none";
  $("b-done").style.transition = "none";
  load().then(() => requestAnimationFrame(() => { busEl.style.transition = ""; $("b-done").style.transition = ""; }));
  clearInterval(timer);
  timer = setInterval(load, REFRESH_MS);
}

// El número del titular también cambia de ruta: cada toque pasa a la siguiente
$("h-ruta").addEventListener("click", () => {
  if (!rutas.length) return;
  const i = rutas.findIndex((r) => r.ruta === current);
  select(rutas[(i + 1) % rutas.length].ruta);
});

async function init() {
  try {
    rutas = await getJSON("/api/rutas");
    $("b-routes").replaceChildren(...rutas.map((r) => {
      const b = el("button", null, r.ruta);
      b.type = "button";
      b.dataset.ruta = r.ruta;
      b.setAttribute("aria-label", `Ruta ${r.ruta}`);
      b.addEventListener("click", () => select(r.ruta));
      return b;
    }));
    // Empezar por una ruta que tenga un bus en movimiento
    const datos = await Promise.all(rutas.map((r) => getJSON(`/api/rutas/${encodeURIComponent(r.ruta)}`).catch(() => null)));
    const conBus = rutas.find((r, i) => datos[i]?.bus);
    select((conBus || rutas[0]).ruta);
  } catch {
    $("board-stop").textContent = "No pudimos conectarnos";
    $("b-upd").textContent = "Recarga la página en un ratito";
    document.querySelector(".live").classList.add("live--off");
  }
}

// Modo claro / oscuro (se guarda igual que en el mapa)
const root = document.documentElement;
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches);
function applyTheme() {
  const dark = isDark();
  const btn = $("tema");
  btn.setAttribute("aria-checked", String(dark));
  btn.title = dark ? "Pasar a modo claro" : "Pasar a modo oscuro";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0E1438" : "#F3F5FB";
}
$("tema").addEventListener("click", () => {
  const change = () => {
    root.dataset.theme = isDark() ? "light" : "dark";
    try { localStorage.setItem("go503-tema", root.dataset.theme); } catch {}
    applyTheme();
  };
  // fundido suave entre modos si el navegador lo soporta
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(change);
  else change();
});
darkQuery.addEventListener("change", () => { if (!root.dataset.theme) applyTheme(); });
applyTheme();

// ---------- Lo que lleva cada bus ----------
// x, y: dónde va el punto sobre el dibujo (en % del ancho y alto). Datos de firmware/README.md
const PIEZAS = {
  caja: { x: 84, y: 46, nombre: "La cajita go503",
    mide: "Ubicación, velocidad y rumbo del bus, cada 5 segundos mientras va en marcha.",
    instala: "Detrás del tablero, en una caja plástica sellada contra el agua y el polvo.",
    panel: "Unidad 7 va a 34 km/h por Metrocentro" },
  antena: { x: 74.2, y: 11.9, nombre: "Antenas de GPS y 4G",
    mide: "El GPS ubica el bus y el 4G manda los datos con un chip de Claro, Tigo o Digicel.",
    instala: "Bajo el techo de fibra o sobre el tablero, con vista al cielo.",
    panel: "Última señal hace 4 s" },
  bateria: { x: 11.1, y: 74.1, nombre: "Conexión a la batería",
    mide: "Le da corriente al sensor, aun con el bus apagado. Consume como 0.1 A.",
    instala: "Al positivo permanente de la batería, con fusible y protección contra los picos del alternador.",
    panel: "Estacionada, reporta cada 10 min" },
  obd: { x: 90, y: 66, nombre: "Conector OBD-II",
    mide: "Temperatura del motor, combustible, horas de motor y códigos de falla, de la computadora del bus.",
    instala: "Se enchufa al conector de diagnóstico bajo el tablero. No se corta ningún cable.",
    panel: "Motor 88 °C, combustible 70 %" },
  encendido: { x: 79, y: 66, nombre: "Switch de encendido",
    mide: "Si el motor está encendido, para contar las horas de motor y avisar del cambio de aceite.",
    instala: "Un cable al switch, con un divisor que protege al sensor del voltaje del bus.",
    panel: "Aceite: faltan 820 km", nivel: "aviso" },
  radiador: { x: 95.5, y: 71, nombre: "Manguera del radiador",
    mide: "La temperatura de la manguera de salida, para avisarte si el motor se calienta.",
    instala: "Un sensor a prueba de agua, sujeto a la manguera con una abrazadera.",
    panel: "Alerta: motor a 105 °C", nivel: "alerta" },
  tanque: { x: 49.3, y: 81.1, nombre: "Flotador del tanque",
    mide: "El nivel de combustible, con el mismo cable que ya va al medidor.",
    instala: "Se lee el voltaje del cable sin desconectar el medidor del tablero.",
    panel: "Combustible al 15 %", nivel: "aviso" },
};
const MODOS = { obd: ["caja", "antena", "obd", "bateria"], viejo: ["caja", "antena", "radiador", "tanque", "encendido", "bateria"] };
const kit = $("sensor");
let pieza = "caja";

function pintarKit(modo, animar) {
  kit.dataset.modo = modo;
  kit.querySelectorAll("[data-modo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === modo)));
  if (!MODOS[modo].includes(pieza)) pieza = "caja";
  const spots = $("kit-spots");
  const parts = $("kit-parts");
  spots.replaceChildren();
  parts.replaceChildren();
  MODOS[modo].forEach((id, i) => {
    const p = PIEZAS[id];
    const dot = el("button", "kit__spot");
    dot.type = "button";
    dot.dataset.pieza = id;
    dot.setAttribute("aria-label", p.nombre);
    dot.title = p.nombre;
    dot.style.left = p.x + "%";
    dot.style.top = p.y + "%";
    dot.style.animationDelay = animar ? `${i * 60}ms` : "0ms";
    spots.append(dot);
    const name = el("button", null, p.nombre);
    name.type = "button";
    name.dataset.pieza = id;
    parts.append(name);
  });
  verPieza(pieza, false);
}

function verPieza(id, animar) {
  pieza = id;
  const p = PIEZAS[id];
  kit.querySelectorAll("[data-pieza]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pieza === id)));
  $("kit-nombre").textContent = p.nombre;
  $("kit-mide").textContent = p.mide;
  $("kit-instala").textContent = p.instala;
  const panel = $("kit-panel");
  panel.textContent = p.panel;
  panel.className = p.nivel ? `is-${p.nivel}` : "";
  if (!animar) return;
  const info = kit.querySelector(".kit__info");
  info.classList.remove("is-new");
  void info.offsetWidth;
  info.classList.add("is-new");
}

kit.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.modo && b.getAttribute("aria-pressed") !== "true") pintarKit(b.dataset.modo, true);
  else if (b.dataset.pieza && b.dataset.pieza !== pieza) verPieza(b.dataset.pieza, true);
});
pintarKit("obd", false);

// Animaciones al bajar: se activan cuando la sección aparece en pantalla (una sola vez)
const reveal = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("is-visible");
    io.unobserve(e.target);
  }), { threshold: 0.35 });
  reveal.forEach((n) => io.observe(n));
} else {
  reveal.forEach((n) => n.classList.add("is-visible"));
}

// ---------- Pedir el sensor ----------
const pedir = $("f-pedir");
pedir.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("pedir-enviar");
  const err = $("pedir-error");
  pedir.querySelectorAll(".field.is-bad").forEach((f) => f.classList.remove("is-bad"));
  err.hidden = true;
  const body = Object.fromEntries(new FormData(pedir));
  // revisión rápida antes de enviar (el servidor revisa igual)
  const bad = !body.nombre.trim() ? "nombre" : body.telefono.replace(/\D/g, "").length < 7 ? "telefono" : null;
  if (bad) return markBad(bad, bad === "nombre" ? "Escribe tu nombre" : "Escribe un teléfono válido, por ejemplo 7123-4567");

  btn.setAttribute("aria-busy", "true");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return markBad(data.campo, data.error || "No pudimos enviar tu solicitud. Intenta de nuevo.");
    const nombre = body.nombre.trim().split(" ")[0];
    $("pedir-gracias").textContent = `¡Listo, ${nombre}!`;
    $("pedir-detalle").textContent = `Te escribimos al ${body.telefono.trim()} en menos de un día hábil para cotizar${body.unidades ? ` tus ${body.unidades} unidades` : ""}.`;
    $("pedir-campos").hidden = true;
    $("pedir-listo").hidden = false;
    $("pedir-listo").focus();
  } catch {
    markBad(null, "Se cayó la conexión. Revisa tu internet e intenta de nuevo.");
  } finally {
    btn.removeAttribute("aria-busy");
    btn.disabled = false;
    btn.textContent = "Enviar solicitud";
  }
});
function markBad(campo, texto) {
  const err = $("pedir-error");
  err.textContent = texto;
  err.hidden = false;
  const input = campo && pedir.elements[campo];
  if (input) { input.closest(".field").classList.add("is-bad"); input.focus(); }
}
pedir.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("is-bad"));
$("pedir-otra").addEventListener("click", () => {
  pedir.reset();
  $("pedir-listo").hidden = true;
  $("pedir-campos").hidden = false;
  $("p-nombre").focus();
});

init();
