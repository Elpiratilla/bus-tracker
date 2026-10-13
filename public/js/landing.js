// go503: tablero en vivo de la portada (usa la misma API que el mapa)

const REFRESH_MS = 5000;
const $ = (id) => document.getElementById(id);
const minsTo = (iso) => Math.ceil((new Date(iso) - Date.now()) / 60000);

let current = null;
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

function render(data) {
  const { ruta, paradas, bus, actualizado } = data;
  const lastIdx = paradas.map((p) => Boolean(p.pasoA)).lastIndexOf(true);
  const next = paradas[lastIdx + 1];
  const hasBus = Boolean(bus) && lastIdx >= 0 && next;

  $("b-ruta").textContent = ruta;
  const title = $("h-ruta");
  if (title.textContent !== ruta) {
    title.textContent = ruta;
    title.classList.remove("is-new");
    void title.offsetWidth; // reinicia la animación
    title.classList.add("is-new");
  }
  const hacia = (data.sentidos || []).find((x) => x.id === data.sentido)?.destino;
  document.querySelector(".board__label").textContent = hacia ? `Va hacia ${hacia}. Su próxima parada:` : "Su próxima parada:";
  $("board-stop").textContent = hasBus ? next.nombre : paradas[0].nombre;

  // Minutos que faltan
  const eta = $("b-eta");
  eta.replaceChildren();
  if (hasBus && next.etaA) {
    const m = minsTo(next.etaA);
    if (m <= 0) eta.append(el("span", "board__num", "¡Ya viene!"));
    else eta.append(el("span", "board__num", String(m)), el("span", "board__unit", "min"));
  } else if (data.sinSenal) {
    const mins = Math.round((Date.now() - new Date(data.ultimaSenal)) / 60000);
    eta.append(el("span", "board__note", `El bus dejó de mandar señal hace ${mins} min. Mira otra ruta mientras tanto.`));
  } else {
    eta.append(el("span", "board__note", `Ahorita no viene ningún bus de la ${ruta} por aquí. Prueba con otra ruta.`));
  }

  // Línea de paradas
  const n = paradas.length - 1;
  const at = (i) => `${(i / n) * 100}%`;
  const stops = $("b-stops");
  stops.style.setProperty("--seg", `${100 / n}cqi`);
  stops.replaceChildren(...paradas.flatMap((p, i) => {
    const state = i <= lastIdx ? "done" : hasBus && i === lastIdx + 1 ? "next" : "todo";
    const dot = el("i", `strip__stop strip__stop--${state}`);
    dot.style.left = at(i);
    const name = el("span", `strip__name${state === "next" ? " strip__name--next" : ""}`, p.nombre);
    name.style.left = at(i);
    return [dot, name];
  }));

  const pos = hasBus ? Math.min(n, lastIdx + (bus.progreso || 0)) : 0;
  $("b-done").style.width = hasBus ? at(pos) : "0";
  const busEl = $("b-bus");
  busEl.hidden = !hasBus;
  busEl.style.left = at(pos);

  // Estado de la conexión
  const secs = Math.max(0, Math.round((Date.now() - new Date(actualizado)) / 1000));
  $("b-upd").textContent = hasBus ? (secs < 10 ? "En vivo ahorita" : `Lo vimos hace ${secs} s`)
    : data.sinSenal ? "Sin señal" : "Esperando que salga un bus";
  document.querySelector(".live").classList.toggle("live--off", !hasBus);
}

async function load() {
  try {
    render(await getJSON(`/api/rutas/${encodeURIComponent(current)}`));
  } catch {
    $("b-upd").textContent = "Se cayó la conexión. Volviendo a intentar…";
    document.querySelector(".live").classList.add("live--off");
  }
}

function select(ruta) {
  current = ruta;
  document.querySelectorAll("#b-routes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ruta === ruta)));
  // al cambiar de ruta el bus no debe "viajar" desde la posición de la otra
  const busEl = $("b-bus");
  busEl.style.transition = "none";
  $("b-done").style.transition = "none";
  load().then(() => requestAnimationFrame(() => { busEl.style.transition = ""; $("b-done").style.transition = ""; }));
  clearInterval(timer);
  timer = setInterval(load, REFRESH_MS);
}

async function init() {
  try {
    const rutas = await getJSON("/api/rutas");
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

init();
