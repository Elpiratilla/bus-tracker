// go503: el bus dibujado con las piezas del sensor (sensor.html)
(() => {
const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

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

})();
