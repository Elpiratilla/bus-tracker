// Simula sensores GPS de buses. Con el servidor encendido: npm run simulate (Node 18+)
// Cada bus avanza en línea recta entre paradas y manda su posición cada TICK_S segundos.
// Velocidad normal:  npm run simulate          (20 km/h, tramos de 3 a 12 min)
// Más rápido:        SIM_SPEED_KMH=120 npm run simulate
require("dotenv").config();
const { distanceM } = require("../src/geo");

const API = `http://localhost:${process.env.PORT || 3000}/api`;
const TICK_S = 2;          // cada cuánto manda posición el sensor
const DWELL_TICKS = 10;    // mensajes que se queda quieto en cada parada (~20 s)
const NOISE = 0.00005;     // ~5 m de error de GPS
const SPEED_KMH = Number(process.env.SIM_SPEED_KMH) || 20; // velocidad típica de bus en ciudad

const post = (url, body) =>
  fetch(API + url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.BUS_API_KEY || "" }, body: JSON.stringify(body) })
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

function runBus(busId, route, speedKmh) {
  const path = buildPath(route.stops, speedKmh);
  let i = 0;
  setInterval(async () => {
    const { lat, lng } = path[i];
    try {
      const res = await post("/telemetry", {
        busId,
        routeId: route.id,
        lat: lat + jitter(),
        lng: lng + jitter(),
        speed: Math.round(20 + Math.random() * 40),
        fuel: Math.round(40 + Math.random() * 50),
        engineTemp: Math.round(80 + Math.random() * 15),
      });
      if (res.position?.entered) console.log(`${busId} llegó a ${res.position.atStop}`);
    } catch (err) {
      console.error(`${busId}: ${err.message}`);
    }
    i = (i + 1) % path.length;
  }, TICK_S * 1000);
}

(async () => {
  const routes = await fetch(API + "/routes").then((r) => r.json());
  routes.forEach((route) => runBus(`BUS-${route.id}`, route, SPEED_KMH));
  console.log(`Simulando un bus por ruta (${routes.map((r) => r.id).join(", ")}) a ${SPEED_KMH} km/h...`);
})();
