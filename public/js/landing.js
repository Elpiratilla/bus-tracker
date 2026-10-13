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
