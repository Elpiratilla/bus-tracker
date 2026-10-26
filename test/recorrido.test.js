// Prueba del corazón del mapa, sin Supabase: con el GPS de un bus por la 101 se detecta el sentido,
// se guarda cuánto tardó cada tramo y se calculan las horas de llegada. Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");

delete process.env.SUPABASE_URL;
const store = require("../src/store");
const { handlePosition } = require("../src/tracking");
const { routeStatus } = require("../src/eta");

const BUS = "T-101";
store.units[BUS] = { busId: BUS, companyId: "empresa-1", routeId: "101" }; // solo los buses registrados guardan tramos
const route = store.routes.find((r) => r.id === "101");
const parada = (id) => route.stops.find((s) => s.id === id);
const MIN = 60000;
const t0 = Date.now() - 30 * MIN;
const gps = (point, min) => handlePosition(BUS, route, point, t0 + min * MIN);

test("sale de Terminal de Oriente y llega al Centro: va de ida y guarda el tramo", () => {
  gps(parada("t-ori"), 0);
  gps({ lat: 13.7060, lng: -89.1780 }, 1);   // salió de la terminal (entre las dos paradas)
  const r = gps(parada("centro"), 11);
  assert.equal(r.direction, "ida");
  const tramo = store.segments.get(store.legKey("101", "ida", "t-ori", "centro")).find((s) => s.busId === BUS);
  assert.equal(tramo.seconds, 600);            // cuenta desde que salió, no desde que llegó a la terminal
});

test("las horas de llegada van en orden, después de ahora", () => {
  const now = t0 + 12 * MIN;
  const { lastIdx, times } = routeStatus(route, "ida", now);
  assert.equal(lastIdx, 1);                    // va por el Centro Histórico
  for (let i = lastIdx + 1; i < times.length; i++) {
    assert.ok(times[i] > now);
    assert.ok(times[i] > times[i - 1]);
  }
});

test("si el bus deja de mandar señal, no se dan minutos de llegada", () => {
  // última señal en el minuto 11 (en el Centro); 9 minutos después sigue sin reportar
  store.buses[BUS] = { busId: BUS, routeId: "101", ...parada("centro"), updatedAt: t0 + 11 * MIN };
  const { lastIdx, times, sinSenal } = routeStatus(route, "ida", t0 + 20 * MIN);
  assert.equal(sinSenal, true);
  assert.ok(times.slice(lastIdx + 1).every((t) => t === null));
  delete store.buses[BUS];
});

test("si vuelve hacia Terminal de Oriente, cambia a regreso", () => {
  gps({ lat: 13.7060, lng: -89.1780 }, 13);
  const r = gps(parada("t-ori"), 22);
  assert.equal(r.direction, "regreso");
});
