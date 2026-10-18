// Recorridos: una vuelta completa por GPS queda grabada; una vuelta que no empezó en la terminal, no.
// Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");

delete process.env.SUPABASE_URL;
const store = require("../src/store");
const { handlePosition } = require("../src/tracking");
const { simplify, validPoints, setShape } = require("../src/trazos");

const route = store.routes.find((r) => r.id === "101");
// las vueltas solo se graban de unidades registradas (no del bus de la demo)
store.units["T-TRAZO"] = { busId: "T-TRAZO", name: "Unidad prueba" };
store.units["T-MEDIA"] = { busId: "T-MEDIA", name: "Unidad media" };
const stops = route.directions.ida;
const MIN = 60000;

// Puntos cada ~100 m entre dos paradas (como el GPS cada pocos segundos)
function camino(a, b, n = 12) {
  return Array.from({ length: n - 1 }, (_, i) => ({ lat: a.lat + ((b.lat - a.lat) * (i + 1)) / n, lng: a.lng + ((b.lng - a.lng) * (i + 1)) / n }));
}

test("una vuelta de la primera a la última parada queda grabada", () => {
  const BUS = "T-TRAZO";
  let t = Date.now() - 60 * MIN;
  handlePosition(BUS, route, stops[0], t);
  for (let i = 0; i < stops.length - 1; i++) {
    for (const p of camino(stops[i], stops[i + 1])) handlePosition(BUS, route, p, (t += 20000));
    handlePosition(BUS, route, stops[i + 1], (t += 20000));
  }
  const rec = store.recordings.find((r) => r.busId === BUS);
  assert.ok(rec, "se grabó la vuelta");
  assert.equal(rec.dir, "ida");
  assert.deepEqual(rec.points[0], [stops[0].lat, stops[0].lng]);
  assert.deepEqual(rec.points.at(-1), [stops.at(-1).lat, stops.at(-1).lng]);
  assert.ok(rec.endedAt > rec.startedAt);
});

test("el bus de la demo (sin registrar) no graba vueltas", () => {
  const BUS = "T-DEMO";
  let t = Date.now() - 90 * MIN;
  handlePosition(BUS, route, stops[0], t);
  for (let i = 0; i < stops.length - 1; i++) handlePosition(BUS, route, stops[i + 1], (t += 5 * MIN));
  assert.equal(store.recordings.some((r) => r.busId === BUS), false);
});

test("si el bus arranca a media ruta, no se graba (la vuelta no está completa)", () => {
  const BUS = "T-MEDIA";
  let t = Date.now() - 30 * MIN;
  handlePosition(BUS, route, stops[2], t);
  for (let i = 2; i < stops.length - 1; i++) {
    for (const p of camino(stops[i], stops[i + 1])) handlePosition(BUS, route, p, (t += 20000));
    handlePosition(BUS, route, stops[i + 1], (t += 20000));
  }
  assert.equal(store.recordings.some((r) => r.busId === BUS), false);
});

test("simplificar quita los puntos que van en línea recta", () => {
  const recta = Array.from({ length: 50 }, (_, i) => [13.70 + i * 0.0001, -89.20]);
  assert.equal(simplify(recta).length, 2);
  const esquina = [[13.70, -89.20], [13.701, -89.20], [13.701, -89.199]];
  assert.equal(simplify(esquina).length, 3);
});

test("los puntos del panel se revisan: fuera de El Salvador o muy pocos, no", () => {
  assert.equal(validPoints([[13.7, -89.2]]), null);
  assert.equal(validPoints([[40.7, -74.0], [40.8, -74.1]]), null);
  assert.deepEqual(validPoints([[13.71234567, -89.2], [13.72, -89.21]]), [[13.712346, -89.2], [13.72, -89.21]]);
});

test("el mapa público recibe el trazo guardado", async () => {
  setShape("101", "ida", [[13.7126, -89.1643], [13.7, -89.2], [13.6935, -89.2362]], "dibujado");
  const express = require("express");
  const app = express().use("/r", require("../src/routes/rutas"));
  const server = app.listen(0);
  const { port } = server.address();
  const data = await (await fetch(`http://localhost:${port}/r/101?sentido=ida`)).json();
  server.close();
  assert.equal(data.trazo.length, 3);
});
