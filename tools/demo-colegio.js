// Demo del micro de colegio, todo en memoria (no toca Supabase). Sirve para enseñarlo en la calle.
//   node tools/demo-colegio.js            -> servidor con un micro y un enlace de familia listos
//   node tools/demo-colegio.js --manejar  -> además el micro hace solo el recorrido de la mañana
// Abre los enlaces que imprime: uno es la app del motorista y el otro lo que ve el papá.
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SECRET_KEY = "";
process.env.BUS_API_KEY = "";
process.env.RENDER = "";

const store = require("../src/store");
const { hashKey } = require("../src/middleware/auth");
const { startTrip } = require("../src/tracking");

const BUS = "U-DEMO01";
const CLAVE = "demo";
const TOKEN = "demo";
const ROUTE = "C-DEMO01";
// Casas en la Escalón y el colegio (aproximadas)
const PARADAS = [
  ["Esquina Col. Escalón", 13.7046, -89.2449],
  ["Paseo General Escalón", 13.7010, -89.2380],
  ["Redondel Masferrer", 13.7065, -89.2330],
  ["Colegio", 13.7085, -89.2265],
];

const stops = PARADAS.map(([name, lat, lng], i) => ({ id: `demo-${i}`, name, lat, lng }));
store.routes.push({ id: ROUTE, name: "Micro Lupita", type: "microbus", companyId: "demo", stops,
  directions: { ida: stops, regreso: [...stops].reverse() } });
store.units[BUS] = { busId: BUS, companyId: "demo", name: "Micro Lupita", type: "microbus", routeId: ROUTE,
  apiKeyHash: hashKey(CLAVE), odometerKm: 0, engineHours: 0, oilIntervalKm: 5000 };
store.familyLinks.set(hashKey(TOKEN), { id: 1, busId: BUS, label: "Familia de prueba", createdAt: new Date().toISOString() });

require("../src/server");

const port = process.env.PORT || 3000;
console.log(`\nApp del motorista: http://localhost:${port}/motorista.html#u=${BUS}&k=${CLAVE}`);
console.log(`Vista de la familia: http://localhost:${port}/familia.html#t=${TOKEN}\n`);

if (process.argv.includes("--manejar")) {
  const { handlePosition } = require("../src/tracking");
  const route = store.routes.find((r) => r.id === ROUTE);
  const STEPS = 20; // puntos entre cada parada
  const path = stops.slice(1).flatMap((to, i) => Array.from({ length: STEPS }, (_, k) => ({
    lat: stops[i].lat + ((to.lat - stops[i].lat) * (k + 1)) / STEPS,
    lng: stops[i].lng + ((to.lng - stops[i].lng) * (k + 1)) / STEPS,
  })));
  let i = 0;
  const salir = () => {
    i = 0;
    startTrip(BUS, route, "ida", Date.now());
    store.buses[BUS] = { busId: BUS, routeId: ROUTE, enServicio: true, sentido: "ida", servicioDesde: Date.now(),
      ...stops[0], updatedAt: Date.now() };
  };
  salir();
  setInterval(() => {
    if (i >= path.length) return salir(); // al llegar al colegio vuelve a empezar
    const p = path[i++];
    const now = Date.now();
    const position = handlePosition(BUS, route, p, now);
    Object.assign(store.buses[BUS], { ...p, atStop: position.atStop, updatedAt: now });
  }, 2000);
  console.log("El micro va manejando solo (un punto cada 2 s).");
}
