// Simula sensores GPS de buses. Con el servidor encendido: npm run simulate (Node 18+)
// Cada bus avanza en línea recta entre paradas y manda su posición cada TICK_S segundos.
require("dotenv").config();

const API = `http://localhost:${process.env.PORT || 3000}/api`;
const TICK_S = 2;          // cada cuánto manda posición el sensor
const DWELL_TICKS = 3;     // mensajes que se queda quieto en cada parada
const NOISE = 0.00005;     // ~5 m de error de GPS

const post = (url, body) =>
  fetch(API + url, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": process.env.BUS_API_KEY || "" }, body: JSON.stringify(body) })
    .then((r) => r.json());

const jitter = () => (Math.random() * 2 - 1) * NOISE;

// Lista de puntos (lat, lng) que recorre el bus: tramos interpolados + pausas en paradas
function buildPath(stops, ticksPerSegment) {
  const path = [];
  stops.forEach((stop, i) => {
    for (let d = 0; d < DWELL_TICKS; d++) path.push(stop);
    const next = stops[i + 1];
    if (!next) return;
    for (let t = 1; t < ticksPerSegment; t++) {
      const p = t / ticksPerSegment;
      path.push({ lat: stop.lat + (next.lat - stop.lat) * p, lng: stop.lng + (next.lng - stop.lng) * p });
    }
  });
  return path;
}

function runBus(busId, route, secondsPerSegment) {
  const path = buildPath(route.stops, Math.round(secondsPerSegment / TICK_S));
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
  const route = routes.find((r) => r.id === "101");
  runBus("BUS-01", route, 20);
  runBus("BUS-02", route, 30);
  console.log("Simulando BUS-01 y BUS-02 en la ruta 101 con GPS...");
})();
