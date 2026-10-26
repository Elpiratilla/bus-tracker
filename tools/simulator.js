// Simula sensores GPS de buses. Con el servidor encendido: npm run simulate (Node 18+)
// Cada bus va y regresa por su ruta en línea recta entre paradas y manda su posición cada TICK_S segundos.
// Velocidad normal:  npm run simulate          (20 km/h, tramos de 3 a 12 min)
// Más rápido:        SIM_SPEED_KMH=120 npm run simulate
// Por defecto saca 2 buses por ruta: uno empieza la ida y el otro el regreso (SIM_POR_RUTA=1 para uno solo)
// Unidad registrada en el panel:  SIM_BUS=U-XXXXXX SIM_KEY=go503_... SIM_ROUTE=101 npm run simulate
require("dotenv").config();
const { distanceM } = require("../src/geo");

// A la página publicada: SIM_API=https://go503.onrender.com/api npm run simulate
const API = process.env.SIM_API || `http://localhost:${process.env.PORT || 3000}/api`;
const TICK_S = 2;          // cada cuánto manda posición el sensor
const DWELL_TICKS = 10;    // mensajes que se queda quieto en cada parada (~20 s)
const NOISE = 0.00005;     // ~5 m de error de GPS
const SPEED_KMH = Number(process.env.SIM_SPEED_KMH) || 20; // velocidad típica de bus en ciudad

const KEY = process.env.SIM_KEY || process.env.BUS_API_KEY || "";
const post = (url, body) =>
  fetch(API + url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY }, body: JSON.stringify(body) })
    .then((r) => r.json());

const jitter = () => (Math.random() * 2 - 1) * NOISE;

// Lista de puntos (lat, lng) que recorre el bus: tramos interpolados + pausas en paradas
function buildPath(stops, speedKmh) {
  const path = [];
  stops.forEach((stop, i) => {
    for (let d = 0; d < DWELL_TICKS; d++) path.push(stop);
    const next = stops[i + 1];
    if (!next) return;
    const seconds = distanceM(stop, next) / (speedKmh / 3.6);
    const ticksPerSegment = Math.max(2, Math.round(seconds / TICK_S));
    for (let t = 1; t < ticksPerSegment; t++) {
      const p = t / ticksPerSegment;
      path.push({ lat: stop.lat + (next.lat - stop.lat) * p, lng: stop.lng + (next.lng - stop.lng) * p });
    }
  });
  return path;
}

// startAtReturn: empieza en la terminal donde arranca el regreso (para que haya bus en los dos sentidos)
function runBus(busId, route, speedKmh, startAtReturn = false) {
  // Ida completa y luego el regreso (sin repetir la terminal donde da la vuelta); al final vuelve a empezar
  const { ida, regreso } = route.directions;
  const sameStop = (a, b) => a && b && a.id === b.id;
  const loop = [...ida, ...(sameStop(ida.at(-1), regreso[0]) ? regreso.slice(1) : regreso)];
  if (sameStop(loop.at(-1), loop[0])) loop.pop(); // la terminal inicial ya está al principio
  loop.push(loop[0]);                              // y cierra la vuelta para seguir sin saltos
  const path = buildPath(loop, speedKmh).slice(0, -DWELL_TICKS);
  // la ida ocupa los primeros puntos; el regreso empieza con la pausa en su terminal
  let i = startAtReturn ? buildPath(ida, speedKmh).length - DWELL_TICKS : 0;
  let fuel = 70 + Math.random() * 25;  // baja poco a poco
  let temp = 86;                        // se mueve suave alrededor de 88 °C
  setInterval(async () => {
    const { lat, lng } = path[i];
    const prev = path[(i - 1 + path.length) % path.length];
    const moving = prev.lat !== lat || prev.lng !== lng;
    fuel = fuel <= 15 ? 95 : fuel - 0.02;
    temp += (88 - temp) * 0.1 + (Math.random() - 0.5) * 0.8;
    try {
      const res = await post("/telemetry", {
        busId,
        routeId: route.id,
        lat: lat + jitter(),
        lng: lng + jitter(),
        speed: moving ? Math.round(speedKmh * (0.85 + Math.random() * 0.3)) : 0,
        fuel: Math.round(fuel),
        engineTemp: Math.round(temp * 10) / 10,
        ignition: true,
      });
      if (res.error) console.error(`${busId}: ${res.error}`);
      if (res.position?.entered) console.log(`${busId} llegó a ${res.position.atStop}`);
    } catch (err) {
      console.error(`${busId}: ${err.message}`);
    }
    i = (i + 1) % path.length;
  }, TICK_S * 1000);
}

(async () => {
  const get = (url) => fetch(API + url).then((r) => r.json());
  const lista = await get("/rutas").catch(() => {
    console.error(`No hay servidor en ${API}. Enciéndelo primero con: npm run dev`);
    process.exit(1);
  });
  // Paradas de cada sentido, con coordenadas (GET /api/rutas/:id?sentido=)
  const sentido = (id, d) => get(`/rutas/${encodeURIComponent(id)}?sentido=${d}`)
    .then((r) => r.paradas.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })));
  const routes = await Promise.all(lista.map(async ({ ruta }) =>
    ({ id: ruta, directions: { ida: await sentido(ruta, "ida"), regreso: await sentido(ruta, "regreso") } })));
  if (process.env.SIM_BUS) {
    const route = routes.find((r) => r.id === process.env.SIM_ROUTE) || routes[0];
    runBus(process.env.SIM_BUS, route, SPEED_KMH);
    console.log(`Simulando ${process.env.SIM_BUS} en la ruta ${route.id} a ${SPEED_KMH} km/h...`);
    return;
  }
  const porRuta = process.env.SIM_POR_RUTA === "1" ? 1 : 2;
  routes.forEach((route) => {
    runBus(`BUS-${route.id}`, route, SPEED_KMH);
    if (porRuta === 2) runBus(`BUS-${route.id}B`, route, SPEED_KMH, true);
  });
  console.log(`Simulando ${porRuta} bus${porRuta === 2 ? "es" : ""} por ruta (${routes.map((r) => r.id).join(", ")}) a ${SPEED_KMH} km/h: `
    + (porRuta === 2 ? "uno arranca de ida y otro de regreso..." : "..."));
})();
