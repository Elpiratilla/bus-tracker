// Prueba de las dos claves de una unidad: la del sensor y la de la app del motorista.
// Cada una sirve sola, así cambiar una no deja sin funcionar a la otra. Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

delete process.env.SUPABASE_URL;
delete process.env.BUS_API_KEY;
const store = require("../src/store");
const { hashKey } = require("../src/middleware/auth");

const BUS = "U-CLAVES";
const SENSOR = "go503_clave_sensor";
const MOTORISTA = "go503_clave_motorista";
store.units[BUS] = { busId: BUS, companyId: "empresa-1", name: "Bus 3", type: "autobus", routeId: "42",
  apiKeyHash: hashKey(SENSOR), driverKeyHash: hashKey(MOTORISTA), odometerKm: 0, engineHours: 0, oilIntervalKm: 5000 };

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/telemetry", require("../src/routes/telemetry"));
  app.use("/api/motorista", require("../src/routes/motorista"));
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, clave, body = {}) => fetch(`${base}${url}`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-api-key": clave },
  body: JSON.stringify({ busId: BUS, ...body }),
}).then((r) => r.status);

test("la clave del motorista abre su app y manda ubicación", async () => {
  assert.equal(await post("/api/motorista/estado", MOTORISTA), 200);
  assert.equal(await post("/api/telemetry", MOTORISTA, { lat: 13.7415, lng: -89.2145 }), 201);
});

test("la clave del sensor sigue funcionando aparte", async () => {
  assert.equal(await post("/api/telemetry", SENSOR, { lat: 13.7415, lng: -89.2145 }), 201);
});

test("una clave cualquiera no entra", async () => {
  assert.equal(await post("/api/motorista/estado", "go503_otra"), 401);
  assert.equal(await post("/api/telemetry", "", { lat: 13.7415, lng: -89.2145 }), 401);
});

test("al cambiar la clave del sensor, el enlace del motorista sigue sirviendo", async () => {
  store.units[BUS].apiKeyHash = hashKey("go503_sensor_nueva");
  assert.equal(await post("/api/telemetry", SENSOR, { lat: 13.7415, lng: -89.2145 }), 401);
  assert.equal(await post("/api/motorista/estado", MOTORISTA), 200);
});
