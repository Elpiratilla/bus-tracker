// Prueba del encendido: un bus con sensor (sin app del motorista) sale del mapa cuando el motor
// lleva más de 5 min apagado, y vuelve al encenderlo. Sin Supabase (todo en memoria). Correr: npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

delete process.env.SUPABASE_URL;
delete process.env.BUS_API_KEY;
const store = require("../src/store");
const { hashKey } = require("../src/middleware/auth");

const BUS = "U-SENSOR1";
const CLAVE = "go503_clave_sensor";
store.units[BUS] = { busId: BUS, companyId: "empresa-1", name: "Bus 9", type: "autobus", routeId: "101",
  apiKeyHash: hashKey(CLAVE), odometerKm: 0, engineHours: 0, oilIntervalKm: 5000 };

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/telemetry", require("../src/routes/telemetry"));
  app.use("/api/buses", require("../src/routes/telemetry"));
  app.use("/api/motorista", require("../src/routes/motorista"));
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, body) => fetch(`${base}${url}`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-api-key": CLAVE },
  body: JSON.stringify({ busId: BUS, ...body }),
});
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
// El sensor en la Terminal de Oriente, con el motor encendido o apagado, hace X minutos
const sensor = (ignition, min = 0) => post("/api/telemetry", { lat: 13.7126, lng: -89.1643, ignition, ts: hace(min) });
const enMapa = async () => (await (await fetch(`${base}/api/buses`)).json()).some((b) => b.busId === BUS);

test("motor encendido: sale en el mapa", async () => {
  await sensor(true);
  assert.ok(await enMapa());
});

test("apagado hace 2 min: sigue en el mapa (lo apagaron un rato en la terminal)", async () => {
  await sensor(false, 2);
  assert.ok(await enMapa());
});

test("apagado hace más de 5 min: sale del mapa", async () => {
  store.buses[BUS].apagadoDesde = Date.now() - 6 * 60000;
  await sensor(false);
  assert.equal(await enMapa(), false);
});

test("si el motorista está en trayecto, sale aunque el motor esté apagado", async () => {
  await post("/api/motorista/viaje", { accion: "salir", sentido: "ida" });
  assert.ok(await enMapa());
  await post("/api/motorista/viaje", { accion: "terminar" });
  assert.equal(await enMapa(), false);
});

test("al otro día enciende el motor sin usar la app: vuelve a salir", async () => {
  await sensor(false); // queda apagado, con el Terminar de antes
  await sensor(true);
  assert.ok(await enMapa());
  assert.equal(store.buses[BUS].apagadoDesde, null);
});
